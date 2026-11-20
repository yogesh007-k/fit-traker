export interface FoodItem {
  id: string;
  name: string;
  category: 'Protein' | 'Carbs' | 'Fats' | 'Dairy' | 'Fruit & Veg' | 'Mixed Meal';
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  vegetarian: boolean;
  vegan: boolean;
}

// Reference nutrition values based on standard USDA FoodData Central per listed serving
export const FOOD_DATABASE: FoodItem[] = [
  { id: 'chicken-breast', name: 'Grilled Chicken Breast', category: 'Protein', servingUnit: '100g cooked', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, vegetarian: false, vegan: false },
  { id: 'egg-whole', name: 'Whole Boiled Egg', category: 'Protein', servingUnit: '1 large egg (50g)', calories: 78, proteinG: 6.3, carbsG: 0.6, fatG: 5.3, vegetarian: false, vegan: false },
  { id: 'egg-whites', name: 'Egg Whites', category: 'Protein', servingUnit: '100g', calories: 52, proteinG: 11, carbsG: 0.7, fatG: 0.2, vegetarian: false, vegan: false },
  { id: 'salmon-fillet', name: 'Baked Atlantic Salmon', category: 'Protein', servingUnit: '100g cooked', calories: 206, proteinG: 22, carbsG: 0, fatG: 12.4, vegetarian: false, vegan: false },
  { id: 'tuna-canned', name: 'Canned Light Tuna in Water', category: 'Protein', servingUnit: '100g drained', calories: 116, proteinG: 25.5, carbsG: 0, fatG: 0.8, vegetarian: false, vegan: false },
  { id: 'turkey-breast', name: 'Lean Ground Turkey (93%)', category: 'Protein', servingUnit: '100g cooked', calories: 170, proteinG: 23, carbsG: 0, fatG: 8, vegetarian: false, vegan: false },
  { id: 'paneer', name: 'Fresh Paneer (Cottage Cheese)', category: 'Dairy', servingUnit: '100g', calories: 265, proteinG: 18.3, carbsG: 1.2, fatG: 20.8, vegetarian: true, vegan: false },
  { id: 'low-fat-paneer', name: 'Low-Fat Paneer', category: 'Dairy', servingUnit: '100g', calories: 178, proteinG: 21, carbsG: 3.5, fatG: 8.5, vegetarian: true, vegan: false },
  { id: 'tofu-firm', name: 'Extra-Firm Tofu', category: 'Protein', servingUnit: '100g', calories: 144, proteinG: 17.3, carbsG: 2.8, fatG: 8.7, vegetarian: true, vegan: true },
  { id: 'tempeh', name: 'Steamed Tempeh', category: 'Protein', servingUnit: '100g', calories: 192, proteinG: 20.3, carbsG: 7.6, fatG: 10.8, vegetarian: true, vegan: true },
  { id: 'soya-chunks', name: 'Textured Soy Chunks (Dry)', category: 'Protein', servingUnit: '50g dry', calories: 172, proteinG: 26, carbsG: 16.5, fatG: 0.3, vegetarian: true, vegan: true },
  { id: 'whey-isolate', name: 'Whey Protein Isolate Scoop', category: 'Protein', servingUnit: '1 scoop (30g)', calories: 112, proteinG: 26, carbsG: 1, fatG: 0.5, vegetarian: true, vegan: false },
  { id: 'pea-protein', name: 'Plant Pea Protein Scoop', category: 'Protein', servingUnit: '1 scoop (32g)', calories: 120, proteinG: 24, carbsG: 2, fatG: 1.5, vegetarian: true, vegan: true },
  { id: 'greek-yogurt', name: 'Non-Fat Greek Yogurt', category: 'Dairy', servingUnit: '170g cup', calories: 100, proteinG: 17, carbsG: 6, fatG: 0.4, vegetarian: true, vegan: false },
  { id: 'cottage-cheese', name: 'Low-Fat Cottage Cheese (2%)', category: 'Dairy', servingUnit: '150g', calories: 122, proteinG: 18, carbsG: 5.4, fatG: 2.8, vegetarian: true, vegan: false },
  { id: 'skim-milk', name: 'Skim / Toned Milk', category: 'Dairy', servingUnit: '250ml cup', calories: 85, proteinG: 8.5, carbsG: 12, fatG: 0.3, vegetarian: true, vegan: false },
  { id: 'soy-milk', name: 'Unsweetened Soy Milk', category: 'Dairy', servingUnit: '250ml cup', calories: 80, proteinG: 7, carbsG: 4, fatG: 4, vegetarian: true, vegan: true },
  { id: 'oats-rolled', name: 'Rolled Oats (Dry)', category: 'Carbs', servingUnit: '50g dry', calories: 190, proteinG: 6.7, carbsG: 33.5, fatG: 3.4, vegetarian: true, vegan: true },
  { id: 'white-rice', name: 'Cooked White Basmati Rice', category: 'Carbs', servingUnit: '150g cooked', calories: 195, proteinG: 4, carbsG: 42, fatG: 0.4, vegetarian: true, vegan: true },
  { id: 'brown-rice', name: 'Cooked Brown Rice', category: 'Carbs', servingUnit: '150g cooked', calories: 166, proteinG: 3.9, carbsG: 34.5, fatG: 1.3, vegetarian: true, vegan: true },
  { id: 'quinoa-cooked', name: 'Cooked Quinoa', category: 'Carbs', servingUnit: '150g cooked', calories: 180, proteinG: 6.6, carbsG: 32, fatG: 2.9, vegetarian: true, vegan: true },
  { id: 'sweet-potato', name: 'Baked Sweet Potato', category: 'Carbs', servingUnit: '150g', calories: 135, proteinG: 3, carbsG: 31, fatG: 0.2, vegetarian: true, vegan: true },
  { id: 'whole-wheat-bread', name: 'Whole Wheat Bread', category: 'Carbs', servingUnit: '2 slices (60g)', calories: 150, proteinG: 6.8, carbsG: 26, fatG: 2.2, vegetarian: true, vegan: true },
  { id: 'idli-steamed', name: 'Steamed Rice & Lentil Idli', category: 'Mixed Meal', servingUnit: '2 idlis (120g)', calories: 146, proteinG: 4.5, carbsG: 29, fatG: 0.6, vegetarian: true, vegan: true },
  { id: 'plain-dosa', name: 'Crispy Plain Dosa', category: 'Mixed Meal', servingUnit: '1 medium dosa', calories: 168, proteinG: 3.9, carbsG: 29, fatG: 3.7, vegetarian: true, vegan: true },
  { id: 'moong-dal-chilla', name: 'Moong Dal Protein Chilla', category: 'Mixed Meal', servingUnit: '2 pancakes', calories: 220, proteinG: 14, carbsG: 31, fatG: 4, vegetarian: true, vegan: true },
  { id: 'lentils-cooked', name: 'Cooked Red/Yellow Lentils (Dal)', category: 'Protein', servingUnit: '150g cooked', calories: 174, proteinG: 13.5, carbsG: 30, fatG: 0.6, vegetarian: true, vegan: true },
  { id: 'chickpeas-cooked', name: 'Boiled Chickpeas (Chana)', category: 'Protein', servingUnit: '150g cooked', calories: 246, proteinG: 13.3, carbsG: 41, fatG: 3.9, vegetarian: true, vegan: true },
  { id: 'black-beans', name: 'Cooked Black Beans', category: 'Protein', servingUnit: '150g cooked', calories: 198, proteinG: 13.2, carbsG: 35.5, fatG: 0.8, vegetarian: true, vegan: true },
  { id: 'edamame', name: 'Shelled Steamed Edamame', category: 'Protein', servingUnit: '100g', calories: 121, proteinG: 11.9, carbsG: 8.9, fatG: 5.2, vegetarian: true, vegan: true },
  { id: 'banana-medium', name: 'Medium Banana', category: 'Fruit & Veg', servingUnit: '1 medium (118g)', calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, vegetarian: true, vegan: true },
  { id: 'apple-medium', name: 'Crisp Apple', category: 'Fruit & Veg', servingUnit: '1 medium (182g)', calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, vegetarian: true, vegan: true },
  { id: 'blueberries', name: 'Fresh Blueberries', category: 'Fruit & Veg', servingUnit: '100g', calories: 57, proteinG: 0.7, carbsG: 14.5, fatG: 0.3, vegetarian: true, vegan: true },
  { id: 'broccoli-steamed', name: 'Steamed Broccoli', category: 'Fruit & Veg', servingUnit: '150g', calories: 52, proteinG: 3.6, carbsG: 10.6, fatG: 0.6, vegetarian: true, vegan: true },
  { id: 'spinach-raw', name: 'Fresh Baby Spinach', category: 'Fruit & Veg', servingUnit: '100g', calories: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4, vegetarian: true, vegan: true },
  { id: 'avocado-half', name: 'Hass Avocado', category: 'Fats', servingUnit: '1/2 fruit (75g)', calories: 120, proteinG: 1.5, carbsG: 6.4, fatG: 11, vegetarian: true, vegan: true },
  { id: 'almonds', name: 'Raw Almonds', category: 'Fats', servingUnit: '28g (23 nuts)', calories: 164, proteinG: 6, carbsG: 6.1, fatG: 14.2, vegetarian: true, vegan: true },
  { id: 'peanut-butter', name: 'Natural Peanut Butter', category: 'Fats', servingUnit: '2 tbsp (32g)', calories: 190, proteinG: 8, carbsG: 6, fatG: 16, vegetarian: true, vegan: true },
  { id: 'chia-seeds', name: 'Chia Seeds', category: 'Fats', servingUnit: '2 tbsp (28g)', calories: 138, proteinG: 4.7, carbsG: 12, fatG: 8.7, vegetarian: true, vegan: true },
  { id: 'olive-oil', name: 'Extra Virgin Olive Oil', category: 'Fats', servingUnit: '1 tbsp (14g)', calories: 119, proteinG: 0, carbsG: 0, fatG: 13.5, vegetarian: true, vegan: true },
  { id: 'walnuts', name: 'Raw Walnut Halves', category: 'Fats', servingUnit: '28g', calories: 185, proteinG: 4.3, carbsG: 3.9, fatG: 18.5, vegetarian: true, vegan: true },
  { id: 'pumpkin-seeds', name: 'Roasted Pumpkin Seeds', category: 'Fats', servingUnit: '28g', calories: 158, proteinG: 8.5, carbsG: 4.2, fatG: 13.9, vegetarian: true, vegan: true },
  { id: 'chapati-roti', name: 'Whole Wheat Chapati / Roti', category: 'Carbs', servingUnit: '2 rotis (80g)', calories: 204, proteinG: 6.8, carbsG: 41, fatG: 1.4, vegetarian: true, vegan: true },
  { id: 'pasta-cooked', name: 'Cooked Whole-Grain Pasta', category: 'Carbs', servingUnit: '150g cooked', calories: 186, proteinG: 8, carbsG: 39, fatG: 0.9, vegetarian: true, vegan: true },
  { id: 'shrimp-cooked', name: 'Grilled Shrimp / Prawns', category: 'Protein', servingUnit: '100g cooked', calories: 99, proteinG: 24, carbsG: 0.2, fatG: 0.3, vegetarian: false, vegan: false },
];
