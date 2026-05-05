import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppCard } from '../components/AppCard';
import { MoodSelector } from '../components/MoodSelector';
import { ScreenShell } from '../components/ScreenShell';
import { SleepQualitySelector } from '../components/SleepQualitySelector';
import { useHealthData } from '../context/HealthDataContext';
import {
  estimateCaloriesBurnedFromActivity,
  formatDurationClock,
  PHYSICAL_ACTIVITY_OPTIONS,
} from '../services/activityCalories';
import { colors } from '../theme/colors';
import type {
  FoodEntry,
  MealType,
  PhysicalActivityCategory,
  PhysicalActivityOptionKey,
  PhysicalActivitySession,
} from '../types/data';
import type { LogFormState, SavedLog, SleepQuality } from '../types/health';

const MEAL_TYPES: MealType[] = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snack',
  'Beverage',
];

type FoodEntryDraft = {
  mealType: MealType;
  itemName: string;
  quantityValue: string;
  quantityUnit: string;
  timeText: string;
  caffeineMg: string;
};

type ActivityOptionCardProps = {
  optionKey: PhysicalActivityOptionKey;
  title: string;
  intensityLabel: string;
  description: string;
  selected: boolean;
  onPress: () => void;
};

function FieldLabel({ label }: { label: string }): React.JSX.Element {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function getSleepQualityLabel(value: SleepQuality): string {
  const labelMap: Record<SleepQuality, string> = {
    1: 'Poor',
    2: 'Light',
    3: 'Fair',
    4: 'Good',
    5: 'Great',
  };
  return labelMap[value];
}

function getEntryDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getEntryTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMetricValue(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function getDefaultFoodDraft(): FoodEntryDraft {
  return {
    mealType: 'Breakfast',
    itemName: '',
    quantityValue: '1',
    quantityUnit: 'serving',
    timeText: '08:30',
    caffeineMg: '0',
  };
}

function getLocalDateFromIso(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildTodayIsoFromTime(timeText: string): string {
  const [hoursRaw, minutesRaw] = timeText.split(':');
  const hours = Math.max(0, Math.min(23, Number.parseInt(hoursRaw ?? '0', 10) || 0));
  const minutes = Math.max(
    0,
    Math.min(59, Number.parseInt(minutesRaw ?? '0', 10) || 0),
  );
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function QuickActionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={styles.quickActionButton}>
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}

function EntryBadge({
  label,
  accent,
}: {
  label: string;
  accent: string;
}): React.JSX.Element {
  return (
    <View style={[styles.entryBadge, { backgroundColor: accent }]}>
      <Text style={styles.entryBadgeText}>{label}</Text>
    </View>
  );
}

function RecentEntry({ entry }: { entry: SavedLog }): React.JSX.Element {
  return (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <View>
          <Text style={styles.entryDate}>{getEntryDateLabel(entry.timestamp)}</Text>
          <Text style={styles.entryTime}>{getEntryTimeLabel(entry.timestamp)}</Text>
        </View>
        <EntryBadge label={entry.mood} accent="#E7F1FF" />
      </View>

      <View style={styles.entryBadgeRow}>
        <EntryBadge label={`${entry.waterIntake.toFixed(1)}L water`} accent="#E7FFF8" />
        <EntryBadge label={`${entry.sleepQuality}/5 sleep`} accent="#FFF4E5" />
        <EntryBadge label={`${formatMetricValue(entry.sleepHours)}h`} accent="#F4EEFF" />
      </View>

      <Text style={styles.entrySummary}>
        Diet: {entry.diet || 'No meal note'}
        {'\n'}
        Symptoms: {entry.symptoms || 'No symptoms logged'}
      </Text>
    </View>
  );
}

function MealTypeChip({
  value,
  selected,
  onPress,
}: {
  value: MealType;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.mealChip, selected && styles.mealChipSelected]}
    >
      <Text
        style={[styles.mealChipText, selected && styles.mealChipTextSelected]}
      >
        {value}
      </Text>
    </Pressable>
  );
}

function ActivityOptionCard({
  optionKey,
  title,
  intensityLabel,
  description,
  selected,
  onPress,
}: ActivityOptionCardProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.activityOptionCard, selected && styles.activityOptionCardSelected]}
    >
      <View style={styles.activityOptionHeader}>
        <Text
          style={[
            styles.activityOptionTitle,
            selected && styles.activityOptionTitleSelected,
          ]}
        >
          {title}
        </Text>
        <EntryBadge
          label={intensityLabel}
          accent={selected ? '#DCEEFF' : '#EEF3FB'}
        />
      </View>
      <Text
        style={[
          styles.activityOptionMeta,
          selected && styles.activityOptionMetaSelected,
        ]}
      >
        {optionKey.replace(/^[^-]+-/, '').replace('-', ' ')}
      </Text>
      <Text style={styles.activityOptionDescription}>{description}</Text>
    </Pressable>
  );
}

function FoodEntryRow({ entry }: { entry: FoodEntry }): React.JSX.Element {
  return (
    <View style={styles.foodEntryCard}>
      <View style={styles.foodEntryHeader}>
        <Text style={styles.foodEntryTitle}>{entry.itemName}</Text>
        <Text style={styles.foodEntryTime}>
          {new Date(entry.occurredAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <Text style={styles.foodEntryMeta}>
        {entry.mealType} • {entry.quantityValue} {entry.quantityUnit}
        {entry.caffeineMg > 0 ? ` • ${Math.round(entry.caffeineMg)}mg caffeine` : ''}
      </Text>
    </View>
  );
}

function ActivitySessionRow({
  session,
}: {
  session: PhysicalActivitySession;
}): React.JSX.Element {
  return (
    <View style={styles.foodEntryCard}>
      <View style={styles.foodEntryHeader}>
        <Text style={styles.foodEntryTitle}>{session.title}</Text>
        <Text style={styles.foodEntryTime}>
          {new Date(session.startedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <Text style={styles.foodEntryMeta}>
        {session.category} | {session.intensityLabel} | {formatDurationClock(session.durationSeconds)} |{' '}
        {Math.round(session.caloriesBurned)} kcal
      </Text>
    </View>
  );
}

export function LogScreen(): React.JSX.Element {
  const {
    logForm,
    setLogField,
    saveLog,
    saveFoodEntry,
    startTimedActivity,
    stopTimedActivity,
    logs,
    foodEntries,
    activitySessions,
    activeActivityTimer,
    profile,
    pendingSyncCount,
    isStorageReady,
  } = useHealthData();
  const [savedMessage, setSavedMessage] = useState('');
  const [foodDraft, setFoodDraft] = useState<FoodEntryDraft>(getDefaultFoodDraft());
  const [selectedActivityKey, setSelectedActivityKey] =
    useState<PhysicalActivityOptionKey>('running-jogging');
  const [activityElapsedSeconds, setActivityElapsedSeconds] = useState(0);

  const selectedActivityOption = useMemo(
    () =>
      PHYSICAL_ACTIVITY_OPTIONS.find(option => option.key === selectedActivityKey) ??
      PHYSICAL_ACTIVITY_OPTIONS[0],
    [selectedActivityKey],
  );
  const displayedActivityOption = useMemo(
    () =>
      PHYSICAL_ACTIVITY_OPTIONS.find(
        option => option.key === (activeActivityTimer?.optionKey ?? selectedActivityKey),
      ) ?? selectedActivityOption,
    [activeActivityTimer?.optionKey, selectedActivityKey, selectedActivityOption],
  );

  const groupedActivityOptions = useMemo(() => {
    return PHYSICAL_ACTIVITY_OPTIONS.reduce<
      Record<PhysicalActivityCategory, typeof PHYSICAL_ACTIVITY_OPTIONS>
    >(
      (groups, option) => {
        groups[option.category].push(option);
        return groups;
      },
      {
        Running: [],
        Cycling: [],
        Swimming: [],
      },
    );
  }, []);

  const lastSaved = useMemo(() => {
    if (!logs[0]) {
      return 'No entry yet';
    }
    return `Last entry ${getEntryDateLabel(logs[0].timestamp)} at ${getEntryTimeLabel(
      logs[0].timestamp,
    )}`;
  }, [logs]);

  useEffect(() => {
    if (!activeActivityTimer) {
      setActivityElapsedSeconds(0);
      return;
    }

    const tick = () => {
      setActivityElapsedSeconds(
        Math.max(
          0,
          Math.round(
            (Date.now() - new Date(activeActivityTimer.startedAt).getTime()) / 1000,
          ),
        ),
      );
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeActivityTimer]);

  const handleInput = <K extends keyof LogFormState>(
    field: K,
    value: LogFormState[K],
  ) => {
    setSavedMessage('');
    setLogField(field, value);
  };

  const adjustNumericField = (
    field: 'waterIntake' | 'sleepHours',
    delta: number,
  ) => {
    const currentValue = Number.parseFloat(logForm[field]) || 0;
    const nextValue = Math.max(0, currentValue + delta);
    handleInput(field, nextValue.toFixed(1));
  };

  const setMetricField = (field: 'waterIntake' | 'sleepHours', value: number) => {
    handleInput(field, value.toFixed(1));
  };

  const handleSave = () => {
    const persist = async () => {
      const { result, sync } = await saveLog();
      setSavedMessage(
        sync.state === 'error'
          ? 'Saved offline, but the sync failed and will retry.'
          : sync.state === 'offline' || sync.pending > 0
            ? 'Saved offline, waiting to sync.'
            : result === 'created'
              ? 'Saved and synced to your account.'
              : "Updated today's log and synced it to your account.",
      );
    };

    persist();
  };

  const handleFoodDraftChange = <K extends keyof FoodEntryDraft>(
    field: K,
    value: FoodEntryDraft[K],
  ) => {
    setFoodDraft(current => ({
      ...current,
      [field]: value,
    }));
  };

  const handleAddFoodEntry = () => {
    if (foodDraft.itemName.trim().length === 0) {
      setSavedMessage('Add a food or drink name before saving a structured entry.');
      return;
    }

    const persist = async () => {
      const occurredAt = buildTodayIsoFromTime(foodDraft.timeText);
      await saveFoodEntry({
        localDate: getLocalDateFromIso(occurredAt),
        occurredAt,
        mealType: foodDraft.mealType,
        itemName: foodDraft.itemName.trim(),
        quantityValue: Math.max(
          0.1,
          Number.parseFloat(foodDraft.quantityValue || '1') || 1,
        ),
        quantityUnit: foodDraft.quantityUnit.trim() || 'serving',
        caffeineMg: Math.max(0, Number.parseFloat(foodDraft.caffeineMg || '0') || 0),
        isCaffeinated:
          (Number.parseFloat(foodDraft.caffeineMg || '0') || 0) > 0,
        source: 'manual',
      });
      setFoodDraft(getDefaultFoodDraft());
      setSavedMessage('Structured food entry saved. Check the sync status above.');
    };

    persist();
  };

  const handleStartTimedActivity = () => {
    const begin = async () => {
      try {
        await startTimedActivity(selectedActivityKey);
        setSavedMessage(
          `${selectedActivityOption.title} timer started. Step tracking is paused until you stop this session.`,
        );
      } catch (error) {
        setSavedMessage(
          error instanceof Error ? error.message : 'Unable to start the activity timer.',
        );
      }
    };

    begin();
  };

  const handleStopTimedActivity = () => {
    const finish = async () => {
      try {
        const session = await stopTimedActivity();
        setSavedMessage(
          `${session.title} saved for ${formatDurationClock(session.durationSeconds)} and ${Math.round(
            session.caloriesBurned,
          )} kcal. Step tracking has resumed.`,
        );
      } catch (error) {
        setSavedMessage(
          error instanceof Error ? error.message : 'Unable to save the timed activity.',
        );
      }
    };

    finish();
  };

  return (
    <ScreenShell
      title="Daily Log"
      subtitle="Track sleep, hydration, mood, diet, and symptoms. SQLite keeps an offline cache while your account syncs with Supabase."
    >
      <AppCard title="Today's Check-In">
        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>
              {isStorageReady ? 'Account cache ready' : 'Preparing offline cache'}
            </Text>
          </View>
          <Text style={styles.statusMeta}>
            {logs.length} daily logs | {pendingSyncCount} waiting to sync
          </Text>
        </View>

        <FieldLabel label="Sleep Quality" />
        <SleepQualitySelector
          value={logForm.sleepQuality}
          onChange={next => handleInput('sleepQuality', next)}
        />
        <Text style={styles.selectedText}>
          Selected: {logForm.sleepQuality}/5 {getSleepQualityLabel(logForm.sleepQuality)}
        </Text>

        <FieldLabel label="Sleep Duration (hours)" />
        <View style={styles.metricRow}>
          <TextInput
            value={logForm.sleepHours}
            onChangeText={text => handleInput('sleepHours', text)}
            keyboardType="decimal-pad"
            placeholder="7.5"
            placeholderTextColor="#97A4BA"
            style={[styles.input, styles.metricInput]}
          />
          <QuickActionButton
            label="-0.5h"
            onPress={() => adjustNumericField('sleepHours', -0.5)}
          />
          <QuickActionButton
            label="+0.5h"
            onPress={() => adjustNumericField('sleepHours', 0.5)}
          />
          <QuickActionButton label="7.5h" onPress={() => setMetricField('sleepHours', 7.5)} />
        </View>

        <FieldLabel label="Water Intake (L)" />
        <View style={styles.metricHero}>
          <Text style={styles.metricHeroValue}>
            {logForm.waterIntake || '0.0'}
            <Text style={styles.metricHeroUnit}>L</Text>
          </Text>
          <Text style={styles.metricHeroLabel}>Daily hydration target: 2.3L</Text>
        </View>
        <View style={styles.quickActionRow}>
          <QuickActionButton
            label="-0.25L"
            onPress={() => adjustNumericField('waterIntake', -0.25)}
          />
          <QuickActionButton
            label="+0.25L"
            onPress={() => adjustNumericField('waterIntake', 0.25)}
          />
          <QuickActionButton label="2.0L" onPress={() => setMetricField('waterIntake', 2.0)} />
          <QuickActionButton label="2.5L" onPress={() => setMetricField('waterIntake', 2.5)} />
        </View>
        <TextInput
          value={logForm.waterIntake}
          onChangeText={text => handleInput('waterIntake', text)}
          keyboardType="decimal-pad"
          placeholder="2.0"
          placeholderTextColor="#97A4BA"
          style={styles.input}
        />

        <FieldLabel label="Mood" />
        <MoodSelector value={logForm.mood} onChange={next => handleInput('mood', next)} />

        <Pressable onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveText}>Save Daily Log</Text>
        </Pressable>
        <Text style={styles.helperText}>{savedMessage || lastSaved}</Text>
      </AppCard>

      <AppCard title="Meals and Symptoms">
        <FieldLabel label="Diet" />
        <TextInput
          value={logForm.diet}
          onChangeText={text => handleInput('diet', text)}
          placeholder="e.g., oats breakfast, rice bowl lunch, soup dinner"
          placeholderTextColor="#97A4BA"
          multiline
          style={[styles.input, styles.multiline]}
        />

        <FieldLabel label="Symptoms" />
        <TextInput
          value={logForm.symptoms}
          onChangeText={text => handleInput('symptoms', text)}
          placeholder="e.g., mild headache, low energy, bloating"
          placeholderTextColor="#97A4BA"
          multiline
          style={[styles.input, styles.multiline]}
        />
      </AppCard>

      <AppCard title="Structured Meals and Drinks">
        <Text style={styles.timelineText}>
          These timestamped entries power real correlations like late-caffeine versus
          sleep quality. They are separate from the free-text meal note above.
        </Text>

        <FieldLabel label="Meal Type" />
        <View style={styles.mealChipRow}>
          {MEAL_TYPES.map(type => (
            <MealTypeChip
              key={type}
              value={type}
              selected={foodDraft.mealType === type}
              onPress={() => handleFoodDraftChange('mealType', type)}
            />
          ))}
        </View>

        <FieldLabel label="Item Name" />
        <TextInput
          value={foodDraft.itemName}
          onChangeText={text => handleFoodDraftChange('itemName', text)}
          placeholder="e.g., Coffee, Greek yogurt bowl, Pasta"
          placeholderTextColor="#97A4BA"
          style={styles.input}
        />

        <View style={styles.dualFieldRow}>
          <View style={styles.dualField}>
            <FieldLabel label="Quantity" />
            <TextInput
              value={foodDraft.quantityValue}
              onChangeText={text => handleFoodDraftChange('quantityValue', text)}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor="#97A4BA"
              style={styles.input}
            />
          </View>
          <View style={styles.dualField}>
            <FieldLabel label="Unit" />
            <TextInput
              value={foodDraft.quantityUnit}
              onChangeText={text => handleFoodDraftChange('quantityUnit', text)}
              placeholder="cup"
              placeholderTextColor="#97A4BA"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.dualFieldRow}>
          <View style={styles.dualField}>
            <FieldLabel label="Time (24h)" />
            <TextInput
              value={foodDraft.timeText}
              onChangeText={text => handleFoodDraftChange('timeText', text)}
              placeholder="17:20"
              placeholderTextColor="#97A4BA"
              style={styles.input}
            />
          </View>
          <View style={styles.dualField}>
            <FieldLabel label="Caffeine (mg)" />
            <TextInput
              value={foodDraft.caffeineMg}
              onChangeText={text => handleFoodDraftChange('caffeineMg', text)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#97A4BA"
              style={styles.input}
            />
          </View>
        </View>

        <Pressable onPress={handleAddFoodEntry} style={styles.saveButton}>
          <Text style={styles.saveText}>Save Structured Entry</Text>
        </Pressable>

        <View style={styles.timelineList}>
          {foodEntries.slice(0, 6).map(entry => (
            <FoodEntryRow key={entry.id} entry={entry} />
          ))}
        </View>
      </AppCard>

      <AppCard title="Timed Activity">
        <Text style={styles.timelineText}>
          Record a workout with a live timer. Step tracking pauses while the timer runs so workout movement does not get counted twice.
        </Text>
        <Text style={styles.activitySupportText}>
          {profile?.weightKg
            ? `Calorie estimates use your saved weight of ${formatMetricValue(profile.weightKg)} kg.`
            : 'Add your weight in Profile before starting a timed activity.'}
        </Text>

        {(['Running', 'Cycling', 'Swimming'] as PhysicalActivityCategory[]).map(category => (
          <View key={category} style={styles.activitySection}>
            <FieldLabel label={category} />
            <View style={styles.activityOptionList}>
              {groupedActivityOptions[category].map(option => (
                <ActivityOptionCard
                  key={option.key}
                  optionKey={option.key}
                  title={option.title}
                  intensityLabel={option.intensityLabel}
                  description={option.description}
                  selected={
                    (activeActivityTimer?.optionKey ?? selectedActivityKey) === option.key
                  }
                  onPress={() => setSelectedActivityKey(option.key)}
                />
              ))}
            </View>
          </View>
        ))}

        <View style={styles.activityTimerCard}>
          <Text style={styles.activityTimerLabel}>
            {activeActivityTimer ? 'Current session' : 'Selected workout'}
          </Text>
          <Text style={styles.activityTimerTitle}>
            {displayedActivityOption.title}
          </Text>
          <Text style={styles.activityTimerMeta}>
            {displayedActivityOption.intensityLabel}{' '}
            |{' '}
            {profile?.weightKg
              ? `${Math.round(
                  estimateCaloriesBurnedFromActivity(
                    displayedActivityOption.metValue,
                    activeActivityTimer ? activityElapsedSeconds : 1800,
                    profile.weightKg,
                  ),
                )} kcal ${activeActivityTimer ? 'so far' : 'per 30 min estimate'}`
              : 'Weight required for calorie estimate'}
          </Text>
          <Text style={styles.activityTimerClock}>
            {formatDurationClock(activityElapsedSeconds)}
          </Text>
          <View style={styles.activityActionRow}>
            <Pressable
              onPress={handleStartTimedActivity}
              disabled={Boolean(activeActivityTimer) || !profile?.weightKg}
              style={[
                styles.saveButton,
                styles.activityActionButton,
                (activeActivityTimer || !profile?.weightKg) && styles.saveButtonDisabled,
              ]}
            >
              <Text style={styles.saveText}>Start Activity</Text>
            </Pressable>
            <Pressable
              onPress={handleStopTimedActivity}
              disabled={!activeActivityTimer}
              style={[
                styles.saveButton,
                styles.activityActionButton,
                !activeActivityTimer && styles.saveButtonDisabled,
              ]}
            >
              <Text style={styles.saveText}>Stop and Save</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.timelineList}>
          {activitySessions.slice(0, 4).map(session => (
            <ActivitySessionRow key={session.id} session={session} />
          ))}
        </View>
      </AppCard>

      <AppCard title="Recent Entries">
        <Text style={styles.timelineText}>
          These are your most recent account-backed entries, cached locally so
          they stay available offline.
        </Text>
        <View style={styles.timelineList}>
          {logs.slice(0, 5).map(entry => (
            <RecentEntry key={entry.id} entry={entry} />
          ))}
        </View>
      </AppCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  statusMeta: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    color: colors.textSecondary,
  },
  fieldLabel: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#FBFCFF',
  },
  multiline: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricInput: {
    flex: 1.2,
  },
  dualFieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dualField: {
    flex: 1,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  quickActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricHero: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  metricHeroValue: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricHeroUnit: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  metricHeroLabel: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  selectedText: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  saveButton: {
    marginTop: 18,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  helperText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
  },
  timelineText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  timelineList: {
    gap: 10,
  },
  entryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  entryDate: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  entryTime: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  entryBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 10,
    marginBottom: 10,
  },
  entryBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  entryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  entrySummary: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  mealChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  mealChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mealChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  mealChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  mealChipTextSelected: {
    color: colors.primary,
  },
  foodEntryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  foodEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  foodEntryTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  foodEntryTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  foodEntryMeta: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
  },
  activitySupportText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  activitySection: {
    marginTop: 6,
  },
  activityOptionList: {
    gap: 10,
  },
  activityOptionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  activityOptionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  activityOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  activityOptionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  activityOptionTitleSelected: {
    color: colors.primary,
  },
  activityOptionMeta: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  activityOptionMetaSelected: {
    color: colors.primary,
  },
  activityOptionDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  activityTimerCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 14,
  },
  activityTimerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  activityTimerTitle: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  activityTimerMeta: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  activityTimerClock: {
    marginTop: 10,
    fontSize: 34,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  activityActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 14,
  },
  activityActionButton: {
    flex: 1,
    marginTop: 0,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
});
