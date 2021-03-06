(function () {
  'use strict';

  angular
    .module('core')
    .controller('HeaderController', HeaderController);

  HeaderController.$inject = ['$scope', '$state', 'Authentication', 'menuService', 'TransferService', '$http'];

  function HeaderController($scope, $state, Authentication, menuService, TransferService, $http) {
    var vm = this;
    vm.authentication = Authentication;
    vm.getAlternatives = getAlternatives;
    sort_alt();

    // Sort alternative ingredients and get suggestions for search
    async function sort_alt() {
      await $http.get('./modules/users/client/controllers/recipes/food_alternatives.json')
        .then ((response) => {
          $scope.altFoods = [];
          $scope.alt_food_object = response.data;
          
          // Loop through each cooking method, food group, and food alternative to 
          // sort alternatives from least to most healthy
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

          $scope.duplicate = 0;

          // Get all names to show up as suggested in the search bar
          $scope.alt_food_object.cooking_methods.forEach((cooking_method, i) => {
            cooking_method.food_groups.forEach( (food_group, j) => {
              food_group.food_alts.forEach( (food_alt, k) => {
                $scope.altFoods.forEach( (altFood, l) => {
                  if(food_alt.db_name == altFood){
                    $scope.duplicate = 1;
                  }
                });

                if($scope.duplicate == 0){
                    $scope.altFoods.push(food_alt.db_name);
                }
                else{
                  $scope.duplicate = 0
                }
              });
            });
          });
        });
    }

    // Get alternatives when searching
    async function getAlternatives() {
      // Initialize variables
      $scope.map = [];
      $scope.in_food_group;
      $scope.orig_nutrient_amount;
      $scope.all_alt_in_group = [];
      $scope.have_match = 0;
      $scope.top_alt_count = 3;
      $scope.mid_ind;
      $scope.cookingStyle = 'None';

      // Loop through cooking methods, food groups, and alternatives to get the alternatives
      // based on what was searched
      $scope.alt_food_object.cooking_methods.forEach( (cooking_method, i) => {
        cooking_method.food_groups.forEach( (food_group, j) => {
          food_group.food_alts.forEach( (food_alt, k) => {
              
            if((food_alt.db_name.toLowerCase() == vm.searchFood.toLowerCase()) && ($scope.cookingStyle == cooking_method.method_name)){
              var alt_item = food_alt;
              $scope.map.push({"map_ndbno": alt_item.db_ndbno, "map_name": alt_item.db_name, "nutrient": alt_item.db_main_nutrient.db_amount, "flipped": false});
              $scope.have_match = 1;
            }
            else if ((food_alt.db_name.toLowerCase() != vm.searchFood.toLowerCase()) && ($scope.have_match == 1)){
              $scope.all_alt_in_group.push(food_alt);
            }			
          });
          $scope.have_match = 0;
        });
      });
    
      // Put three alternatives into map array to display on search screen
      if($scope.all_alt_in_group.length > 0) {
        if($scope.all_alt_in_group.length < $scope.top_alt_count){
          $scope.all_alt_in_group.forEach((alt_item, i) => {
            $scope.map.push({
              "map_ndbno": alt_item.db_ndbno, 
              "map_name": alt_item.db_name, 
              "nutrient": alt_item.db_main_nutrient.db_amount, 
              "flipped": false
            });
          });
        }
        else{
          // Control what alt we give
          $scope.mid_ind = $scope.all_alt_in_group.length/2;
          // Index is not whole number
          if($scope.mid_ind % 1 != 0){
            $scope.mid_ind = $scope.mid_ind - 0.5;
          }
          $scope.all_alt_in_group.forEach((alt_item, i) => {
            if(i==0 || i==$scope.mid_ind || i==$scope.all_alt_in_group.length-1){
              $scope.map.push({"map_ndbno": alt_item.db_ndbno, "map_name": alt_item.db_name, "nutrient": alt_item.db_main_nutrient.db_amount, "flipped": false});
            }
          });
        }		
      }
      else $scope.map.push({"map_name": "No alternatives available"});

      // Transfer data to the search controller
      TransferService.setAlternatives($scope.map);

      if($state.is('search')) $state.reload();
      else $state.go('search');
    }
  }
}());
