import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import type { PedometerStatus } from '../types/health';
import {
  getAndroidStepCounterSnapshot,
  isAndroidStepCounterAvailable,
  startAndroidStepCounterService,
  subscribeToAndroidStepCounter,
  type AndroidStepCounterSnapshot,
} from '../services/androidStepCounter';

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function requestActivityPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 29) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
    {
      title: 'Activity Access',
      message:
        'HealthRecApp needs activity recognition to track your daily steps.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function getStatusFromSnapshot(
  snapshot: AndroidStepCounterSnapshot,
): { status: PedometerStatus; statusMessage: string } {
  if (!snapshot.permissionGranted) {
    return {
      status: 'denied',
      statusMessage:
        'Activity permission denied. Enable Activity Recognition to count steps.',
    };
  }

  if (!snapshot.sensorAvailable) {
    return {
      status: 'unavailable',
      statusMessage:
        'Step counter sensor is unavailable on this device. You can still log health data manually.',
    };
  }

  if (snapshot.trackingPaused) {
    return {
      status: 'granted',
      statusMessage:
        'Step tracking is paused while your timed activity is running. It will resume when you stop the timer.',
    };
  }

  if (!snapshot.serviceRunning) {
    return {
      status: 'error',
      statusMessage:
        'Step tracking service is not running right now. Reopen the app to restart it.',
    };
  }

  return {
    status: 'granted',
    statusMessage: 'Background step tracking is active.',
  };
}

type UseStepCounterResult = {
  stepsToday: number;
  goal: number;
  progress: number;
  status: PedometerStatus;
  statusMessage: string;
  sessionDate: string | null;
  sessionStartedAt: number | null;
};

export function useStepCounter(goal: number): UseStepCounterResult {
  const [stepsToday, setStepsToday] = useState(0);
  const [status, setStatus] = useState<PedometerStatus>('checking');
  const [statusMessage, setStatusMessage] = useState('Checking sensor status...');
  const [sessionDate, setSessionDate] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const activeDayKey = useRef(formatDayKey(new Date()));

  useEffect(() => {
    let isMounted = true;

    const startTracking = async () => {
      setStatus('checking');
      setStatusMessage('Checking sensor status...');

      if (!isAndroidStepCounterAvailable()) {
        if (!isMounted) {
          return;
        }
        setStatus('unavailable');
        setStatusMessage(
          Platform.OS === 'android'
            ? 'Android step tracking is not available in this build. Rebuild the app with the native module.'
            : 'Live step tracking is only available on Android in this build.',
        );
        return;
      }

      let snapshot: AndroidStepCounterSnapshot;
      try {
        snapshot = await getAndroidStepCounterSnapshot();
      } catch {
        if (!isMounted) {
          return;
        }
        setStatus('error');
        setStatusMessage('Unable to read the Android step counter status.');
        return;
      }

      if (!snapshot.sensorAvailable) {
        if (!isMounted) {
          return;
        }
        activeDayKey.current = snapshot.sessionDate;
        setStepsToday(snapshot.stepCount);
        setSessionDate(snapshot.sessionDate);
        setSessionStartedAt(snapshot.sessionStartedAt);
        const nextStatus = getStatusFromSnapshot(snapshot);
        setStatus(nextStatus.status);
        setStatusMessage(nextStatus.statusMessage);
        return;
      }

      const granted = await requestActivityPermission();
      if (!granted) {
        if (!isMounted) {
          return;
        }
        setStatus('denied');
        setStatusMessage(
          'Activity permission denied. Enable Activity Recognition to count steps.',
        );
        return;
      }

      try {
        const serviceSnapshot = await startAndroidStepCounterService();
        if (!isMounted) {
          return;
        }
        const nextDayKey = serviceSnapshot.sessionDate;
        activeDayKey.current = nextDayKey;
        setStepsToday(serviceSnapshot.stepCount);
        setSessionDate(serviceSnapshot.sessionDate);
        setSessionStartedAt(serviceSnapshot.sessionStartedAt);
        const nextStatus = getStatusFromSnapshot(serviceSnapshot);
        setStatus(nextStatus.status);
        setStatusMessage(nextStatus.statusMessage);
      } catch {
        if (!isMounted) {
          return;
        }
        setStatus('error');
        setStatusMessage('Unable to start the Android step tracking service.');
      }
    };

    const refreshForNewDay = () => {
      const refreshSnapshot = async () => {
        try {
          const snapshot = await getAndroidStepCounterSnapshot();
          if (!isMounted) {
            return;
          }
          const nextDayKey = snapshot.sessionDate;
          if (activeDayKey.current !== nextDayKey) {
            activeDayKey.current = nextDayKey;
          }
          setStepsToday(snapshot.stepCount);
          setSessionDate(snapshot.sessionDate);
          setSessionStartedAt(snapshot.sessionStartedAt);
          const nextStatus = getStatusFromSnapshot(snapshot);
          setStatus(nextStatus.status);
          setStatusMessage(nextStatus.statusMessage);
        } catch {
          if (!isMounted) {
            return;
          }
          setStatus('error');
          setStatusMessage('Unable to refresh the Android step counter.');
        }
      };

      refreshSnapshot();
    };

    startTracking();
    const eventSubscription = subscribeToAndroidStepCounter(snapshot => {
      if (!isMounted) {
        return;
      }
      activeDayKey.current = snapshot.sessionDate;
      setStepsToday(snapshot.stepCount);
      setSessionDate(snapshot.sessionDate);
      setSessionStartedAt(snapshot.sessionStartedAt);
      const nextStatus = getStatusFromSnapshot(snapshot);
      setStatus(nextStatus.status);
      setStatusMessage(nextStatus.statusMessage);
    });

    const appStateSub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refreshForNewDay();
      }
    });
    const dayInterval = setInterval(refreshForNewDay, DAY_MS / 24);

    return () => {
      isMounted = false;
      clearInterval(dayInterval);
      appStateSub.remove();
      eventSubscription?.remove();
    };
  }, []);

  const progress = useMemo(() => {
    if (goal <= 0) {
      return 0;
    }
    return Math.min(stepsToday / goal, 1);
  }, [goal, stepsToday]);

  return {
    stepsToday,
    goal,
    progress,
    status,
    statusMessage,
    sessionDate,
    sessionStartedAt,
  };
}
