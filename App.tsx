// import * as React from 'react';

// import {
//   Platform,
//   PermissionsAndroid,
// } from 'react-native';
// import {NavigationContainer} from '@react-navigation/native';
// import {createStackNavigator} from '@react-navigation/stack';
// import modeSelectionScreen from './screens/modeSelectionScreen';
// import manualMode from './screens/manualMode';
// import brustMode from './screens/brustMode'
// import Controller from './utils/Controller'
// import BleManager from 'react-native-ble-manager';
// // import storage from '@react-native-firebase/storage'
// const Stack = createStackNavigator();
// const App =() => {

//   React.useEffect(async () =>{
//     Controller.getInstance().initialize();
//   })

//   return (
//     <NavigationContainer>
//         <Stack.Navigator initialRouteName ='modeSelectionScreen'>
//         <Stack.Screen
//           name="modeSelectionScreen"
//           component={modeSelectionScreen}
//           options={{
//             headerShown: false,
//           }}
//         />

//         <Stack.Screen
//           name="manualMode"
//           component={manualMode}
//           options={{
//             headerShown: false,
//           }}
//         />

//         <Stack.Screen
//           name="brustMode"
//           component={brustMode}
//           options={{
//             headerShown: false,
//           }}
//         />
//         </Stack.Navigator>
//     </NavigationContainer>
//   );
// }

// export default App;

import React, {Component, useEffect} from 'react';

import {
  View,
  Text,
  // Platform,
  // PermissionsAndroid,
} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import Controller from './utils/Controller';
const Stack = createStackNavigator();
import modeSelectionScreen from './screens/modeSelectionScreen';
import brustMode from './screens/brustMode';
import manualMode from './screens/manualMode';
import qrScan from './screens/qrScan';
const App = () => {
  useEffect(()=>{
    Controller.getInstance().initialize();
  },[]);


  
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="brustMode">
        <Stack.Screen
          name="modeSelectionScreen"
          component={modeSelectionScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="manualMode"
          component={manualMode}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="brustMode"
          component={brustMode}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="qrScan"
          component={qrScan}
          options={{
            headerShown: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
