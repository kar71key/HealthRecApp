import type {
  PhysicalActivityCategory,
  PhysicalActivityOptionKey,
} from '../types/data';

export type PhysicalActivityOption = {
  key: PhysicalActivityOptionKey;
  category: PhysicalActivityCategory;
  title: string;
  intensityLabel: string;
  description: string;
  metValue: number;
};

const HOURS_PER_SECOND = 1 / 3600;

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export const PHYSICAL_ACTIVITY_OPTIONS: PhysicalActivityOption[] = [
  {
    key: 'running-jogging',
    category: 'Running',
    title: 'Jogging',
    intensityLabel: 'Easy pace',
    description: 'Comfortable jog or easy run.',
    metValue: 7,
  },
  {
    key: 'running-steady',
    category: 'Running',
    title: 'Steady Run',
    intensityLabel: 'Moderate pace',
    description: 'Continuous run at a steady training pace.',
    metValue: 9.8,
  },
  {
    key: 'running-sprints',
    category: 'Running',
    title: 'Sprinting Intervals',
    intensityLabel: 'High intensity',
    description: 'Short hard efforts or fast interval repeats.',
    metValue: 13.5,
  },
  {
    key: 'cycling-leisure',
    category: 'Cycling',
    title: 'Leisure Ride',
    intensityLabel: 'Easy pace',
    description: 'Relaxed ride on flat ground.',
    metValue: 4.8,
  },
  {
    key: 'cycling-road',
    category: 'Cycling',
    title: 'Road Cycling',
    intensityLabel: 'Moderate pace',
    description: 'Steady outdoor ride or spin-bike effort.',
    metValue: 8,
  },
  {
    key: 'cycling-intervals',
    category: 'Cycling',
    title: 'Intervals / Climbing',
    intensityLabel: 'High intensity',
    description: 'Hard climbs, intervals, or aggressive effort.',
    metValue: 10,
  },
  {
    key: 'swimming-light',
    category: 'Swimming',
    title: 'Light Laps',
    intensityLabel: 'Easy pace',
    description: 'Gentle lap swimming with frequent recovery.',
    metValue: 6,
  },
  {
    key: 'swimming-moderate',
    category: 'Swimming',
    title: 'Freestyle Training',
    intensityLabel: 'Moderate pace',
    description: 'Continuous lap swimming at a steady pace.',
    metValue: 8.3,
  },
  {
    key: 'swimming-vigorous',
    category: 'Swimming',
    title: 'Vigorous Sets',
    intensityLabel: 'High intensity',
    description: 'Hard sets, intervals, or race-pace swimming.',
    metValue: 10,
  },
];

export function getPhysicalActivityOption(
  key: PhysicalActivityOptionKey,
): PhysicalActivityOption | undefined {
  return PHYSICAL_ACTIVITY_OPTIONS.find(option => option.key === key);
}

export function estimateCaloriesBurnedFromActivity(
  metValue: number,
  durationSeconds: number,
  weightKg?: number | null,
): number {
  if (!weightKg || weightKg <= 0 || durationSeconds <= 0 || metValue <= 0) {
    return 0;
  }

  return roundToSingleDecimal(metValue * weightKg * durationSeconds * HOURS_PER_SECOND);
}

export function formatDurationClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`;
  }

  return `${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`;
}

