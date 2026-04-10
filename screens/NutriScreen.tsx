import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

import { AppCard } from '../components/AppCard';
import { ScreenShell } from '../components/ScreenShell';
import { useHealthData } from '../context/HealthDataContext';
import { recognizeFoodFromImage, summarizeRecognition } from '../services/fatSecret';
import { analyzeNutritionWithGemini } from '../services/geminiNutri';
import { colors } from '../theme/colors';
import type {
  GeminiNutritionAnalysis,
  ParsedFoodRecognition,
  StoredNutritionScan,
} from '../types/nutri';

type SelectedImage = {
  uri: string;
  base64: string;
  fileName?: string;
  mimeType: string;
};

function MacroTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}): React.JSX.Element {
  return (
    <View style={styles.macroTile}>
      <View style={[styles.macroDot, { backgroundColor: accent }]} />
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>{value}</Text>
    </View>
  );
}

function NutritionLine({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View style={styles.nutritionLine}>
      <Text style={styles.nutritionLabel}>{label}</Text>
      <Text style={styles.nutritionValue}>{value}</Text>
    </View>
  );
}

function HistoryItem({ item }: { item: StoredNutritionScan }): React.JSX.Element {
  return (
    <View style={styles.historyItem}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.historyCalories}>{item.totalCalories} kcal</Text>
      </View>
      <Text style={styles.historyMeta}>
        {new Date(item.scannedAt).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
        })}{' '}
        • {item.foodsCount} food match{item.foodsCount === 1 ? '' : 'es'}
      </Text>
      <Text style={styles.historyMacroText}>
        Protein {item.protein}g • Carbs {item.carbs}g • Fat {item.fat}g
      </Text>
    </View>
  );
}

export function NutriScreen(): React.JSX.Element {
  const { nutritionScans, saveFoodEntry, saveNutritionScan } = useHealthData();
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<'fatsecret' | 'gemini' | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [recognizedFoods, setRecognizedFoods] = useState<ParsedFoodRecognition[]>([]);
  const [geminiAnalysis, setGeminiAnalysis] =
    useState<GeminiNutritionAnalysis | null>(null);

  const summary = useMemo(() => {
    if (recognizedFoods.length === 0) {
      return null;
    }
    return summarizeRecognition(recognizedFoods);
  }, [recognizedFoods]);

  const handlePickImage = async () => {
    setErrorMessage('');

    const response = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      includeBase64: true,
      quality: 0.7,
      maxWidth: 512,
      maxHeight: 512,
    });

    if (response.didCancel) {
      return;
    }

    if (response.errorCode || !response.assets?.[0]?.base64 || !response.assets[0].uri) {
      setErrorMessage('Unable to load this image. Try a smaller dish photo.');
      return;
    }

    setRecognizedFoods([]);
    setGeminiAnalysis(null);
    setSelectedImage({
      uri: response.assets[0].uri,
      base64: response.assets[0].base64,
      fileName: response.assets[0].fileName,
      mimeType: response.assets[0].type ?? 'image/jpeg',
    });
  };

  const handleAnalyze = async () => {
    if (!selectedImage?.base64) {
      setErrorMessage('Pick a dish photo first.');
      return;
    }

    setActiveAnalysis('fatsecret');
    setErrorMessage('');

    try {
      const foods = await recognizeFoodFromImage(selectedImage.base64);
      setRecognizedFoods(foods);

      const nextSummary = summarizeRecognition(foods);
      const scannedAt = new Date().toISOString();
      await saveNutritionScan({
        title: nextSummary.title,
        source: 'fatsecret',
        scannedAt,
        foodsCount: nextSummary.foodsCount,
        totalCalories: nextSummary.totalCalories,
        proteinG: nextSummary.protein,
        carbsG: nextSummary.carbs,
        fatG: nextSummary.fat,
        rawPayloadJson: JSON.stringify(foods),
      });
      await saveFoodEntry({
        localDate: scannedAt.slice(0, 10),
        occurredAt: scannedAt,
        mealType: 'Snack',
        itemName: nextSummary.title,
        quantityValue: 1,
        quantityUnit: 'scan',
        caffeineMg: 0,
        isCaffeinated: false,
        estimatedCalories: nextSummary.totalCalories,
        estimatedProteinG: nextSummary.protein,
        estimatedCarbsG: nextSummary.carbs,
        estimatedFatG: nextSummary.fat,
        source: 'fatsecret',
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to analyze this image.',
      );
    } finally {
      setActiveAnalysis(null);
    }
  };

  const handleGeminiAnalyze = async () => {
    if (!selectedImage?.base64) {
      setErrorMessage('Pick a dish photo first.');
      return;
    }

    setActiveAnalysis('gemini');
    setErrorMessage('');

    try {
      const analysis = await analyzeNutritionWithGemini(
        selectedImage.base64,
        selectedImage.mimeType,
      );
      setGeminiAnalysis(analysis);
      const scannedAt = new Date().toISOString();
      await saveNutritionScan({
        title: analysis.dishName,
        source: 'gemini',
        scannedAt,
        foodsCount: Math.max(1, analysis.likelyIngredients.length),
        totalCalories: Math.round(analysis.nutrition.calories),
        proteinG: analysis.nutrition.protein,
        carbsG: analysis.nutrition.carbs,
        fatG: analysis.nutrition.fat,
        rawPayloadJson: JSON.stringify(analysis),
      });
      await saveFoodEntry({
        localDate: scannedAt.slice(0, 10),
        occurredAt: scannedAt,
        mealType: 'Snack',
        itemName: analysis.dishName,
        quantityValue: 1,
        quantityUnit: 'scan',
        caffeineMg: 0,
        isCaffeinated: false,
        estimatedCalories: Math.round(analysis.nutrition.calories),
        estimatedProteinG: analysis.nutrition.protein,
        estimatedCarbsG: analysis.nutrition.carbs,
        estimatedFatG: analysis.nutrition.fat,
        source: 'gemini',
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to analyze this image.',
      );
    } finally {
      setActiveAnalysis(null);
    }
  };

  return (
    <ScreenShell
      title="Nutri"
      subtitle="Upload a dish photo and get an ingredient-style breakdown plus estimated nutrition."
    >
      <AppCard title="Dish Scan">
        <View style={styles.heroWrap}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
          ) : (
            <View style={styles.emptyPreview}>
              <Text style={styles.emptyPreviewTitle}>No dish selected</Text>
              <Text style={styles.emptyPreviewText}>
                Use a clear top-down or angled food photo at roughly 512px for better recognition.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryButton} onPress={handlePickImage}>
            <Text style={styles.secondaryButtonText}>Upload Dish Photo</Text>
          </Pressable>
          <Pressable
            style={[
              styles.primaryButton,
              (!selectedImage || activeAnalysis !== null) && styles.buttonDisabled,
            ]}
            onPress={handleAnalyze}
            disabled={!selectedImage || activeAnalysis !== null}
          >
            {activeAnalysis === 'fatsecret' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Analyze Nutrition (FatSecret)</Text>
            )}
          </Pressable>
          <Pressable
            style={[
              styles.geminiButton,
              (!selectedImage || activeAnalysis !== null) && styles.buttonDisabled,
            ]}
            onPress={handleGeminiAnalyze}
            disabled={!selectedImage || activeAnalysis !== null}
          >
            {activeAnalysis === 'gemini' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Analyze Nutrition (Gemini)</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.helperText}>
          {selectedImage?.fileName
            ? `Selected: ${selectedImage.fileName}`
            : 'Results are persisted in the local relational store and queued for future sync.'}
        </Text>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </AppCard>

      {summary ? (
        <AppCard title="Scan Summary">
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>{summary.title}</Text>
            <Text style={styles.summaryCalories}>{summary.totalCalories} kcal</Text>
          </View>
          <View style={styles.macroGrid}>
            <MacroTile label="Protein" value={`${summary.protein}g`} accent={colors.accent} />
            <MacroTile label="Carbs" value={`${summary.carbs}g`} accent={colors.warning} />
            <MacroTile label="Fat" value={`${summary.fat}g`} accent={colors.danger} />
            <MacroTile
              label="Items"
              value={`${summary.foodsCount}`}
              accent={colors.primary}
            />
          </View>
        </AppCard>
      ) : null}

      {recognizedFoods.length > 0 ? (
        <AppCard title="Detected Foods">
          <View style={styles.foodList}>
            {recognizedFoods.map(food => (
              <View key={food.id} style={styles.foodCard}>
                <View style={styles.foodHeader}>
                  <View style={styles.foodTextWrap}>
                    <Text style={styles.foodName}>{food.detectedName}</Text>
                    <Text style={styles.foodSubtext}>
                      {food.portionLabel} • {food.metricPortionLabel}
                    </Text>
                  </View>
                  <Text style={styles.foodCalories}>
                    {Math.round(food.nutrition.calories)} kcal
                  </Text>
                </View>

                <View style={styles.foodPillRow}>
                  <View style={styles.foodPill}>
                    <Text style={styles.foodPillText}>
                      Suggested: {food.suggestedServing}
                    </Text>
                  </View>
                  <View style={styles.foodPill}>
                    <Text style={styles.foodPillText}>{food.suggestedMetricLabel}</Text>
                  </View>
                  {food.foodType ? (
                    <View style={styles.foodPill}>
                      <Text style={styles.foodPillText}>{food.foodType}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.nutritionGrid}>
                  <NutritionLine
                    label="Protein"
                    value={`${food.nutrition.protein.toFixed(1)}g`}
                  />
                  <NutritionLine
                    label="Carbs"
                    value={`${food.nutrition.carbs.toFixed(1)}g`}
                  />
                  <NutritionLine
                    label="Fat"
                    value={`${food.nutrition.fat.toFixed(1)}g`}
                  />
                  <NutritionLine
                    label="Fiber"
                    value={`${(food.nutrition.fiber ?? 0).toFixed(1)}g`}
                  />
                  <NutritionLine
                    label="Sugar"
                    value={`${(food.nutrition.sugar ?? 0).toFixed(1)}g`}
                  />
                  <NutritionLine
                    label="Sodium"
                    value={`${(food.nutrition.sodium ?? 0).toFixed(0)}mg`}
                  />
                </View>

                {food.foodUrl ? (
                  <Pressable
                    onPress={() => Linking.openURL(food.foodUrl ?? '')}
                    style={styles.linkButton}
                  >
                    <Text style={styles.linkButtonText}>Open FatSecret Listing</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </AppCard>
      ) : null}

      {geminiAnalysis ? (
        <AppCard title="Gemini Nutrition Estimate">
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>{geminiAnalysis.dishName}</Text>
            <Text style={styles.summaryCalories}>
              {Math.round(geminiAnalysis.nutrition.calories)} kcal
            </Text>
          </View>
          <Text style={styles.geminiSummary}>{geminiAnalysis.summary}</Text>
          <View style={styles.foodPillRow}>
            <View style={styles.foodPill}>
              <Text style={styles.foodPillText}>
                Confidence: {geminiAnalysis.confidence}
              </Text>
            </View>
          </View>

          <View style={styles.macroGrid}>
            <MacroTile
              label="Protein"
              value={`${geminiAnalysis.nutrition.protein.toFixed(1)}g`}
              accent={colors.accent}
            />
            <MacroTile
              label="Carbs"
              value={`${geminiAnalysis.nutrition.carbs.toFixed(1)}g`}
              accent={colors.warning}
            />
            <MacroTile
              label="Fat"
              value={`${geminiAnalysis.nutrition.fat.toFixed(1)}g`}
              accent={colors.danger}
            />
            <MacroTile
              label="Fiber"
              value={`${geminiAnalysis.nutrition.fiber.toFixed(1)}g`}
              accent={colors.primary}
            />
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Likely Ingredients</Text>
            <View style={styles.foodPillRow}>
              {geminiAnalysis.likelyIngredients.map(item => (
                <View key={item} style={styles.foodPill}>
                  <Text style={styles.foodPillText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Model Notes</Text>
            <View style={styles.notesList}>
              {geminiAnalysis.notes.map(note => (
                <Text key={note} style={styles.noteItem}>
                  • {note}
                </Text>
              ))}
            </View>
          </View>
        </AppCard>
      ) : null}

      <AppCard title="Recent Scans">
        {nutritionScans.length === 0 ? (
          <Text style={styles.emptyHistoryText}>
            Your nutrition scan history will appear here after the first analysis.
          </Text>
        ) : (
          <View style={styles.historyList}>
            {nutritionScans.map(item => (
              <HistoryItem key={item.id} item={item} />
            ))}
          </View>
        )}
      </AppCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: 14,
  },
  previewImage: {
    width: '100%',
    height: 220,
  },
  emptyPreview: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyPreviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyPreviewText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  actionRow: {
    gap: 10,
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 48,
  },
  geminiButton: {
    borderRadius: 14,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  helperText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
  },
  errorText: {
    marginTop: 8,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  summaryTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryCalories: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  geminiSummary: {
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  macroTile: {
    width: '48%',
    minHeight: 92,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginBottom: 8,
  },
  macroLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  foodList: {
    gap: 12,
  },
  foodCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 14,
  },
  foodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  foodTextWrap: {
    flex: 1,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  foodSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  foodCalories: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  foodPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  foodPill: {
    borderRadius: 999,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  foodPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionBlock: {
    marginTop: 14,
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  nutritionGrid: {
    gap: 8,
  },
  nutritionLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  nutritionLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  nutritionValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  linkButton: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    paddingVertical: 10,
  },
  linkButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  historyList: {
    gap: 10,
  },
  historyItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyCalories: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  historyMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  historyMacroText: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textPrimary,
  },
  emptyHistoryText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  notesList: {
    gap: 6,
  },
  noteItem: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
});

