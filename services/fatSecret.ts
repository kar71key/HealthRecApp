import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ParsedFoodRecognition, StoredNutritionScan } from '../types/nutri';
import { APP_SECRETS } from './appSecrets';

const TOKEN_STORAGE_KEY = '@health-rec-app/fatsecret-token';
const SCAN_STORAGE_KEY = '@health-rec-app/nutri-scan-history';
const FATSECRET_CLIENT_ID = APP_SECRETS.fatSecretClientId;
const FATSECRET_CLIENT_SECRET = APP_SECRETS.fatSecretClientSecret;
const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const IMAGE_RECOGNITION_URL =
  'https://platform.fatsecret.com/rest/image-recognition/v2';

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

type FatSecretTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type FatSecretErrorResponse = {
  error?: {
    code?: number | string;
    message?: string;
  };
};

type FatSecretFoodResponse = {
  food_id?: string | number;
  food_entry_name?: string;
  eaten?: {
    food_name_singular?: string;
    food_name_plural?: string;
    units?: number | string;
    total_metric_amount?: number | string;
    metric_description?: string;
    total_nutritional_content?: Record<string, string | undefined>;
  };
  suggested_serving?: {
    serving_id?: string | number;
    serving_description?: string;
    metric_measure_amount?: string | number;
    metric_serving_description?: string;
    number_of_units?: string | number;
  };
  food?: {
    food_type?: string;
    food_url?: string;
  };
};

type FatSecretRecognitionResponse = FatSecretErrorResponse & {
  food_response?: FatSecretFoodResponse[];
};

function parseNumber(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMacroValue(
  nutrition: Record<string, string | undefined>,
  key: string,
): number | undefined {
  if (!nutrition[key]) {
    return undefined;
  }
  return parseNumber(nutrition[key]);
}

function encodeAsciiToBase64(input: string): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let index = 0;

  while (index < input.length) {
    const byte1 = input.charCodeAt(index++) & 0xff;
    const hasByte2 = index < input.length;
    const byte2 = hasByte2 ? input.charCodeAt(index++) & 0xff : 0;
    const hasByte3 = index < input.length;
    const byte3 = hasByte3 ? input.charCodeAt(index++) & 0xff : 0;

    const chunk = (byte1 << 16) | (byte2 << 8) | byte3;

    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    output += hasByte2 ? alphabet[(chunk >> 6) & 63] : '=';
    output += hasByte3 ? alphabet[chunk & 63] : '=';
  }

  return output;
}

async function getCachedToken(): Promise<string | null> {
  try {
    const storedValue = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedValue) {
      return null;
    }

    const cached = JSON.parse(storedValue) as CachedToken;
    if (!cached.accessToken || !cached.expiresAt) {
      return null;
    }

    if (Date.now() >= cached.expiresAt) {
      return null;
    }

    return cached.accessToken;
  } catch {
    return null;
  }
}

async function cacheToken(accessToken: string, expiresInSeconds: number): Promise<void> {
  const tokenValue: CachedToken = {
    accessToken,
    // Refresh one minute early to avoid edge-expiry failures.
    expiresAt: Date.now() + Math.max(expiresInSeconds - 60, 60) * 1000,
  };

  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenValue));
}

async function getAccessToken(): Promise<string> {
  const cachedToken = await getCachedToken();
  if (cachedToken) {
    return cachedToken;
  }

  const credentials = encodeAsciiToBase64(
    `${FATSECRET_CLIENT_ID}:${FATSECRET_CLIENT_SECRET}`,
  );
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=image-recognition',
  });

  const data = (await response.json()) as FatSecretTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error('Unable to authenticate with FatSecret.');
  }

  await cacheToken(data.access_token, data.expires_in);
  return data.access_token;
}

function parseRecognitionResult(
  response: FatSecretRecognitionResponse,
): ParsedFoodRecognition[] {
  const foods = response.food_response ?? [];

  return foods.map((item, index) => {
    const nutrition = item.eaten?.total_nutritional_content ?? {};
    const units = parseNumber(item.eaten?.units);
    const portionName =
      units === 1
        ? item.eaten?.food_name_singular
        : item.eaten?.food_name_plural || item.eaten?.food_name_singular;
    const metricAmount = parseNumber(item.eaten?.total_metric_amount);
    const metricUnit = item.eaten?.metric_description ?? 'g';
    const suggestedMetricAmount = parseNumber(
      item.suggested_serving?.metric_measure_amount,
    );
    const suggestedMetricUnit =
      item.suggested_serving?.metric_serving_description ?? metricUnit;

    return {
      id: `${item.food_id ?? 'food'}-${index}`,
      detectedName: item.food_entry_name ?? `Dish ${index + 1}`,
      portionLabel: `${units || 1} ${portionName ?? 'serving'}`,
      metricPortionLabel: `${metricAmount || 0} ${metricUnit}`,
      nutrition: {
        calories: parseNumber(nutrition.calories),
        carbs: parseNumber(nutrition.carbohydrate),
        protein: parseNumber(nutrition.protein),
        fat: parseNumber(nutrition.fat),
        saturatedFat: getMacroValue(nutrition, 'saturated_fat'),
        fiber: getMacroValue(nutrition, 'fiber'),
        sugar: getMacroValue(nutrition, 'sugar'),
        sodium: getMacroValue(nutrition, 'sodium'),
        potassium: getMacroValue(nutrition, 'potassium'),
        cholesterol: getMacroValue(nutrition, 'cholesterol'),
        calcium: getMacroValue(nutrition, 'calcium'),
        iron: getMacroValue(nutrition, 'iron'),
        vitaminA: getMacroValue(nutrition, 'vitamin_a'),
        vitaminC: getMacroValue(nutrition, 'vitamin_c'),
      },
      suggestedServing:
        item.suggested_serving?.serving_description ?? 'Suggested serving unavailable',
      suggestedMetricLabel: `${suggestedMetricAmount || 0} ${suggestedMetricUnit}`,
      foodType: item.food?.food_type,
      foodUrl: item.food?.food_url,
    };
  });
}

export function summarizeRecognition(
  foods: ParsedFoodRecognition[],
): Omit<StoredNutritionScan, 'id' | 'scannedAt'> {
  return {
    title: foods.map(item => item.detectedName).join(', '),
    totalCalories: Math.round(
      foods.reduce((sum, item) => sum + item.nutrition.calories, 0),
    ),
    protein: Number(
      foods.reduce((sum, item) => sum + item.nutrition.protein, 0).toFixed(1),
    ),
    carbs: Number(
      foods.reduce((sum, item) => sum + item.nutrition.carbs, 0).toFixed(1),
    ),
    fat: Number(foods.reduce((sum, item) => sum + item.nutrition.fat, 0).toFixed(1)),
    foodsCount: foods.length,
  };
}

export async function loadNutritionScanHistory(): Promise<StoredNutritionScan[]> {
  try {
    const storedValue = await AsyncStorage.getItem(SCAN_STORAGE_KEY);
    if (!storedValue) {
      return [];
    }

    const parsed = JSON.parse(storedValue) as StoredNutritionScan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveNutritionScanHistory(
  scans: StoredNutritionScan[],
): Promise<void> {
  await AsyncStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify(scans.slice(0, 5)));
}

export async function recognizeFoodFromImage(
  imageBase64: string,
): Promise<ParsedFoodRecognition[]> {
  const token = await getAccessToken();
  const response = await fetch(IMAGE_RECOGNITION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_b64: imageBase64,
      include_food_data: true,
      region: 'US',
      language: 'en',
    }),
  });

  const data = (await response.json()) as FatSecretRecognitionResponse;
  const errorCode = Number(data.error?.code);

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'FatSecret request failed.');
  }

  if (errorCode === 211) {
    throw new Error('No food was detected in this image. Try a clearer dish photo.');
  }

  const foods = parseRecognitionResult(data);
  if (foods.length === 0) {
    throw new Error('FatSecret returned no recognizable food items.');
  }

  return foods;
}
