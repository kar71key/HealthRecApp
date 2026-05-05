import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  type EmitterSubscription,
} from 'react-native';

export type AndroidStepCounterSnapshot = {
  stepCount: number;
  sessionDate: string;
  sessionStartedAt: number;
  lastUpdatedAt: number;
  serviceRunning: boolean;
  sensorAvailable: boolean;
  permissionGranted: boolean;
  trackingPaused: boolean;
};

type AndroidStepCounterModule = {
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
  startService: () => Promise<AndroidStepCounterSnapshot>;
  stopService: () => Promise<void>;
  pauseTracking: () => Promise<AndroidStepCounterSnapshot>;
  resumeTracking: () => Promise<AndroidStepCounterSnapshot>;
  getCurrentStepCount: () => Promise<number>;
  getSnapshot: () => Promise<AndroidStepCounterSnapshot>;
};

const MODULE_NAME = 'AndroidStepCounter';
const EVENT_STEP_UPDATE = 'AndroidStepCounter:StepUpdate';

const nativeModule = NativeModules[MODULE_NAME] as AndroidStepCounterModule | undefined;

const eventEmitter =
  Platform.OS === 'android' && nativeModule
    ? new NativeEventEmitter(nativeModule)
    : null;

export function isAndroidStepCounterAvailable(): boolean {
  return Platform.OS === 'android' && Boolean(nativeModule);
}

export async function startAndroidStepCounterService(): Promise<AndroidStepCounterSnapshot> {
  if (!nativeModule) {
    throw new Error('Android step counter module is unavailable.');
  }

  return nativeModule.startService();
}

export async function stopAndroidStepCounterService(): Promise<void> {
  if (!nativeModule) {
    return;
  }

  await nativeModule.stopService();
}

export async function pauseAndroidStepCounterTracking(): Promise<AndroidStepCounterSnapshot> {
  if (!nativeModule) {
    throw new Error('Android step counter module is unavailable.');
  }

  return nativeModule.pauseTracking();
}

export async function resumeAndroidStepCounterTracking(): Promise<AndroidStepCounterSnapshot> {
  if (!nativeModule) {
    throw new Error('Android step counter module is unavailable.');
  }

  return nativeModule.resumeTracking();
}

export async function getAndroidStepCounterSnapshot(): Promise<AndroidStepCounterSnapshot> {
  if (!nativeModule) {
    throw new Error('Android step counter module is unavailable.');
  }

  return nativeModule.getSnapshot();
}

export function subscribeToAndroidStepCounter(
  listener: (snapshot: AndroidStepCounterSnapshot) => void,
): EmitterSubscription | null {
  if (!eventEmitter) {
    return null;
  }

  return eventEmitter.addListener(EVENT_STEP_UPDATE, listener);
}
