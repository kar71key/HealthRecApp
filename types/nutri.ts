export type NutritionSummary = {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  saturatedFat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  potassium?: number;
  cholesterol?: number;
  calcium?: number;
  iron?: number;
  vitaminA?: number;
  vitaminC?: number;
};

export type ParsedFoodRecognition = {
  id: string;
  detectedName: string;
  portionLabel: string;
  metricPortionLabel: string;
  nutrition: NutritionSummary;
  suggestedServing: string;
  suggestedMetricLabel: string;
  foodType?: string;
  foodUrl?: string;
};

export type StoredNutritionScan = {
  id: string;
  scannedAt: string;
  title: string;
  totalCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  foodsCount: number;
};

export type GeminiNutritionAnalysis = {
  dishName: string;
  summary: string;
  confidence: string;
  likelyIngredients: string[];
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
  };
  notes: string[];
};
