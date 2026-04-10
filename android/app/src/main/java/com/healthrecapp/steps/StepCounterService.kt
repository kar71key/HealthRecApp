package com.healthrecapp.steps

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.healthrecapp.MainActivity
import com.healthrecapp.R

class StepCounterService : Service(), SensorEventListener {
  private var sensorManager: SensorManager? = null
  private var stepSensor: Sensor? = null
  private var listenerRegistered = false

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    StepCounterStore.markServiceRunning(this, true)
    startForegroundWithSnapshot(StepCounterStore.ensureCurrentSession(this))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }

    if (!StepCounterStore.hasActivityPermission(this)) {
      StepCounterStore.markServiceRunning(this, false)
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }

    registerSensorListener()
    startForegroundWithSnapshot(StepCounterStore.ensureCurrentSession(this))
    return START_STICKY
  }

  override fun onDestroy() {
    unregisterSensorListener()
    StepCounterStore.markServiceRunning(this, false)
    StepCounterBridge.emitSnapshot(StepCounterStore.getSnapshot(this))
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onSensorChanged(event: SensorEvent?) {
    val sensorEvent = event ?: return
    if (sensorEvent.sensor.type != Sensor.TYPE_STEP_COUNTER) {
      return
    }

    val snapshot = StepCounterStore.recordSensorValue(this, sensorEvent.values[0])
    startForegroundWithSnapshot(snapshot)
    StepCounterBridge.emitSnapshot(snapshot)
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
    // No-op for step counter updates.
  }

  private fun registerSensorListener() {
    if (listenerRegistered) {
      return
    }

    val manager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    val sensor = manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    sensorManager = manager
    stepSensor = sensor

    if (sensor == null) {
      StepCounterStore.markSensorAvailability(this, false)
      StepCounterBridge.emitSnapshot(StepCounterStore.getSnapshot(this))
      return
    }

    listenerRegistered = manager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
    StepCounterStore.markSensorAvailability(this, listenerRegistered)
    StepCounterBridge.emitSnapshot(StepCounterStore.getSnapshot(this))
  }

  private fun unregisterSensorListener() {
    if (!listenerRegistered) {
      return
    }

    sensorManager?.unregisterListener(this)
    listenerRegistered = false
  }

  private fun startForegroundWithSnapshot(snapshot: StepCounterSnapshot) {
    val notification = buildNotification(snapshot)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun buildNotification(snapshot: StepCounterSnapshot): Notification {
    val activityIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      activityIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val contentText =
      if (snapshot.sensorAvailable) {
        "${snapshot.stepCount} steps recorded today"
      } else {
        "Step counter sensor unavailable on this device"
      }

    return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
      .setContentTitle("HealthRec step tracking")
      .setContentText(contentText)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentIntent(pendingIntent)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager = getSystemService(NotificationManager::class.java)
    val existing = manager.getNotificationChannel(NOTIFICATION_CHANNEL_ID)
    if (existing != null) {
      return
    }

    val channel = NotificationChannel(
      NOTIFICATION_CHANNEL_ID,
      "Step Tracking",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Persistent notification for background step tracking."
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  companion object {
    const val ACTION_START = "com.healthrecapp.steps.action.START"
    const val ACTION_STOP = "com.healthrecapp.steps.action.STOP"
    private const val NOTIFICATION_CHANNEL_ID = "healthrec-step-tracking"
    private const val NOTIFICATION_ID = 1207
  }
}
