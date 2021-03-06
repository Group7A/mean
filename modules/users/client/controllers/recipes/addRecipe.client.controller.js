(function () {
  'use strict';

  angular
    .module('users')
    .controller('AddRecipeController', AddRecipeController);

  AddRecipeController.$inject = ['UsersService', 'TransferService', '$scope', '$http', 
    'Authentication', 'Notification', '$location', '$state', '$stateParams'];

  function AddRecipeController(UsersService, TransferService, $scope, $http, 
      Authentication, Notification, $location, $state, $stateParams) {
    var vm = this;

    vm.user = Authentication.user;
    vm.updateMyRecipes = updateMyRecipes;
    vm.getImage = getImage;

    // Initialize recipe, and ingredients, directions lists
    $scope.ingredientList = [{}];
    $scope.directionsList = [{}];

    // If coming from alternatives state, get the data from there
    if($state.previous.state.name == "alternatives") {
       $scope.recipe = $stateParams.recipe;
       $scope.recipe.editAfterAdd = true;
       $scope.ingredientList = $scope.recipe.ingredients;
       $scope.directionsList = $scope.recipe.directionsList;
    }
    else { // Else, initialize everything to be empty
      $scope.ingredientList = [{}];
      $scope.directionsList = [{}];

      $scope.recipe = {
        'name': '',
        'cookingStyle': '',
        'time':'',
        'healthClassifications': {
          'glutenFree': false,
          'noSugar': false,
          'lowFat': false,
          'vegan': false,
          'lowCalorie': false
        },
        'ingredients': [{
          'name': '',
          'quantity': '',
          'units': ''
        }],
        'directionsList': [{
          'directions': ''
        }],
        'review': [{
          'writtenReview': '',
          'rating': '',
          'reviewedBy': vm.user.displayName
        }],
        'ownedBy': vm.user.displayName
      };
    }

    // Get image of recipe from Bing web search API
    async function getImage() {
      let subscriptionKey = '6e4bbfc395054217a71390d8b08ff40b';
      let host = 'https://api.cognitive.microsoft.com';
      let path = '/bing/v7.0/search';
      let search = $scope.recipe.name + ' food';

      let req = {
          method : 'GET',
          url: host + path + '?q=' + encodeURIComponent(search),
          headers : {
              'Ocp-Apim-Subscription-Key' : subscriptionKey,
          }
      };

      await $http(req)
        .then( (response) => {
          if(response.data.images) {
            $scope.image = response.data.images.value[0].contentUrl;
          }
        })
        .catch( (err) => {
          console.log(err);
        });
    }

    // Add recipe to mongo
    function updateMyRecipes(isValid) {
      // Get recipe and image, as well as alternatives to send to next page
      var recipe = $scope.recipe;
      recipe.image = $scope.image;
      getAlternatives();

      if (!isValid) {
        $scope.$broadcast('show-errors-check-validity', 'vm.addRecipeForm');
        return false;
      }

      // If coming from alternatives, update the recipe user just added
      if($state.previous.state.name == "alternatives") {
        UsersService.updateMyRecipe(recipe)
          .then(updateSuccess)
          .catch(updateFailure);
      }
      else UsersService.addRecipe(recipe) // If coming here for the first time, just add recipe
            .then(addSuccess)
            .catch(addFailure);

      // Send notification and get id of recipe
      function addSuccess(response) {
        Notification.success({ message: '<i class="glyphicon glyphicon-ok"></i> Add recipe successful!' });
        recipe._id = response._id;
      }

      function addFailure(response) {
        Notification.error({ message: '<i class="glyphicon glyphicon-remove"></i> Add recipe failed!' })
      }

      // Send notification and get id of recipe
      function updateSuccess(response) {
        Notification.success({ message: '<i class="glyphicon glyphicon-ok"></i> Update recipe successful!' });
        recipe._id = response._id;
      }

      function updateFailure(response) {
        Notification.error({ message: '<i class="glyphicon glyphicon-remove"></i> Update recipe failed!' })
      }

      // Get data to transfer to the alternatives page
      var transferData = {
        'recipe': recipe,
        'healthy_map': $scope.healthy_map,
        'truest_map': $scope.truest_map,
        'multiple_map': $scope.multiple_map
      };

      $state.go('alternatives', transferData);
    }

    // Sort alternative ingredients
    async function sort_alt() {
      await $http.get('./modules/users/client/controllers/recipes/food_alternatives.json')
        .then ((response) => {
          $scope.alt_food_object = response.data;

          $scope.alt_food_object.cooking_methods.forEach((cooking_method, i) => {
            cooking_method.food_groups.forEach( (food_group, j) => {
              food_group.food_alts.sort(function(a, b) {
                var nut_valA = a.db_main_nutrient.db_amount;
                var nut_valB = b.db_main_nutrient.db_amount;
                if(nut_valA < nut_valB){
                  return 1;
                }
                else if(nut_valA > nut_valB){
                  return -1;
                }	
                else{
                  return 0;
                }
              });
            });
          });
        });
    }

    sort_alt();

    // Get alternatives from recipe
    function getAlternatives() {
      // Initialize variables
      $scope.healthy_map = [];
      $scope.truest_map = [];
      $scope.multiple_map = [];
      $scope.in_food_group;
      $scope.orig_nutrient_amount;
      $scope.all_alt_in_group = [];
      $scope.have_match = 0;
      $scope.top_alt_count = 3;
      $scope.mid_ind;

      // Get alternatives
      $scope.recipe.ingredients.forEach( (ingredient, x) => {
        $scope.alt_food_object.cooking_methods.forEach( (cooking_method, i) => {
          cooking_method.food_groups.forEach( (food_group, j) => {
            food_group.food_alts.forEach( (food_alt, k) => {           
              if((food_alt.db_name.toLowerCase() == ingredient.name.toLowerCase()) && ($scope.recipe.cookingStyle == cooking_method.method_name)){
                $scope.have_match = 1;
              }
              else if ((food_alt.db_name != ingredient.name) && ($scope.have_match == 1)){
                $scope.all_alt_in_group.push(food_alt);
              }			
            });
            $scope.have_match = 0;
          });
        });
        
        // Loop through all the alternatives
        if($scope.all_alt_in_group.length > 0) {
          // Map for healthiest alternatives
          var alt_item = $scope.all_alt_in_group[$scope.all_alt_in_group.length-1];
          $scope.healthy_map.push({"map_ndbno": alt_item.db_ndbno, "map_name": alt_item.db_name, "nutrient": alt_item.db_main_nutrient.db_amount, "flipped": false});

          // Map for truest to taste/nutrionally closest recipes
          var alt_item = $scope.all_alt_in_group[0];
          $scope.truest_map.push({"map_ndbno": alt_item.db_ndbno, "map_name": alt_item.db_name, "nutrient": alt_item.db_main_nutrient.db_amount, "flipped": false});
        
          // Map for 3 alternatives, for the customizing page
          if($scope.all_alt_in_group.length < $scope.top_alt_count){
            var alts = [];
            $scope.all_alt_in_group.forEach((alt_item, i) => {
              alts.push({
                "map_ndbno": alt_item.db_ndbno, 
                "map_name": alt_item.db_name, 
                "nutrient": alt_item.db_main_nutrient.db_amount, 
                "flipped": false
              });
            });

            $scope.multiple_map.push(alts);
          }
          else{
            // Control what alt we give
            $scope.mid_ind = $scope.all_alt_in_group.length / 2;

            // Index is not whole number
            if($scope.mid_ind % 1 != 0){
              $scope.mid_ind = $scope.mid_ind - 0.5;
            }

            var alts = [];

            $scope.all_alt_in_group.forEach((alt_item, i) => {
              if(i==0 || i==$scope.mid_ind || i==$scope.all_alt_in_group.length-1){
                alts.push({"map_ndbno": alt_item.db_ndbno, "map_name": alt_item.db_name, "nutrient": alt_item.db_main_nutrient.db_amount, "flipped": false});
              }
            });

            $scope.multiple_map.push(alts);
          }	
        }
        else { // If no alternatives available, send this to the map
          $scope.healthy_map.push({"map_name": 'No alternatives available'});
          $scope.truest_map.push({"map_name": 'No alternatives available'});
          $scope.multiple_map.push({"map_name": 'No alternatives available'});
        }

        // Empty array for next alternatives
        while($scope.all_alt_in_group.length > 0) {
          $scope.all_alt_in_group.pop();
        }
      });
    }

    // Add an ingredient to the list
    $scope.addIngredient = function () {
      $scope.ingredientList.push({});
    };

    // Remove an ingredient from the list
    $scope.removeIngredientRow = function (ingredient) {
      var index = $scope.recipe.ingredients.indexOf(ingredient);
      $scope.recipe.ingredients.splice(index, 1);
      $scope.ingredientList.splice(index,1);
      $scope.$emit('customerDeleted', ingredient); 
    };

    // Add another direction to the list
    $scope.addDirections = function () {
      $scope.directionsList.push({});
    };

    // Remove a direction from the list
    $scope.removeDirectionsRow = function(direction) {
      var index = $scope.recipe.directionsList.indexOf(direction);
      $scope.recipe.directionsList.splice(index, 1);
      $scope.directionsList.splice(index,1);
      $scope.$emit('customerDeleted', direction); 
    };

    // Rating from users
    $scope.getStars = (number) => {
      $scope.recipe.review[0].rating = number;
    }
  }
}());
