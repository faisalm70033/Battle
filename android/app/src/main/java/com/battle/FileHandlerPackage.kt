package com.battle

import android.os.Build
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.eisai_ota_boot.FilesHandler // Assuming this is your custom native module

class FilesHandlerPackage : ReactPackage {
    override fun createViewManagers(reactContext: ReactApplicationContext): MutableList<ViewManager<*, *>> {
        // Return an empty list since you don't need view managers
        return mutableListOf()
    }

    override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> {
        val modules = mutableListOf<NativeModule>()

        try {
            // Only add the module if the Android version is >= Android Nougat (API 24)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                modules.add(FilesHandler(reactContext)) // Adding your native module
            }
        } catch (e: Exception) {
            // Handle any exceptions, but continue gracefully
            e.printStackTrace()
        }

        return modules
    }
}
