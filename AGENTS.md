# AGENTS.md

Draft repository guide for agents working in this codebase.

## Project Overview

HealthRecApp is a bare React Native app focused on personal health tracking and lightweight insights.

Current implemented areas:

- Email/password authentication through Supabase Auth.
- Offline-first health data storage in local SQLite with queued sync to Supabase.
- Android-native step tracking using a foreground service and `TYPE_STEP_COUNTER`.
- Manual daily logging for sleep, hydration, mood, diet, symptoms, and structured food/drink entries.
- Nutrition image analysis in the `Nutri` tab using FatSecret and Gemini.
- Symptom checker UI in the `Checker` tab that talks to a HuggingFace-hosted backend.
- Insights generated locally from synced data and cached as insight snapshots.
- Timed physical activity logging for running, cycling, and swimming, with calorie estimates based on duration and body weight.

Project priority is currently Android. iOS support exists in the repo structure but is not the active focus. Needs verification.

## Folder Structure

- [`App.tsx`](C:/dev/HealthRecApp/HealthRecApp/App.tsx): top-level app entry.
- [`navigation/`](C:/dev/HealthRecApp/HealthRecApp/navigation): root stack and bottom-tab navigation.
- [`screens/`](C:/dev/HealthRecApp/HealthRecApp/screens): app screens.
  - `DashboardScreen.tsx`
  - `ActivityScreen.tsx`
  - `LogScreen.tsx`
  - `InsightsScreen.tsx`
  - `NutriScreen.tsx`
  - `SymptomCheckerScreen.tsx`
  - `LoginScreen.tsx`
- [`components/`](C:/dev/HealthRecApp/HealthRecApp/components): shared UI components such as cards, charts, selectors, and the screen shell.
- [`context/`](C:/dev/HealthRecApp/HealthRecApp/context): app-wide state providers.
  - [`AuthContext.tsx`](C:/dev/HealthRecApp/HealthRecApp/context/AuthContext.tsx)
  - [`HealthDataContext.tsx`](C:/dev/HealthRecApp/HealthRecApp/context/HealthDataContext.tsx)
- [`repositories/`](C:/dev/HealthRecApp/HealthRecApp/repositories): repository layer for SQLite persistence, migrations, sync queueing, and data mapping.
  - [`healthRepository.ts`](C:/dev/HealthRecApp/HealthRecApp/repositories/healthRepository.ts)
- [`services/`](C:/dev/HealthRecApp/HealthRecApp/services): domain services and integrations.
  - local DB and sync: `localDb.ts`, `sync.ts`, `supabase.ts`
  - analytics and calculations: `insights.ts`, `calorieEstimate.ts`, `activityCalories.ts`
  - external APIs: `fatSecret.ts`, `geminiNutri.ts`
  - secrets template: `appSecrets.example.ts`
  - Android bridge wrapper: `androidStepCounter.ts`
- [`types/`](C:/dev/HealthRecApp/HealthRecApp/types): shared TypeScript models for persisted data and UI state.
- [`theme/`](C:/dev/HealthRecApp/HealthRecApp/theme): color/theme tokens.
- [`android/`](C:/dev/HealthRecApp/HealthRecApp/android): Android native project.
  - [`android/app/src/main/java/com/healthrecapp/steps/`](C:/dev/HealthRecApp/HealthRecApp/android/app/src/main/java/com/healthrecapp/steps): native step-tracking service, store, bridge, module, package, and boot receiver.
- [`supabase/`](C:/dev/HealthRecApp/HealthRecApp/supabase): SQL schema and RLS policies.
  - [`schema.sql`](C:/dev/HealthRecApp/HealthRecApp/supabase/schema.sql)
- [`patches/`](C:/dev/HealthRecApp/HealthRecApp/patches): `patch-package` patches required after install.
- [`__tests__/`](C:/dev/HealthRecApp/HealthRecApp/__tests__): Jest tests.

There are also non-app artifacts in the repo root such as screenshots, PDFs, thesis documents, and zip/tar files. These are not part of the runtime app.

## Setup, Build, Test, and Lint

### Setup

Requirements:

- Node `>= 22.11.0` per [`package.json`](C:/dev/HealthRecApp/HealthRecApp/package.json)
- Android toolchain configured locally
- Supabase project configured manually

Install dependencies:

```powershell
npm install
```

Notes:

- `postinstall` runs `patch-package`, so the patch in [`patches/react-native-sqlite-storage+6.0.1.patch`](C:/dev/HealthRecApp/HealthRecApp/patches/react-native-sqlite-storage+6.0.1.patch) is expected to apply automatically.
- Create a local secret file from [`services/appSecrets.example.ts`](C:/dev/HealthRecApp/HealthRecApp/services/appSecrets.example.ts). The real file is [`services/appSecrets.ts`](C:/dev/HealthRecApp/HealthRecApp/services/appSecrets.ts) and is gitignored.
- Supabase tables and RLS policies are not created automatically. Run [`supabase/schema.sql`](C:/dev/HealthRecApp/HealthRecApp/supabase/schema.sql) manually in the Supabase SQL Editor.

### Start Metro

```powershell
npx react-native start
```

### Run Android

General:

```powershell
npm run android
```

Typical emulator/device flow used in this repo:

```powershell
npx react-native run-android --device emulator-5554
```

### Build Android Release APK

```powershell
cd android
.\gradlew.bat assembleRelease
```

APK output:

- [`android/app/build/outputs/apk/release/app-release.apk`](C:/dev/HealthRecApp/HealthRecApp/android/app/build/outputs/apk/release/app-release.apk)

### Useful Android Native Verification

```powershell
cd android
.\gradlew.bat app:compileDebugKotlin --console=plain
```

### Tests

General:

```powershell
npm test
```

Common non-watch form used during implementation:

```powershell
npm test -- --runInBand --watchAll=false
```

### Lint

```powershell
npm run lint
```

Known current lint warnings exist in:

- [`App.tsx`](C:/dev/HealthRecApp/HealthRecApp/App.tsx)
- [`navigation/MainTabs.tsx`](C:/dev/HealthRecApp/HealthRecApp/navigation/MainTabs.tsx)
- [`services/fatSecret.ts`](C:/dev/HealthRecApp/HealthRecApp/services/fatSecret.ts)

## Coding Conventions Followed So Far

- TypeScript is used throughout the app code.
- UI is built with React function components and hooks.
- Shared app state is managed through context providers rather than prop drilling.
- Screens read and write app data through [`HealthDataContext.tsx`](C:/dev/HealthRecApp/HealthRecApp/context/HealthDataContext.tsx), not by calling Supabase directly.
- Persistence and sync logic live in [`healthRepository.ts`](C:/dev/HealthRecApp/HealthRecApp/repositories/healthRepository.ts) and related services, not in screens.
- Persisted app models use camelCase in TypeScript, while SQLite/Supabase rows and payloads map to snake_case at the storage boundary.
- Persisted entities consistently carry `id`, `userId`, `createdAt`, `updatedAt`, and `syncStatus`.
- User-scoped IDs are preferred for persisted entities and generated insight records.
- Date/time handling is centralized through helpers in [`services/date.ts`](C:/dev/HealthRecApp/HealthRecApp/services/date.ts) where practical.
- Calorie estimation logic is centralized in service files instead of being embedded in screen code.
- Android native logic is written in Kotlin under [`android/app/src/main/java/com/healthrecapp`](C:/dev/HealthRecApp/HealthRecApp/android/app/src/main/java/com/healthrecapp).
- Secrets are not meant to be committed. The tracked template is [`services/appSecrets.example.ts`](C:/dev/HealthRecApp/HealthRecApp/services/appSecrets.example.ts), and the real file is local-only.

## Important Implementation Decisions

### Data Storage

- The app is offline-first.
- Local SQLite is the primary app-side store.
- Supabase is the remote backend and long-term source of truth when schema is up to date.
- Sync is queue-based and user-scoped.

Relevant files:

- [`services/localDb.ts`](C:/dev/HealthRecApp/HealthRecApp/services/localDb.ts)
- [`repositories/healthRepository.ts`](C:/dev/HealthRecApp/HealthRecApp/repositories/healthRepository.ts)
- [`services/sync.ts`](C:/dev/HealthRecApp/HealthRecApp/services/sync.ts)

### Auth

- Real auth uses Supabase email/password auth.
- App startup is gated by auth state in [`navigation/RootNavigator.tsx`](C:/dev/HealthRecApp/HealthRecApp/navigation/RootNavigator.tsx).
- Session persistence uses AsyncStorage through Supabase client configuration in [`services/supabase.ts`](C:/dev/HealthRecApp/HealthRecApp/services/supabase.ts).

### Supabase Schema

- Tables and RLS policies are managed manually in [`supabase/schema.sql`](C:/dev/HealthRecApp/HealthRecApp/supabase/schema.sql).
- The app does not auto-provision tables, columns, or policies.
- Schema drift between app code and Supabase has already caused sync issues, so schema updates must be treated as part of any data-model change.

### Step Tracking

- Live step tracking is Android-native, not JS-only.
- The implementation uses a foreground service, shared preferences, a boot receiver, and a React Native native module bridge.
- The current JS hook is [`hooks/useStepCounter.ts`](C:/dev/HealthRecApp/HealthRecApp/hooks/useStepCounter.ts).
- The native bridge wrapper is [`services/androidStepCounter.ts`](C:/dev/HealthRecApp/HealthRecApp/services/androidStepCounter.ts).

### Calories

- Step summaries now store total calories plus a split between step-derived calories and timed-activity calories.
- Timed physical activities are stored as first-class sessions and also rolled into the current day’s calorie total.

### Insights

- Insight facts are generated locally in [`services/insights.ts`](C:/dev/HealthRecApp/HealthRecApp/services/insights.ts) from synced data and cached in `insight_snapshots`.
- Insight snapshot IDs are user-scoped to avoid cross-user collisions under Supabase RLS.

### External APIs

- `Nutri` uses FatSecret image recognition and Gemini.
- Secrets for those services are read from [`services/appSecrets.ts`](C:/dev/HealthRecApp/HealthRecApp/services/appSecrets.ts), which is local-only.
- This is acceptable for prototype/demo use but not production-grade secret handling.

## Files and Folders Agents Should Avoid Editing

Avoid editing these unless the task specifically requires it:

- [`services/appSecrets.ts`](C:/dev/HealthRecApp/HealthRecApp/services/appSecrets.ts): local untracked secrets file.
- [`node_modules/`](C:/dev/HealthRecApp/HealthRecApp/node_modules): installed dependencies.
- Root binary/document artifacts such as PDFs, DOCX files, screenshots, `proj.zip`, and `hermesc.tar.gz`.
- [`patches/react-native-sqlite-storage+6.0.1.patch`](C:/dev/HealthRecApp/HealthRecApp/patches/react-native-sqlite-storage+6.0.1.patch): edit only if intentionally changing the SQLite dependency or patch behavior.
- [`android/app/src/main/java/com/healthrecapp/steps/`](C:/dev/HealthRecApp/HealthRecApp/android/app/src/main/java/com/healthrecapp/steps): native step-tracking code. Changes here should be followed by Android native verification on emulator and a real device.
- [`android/app/build.gradle`](C:/dev/HealthRecApp/HealthRecApp/android/app/build.gradle), [`android/gradle.properties`](C:/dev/HealthRecApp/HealthRecApp/android/gradle.properties), [`android/app/src/main/java/com/healthrecapp/MainApplication.kt`](C:/dev/HealthRecApp/HealthRecApp/android/app/src/main/java/com/healthrecapp/MainApplication.kt), and [`android/app/src/main/java/com/healthrecapp/MainActivity.kt`](C:/dev/HealthRecApp/HealthRecApp/android/app/src/main/java/com/healthrecapp/MainActivity.kt): release/emulator/device compatibility has been fragile here.
- [`ios/`](C:/dev/HealthRecApp/HealthRecApp/ios): avoid unless the task explicitly requires iOS work. Current project focus is Android. Needs verification.

Edit with extra care when touching:

- [`services/supabase.ts`](C:/dev/HealthRecApp/HealthRecApp/services/supabase.ts)
- [`services/sync.ts`](C:/dev/HealthRecApp/HealthRecApp/services/sync.ts)
- [`supabase/schema.sql`](C:/dev/HealthRecApp/HealthRecApp/supabase/schema.sql)
- [`repositories/healthRepository.ts`](C:/dev/HealthRecApp/HealthRecApp/repositories/healthRepository.ts)

Those files are tightly coupled.

## Known Bugs, Quirks, and Gotchas

- Supabase schema changes are manual. If the app starts using a new table or column before [`supabase/schema.sql`](C:/dev/HealthRecApp/HealthRecApp/supabase/schema.sql) has been applied to the real project, sync problems are likely.
- The app currently contains compatibility guards for some missing backend schema, including timed activity sync. That prevents full app failure, but it does not replace the schema update.
- `physical_activity_sessions` remote sync is currently local-first if the backend table has not been created yet.
- Debug Android builds require Metro to be running.
- Android step tracking requires `ACTIVITY_RECOGNITION` permission and a real `TYPE_STEP_COUNTER` sensor.
- Android emulators often do not provide a usable step counter sensor, so step tracking may show as unavailable there.
- Supabase signup may create an account without immediate login if email confirmation is enabled. [`AuthContext.tsx`](C:/dev/HealthRecApp/HealthRecApp/context/AuthContext.tsx) already contains a fallback/error message for this case.
- Release/device behavior has historically differed from emulator behavior after native Android changes. Retest both if touching Android startup, Hermes/JSC, ABI settings, or step-tracking native code.
- `react-native-sqlite-storage` depends on the local patch in [`patches/react-native-sqlite-storage+6.0.1.patch`](C:/dev/HealthRecApp/HealthRecApp/patches/react-native-sqlite-storage+6.0.1.patch).
- Needs verification: `npx tsc --noEmit` and `npm run lint` have occasionally hit local Node memory limits in this environment after larger code changes, even when reruns later succeed.

## Current Unfinished Work

- Apply the latest [`supabase/schema.sql`](C:/dev/HealthRecApp/HealthRecApp/supabase/schema.sql) to the real Supabase project so that:
  - `physical_activity_sessions` exists remotely
  - `step_calories_burned` exists remotely
  - `activity_calories_burned` exists remotely
- End-to-end verify timed physical activity sync after the schema is applied.
- End-to-end verify timed physical activity behavior on a real Android device, including:
  - step tracking pause during the timer
  - step tracking resume after saving
  - no calorie double counting
- iOS support for the current native step-tracking and timed-activity flow. Needs verification.

