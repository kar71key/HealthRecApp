declare module 'react-native-pedometer' {
  export type PedometerData = {
    startDate?: Date;
    endDate?: Date;
    numberOfSteps: number;
  };

  type AvailabilityCallback = (error: string | null, available: boolean) => void;
  type DataCallback = (error: string | null, data: PedometerData) => void;
  type LiveUpdateCallback = (data: PedometerData) => void;

  interface PedometerAPI {
    isStepCountingAvailable: (callback: AvailabilityCallback) => void;
    queryPedometerDataBetweenDates: (
      startDate: Date,
      endDate: Date,
      callback: DataCallback,
    ) => void;
    startPedometerUpdatesFromDate: (
      startDate: Date,
      callback: LiveUpdateCallback,
    ) => void;
    stopPedometerUpdates: () => void;
  }

  const Pedometer: PedometerAPI;

  export default Pedometer;
}

