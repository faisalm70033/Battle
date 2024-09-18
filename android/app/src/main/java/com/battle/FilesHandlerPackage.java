// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package com.battle;

import android.os.Build;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class FilesHandlerPackage implements ReactPackage {
  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }

  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    List<NativeModule> modules = new ArrayList<>();

    try {
    
        modules.add(new FilesHandler(reactContext));
      
    } catch (Exception e) {
      // do nothing. a module is not added into a package.
    }

    return modules;
  }
}
