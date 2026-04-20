package com.healthrecapp

import android.app.Application
import android.os.Build
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.PackageList
import com.healthrecapp.steps.StepCounterPackage

class MainApplication : Application(), ReactApplication {

  private fun isEmulator(): Boolean =
    Build.FINGERPRINT.startsWith("generic") ||
      Build.FINGERPRINT.startsWith("unknown") ||
      Build.MODEL.contains("google_sdk") ||
      Build.MODEL.contains("Emulator") ||
      Build.MODEL.contains("Android SDK built for x86") ||
      Build.MANUFACTURER.contains("Genymotion") ||
      Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic") ||
      Build.PRODUCT == "google_sdk" ||
      Build.PRODUCT == "sdk_google_phone_x86" ||
      Build.PRODUCT == "sdk_google_phone_x86_64" ||
      Build.PRODUCT == "sdk_gphone64_x86_64" ||
      Build.PRODUCT == "sdk_gphone_x86" ||
      Build.PRODUCT == "sdk" ||
      Build.PRODUCT == "sdk_x86" ||
      Build.HARDWARE.contains("ranchu") ||
      Build.HARDWARE.contains("goldfish")

  private fun getAppPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
      add(StepCounterPackage())
    }

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList = getAppPackages(),
      useDevSupport = BuildConfig.DEBUG && !isEmulator(),
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
