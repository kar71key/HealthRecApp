package com.healthrecapp.steps

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference

object StepCounterBridge {
  const val MODULE_NAME = "AndroidStepCounter"
  const val EVENT_STEP_UPDATE = "AndroidStepCounter:StepUpdate"

  private var reactContextRef: WeakReference<ReactApplicationContext>? = null

  fun attachReactContext(reactContext: ReactApplicationContext) {
    reactContextRef = WeakReference(reactContext)
  }

  fun detachReactContext(reactContext: ReactApplicationContext) {
    val current = reactContextRef?.get()
    if (current == reactContext) {
      reactContextRef = null
    }
  }

  fun emitSnapshot(snapshot: StepCounterSnapshot) {
    val reactContext = reactContextRef?.get() ?: return
    if (!reactContext.hasActiveReactInstance()) {
      return
    }

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT_STEP_UPDATE, StepCounterStore.toWritableMap(snapshot))
  }
}
