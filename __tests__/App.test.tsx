/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-gesture-handler', () => {
  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: null,
    session: null,
    isReady: true,
    isLoggedIn: false,
    isConfigured: true,
    configurationMessage: null,
    signIn: jest.fn(),
    signUp: jest.fn(),
    restoreSession: jest.fn(),
    refreshSession: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock('../context/HealthDataContext', () => ({
  HealthDataProvider: ({ children }: { children: React.ReactNode }) => children,
  useHealthData: () => ({
    stepsToday: 0,
    stepGoal: 9000,
    stepProgress: 0,
    stepStatus: 'unavailable',
    stepStatusMessage: 'Mocked pedometer state.',
    weeklySteps: [],
    stepSummaries: [],
    logForm: {
      symptoms: '',
      diet: '',
      waterIntake: '2.2',
      mood: 'Good',
      sleepQuality: 4,
      sleepHours: '7.5',
    },
    logs: [],
    dailyLogs: [],
    foodEntries: [],
    nutritionScans: [],
    insightFacts: [],
    profile: null,
    pendingSyncCount: 0,
    syncState: 'idle',
    lastSyncedAt: null,
    syncError: null,
    isStorageReady: true,
    refreshData: jest.fn(),
    syncNow: jest.fn(() => Promise.resolve(null)),
    saveProfile: jest.fn(),
    setLogField: jest.fn(),
    saveLog: jest.fn(() =>
      Promise.resolve({
        result: 'created',
        sync: {
          mode: 'full',
          attempted: 0,
          synced: 0,
          pulled: 0,
          skipped: false,
          pending: 0,
          state: 'idle',
          error: null,
          lastSyncedAt: null,
        },
      }),
    ),
    saveFoodEntry: jest.fn(),
    saveNutritionScan: jest.fn(),
  }),
}));

jest.mock('../hooks/useStepCounter', () => ({
  useStepCounter: () => ({
    stepsToday: 0,
    goal: 9000,
    progress: 0,
    status: 'unavailable',
    statusMessage: 'Mocked pedometer state.',
  }),
}));

jest.mock('../navigation/RootNavigator', () => ({
  RootNavigator: () => null,
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });
});
