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

import {NativeModules, NativeEventEmitter} from 'react-native'
import BleManager from 'react-native-ble-manager';
import { EventRegister } from 'react-native-event-listeners'
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);
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


    initialize()
    {
        BleManager.start({ showAlert: false }).then(() => {
            // Success code
            console.log("Module initialized");
            bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral);
            bleManagerEmitter.addListener('BleManagerStopScan', this.handleStopScan );
            
          });
    }
    scanDevices() {
        if (!isScanning) {
            BleManager.scan([], 10, false).then((results) => {
              console.log('Scanning...', results);
              isScanning = true
              EventRegister.emit('scanningStatus', true);
            }).catch(err => {
              console.error(err);
            });
          } 
    }


    disconnect(id)
    {

      return new Promise(function(resolve, reject){
      

        if(id != null)
        {
          BleManager.disconnect(id)
          .then(() => {
            // Success code
            resolve("Disconnected");
          })
          .catch((error) => {
            // Failure code
            resolve(error)
            console.log(error);
          });
        }
        else{
          resolve('No Device Connected')
        }


      })



    }



    getDevicePackageVersion(id)
    {



      var firmwareVersion = null;
      var firmwareTimeout = null;

 
      return new Promise(function(resolve, reject){

        firmwareTimeout = setTimeout(() =>{
          if(firmwareVersion == null)
          {
            BleManager.stopScan().then(() => {
              isScanning = false;
             });
            reject('Connection Failed')
          }
          else{
            resolve(firmwareVersion)
          }
        },10000)
     
        
        BleManager.scan([], 200, false).then((results) => {
          console.log('Scanning...', results);
          isScanning = true
        
        }).catch(err => {
          console.error(err);
        });
  
        BleManager.connect(id).then(async() =>{
          console.log('Connected')
          BleManager.stopScan().then(() => {
            isScanning = false;
            // Success code
            // console.log("Scan stopped");
          });


          await BleManager.retrieveServices(id).then(async (peripheralInfo) =>{

            await BleManager.read(id, '180A', '2A26').then(async (readData) =>{
            console.log('Read: ' + readData);
            var data = '';
            for (var i = 0; i < readData.length; ++i) {
              data += String.fromCharCode(readData[i]);
            }
            
            var data = data.toUpperCase();
            console.log('data: ' + data);
            
            await BleManager.disconnect(id).then(() =>{

              firmwareVersion = data;
              clearTimeout(firmwareTimeout)
              firmwareTimeout = null
              resolve(data)

            }).catch((error) =>{
              reject(error)
            })

            }).catch(async (err) =>{
              await BleManager.disconnect(id).then(() =>{

                reject(err)
  
              }).catch((error) =>{
                reject(error)
              })

            })

          }).catch(async (err) =>{
            reject(err)
            await BleManager.disconnect(id).then(() =>{

              reject(err)

            }).catch((error) =>{
              reject(error)
            })
          })





  
        }).catch((err)=>{
          reject(err)
          BleManager.stopScan().then(() => {
            isScanning = false;
            // Success code
            // console.log("Scan stopped");
          });
        })


      })



    }

    stopScan()
    {
        BleManager.stopScan().then(() => {
            isScanning = false;
            // Success code
            // console.log("Scan stopped");
          });
    }


    handleStopScan = () => {
        console.log('Scan is stopped');
        isScanning = false;
        EventRegister.emit('scanningStatus', false);
      }


    handleDiscoverPeripheral = (peripheral) => {
        // console.log('Got ble peripheral', peripheral);
        if (!peripheral.name) {
          peripheral.name = 'NO NAME';
        }

        EventRegister.emit('scanDevicesEvent', peripheral);
        // peripherals.set(peripheral.id, peripheral);
        // setList(Array.from(peripherals.values()));
      }



    
}