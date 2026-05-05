export type MoodLevel = 'Great' | 'Good' | 'Okay' | 'Low';

export type SleepQuality = 1 | 2 | 3 | 4 | 5;

export type LogFormState = {
  symptoms: string;
  diet: string;
  waterIntake: string;
  mood: MoodLevel;
  sleepQuality: SleepQuality;
  sleepHours: string;
};

export type SavedLog = {
  id: string;
  timestamp: string;
  symptoms: string;
  diet: string;
  waterIntake: number;
  mood: MoodLevel;
  sleepQuality: SleepQuality;
  sleepHours: number;
};

export type StepPoint = {
  id: string;
  isoDate: string;
  day: string;
  steps: number;
  stepCaloriesBurned: number;
  activityCaloriesBurned: number;
  caloriesBurned: number;
};

export type SaveLogResult = 'created' | 'updated';

export type MetricBarChartPoint = {
  id: string;
  label: string;
  value: number;
  caption: string;
};

export type PedometerStatus =
  | 'checking'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'error';
