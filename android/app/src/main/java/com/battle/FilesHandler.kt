// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package com.eisai_ota_boot;

//import static java.util.stream.Collectors.joining;


import android.content.Context;

import android.os.Build;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;
import java.io.FileOutputStream;


@RequiresApi(Build.VERSION_CODES.N)
class FilesHandler(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  companion object {
    private lateinit var reactContext: ReactApplicationContext
  }

  init {
    reactContext = context
  }

  @NonNull
  override fun getName(): String {
    return "FilesHandler"
  }

  // It returns the mode path in the app package,
  // so that onnxruntime is able to load a model using a given path.

  @ReactMethod
  fun getFilePath(filename: String, promise: Promise) {
    try {
      val modelPath = copyFile(reactContext, filename)
      promise.resolve(modelPath)
    } catch (e: Exception) {
      promise.reject("Can't get a model", e)
    }
  }

  /*
   Copy a file from assets to data folder and return a URI for the copied file.
  */
  @Throws(Exception::class)
  private fun copyFile(context: Context, filename: String): String {
    val file = File(context.getExternalFilesDir(null), filename)
    if (!file.exists()) {
      context.assets.open(filename).use { inputStream ->
        FileOutputStream(file).use { outputStream ->
          val buffer = ByteArray(1024)
          var read: Int
          while (inputStream.read(buffer).also { read = it } != -1) {
            outputStream.write(buffer, 0, read)
          }
        }
      }
    }
    return file.toURI().toString()
  }
}
