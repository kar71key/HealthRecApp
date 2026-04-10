package com.healthrecapp.steps

import android.Manifest
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.time.LocalDate

data class StepCounterSnapshot(
  val stepCount: Int,
  val sessionDate: String,
  val sessionStartedAt: Long,
  val lastUpdatedAt: Long,
  val serviceRunning: Boolean,
  val sensorAvailable: Boolean,
  val permissionGranted: Boolean,
)

object StepCounterStore {
  private const val PREFS_NAME = "health_rec_step_counter"
  private const val KEY_BASELINE = "baseline"
  private const val KEY_ACCUMULATED = "accumulated"
  private const val KEY_CURRENT_STEP_COUNT = "current_step_count"
  private const val KEY_LAST_RAW_SENSOR_VALUE = "last_raw_sensor_value"
  private const val KEY_SESSION_DATE = "session_date"
  private const val KEY_SESSION_STARTED_AT = "session_started_at"
  private const val KEY_LAST_UPDATED_AT = "last_updated_at"
  private const val KEY_BOOT_COUNT = "boot_count"
  private const val KEY_SENSOR_AVAILABLE = "sensor_available"
  private const val KEY_SERVICE_RUNNING = "service_running"
  private const val UNSET_FLOAT = -1f

  private fun getPrefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun getTodayKey(): String = LocalDate.now().toString()

  private fun getBootCount(context: Context): Int =
    try {
      Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, 0)
    } catch (_: Exception) {
      0
    }

  fun hasActivityPermission(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return true
    }

    return ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACTIVITY_RECOGNITION,
    ) == PackageManager.PERMISSION_GRANTED
  }

  fun markServiceRunning(context: Context, running: Boolean) {
    getPrefs(context).edit().putBoolean(KEY_SERVICE_RUNNING, running).apply()
  }

  fun markSensorAvailability(context: Context, available: Boolean) {
    getPrefs(context).edit().putBoolean(KEY_SENSOR_AVAILABLE, available).apply()
  }

  fun ensureCurrentSession(context: Context): StepCounterSnapshot {
    val prefs = getPrefs(context)
    val today = getTodayKey()
    val sessionDate = prefs.getString(KEY_SESSION_DATE, null)
    if (sessionDate != today) {
      val storedBootCount = prefs.getInt(KEY_BOOT_COUNT, getBootCount(context))
      val currentBootCount = getBootCount(context)
      val lastRawSensorValue = prefs.getFloat(KEY_LAST_RAW_SENSOR_VALUE, UNSET_FLOAT)
      val nextBaseline =
        if (storedBootCount == currentBootCount && lastRawSensorValue >= 0f) {
          lastRawSensorValue
        } else {
          UNSET_FLOAT
        }
      val now = System.currentTimeMillis()
      prefs.edit()
        .putString(KEY_SESSION_DATE, today)
        .putFloat(KEY_BASELINE, nextBaseline)
        .putInt(KEY_ACCUMULATED, 0)
        .putInt(KEY_CURRENT_STEP_COUNT, 0)
        .putInt(KEY_BOOT_COUNT, currentBootCount)
        .putLong(KEY_SESSION_STARTED_AT, now)
        .putLong(KEY_LAST_UPDATED_AT, now)
        .apply()
    }

    return getSnapshot(context)
  }

  fun recordSensorValue(context: Context, rawSensorValue: Float): StepCounterSnapshot {
    val prefs = getPrefs(context)
    val now = System.currentTimeMillis()
    val today = getTodayKey()
    val currentBootCount = getBootCount(context)
    val storedBootCount = prefs.getInt(KEY_BOOT_COUNT, currentBootCount)
    val lastRawSensorValue = prefs.getFloat(KEY_LAST_RAW_SENSOR_VALUE, UNSET_FLOAT)
    val existingSessionDate = prefs.getString(KEY_SESSION_DATE, null)
    var baseline = prefs.getFloat(KEY_BASELINE, UNSET_FLOAT)
    var accumulated = prefs.getInt(KEY_ACCUMULATED, 0)
    var currentStepCount = prefs.getInt(KEY_CURRENT_STEP_COUNT, 0)
    var sessionStartedAt = prefs.getLong(KEY_SESSION_STARTED_AT, now)

    if (existingSessionDate != today) {
      baseline =
        if (storedBootCount == currentBootCount && lastRawSensorValue >= 0f) {
          lastRawSensorValue
        } else {
          rawSensorValue
        }
      accumulated = 0
      currentStepCount = 0
      sessionStartedAt = now
    } else if (
      storedBootCount != currentBootCount ||
        (baseline >= 0f && rawSensorValue < baseline) ||
        (lastRawSensorValue >= 0f && rawSensorValue < lastRawSensorValue)
    ) {
      accumulated = currentStepCount
      baseline = rawSensorValue
    } else if (baseline < 0f) {
      baseline = rawSensorValue
      currentStepCount = accumulated
      if (sessionStartedAt <= 0L) {
        sessionStartedAt = now
      }
    }

    if (baseline >= 0f) {
      currentStepCount = accumulated + maxOf((rawSensorValue - baseline).toInt(), 0)
    }

    prefs.edit()
      .putFloat(KEY_BASELINE, baseline)
      .putInt(KEY_ACCUMULATED, accumulated)
      .putInt(KEY_CURRENT_STEP_COUNT, currentStepCount)
      .putFloat(KEY_LAST_RAW_SENSOR_VALUE, rawSensorValue)
      .putString(KEY_SESSION_DATE, today)
      .putLong(KEY_SESSION_STARTED_AT, sessionStartedAt)
      .putLong(KEY_LAST_UPDATED_AT, now)
      .putInt(KEY_BOOT_COUNT, currentBootCount)
      .putBoolean(KEY_SENSOR_AVAILABLE, true)
      .putBoolean(KEY_SERVICE_RUNNING, true)
      .apply()

    return getSnapshot(context)
  }

  fun getSnapshot(context: Context): StepCounterSnapshot {
    val prefs = getPrefs(context)
    val now = System.currentTimeMillis()
    return StepCounterSnapshot(
      stepCount = prefs.getInt(KEY_CURRENT_STEP_COUNT, 0),
      sessionDate = prefs.getString(KEY_SESSION_DATE, getTodayKey()) ?: getTodayKey(),
      sessionStartedAt = prefs.getLong(KEY_SESSION_STARTED_AT, now),
      lastUpdatedAt = prefs.getLong(KEY_LAST_UPDATED_AT, 0L),
      serviceRunning = prefs.getBoolean(KEY_SERVICE_RUNNING, false),
      sensorAvailable = prefs.getBoolean(KEY_SENSOR_AVAILABLE, true),
      permissionGranted = hasActivityPermission(context),
    )
  }

  fun toWritableMap(snapshot: StepCounterSnapshot): WritableMap =
    Arguments.createMap().apply {
      putInt("stepCount", snapshot.stepCount)
      putString("sessionDate", snapshot.sessionDate)
      putDouble("sessionStartedAt", snapshot.sessionStartedAt.toDouble())
      putDouble("lastUpdatedAt", snapshot.lastUpdatedAt.toDouble())
      putBoolean("serviceRunning", snapshot.serviceRunning)
      putBoolean("sensorAvailable", snapshot.sensorAvailable)
      putBoolean("permissionGranted", snapshot.permissionGranted)
    }
}
