package com.battle

import android.app.Application
import android.content.Context
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactInstanceManager
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import com.oblador.vectoricons.VectorIconsPackage
import java.lang.reflect.InvocationTargetException


class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
//        override fun getPackages(): List<ReactPackage> =
//            PackageList(this).packages.apply {
//
//              // Packages that cannot be autolinked yet can be added manually here, for example:
//                if (none { it is VectorIconsPackage }) {
//                    add(VectorIconsPackage())
//                }
//                add(FilesHandlerPackage())
//            }

          override fun getPackages(): List<ReactPackage> =
              PackageList(this).packages.apply {
                  // Add manually linked packages here
                  if (none { it is VectorIconsPackage }) {
                      add(VectorIconsPackage())
                  }
                  add(FilesHandlerPackage())  // Add your custom package
              }

          override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
        initializeFlipper(this,reactNativeHost.reactInstanceManager)

    }
  }
    private fun initializeFlipper(
        context: Context, reactInstanceManager: ReactInstanceManager
    ) {
        if (BuildConfig.DEBUG) {
            try {
                /*
         We use reflection here to pick up the class that initializes Flipper,
        since Flipper library is not available in release mode
        */
                val aClass = Class.forName("com.eisai_ota_boot.ReactNativeFlipper")
                aClass
                    .getMethod(
                        "initializeFlipper",
                        Context::class.java,
                        ReactInstanceManager::class.java
                    )
                    .invoke(null, context, reactInstanceManager)
            } catch (e: ClassNotFoundException) {
                e.printStackTrace()
            } catch (e: NoSuchMethodException) {
                e.printStackTrace()
            } catch (e: IllegalAccessException) {
                e.printStackTrace()
            } catch (e: InvocationTargetException) {
                e.printStackTrace()
            }
        }
    }
}
