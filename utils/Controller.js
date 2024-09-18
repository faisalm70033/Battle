// import {NativeModules, NativeEventEmitter} from 'react-native'
// import BleManager from 'react-native-ble-manager';
// import { EventRegister } from 'react-native-event-listeners'
// const BleManagerModule = NativeModules.BleManager;
// const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);
// var isScanning = false;
// export default class Controller {
//     static instance = Controller.instance || new Controller()

//     initialize()
//     {
//         BleManager.start({ showAlert: false }).then(() => {
//             // Success code
//             console.log("Module initialized");
//             bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral);
//             bleManagerEmitter.addListener('BleManagerStopScan', this.handleStopScan );

//           });
//     }
//     scanDevices() {
//         if (!isScanning) {
//             BleManager.scan([], 10, true).then((results) => {
//               console.log('Scanning...', results);
//               isScanning = true
//               EventRegister.emit('scanningStatus', true);
//             }).catch(err => {
//               console.error(err);
//             });
//           }
//     }

//     stopScan()
//     {
//         BleManager.stopScan().then(() => {
//             isScanning = false;
//             // Success code
//             // console.log("Scan stopped");
//           });
//     }

//     handleStopScan = () => {
//         console.log('Scan is stopped');
//         isScanning = false;
//         EventRegister.emit('scanningStatus', false);
//       }

//     handleDiscoverPeripheral = (peripheral) => {
//         // console.log('Got ble peripheral', peripheral);
//         if (!peripheral.name) {
//           peripheral.name = 'NO NAME';
//         }

//         EventRegister.emit('scanDevicesEvent', peripheral);
//         // peripherals.set(peripheral.id, peripheral);
//         // setList(Array.from(peripherals.values()));
//       }

// }

import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import BleManager from 'react-native-ble-manager';
import {EventRegister} from 'react-native-event-listeners';
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);
import RNAndroidLocationEnabler from 'react-native-android-location-enabler';
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
var isScanning = false;
export default class Controller {
  static myInstance = null;

  /**
   * @returns {CommonDataManager}
   */
  static getInstance() {
    if (Controller.myInstance == null) {
      Controller.myInstance = new Controller();
    }

    return this.myInstance;
  }

  initialize() {
    BleManager.start({showAlert: false}).then(() => {
      // Success code
      console.log('Module initialized');

      bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral');
      bleManagerEmitter.removeAllListeners('BleManagerStopScan');

      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        this.handleDiscoverPeripheral.bind(this),
      );
      bleManagerEmitter.addListener('BleManagerStopScan', this.handleStopScan);
    });
  }
  async scanDevices() {
    if (!isScanning) {
      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        this.handleDiscoverPeripheral.bind(this),
      );
      await this.sleep(500);
      BleManager.scan([], 10, false)
        .then(results => {
          console.log('Scanning...', results);
          isScanning = true;
          EventRegister.emit('scanningStatus', true);
        })
        .catch(err => {
          console.error(err);
        });
    }
  }

  disconnect(id) {
    return new Promise(function (resolve, reject) {
      if (id != null) {
        BleManager.disconnect(id)
          .then(() => {
            // Success code
            resolve('Disconnected');
          })
          .catch(error => {
            // Failure code
            resolve(error);
            console.log(error);
          });
      } else {
        resolve('No Device Connected');
      }
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  bin2string(array) {
    var result = '';
    for (var i = 0; i < array.length; ++i) {
      result += String.fromCharCode(array[i]);
    }
    return result;
  }

  bytesToHex(bytes) {
    for (var hex = [], i = 0; i < bytes.length; i++) {
      var current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
      hex.push((current >>> 4).toString(16));
      hex.push((current & 0xf).toString(16));
    }
    return hex.join('');
  }

  async getDeviceSerialNumber(id) {
    await this.sleep(100);
    var thisClass = this;
    return new Promise(async function (resolve, reject) {
      await BleManager.read(id, '180A', '2A25')
        .then(async readData => {
          var serialNumber = thisClass.bytesToHex(readData).toUpperCase();
          resolve(serialNumber);
        })
        .catch(async err => {
          reject(err);
        });
    });
  }

  async getDeviceFirmwareVersion(id) {
    await this.sleep(350);
    var thisClass = this;
    return new Promise(async function (resolve, reject) {
      await BleManager.read(id, '180A', '2A26')
        .then(async readData => {
          var firmwareVersion = thisClass.bin2string(readData).toUpperCase();
          resolve(firmwareVersion);
        })
        .catch(async err => {
          reject(err);
        });
    });
  }

  async getDevicebootloaderVersion(id) {
    await this.sleep(600);
    var thisClass = this;
    return new Promise(async function (resolve, reject) {
      await BleManager.read(id, '180A', '2A28')
        .then(async readData => {
          var bootloaderVersion = thisClass.bin2string(readData).toUpperCase();

          resolve(bootloaderVersion);
        })
        .catch(async err => {
          reject(err);
        });
    });
  }

  hexToBytes(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2) {
      bytes.push(parseInt(hex.substr(c, 2), 16));
    }
    return bytes;
  }

  async enableDfuService(id) {
    await this.sleep(400);
    var thisClass = this;

    return new Promise(async function (resolve, reject) {
      BleManager.startNotification(
        id,
        'FE59',
        '8EC90003-F315-4F60-9FB8-838830DAEA50',
      )
        .then(async () => {
          // Success code
          console.log('Notification started');
          await thisClass.sleep(400);

          BleManager.write(
            id,
            'FE59',
            '8EC90003-F315-4F60-9FB8-838830DAEA50',
            thisClass.hexToBytes('01'),
          )
            .then(() => {
              // Success code
              console.log('Write: ', thisClass.hexToBytes('01'));
              resolve(true);
            })
            .catch(error => {
              // Failure code
              console.log(error);
              reject(error);
            });
        })
        .catch(error => {
          // Failure code
          console.log(error);
          reject(error);
        });
    });
  }

  async checkBluetooth() {
   
    return new Promise(async function (resolve, reject) {
      var bluetoothStatus = '';

      await BluetoothStateManager.getState().then(async bluetoothState => {
        console.log('bluetoothState: ' + bluetoothState);
        if (bluetoothState == 'PoweredOn') {
          bluetoothStatus = 'enabled';
        } else {
          bluetoothStatus = 'not enabled';
        }
      });

      resolve(bluetoothStatus);
    });
  }

  async checkLocationNbluetooth() {
    console.log("enter in check bluethoot")
    return new Promise(async function (resolve, reject) {
      var locationStatus = '';
      var bluetoothStatus = '';

      await RNAndroidLocationEnabler.promptForEnableLocationIfNeeded({
        interval: 1000,
        fastInterval: 500,
      })
        .then(data => {
          console.log(data);
          locationStatus = 'enabled';
        })
        .catch(err => {
          console.log('ERROR: ' + err);
          locationStatus = 'not enabled';
        });

      await BluetoothStateManager.getState().then(async bluetoothState => {
        console.log('bluetoothState: ' + bluetoothState);
        if (bluetoothState == 'PoweredOn') {
          bluetoothStatus = 'enabled';
        } else {
          await BleManager.enableBluetooth()
            .then(() => {
              bluetoothStatus = 'enabled';
            })
            .catch(error => {
              bluetoothStatus = 'not enabled';
            });
        }
      });

      resolve({
        bluetoothStatus: bluetoothStatus,
        locationStatus: locationStatus,
      });
    });
  }
  // async checkPermissions()
  // {

  //   return new Promise(async function(resolve, reject){

  //     var locationPermission = "denied"
  //     var storagePermission = "denied"

  //     if (Platform.OS === 'android' && Platform.Version >= 23) {
  //         await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).then(async (result) => {

  //           if (result) {
  //             locationPermission = "granted"
  //           } else {
  //          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).then((result) => {

  //            if (result == "granted") {
  //             locationPermission = "granted"
  //           } else if(result == "denied"){
  //             locationPermission = "denied"
  //           }
  //           else if (result == "never_ask_again")
  //           {
  //             locationPermission = "never_ask_again"
  //           }
  //             });
  //           }
  //       });
  //     }

  //     await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE).then(async (result) => {

  //       if (result) {
  //         storagePermission = "granted"
  //       } else {
  //         await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE).then((result) => {

  //            if (result == "granted") {
  //             storagePermission = "granted"
  //           } else if(result == "denied"){
  //             storagePermission = "denied"
  //           }
  //           else if (result == "never_ask_again")
  //           {
  //             storagePermission = "never_ask_again"
  //           }

  //         });
  //       }
  //   });

  //   resolve({locationPermission: locationPermission, storagePermission: storagePermission})
  //   })

  // }

  async getDeviceInformation(id) {
    var thisClass = this;

    var deviceInformation = null;
    var deviceInfoTimeout = null;

    return new Promise(async function (resolve, reject) {
      deviceInfoTimeout = setTimeout(async () => {
        if (deviceInformation == null) {
          await BleManager.disconnect(id)
            .then(() => {
              console.log('disconnected');
            })
            .catch(err => {
              console.log(err);
            });
          bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral');
          // await thisClass.sleep(500)
          await BleManager.stopScan().then(() => {
            isScanning = false;
          });
          reject('Connection Failed');
        } else {
          resolve(deviceInformation);
        }
      }, 10000);

      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        thisClass.handleDiscoverPeripheral.bind(thisClass),
      );
      await thisClass.sleep(1000);
      await BleManager.scan([], 200, false)
        .then(async results => {
          console.log('Scanning...', results);
          isScanning = true;
        })
        .catch(err => {
          console.error(err);
        });

      await BleManager.connect(id)
        .then(async () => {
          console.log('Connected. Fetching device information');
          bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral');
          // await thisClass.sleep(500)
          BleManager.stopScan().then(() => {
            isScanning = false;

            // Success code
            // console.log("Scan stopped");
          });

          console.log('RETREIVING SERVICES');
          await BleManager.retrieveServices(id)
            .then(async peripheralInfo => {
              console.log('Fetching device information');
              await Promise.all([
                thisClass.getDeviceSerialNumber(id),
                thisClass.getDeviceFirmwareVersion(id),
                thisClass.getDevicebootloaderVersion(id),
              ])
                .then(async ([sn, fv, bv]) => {
                  console.log('Device information fetching');
                  await BleManager.disconnect(id)
                    .then(() => {
                      console.log('Device Disconnected');

                      deviceInformation = {
                        serialNumber: sn,
                        firmwareVersion: fv,
                        bootloaderVersion: bv,
                      };
                      console.log(deviceInformation);
                      clearTimeout(deviceInfoTimeout);
                      deviceInfoTimeout = null;
                      resolve(deviceInformation);
                    })
                    .catch(error => {
                      console.log('Error while disconnecting');
                      reject(error);
                    });
                })
                .catch(async err => {
                  console.log('ERROR OF PROMISE.ALL: ' + err);
                  await BleManager.disconnect(id)
                    .then(() => {
                      reject(err);
                    })
                    .catch(error => {
                      reject(error);
                    });
                });
            })
            .catch(async err => {
              reject(err);
              await BleManager.disconnect(id)
                .then(() => {
                  reject(err);
                })
                .catch(error => {
                  reject(error);
                });
            });
        })
        .catch(async err => {
          reject(err);
          bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral');
          // await thisClass.sleep(500)
          BleManager.stopScan().then(() => {
            isScanning = false;

            // Success code
            // console.log("Scan stopped");
          });
        });
    });
  }

  async stopScan() {
    bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral');
    // await this.sleep(500)
    BleManager.stopScan().then(() => {
      isScanning = false;

      // Success code
      // console.log("Scan stopped");
    });
  }

  handleStopScan = () => {
    console.log('Scan is stopped');
    isScanning = false;
    bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral');
    EventRegister.emit('scanningStatus', false);
  };

  handleDiscoverPeripheral = peripheral => {
    // console.log('Got ble peripheral', peripheral);
    if (!peripheral.name) {
      peripheral.name = 'NO NAME';
    }

    EventRegister.emit('scanDevicesEvent', peripheral);
    // peripherals.set(peripheral.id, peripheral);
    // setList(Array.from(peripherals.values()));
  };
}
