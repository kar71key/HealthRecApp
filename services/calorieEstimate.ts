const DEFAULT_STRIDE_LENGTH_METERS = 0.762;
const STRIDE_FROM_HEIGHT_RATIO = 0.414;
const WALKING_CALORIES_PER_KG_PER_KM = 0.53;

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function estimateStepDistanceKm(
  stepCount: number,
  heightCm?: number | null,
): number {
  if (stepCount <= 0) {
    return 0;
  }

  const strideLengthMeters =
    heightCm && heightCm > 0
      ? (heightCm * STRIDE_FROM_HEIGHT_RATIO) / 100
      : DEFAULT_STRIDE_LENGTH_METERS;

  return (stepCount * strideLengthMeters) / 1000;
}

export function estimateCaloriesBurnedFromSteps(
  stepCount: number,
  weightKg?: number | null,
  heightCm?: number | null,
): number {
  if (!weightKg || weightKg <= 0 || stepCount <= 0) {
    return 0;
  }

  const distanceKm = estimateStepDistanceKm(stepCount, heightCm);
  return roundToSingleDecimal(distanceKm * weightKg * WALKING_CALORIES_PER_KG_PER_KM);
}
