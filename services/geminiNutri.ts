import type { GeminiNutritionAnalysis } from '../types/nutri';
import { APP_SECRETS } from './appSecrets';

const GEMINI_API_KEY = APP_SECRETS.geminiApiKey;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
  };
};

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizeGeminiAnalysis(value: unknown): GeminiNutritionAnalysis {
  const raw = (value ?? {}) as Partial<GeminiNutritionAnalysis>;
  const nutrition = (raw.nutrition ?? {}) as Partial<
    GeminiNutritionAnalysis['nutrition']
  >;

  return {
    dishName:
      typeof raw.dishName === 'string' && raw.dishName.trim().length > 0
        ? raw.dishName.trim()
        : 'Detected dish',
    summary:
      typeof raw.summary === 'string' && raw.summary.trim().length > 0
        ? raw.summary.trim()
        : 'Gemini returned a nutrition estimate for the uploaded dish.',
    confidence:
      typeof raw.confidence === 'string' && raw.confidence.trim().length > 0
        ? raw.confidence.trim()
        : 'medium',
    likelyIngredients: Array.isArray(raw.likelyIngredients)
      ? raw.likelyIngredients.filter(
        item => typeof item === 'string' && item.trim().length > 0,
      )
      : [],
    nutrition: {
      calories: toNumber(nutrition.calories),
      protein: toNumber(nutrition.protein),
      carbs: toNumber(nutrition.carbs),
      fat: toNumber(nutrition.fat),
      fiber: toNumber(nutrition.fiber),
      sugar: toNumber(nutrition.sugar),
      sodium: toNumber(nutrition.sodium),
    },
    notes: Array.isArray(raw.notes)
      ? raw.notes.filter(item => typeof item === 'string' && item.trim().length > 0)
      : [],
  };
}

export async function analyzeNutritionWithGemini(
  imageBase64: string,
  mimeType: string,
): Promise<GeminiNutritionAnalysis> {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'Analyze the dish in this image and estimate its nutritional profile. Return JSON only. Identify the likely dish name, a short summary, confidence level, a list of likely ingredients, and estimated nutrition totals for one visible serving. Nutrition fields must be calories, protein, carbs, fat, fiber, sugar, and sodium. Also return short notes about uncertainty or assumptions.',
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            dishName: { type: 'STRING' },
            summary: { type: 'STRING' },
            confidence: { type: 'STRING' },
            likelyIngredients: {
              type: 'ARRAY',
              items: { type: 'STRING' },
            },
            nutrition: {
              type: 'OBJECT',
              properties: {
                calories: { type: 'NUMBER' },
                protein: { type: 'NUMBER' },
                carbs: { type: 'NUMBER' },
                fat: { type: 'NUMBER' },
                fiber: { type: 'NUMBER' },
                sugar: { type: 'NUMBER' },
                sodium: { type: 'NUMBER' },
              },
              required: [
                'calories',
                'protein',
                'carbs',
                'fat',
                'fiber',
                'sugar',
                'sodium',
              ],
            },
            notes: {
              type: 'ARRAY',
              items: { type: 'STRING' },
            },
          },
          required: [
            'dishName',
            'summary',
            'confidence',
            'likelyIngredients',
            'nutrition',
            'notes',
          ],
        },
      },
    }),
  });

  const data = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Gemini nutrition analysis failed.');
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned an empty nutrition analysis.');
  }

  try {
    return normalizeGeminiAnalysis(JSON.parse(text));
  } catch {
    throw new Error('Gemini returned an unreadable nutrition response.');
  }
}
