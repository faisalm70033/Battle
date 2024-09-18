// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package com.battle;

import static java.util.stream.Collectors.joining;


import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.core.math.MathUtils;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@RequiresApi(api = Build.VERSION_CODES.N)
public class FilesHandler extends ReactContextBaseJavaModule {
  private static ReactApplicationContext reactContext;

  FilesHandler(ReactApplicationContext context) throws Exception {
    super(context);
    reactContext = context;
  }

  @NonNull
  @Override
  public String getName() {
    return "FilesHandler";
  }

  // It returns mode path in app package,
  // so that onnxruntime is able to load a model using a given path.
 


  @ReactMethod
  public void getFilePath(String filename,Promise promise) {
    try {
      String modelPath = copyFile(reactContext, filename);
      promise.resolve(modelPath);
    } catch (Exception e) {
      promise.reject("Can't get a mdoel", e);
    }
  }



  /*
    Copy a file from assets to data folder and return an uri for copied file.
   */
  private static String copyFile(Context context, String filename) throws Exception {
    File file = new File(context.getExternalFilesDir(null), filename);
    if (!file.exists()) {
      try (InputStream in = context.getAssets().open(filename)) {
        try (OutputStream out = new FileOutputStream(file)) {
          byte[] buffer = new byte[1024];
          int read = in.read(buffer);
          while (read != -1) {
            out.write(buffer, 0, read);
            read = in.read(buffer);
          }
        }
      }
    }

    return file.toURI().toString();
  }
}
