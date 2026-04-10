package com.healthrecapp.steps

import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class StepCounterModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = StepCounterBridge.MODULE_NAME

  override fun initialize() {
    super.initialize()
    StepCounterBridge.attachReactContext(reactContext)
  }

  override fun invalidate() {
    StepCounterBridge.detachReactContext(reactContext)
    super.invalidate()
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for React Native event emitter compatibility.
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    // Required for React Native event emitter compatibility.
  }

  @ReactMethod
  fun startService(promise: Promise) {
    if (!StepCounterStore.hasActivityPermission(reactContext)) {
      promise.reject(
        "ACTIVITY_PERMISSION_DENIED",
        "Activity Recognition permission is required to track steps.",
      )
      return
    }

    val intent = Intent(reactContext, StepCounterService::class.java).apply {
      action = StepCounterService.ACTION_START
    }
    ContextCompat.startForegroundService(reactContext, intent)
    StepCounterStore.markServiceRunning(reactContext, true)
    promise.resolve(StepCounterStore.toWritableMap(StepCounterStore.ensureCurrentSession(reactContext)))
  }

  @ReactMethod
  fun stopService(promise: Promise) {
    val intent = Intent(reactContext, StepCounterService::class.java).apply {
      action = StepCounterService.ACTION_STOP
    }
    reactContext.startService(intent)
    promise.resolve(null)
  }

  @ReactMethod
  fun getCurrentStepCount(promise: Promise) {
    val snapshot = StepCounterStore.ensureCurrentSession(reactContext)
    promise.resolve(snapshot.stepCount)
  }

  @ReactMethod
  fun getSnapshot(promise: Promise) {
    promise.resolve(StepCounterStore.toWritableMap(StepCounterStore.ensureCurrentSession(reactContext)))
  }
}
