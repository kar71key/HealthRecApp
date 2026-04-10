package com.healthrecapp.steps

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class StepCounterBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Intent.ACTION_BOOT_COMPLETED) {
      return
    }

    if (!StepCounterStore.hasActivityPermission(context)) {
      return
    }

    val serviceIntent = Intent(context, StepCounterService::class.java).apply {
      action = StepCounterService.ACTION_START
    }
    ContextCompat.startForegroundService(context, serviceIntent)
  }
}
