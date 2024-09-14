import React, { Component } from 'react'
import { Text, View, NativeModules, NativeEventEmitter, TouchableOpacity, 
    ActivityIndicator, SafeAreaView, ScrollView,FlatList, Platform, TextInput, Alert, Linking } from 'react-native'
import Controller from '../utils/Controller'
import { EventRegister } from 'react-native-event-listeners'
import { NordicDFU, DFUEmitter } from "@domir/react-native-nordic-dfu";
import StatusBar from '../utils/StatusBar'
import * as Progress from 'react-native-progress';
// import { Dialog } from 'react-native-simple-dialogs';
import Dialog from "react-native-dialog";
import {scale, verticalScale, moderateScale} from '../utils/scale';
import DocumentPicker from 'react-native-document-picker'
import Icon from 'react-native-vector-icons/Ionicons';
var RNFS = require('react-native-fs');
import storage from '@react-native-firebase/storage'
import moment from 'moment'
import { AutocompleteDropdown } from 'react-native-autocomplete-dropdown'
import MNSIT from '../utils/files-handler'
import BleManager from 'react-native-ble-manager';
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);


export default class brustMode extends Component {

    childKey = 0;
    dfuProgressListener = null;
dfuStateListener = null;
constructor(props)
{

    super(props);
    this.state = {
        isScanning: false,
        // isLocalScanning: false,
        isProcessCompleted: true,
        devicesList: [],
        peripherals: new Map(),
        showConnectionDialog: false,
        showLoadingDialog: false,
        showAlert: false,
        connectionStatus: 'Not Connected',
        peripheral: null,
        dfuState: "Not started",
        progress: 0,
        totalProgress:0,
        deviceNameFilter:'Eisai wearable',
        // Eisai wearable
        firnwareVersionFilter: '',
        // 0.6.3
        // firnwareVersionFilter: '0.1',
        // autoDFUStatus: 'Not Started',
        autoDFUStatus:'Not started',
        firmwarefilepath : '',
        alertMessage:'',
        alertTitle: 'Alert',
        totalDevices:0,
        currentDevice:0,
        aborted: false,
        logs: [],
        outputFilePath: '',
        csvFileLog:[],
        devicesSuggesionList: [],
        deviceSuggesionScan: false,
        dfuFailedDevices: 0
        }



}


toTitleCase(str) {
    return str.replace(
      /\w\S*/g,
      function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      }
    );
  }
  
  async startScan()
  {
    bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral')
    await this.sleep(250)
    this.peripheralsListener = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheralForSuggestions.bind(this));
    await this.sleep(250)
    BleManager.scan([], 10, false).then(() => {
        // Success code
        
        console.log("Local Scan started");
        this.setState({isScanning: true, deviceSuggesionScan: true})
      }).catch((err) =>{
          console.log(err)
          this.setState({isScanning: false, })
      })
  }
  stopScan()
  {
    BleManager.stopScan().then(() => {
        bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral')
        // Success code
        console.log("Local Scan stopped");
        this.setState({isScanning: false, deviceSuggesionScan: false})
      });
  }

  async disconnectConnectedPeripherals()
  {
    await BleManager.getConnectedPeripherals([]).then(async (peripheralsArray) => {
        // Success code
        if(peripheralsArray.length > 0)
        {
            for(var a=0;a<peripheralsArray.length;a++)
            {
                await BleManager.disconnect(peripheralsArray[a].id).then(() =>{
                    console.log("Peripheral Disconnected")
                }).catch((err) =>{
                    console.log(err)
                })
            }
        }
      }).catch((err) =>
      {
          console.log('getConnectedPeripherals: ' + err)
      });
  }
componentDidMount()
{
    
    this.focusListener = this.props.navigation.addListener('focus', async () => {

        console.log(this.state.firmwarefilepath)

        await this.sleep(500);

        if(Platform.OS == 'android')
        {
            await Controller.getInstance().checkLocationNbluetooth().then(async (status) =>{
                console.log(status)

                if(status.bluetoothStatus == "enabled" && status.locationStatus == "enabled" )
                {
                    
                }
                else
                {
                    var message = "Please enable bluetooth and location"
                    if(status.bluetoothStatus == "not enabled" && status.locationStatus == "not enabled" )
                    {
                        message = "Please enable bluetooth and location"
                    }
                    else if(status.bluetoothStatus == "enabled" && status.locationStatus == "not enabled")
                    {
                        message = "Please enable location"
                    }

                    else if(status.bluetoothStatus == "not enabled" && status.locationStatus == "enabled")
                    {
                        message = "Please enable bluetooth"
                    }
                    this.setState({
                        showAlert: true,
                        alertMessage: message
                    })
                }

            })
        }
        else if(Platform.OS == "ios")
        {
            await Controller.getInstance().checkBluetooth().then(async (bluetoothStatus) =>{

                console.log("bluetoothStatus: "+ bluetoothStatus)

                if(bluetoothStatus == "enabled" )
            {
                
                
            }
            else{
                this.enableIosBluetooth()
            }

            })
        }



        
  
        console.log("FOCUS LISTENER CALLED")
    })


    this.blurListener = this.props.navigation.addListener('blur', async () => {

        bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral')
        // bleManagerEmitter.removeListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral);
        // this.peripheralsListener.remove()
        console.log("BLUR LISTENER CALLED")
        this.stopScan()
        Controller.getInstance().stopScan()
 
    })

      this.dfuProgressListener = DFUEmitter.addListener("DFUProgress", ({ percent }) => {
        console.log("DFU progress:", percent);
        // if(percent != 0)
        // {
            var totalPerent = Math.round((((this.state.currentDevice -1 ) / this.state.totalDevices) * 100) + (1 / this.state.totalDevices) * percent)
            // this.setState({ totalProgress: totalPerent });    
        // }
        this.setState({ progress: percent , totalProgress: totalPerent});
      });
      this.dfuStateListener = DFUEmitter.addListener("DFUStateChanged", async ({ state }) => {
        console.log("DFU state:", state);
        state = state.replace(/_/g, ' ');
        state = this.toTitleCase(state)
        state = state.replace('State ', '');
        
        if(state != 'Dfu Completed' && state != 'Dfu Failed')
        {
            if(state == "Dfu Process Starting")
            {
                var logData = state + ': ' + this.state.devicesList[this.state.currentDevice-1].id
                if(!this.state.logs.map((item) =>{ return item.message}).includes(logData))
                {
                    this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: logData, type:'info'});
                    // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , logData, 'info')
                }
            }
            else{
                
             this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: state, type:'info'});
            // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , state, 'info')
                
            }

            
        }
        this.setState({ dfuState: state });


      });

      
    // Controller.instance.scanDevices();
    this.devicesListener = EventRegister.addEventListener('scanDevicesEvent', async (peripheral) => {
        if(this.state.autoDFUStatus == 'Scanning')
        {
            console.log(peripheral.name , peripheral.id)
            // 'C4:5F:B4:31:B4:A0'
            // 'D1:B9:2E:4C:9B:1B'
            if(peripheral.id == 'C4:5F:B4:31:B4:A0')
            {
                if(this.state.deviceNameFilter == '' || this.state.deviceNameFilter.toUpperCase() == peripheral.name.toUpperCase() || peripheral.name == "EISAI PH3 DFU V2")
            {
                var logData = "Found: " + peripheral.id
                if(!this.state.logs.map((item) =>{ return item.message}).includes(logData))
                {
                    this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: logData, type:'info'});
                    this.state.csvFileLog.push({date: "'"+moment().format('DD-MM-YYYY')+"'", time: "'"+moment().format('HH:mm:ss.SSS')+"'", deviceName: peripheral.name, deviceId: peripheral.id, packageFile: this.state.firmwarefilepath['firmware'].split('/')[this.state.firmwarefilepath['firmware'].split('/').length-1], macAddress:null, firmwareVersion: null, bootloaderVersion: null, dfuStatus: 'Not Started'})
                    console.log(this.state.csvFileLog)
                    // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , logData, 'info')
                }
    
                this.state.peripherals.set(peripheral.id, peripheral);
                this.setState({
                    devicesList: Array.from(this.state.peripherals.values())
                })
            }
            }
        }

        // setList(Array.from(peripherals.values()));
    })
    this.statusListener = EventRegister.addEventListener('scanningStatus', async (status) => {
        

        if(status == true)
        {
            this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: "Scanning Started", type:'info'});
            // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Scanning Started", 'info')
            
        }
        if(status == false)
        {
            bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral')
            this.setState({
                deviceSuggesionScan: false
            })
        }

        // if(status == false)
        // {
        //     this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: "Scanning Stopped", type:'info'});
        //     await this.autoDFU() 
        // }
        if(status == false && this.state.aborted == false && this.state.autoDFUStatus == 'Scanning')
        {
            console.log("CHECK HERE: ======================================")
            console.log(status, this.state.aborted, this.state.autoDFUStatus)
            this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: "Scanning Stopped", type:'info'});
            // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Scanning Stopped", 'info')
            await this.autoDFU()
        }
        else if(status == false && this.state.aborted == true)
        {

        }

        this.setState({
            isScanning: status
        })


    })
    

}
sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async uploadLogFile()
  {
      var thisClass = this;
    return new Promise(function(resolve,reject) {
        thisClass.setState({
            showConnectionDialog: false,
            showLoadingDialog: true
          })

          setTimeout(async() =>{
            var fileUploaded = false
            var fileUploadTimer = null;
            var fileName = thisClass.state.outputFilePath.split('/')
            fileName = fileName[fileName.length-1]
            console.log("fileName: ")
            console.log(fileName)
            const uploadUri = thisClass.state.outputFilePath
      
      
          // var fileUploaded = false
          // var fileUploadTimer = null;
          // var fileName = this.state.outputFilePath.split('/')
          // fileName = fileName[fileName.length-1]
          // const uploadUri = this.state.outputFilePath
      
          const task = storage()
          .ref('EISAI_OTA_LOGS/'+fileName)
          .putFile(uploadUri);
          if(fileUploadTimer == null)
          {
              fileUploadTimer = setTimeout(async () =>{
                  console.log('File Upload TimeOut')
                  fileUploadTimer = false
                  if(fileUploaded == false)
                  {
                    await task.cancel()
                  }
                  thisClass.setState({showLoadingDialog: false})
                  resolve('Not Uploaded')
              },30000);
          }
      
      
          await task.then(async () =>{
              console.log('Log File Uploaded')
              fileUploaded = true
              clearTimeout(fileUploadTimer)
              fileUploadTimer = null
              await RNFS.unlink(thisClass.state.outputFilePath).then(() =>{
                  console.log("Log File: "+ thisClass.state.outputFilePath+ ' Deleted')
              }).catch((err) =>{
                  console.log(err)
              })
              thisClass.setState({showLoadingDialog: false})
              resolve('Uploaded')
          }).catch((err) =>{
              console.log('Log File Upload Fail Due To Error ' + err)
              fileUploaded = false
              clearTimeout(fileUploadTimer)
              fileUploadTimer = null
              thisClass.setState({showLoadingDialog: false})
              resolve('Not Uploaded')
          })
          },500)


    })
      

     
     

  }

//   uploadLogFile = async () => {
//     // const { uri } = image;
//     var fileName = this.state.outputFilePath.split('/')
//     fileName = fileName[fileName.length-1]
//     const uploadUri = this.state.outputFilePath
//     // const uploadUri = Platform.OS === 'ios' ? uri.replace('file://', '') : uri;
//     // setUploading(true);
//     // setTransferred(0);
//     const task = storage()
//       .ref('Pkd_Ota_Logs/'+fileName)
//       .putFile(uploadUri);
//     // set progress state
//     task.on('state_changed', snapshot => {
//     //   setTransferred(
//     //     Math.round(snapshot.bytesTransferred / snapshot.totalBytes) * 10000
//     //   );
//     console.log(`${snapshot.bytesTransferred} transferred out of ${snapshot.totalBytes}`);

//     console.log("Upload Status: "+Math.round(snapshot.bytesTransferred / snapshot.totalBytes) * 10000)
//     });

//     try {
//       await task;
//     } catch (e) {
//         this.setState({showLoadingDialog: false})
//       console.log(e);
//     }
//     this.setState({showLoadingDialog: false})
//     // setUploading(false);
//     console.log(
//       'logFile uploaded!');
//     // setImage(null);
//   };
  

async checkDfuStatus()
{
    var thisClass = this;
    return new Promise(function(resolve,reject) {
         var dfuTimer = null
         dfuTimer = setTimeout(() =>{
             resolve(thisClass.state.dfuState)
         }, 3000)
         if(thisClass.state.dfuState == "Failed" || thisClass.state.dfuState == "Dfu Completed")
         {
             resolve(thisClass.state.dfuState)
         }
    })
}
  async performDfu(peripheral)
  {
      
      var isSuccess = false
      var response = ''
      for(var a=0;a<2;a++)
      {
        console.log('Performing Dfu')
          var file = this.state.firmwarefilepath[Object.keys(this.state.firmwarefilepath)[a]]
          console.log(console.log("DFU STATE IN PERFROM DFU: " + this.state.dfuState))
          console.log("FIRMWAREFILEPATH: " + file)
          await NordicDFU.startDFU({
              deviceAddress: peripheral.id,
            //   deviceName: peripheral.name,
              filePath: file,
            //   alternativeAdvertisingNameEnabled: Platform.OS == 'ios' ? false:null
              })
      
              .then(async (res) => {     
                  
                isSuccess = true
                response = res
                  // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Success On Device: " + res.deviceAddress, 'success')
                  console.log("Transfer done:", res)
                  
                })
              .catch(async(err) =>{
                console.log(err)
                console.log(typeof err);
                isSuccess = false
                response = err
                //   err = err.substring(1, err.length-1);
              })

              if(!isSuccess)
              {
                  break;
              }

              await this.sleep(20000)
      }

      if(isSuccess)
      {
        var index = this.getIndexOfDevice(response.deviceAddress)
        if(index != -1)
        {
            var tuple = this.state.csvFileLog[index]

            tuple['date'] = "'"+moment().format('DD-MM-YYYY')+"'"
            tuple['time'] = "'"+moment().format('HH:mm:ss.SSS')+"'"
            tuple['dfuStatus'] = 'Success'
            this.state.csvFileLog[index] = tuple
            await this.writeToCsv(response.deviceAddress)
        }

        console.log(this.state.csvFileLog)
        this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"Dfu Success On Device: " + response.deviceAddress, type:'success'});
      }
      else{

        var index = this.getIndexOfDevice(this.state.devicesList[this.state.currentDevice-1].id)
        if(index != -1)
        {
            var tuple = this.state.csvFileLog[index]
            tuple['date'] = "'"+moment().format('DD-MM-YYYY')+"'"
            tuple['time'] = "'"+moment().format('HH:mm:ss.SSS')+"'"
            tuple['dfuStatus'] = 'Failed'
            this.state.csvFileLog[index] = tuple
            await this.writeToCsv(this.state.devicesList[this.state.currentDevice-1].id)
        }

        this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"Dfu Failed On Device: " + this.state.devicesList[this.state.currentDevice-1].id, type:'error'});
        // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Failed On Device: " + this.state.devicesList[this.state.currentDevice-1].id + res.deviceAddress, 'error')
        this.setState({
          dfuFailedDevices: this.state.dfuFailedDevices+1,
          totalProgress: this.state.totalProgress + (Math.round((1/this.state.totalDevices)* 100) - (Math.round((1/this.state.totalDevices)* this.state.progress)))
        })

        //FW version check failed
        if(response == 'Error: Firmware not specified' || response == 'FW version check failed')
        {
          this.setState({
              isProcessCompleted: true,   
              aborted: true,
              devicesList: [],
              totalDevices:0,
              currentDevice:0,
              peripherals: new Map(),
              connectionStatus: 'Not Connected',
              autoDFUStatus: 'Dfu Aborted',
              showAlert: true,
              alertMessage: 'Please restart the application',
              showConnectionDialog: false,
              firmwarefilepath:''
          })
        }

      }

  }

async autoDFU()
{
    if(this.state.devicesList == null || this.state.devicesList.length == 0)
{

    this.setState({
        isProcessCompleted: true,
        aborted: false,
        devicesList: [],
        totalDevices:0,
        currentDevice:0,
        peripherals: new Map(),
        connectionStatus: 'Not Connected',
        autoDFUStatus: 'Dfu Aborted',
        showConnectionDialog: false,
        firmwarefilepath:''
    })
    if(!this.state.aborted)
    {
        this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"No " + this.state.deviceNameFilter +" devices found, process aborted", type:'error'});
    }
    await RNFS.unlink(this.state.outputFilePath).then(()=>{
        console.log("FILE DELETED")
    }).catch((err) =>{
        console.log(err)
    })
}
else{

    var filteredDevices = []
    this.setState({
         autoDFUStatus: this.state.firnwareVersionFilter == "" ? 'Fetching Device Information': 'Filtering',
         totalDevices: this.state.devicesList.length,
         currentDevice : 1
     })

     //loop for getting device iformation
    

     for(var a=0; a<this.state.totalDevices;a++)
     {
         this.setState({currentDevice: a+1})
         var currentDevice = this.state.devicesList[a]

         console.log("FETCHING DEVICE INFORMATION OF DEVICE: " + currentDevice.id)
         await Controller.getInstance().getDeviceInformation(currentDevice.id).then(async (deviceInformation) =>{

             var deviceIndex = this.getIndexOfDevice(currentDevice.id)
             if(deviceIndex != -1)
             {
                 var tuple =this.state.csvFileLog[deviceIndex]
                 // deviceInformation = {serialNumber: sn, firmwareVersion:fv, bootloaderVersion: bv}
                 tuple['date'] = "'"+moment().format('DD-MM-YYYY')+"'"
                 tuple['time'] = "'"+moment().format('HH:mm:ss.SSS')+"'"
                 tuple['macAddress'] = deviceInformation.serialNumber;
                 tuple['firmwareVersion'] = deviceInformation.firmwareVersion;
                 tuple['bootloaderVersion'] = deviceInformation.bootloaderVersion;
                 this.state.csvFileLog[deviceIndex] = tuple

             }

             if(this.state.firnwareVersionFilter != "")
             {
                 if(deviceInformation.firmwareVersion <(this.state.firnwareVersionFilter))
                 {
                     currentDevice.previousPackageVersion = deviceInformation.firmwareVersion
                     filteredDevices.push(currentDevice) 
                 }
                 else{

                    // console.log("check this later, below line is causing error")
                    // console.log(this.state.csvFileLog)
                    if(this.getIndexOfDevice(currentDevice.id) != -1)
                    {
                        this.state.csvFileLog[this.getIndexOfDevice(currentDevice.id)].dfuStatus = 'Device skipped. Device is already up to date'
                        await this.writeToCsv(currentDevice.id)
                    }


                    //  this.state.csvFileLog[a].dfuStatus = 'Device skipped, device is already up to date'
                    //  await this.writeToCsv(this.state.csvFileLog[a].deviceId)
                     // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , 'Device: '+ currentDevice.id +' is already up to date. (Current package version : '+ FirmwareVerison +', Update version: '+this.state.firnwareVersionFilter+')', 'info')
                     this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'Device: '+ currentDevice.id +' is already up to date. (Current package version : '+ deviceInformation.firmwareVersion +', Update version: '+this.state.firnwareVersionFilter+')', type:'info'});
                 }

             }
             else{
                filteredDevices.push(currentDevice) 
             }

         }).catch(async (err) =>{

             this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'Failed to fetch information of device: '+ currentDevice.id +', trying again', type:'error'});
             // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , 'Failed to fetch current package version of device: : '+ currentDevice.id +', trying again', 'error')
             console.log(err)
             await Controller.getInstance().getDeviceInformation(currentDevice.id).then(async (deviceInformation) =>{
                 var deviceIndex = this.getIndexOfDevice(currentDevice.id)
                 if(deviceIndex != -1)
                 {
                     var tuple =this.state.csvFileLog[deviceIndex]
                     // deviceInformation = {serialNumber: sn, firmwareVersion:fv, bootloaderVersion: bv}
                     tuple['date'] = "'"+moment().format('DD-MM-YYYY')+"'"
                     tuple['time'] = "'"+moment().format('HH:mm:ss.SSS')+"'"
                     tuple['macAddress'] = deviceInformation.serialNumber;
                     tuple['firmwareVersion'] = deviceInformation.firmwareVersion;
                     tuple['bootloaderVersion'] = deviceInformation.bootloaderVersion;

                     this.state.csvFileLog[deviceIndex] = tuple
                 }

                 if(this.state.firnwareVersionFilter != "")
                 {
                     if(deviceInformation.firmwareVersion <(this.state.firnwareVersionFilter))
                     {
                         currentDevice.previousPackageVersion = deviceInformation.firmwareVersion
                         filteredDevices.push(currentDevice) 
                     }
                     else{

                        if(this.getIndexOfDevice(currentDevice.id) != -1)
                        {
                         this.state.csvFileLog[this.getIndexOfDevice(currentDevice.id)].dfuStatus = 'Device skipped. Device is already up to date'
                         await this.writeToCsv(currentDevice.id)
                        }
     
                         // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , 'Device: '+ currentDevice.id +' is already up to date. (Current package version : '+ FirmwareVerison +', Update version: '+this.state.firnwareVersionFilter+')', 'info')
                         this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'Device: '+ currentDevice.id +' is already updated. current package version : '+ deviceInformation.firmwareVersion, type:'info'});
                     }
                 }
                 else{
                    filteredDevices.push(currentDevice) 
                 }

             }).catch(async (err) =>{
                 this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'Failed to fetch information of device: '+ currentDevice.id +', skipping device', type:'error'});
                 console.log(err)



                 

                 var deviceIndex = this.getIndexOfDevice(currentDevice.id)
                 if(deviceIndex != -1)
                 {
                     var tuple =this.state.csvFileLog[deviceIndex]
                     // deviceInformation = {serialNumber: sn, firmwareVersion:fv, bootloaderVersion: bv}
                     tuple['date'] = "'"+moment().format('DD-MM-YYYY')+"'"
                     tuple['time'] = "'"+moment().format('HH:mm:ss.SSS')+"'"
                     tuple['macAddress'] = null;
                     tuple['firmwareVersion'] = null;
                     tuple['bootloaderVersion'] = null;
                     tuple['dfuStatus'] = 'Failed. Error while fetching device information';
                     await this.writeToCsv(this.state.csvFileLog[deviceIndex].deviceId)

                     
                 }

       

             })
             
         })

         if(this.state.aborted)
         {
             console.log('Exiting Loop')
             break;
         }
         await this.sleep(1000)

     }

     //write csv file


     if(this.state.aborted)
     {

         console.log("----------------------------CHECK HERE ----------------------------")
         console.log(this.state.csvFileLog)
         console.log(this.state.csvFileLog.length)
         var lengthOfFile  = this.state.csvFileLog.length
         console.log("LENGTH OF FILE: "  + lengthOfFile)
         console.log("FILE: ")
         console.log(this.state.csvFileLog)
         
         if(lengthOfFile > 0)
         {
            for(var a=0;a<lengthOfFile;a++)
            {
                console.log("VALUE OF A IS:    " + a)
                console.log("OBJECT AT INDEX: " + a)
                console.log(this.state.csvFileLog[0])
                // console.log("WRITING DATA OF DEVICE: "+ this.state.csvFileLog[0].deviceId + 'TO CSV')
                if(this.state.csvFileLog[0].dfuStatus === "Not Started")
                {
                   this.state.csvFileLog[0].dfuStatus = 'Process Aborted'
                   await this.writeToCsv(this.state.csvFileLog[0].deviceId)
                }
            }
         }



         // for(var a=0;a<=this.state.csvFileLog.length;a++)
         // {
         //     console.log('ABRTING PROECESSS HERE')
         //     console.log(this.state.csvFileLog)
         //     this.state.csvFileLog[0].dfuStatus = 'Process Aborted'
         //     await this.writeToCsv(this.state.csvFileLog[0].id)
         // }

         console.log("ABORTING PROCESS")
         console.log(this.state.devicesList[this.state.currentDevice-1].id)
         await this.disconnectConnectedPeripherals()
        //  await Controller.getInstance().disconnect(this.state.devicesList[this.state.currentDevice-1].id)
         this.setState({
             isProcessCompleted: true,
             aborted: true,
             devicesList: [],
             totalDevices:0,
             currentDevice:0,
             peripherals: new Map(),
             connectionStatus: 'Not Connected',
             autoDFUStatus: 'Dfu Aborted',
             showConnectionDialog: false,
             firmwarefilepath:''
         })
         this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'Dfu Aborted', type:'error'});
         // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Aborted", 'error')
         console.log("this.uploadLogFile() 1")
         await this.uploadLogFile()
     }

else{
//not aborted

// if(this.state.firnwareVersionFilter !== "")
// {
 if(filteredDevices.length == 0)
 {
if( this.state.logs.map((log) =>{
    return(log.message).includes("skipping device")
}).reduce((a, v) => (v === true ? a + 1 : a), 0) == this.state.devicesList.length)
{
    this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'Failed to fetch device information, process aborted', type:'error'});
    // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "All devices already have updated version", 'success')
    console.log("this.uploadLogFile() 2")
    await this.uploadLogFile()
    console.log("LOG FILE UPLOADED")

    this.setState({
        totalDevices:0,
        currentDevice:0,
        isProcessCompleted: true,
        showAlert: true,
        alertMessage: 'Failed to fetch device information, process aborted',
        autoDFUStatus: 'Process Completed',
        firmwarefilepath: "",
        devicesList:[],
        peripherals: new Map(),
        showConnectionDialog: false,
    })
}
else{

    if( this.state.logs.map((log) =>{
        return(log.message).includes("skipping device")
    }).reduce((a, v) => (v === true ? a + 1 : a), 0) === 0)
    {
        this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'All devices already have updated version', type:'success'});
        // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "All devices already have updated version", 'success')
        console.log("this.uploadLogFile() 3")
        await this.uploadLogFile()
    
        this.setState({
            totalDevices:0,
            currentDevice:0,
            isProcessCompleted: true,
            showAlert: true,
            alertMessage: 'All devices already have updated version',
            autoDFUStatus: 'Process Completed',
            firmwarefilepath: "",
            devicesList:[],
            peripherals: new Map(),
            showConnectionDialog: false,
        })
    }

    else{
        this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'Devices already have updated version, skipped: ' + this.state.logs.map((log) =>{
            return(log.message).includes("skipping device")
        }).reduce((a, v) => (v === true ? a + 1 : a), 0), type:'success'});
        // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "All devices already have updated version", 'success')
        console.log("this.uploadLogFile() 4")
        await this.uploadLogFile()
    
        this.setState({
            totalDevices:0,
            currentDevice:0,
            isProcessCompleted: true,
            showAlert: true,
            alertMessage: 'Devices already have updated version, skipped: ' + this.state.logs.map((log) =>{
                return(log.message).includes("skipping device")
            }).reduce((a, v) => (v === true ? a + 1 : a), 0),
            autoDFUStatus: 'Process Completed',
            firmwarefilepath: "",
            devicesList:[],
            peripherals: new Map(),
            showConnectionDialog: false,
        })
    }



}

 }
 else{
     this.setState({
         devicesList : filteredDevices,
         totalDevices: filteredDevices.length,
         currentDevice : 1,
         autoDFUStatus: 'Performing Dfu'
     })
 }
// }
// else{
//  this.setState({
//      currentDevice : 1,
//      autoDFUStatus: 'Performing Dfu'
//  })
// }
}

if(!this.state.aborted && this.state.devicesList.length > 0)
{
    this.setState({
        dfuState:'Preparing'
    })
    await this.sleep(1000)
//loop for performing dfu
     for(var a=0; a<this.state.totalDevices;a++)
     {
         this.setState({currentDevice: a+1})
         var currentDevice = this.state.devicesList[a]
         this.setState({
             currentDevice : a+1,
             progress:0,
         })
         await this.performDfu(this.state.devicesList[a])
         await this.checkDfuStatus().then((status) =>{
             console.log("checkDfuStatus: " + status)
         })

         

         if(this.state.aborted)
         {
             if(a == (this.state.totalDevices-1))
             {
                 this.setState({
                     aborted: false
                 })
             }
             else{
                console.log("ABORTING LOOP")
                break;
             }

             
         }
         await this.sleep(1000)
         
         

     }

     if(this.state.aborted)
     {
        await this.disconnectConnectedPeripherals()
        //  await Controller.getInstance().disconnect(this.state.devicesList[this.state.currentDevice-1].id)
         

         var lengthOfFile  = this.state.csvFileLog.length
         console.log("LENGTH OF FILE: "  + lengthOfFile)
         console.log("FILE: ")
         console.log(this.state.csvFileLog)

         if(lengthOfFile > 0)
         {
            for(var a=0;a<lengthOfFile;a++)
            {
                console.log("2 VALUE OF A IS:    " + a)

                console.log("2 DATA OBJECT: ")
                console.log(this.state.csvFileLog)

                console.log("2 OBJECT AT INDEX: " + a)
                console.log(this.state.csvFileLog[0])
                // console.log("2 WRITING DATA OF DEVICE: "+ this.state.csvFileLog[0].deviceId + 'TO CSV')
                if (this.state.csvFileLog[0].dfuStatus == 'Not Started')
                {
                    this.state.csvFileLog[0].dfuStatus = 'Process Aborted'
                }

                await this.writeToCsv(this.state.csvFileLog[0].deviceId).then((data) =>{
                    console.log("SUCCES IN LOOP WITH RESPONSE: " + data)
                }).catch((err) =>{
                    console.log("FAILED IN LOOP WITH ERROR: "+ err)
                })
            }
         }



         this.setState({
             isProcessCompleted: true,
             aborted: true,
             devicesList: [],
             totalDevices:0,
             currentDevice:0,
             peripherals: new Map(),
             connectionStatus: 'Not Connected',
             autoDFUStatus: 'Dfu Aborted',
             showConnectionDialog: false,
             firmwarefilepath:''
         })
         this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"Dfu Aborted" , type:'error'});
         // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Aborted", 'error')
         console.log("this.uploadLogFile() 5")
         await this.uploadLogFile()
     }
     else{
        //  console.log(this.state.logs)

        //  var errors = this.state.logs.map((log) =>{
        //     return(log.message).includes("Dfu Failed On Device")
        // }).reduce((a, v) => (v === true ? a + 1 : a), 0)

        // var errors = this.state.logs.map((log) =>{
        //     return(log.message).includes("Dfu Failed On Device")
        //     }).reduce((acc,curr) => {
        //         if(curr === true)
        //            acc++;
        //         return acc;
        //     },0)
        

            if(this.state.dfuFailedDevices == 0)
            {
                this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"Dfu Process Completed", type:'success'});
            }
            else{
                if(this.state.dfuFailedDevices == 1)
                {
                    if(this.state.dfuFailedDevices == this.state.devicesList.length)
                    {
                        this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"Dfu Failed", type:'error'});            
                    }
                    else{
                        this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"Dfu Process Completed. Failed On 1 Device", type:'error'});
                    }

                }
                else if (this.state.dfuFailedDevices > 1)
                {
                    if(this.state.dfuFailedDevices == this.state.devicesList.length)
                    {
                        this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"Dfu Failed On All Devices", type:'error'});            
                    }
                    else{
                        this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"Dfu Process Completed. Failed On "+this.state.dfuFailedDevices+" Devices", type:'error'});
                    }

                }
            }

        
        //  await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Process Completed", 'success')
         console.log("this.uploadLogFile() 6")
         await this.uploadLogFile()
         this.setState({
             aborted: false,
             showConnectionDialog:false,
             isProcessCompleted: true,
             devicesList: [],
             totalDevices:0,
             currentDevice:0,
             peripherals: new Map(),
             firmwarefilepath:'',
             autoDFUStatus: 'Process Completed',

         })
     }
}


}
     




}

getIndexOfDevice(deviceId)
{
    var index = this.state.csvFileLog.map((item) =>{
        return (item.deviceId)
        }).indexOf(deviceId)
        return index
}

async writeToCsv(deviceId)
{
var thisClass = this;
    return new Promise(async function(resolve, reject){


        
        var deviceData = thisClass.state.csvFileLog[thisClass.getIndexOfDevice(deviceId)]
console.log("WRITING DATA OF DEVICE: "+deviceId+" TO CSV")


if(thisClass.getIndexOfDevice(deviceId) != -1)
{
    var csvRow = deviceData['date']+','+deviceData['time']+','+deviceData['deviceId']+','+deviceData['macAddress']+','+deviceData['packageFile']+','+deviceData['firmwareVersion']+','+deviceData['bootloaderVersion']+','+deviceData['dfuStatus']

var data = null
console.log("READING FILES FROM STORAGE")
data = await RNFS.readFile(thisClass.state.outputFilePath, 'utf8')
console.log("DATA IS: " + data)
if(data != null)
{
    console.log("DATA IN NOT NULL")
    var appendData = data+'\n'+csvRow
    await RNFS.writeFile(thisClass.state.outputFilePath,appendData, 'utf8')

}
console.log("getIndexOfDevice(deviceId): " + thisClass.getIndexOfDevice(deviceId))
console.log("Removing deivce: " + deviceId + " from list at index: " +thisClass.getIndexOfDevice(deviceId))
thisClass.state.csvFileLog.splice(thisClass.getIndexOfDevice(deviceId), 1);
resolve("Success")
}

else{
    resolve("No Data for the given device")
    console.log("DATA NOT PRESENT")
}

    })



 }


async createlogFile()
{
    var currentDirectory = 'EISAI_OTA_LOGS'
    let absolutePath = ""
    // if(Platform.OS == "android")
    // {
    //     console.log("ANDORID")
    //     absolutePath = `/storage/emulated/0/${currentDirectory}`
    // } 
    // else{
    //     console.log("IOS")
    //     absolutePath = `${RNFS.DocumentDirectoryPath}/${currentDirectory}`
    // }
    absolutePath = `${RNFS.DocumentDirectoryPath}/${currentDirectory}`
    if(await RNFS.exists(absolutePath))
    {
     console.log('Folder already exists')
        }
    else{
        console.log('Creating folder')
        RNFS.mkdir(absolutePath);

    }

    var outputFilePath = absolutePath+'/pkd_ota_Log_'+moment().format('DD_MM_YYYY_hh_mm_ss_A')+'.csv'
    this.setState({outputFilePath: outputFilePath})
    await RNFS.writeFile(outputFilePath, 'Date,Time,Device Id,Mac address,Update Firmware,Firmware Version,Bootloader Version,Dfu Status', 'utf8')
            .then((success) => {
                // resolve('success')
                console.log('CSV FILE WRITTEN!');
            })
            .catch((err) => {
                // reject(err)
                console.log(err.message);
            });

            // this.setState({
            //     csvFileLog: [
            //         {
            //         "bootloaderVersion":"0.1.0",
            //         "date":"'23-09-2021'",
            //         "deviceId":"D1:B9:2E:4C:9B:1B",
            //         "deviceName":"EISAI Wearable",
            //         "dfuStatus":"Success",
            //         "firmwareVersion":"0.5.6",
            //         "macAddress":"D1B92E4C9B1B",
            //         "packageFile":"EISAI_WEARABLE_PH3_REV_0_5_6_PKG.zip",
            //         "time":"'10:29:43.012'"
            //         },
            //         {
            //         "bootloaderVersion":"0.1.0",
            //         "date":"'23-09-2021'",
            //         "deviceId":"E6:32:EB:4F:1B:66",
            //         "deviceName":"EISAI Wearable",
            //         "dfuStatus":"Not Started",
            //         "firmwareVersion":"0.5.6",
            //         "macAddress":"E632EB4F1B66",
            //         "packageFile":"EISAI_WEARABLE_PH3_REV_0_5_6_PKG.zip",
            //         "time":"'10:29:13.661'"
            //         }
            //         ]
            // })
            // await this.writeToCsv("D1:B9:2E:4C:9B:1B")

}

writeLog(time, log, type)
{
    var thisClass = this;
    return new Promise(async function(resolve, reject)
    {
  
            
        thisClass.state.logs.push({time: time , message:log, type:type});

            if(await RNFS.exists(thisClass.state.outputFilePath))
            {
                console.log('File Existed')
                await RNFS.readFile(thisClass.state.outputFilePath, 'utf8').then(async (data) =>{
                    console.log(data)
                    
                    var appendData = data+'\n'+time +" "+ log
                    await RNFS.writeFile(thisClass.state.outputFilePath,appendData, 'utf8')
                    .then((success) => {
                        resolve('success')
                        console.log('FILE WRITTEN!');
                    })
                    .catch((err) => {
                        reject(err)
                        console.log(err.message);
                    });
    
                    
                }).catch((err) =>{
                    console.log(err)
                })
            }
            else{
                console.log('File Created')

                await RNFS.writeFile(thisClass.state.outputFilePath, time +" "+ log, 'utf8')
                    .then((success) => {
                        resolve('success')
                        console.log('FILE WRITTEN!');
                    })
                    .catch((err) => {
                        reject(err)
                        console.log(err.message);
                    });
            }




    })

}


handleDiscoverPeripheralForSuggestions = (peripheral) => {
if(this.state.deviceSuggesionScan)
{
    var deviceList = this.state.devicesSuggesionList
    var tuple = {}
    // console.log('Got ble peripheral', peripheral);
    if (!peripheral.name) {
      peripheral.name = 'NO NAME';
    }




    // if(deviceList.indexOf(peripheral.name) == -1)
    if(deviceList.map((dataPoint) =>{
        return dataPoint.title
        }).indexOf(peripheral.name) == -1)
    {
 
        tuple = {
            id: deviceList.length + 1,
            title: peripheral.name
        }
        deviceList.push(tuple)
    }

    this.setState({
        devicesSuggesionList: deviceList
    })

    console.log(this.state.devicesSuggesionList)
}


  
}
enableIosBluetooth() {
    Alert.alert(
        'Enable Bluetooth',
        'App wants to use your bluetooth for connecting to devices.',
        [
          {
            text: 'Settings',
            onPress: () => {
              const majorVersionIOS = parseInt(Platform.Version, 10);
              if (majorVersionIOS < 14) {
                Linking.openURL('app-settings:{3}');
              } else {
                Linking.openURL('App-Prefs:Bluetooth');
              }
            },
          },
          {
            text: 'Close',
            onPress: () => console.log('Cancel Pressed'),
          },
        ],
        {cancelable: false},
      );


  }




  componentWillUnmount() {


    // bleManagerEmitter.removeListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral);
    bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral')
    // this.peripheralsListener.remove()
    if (this.focusListener != null && this.focusListener.remove) {
        this.focusListener.remove();
      }

      if (this.blurListener != null && this.blurListener.remove) {
        this.blurListener.remove();
      }

      
    EventRegister.removeEventListener(this.devicesListener)
    EventRegister.removeEventListener(this.statusListener)
    this.dfuProgressListener.remove();
    this.dfuStateListener.remove();
}


   render()
   {
    const renderItem = (item) => {
        ++this.childKey;
            
        const colors = item.type == 'info' ? {timeColor:'#4d4d4d', messageColor: '#000000'} : (item.type == 'error' ? {timeColor: '#dd5c63', messageColor: '#ce1620'} : {timeColor: '#5eaa4f', messageColor: '#8ec484'});
        return (
            <View key={this.childKey} style={{marginVertical:verticalScale(1), flexDirection:'row' ,marginHorizontal:scale(1)}}>
            <Text style={{fontSize: Platform.OS == "ios" ? scale(13):scale(10.2), color: colors.timeColor, width:'45%', textAlign:'left'}}>{item.time}</Text>
              <Text style={{fontSize: Platform.OS == "ios" ? scale(13):scale(10.2), color: colors.messageColor, width:'55%', fontWeight:'bold'}}>{item.message}</Text>
            </View>

        );

      }

               return (
            <View style={{flex:1}}>
                 <StatusBar backgroundColor="#013C4E" barStyle="light-content" />

                 <View style={{backgroundColor:'#00a9cd'}}>
                 
                 <Text style={{fontWeight:'bold', color:'white', justifyContent:'center',textAlign:'center', width:'100%',marginTop: verticalScale(10), fontSize:scale(20)}}>EISAI OTA BOOT</Text>

                {/* <View style = {Platform.OS == "android" ? ({flexDirection:'row', height:scale(35) ,alignItems:'center', marginVertical:scale(10),marginHorizontal:'5%'}) 
                :({flexDirection:'row', height:scale(35.1) ,zIndex:999,alignItems:'center', marginVertical:scale(10),marginHorizontal:'5%'})}>
                    <View style={{backgroundColor: 'white',width: scale(110), height:scale(35) ,paddingStart: scale(10), borderTopStartRadius: scale(5), borderBottomStartRadius: scale(5) ,justifyContent: 'center'}}>
                    <Text style= {{fontWeight:'bold', color:'#00a9cd'}}>Device Name: </Text>
                    </View>
                    <AutocompleteDropdown
                    
                    showChevron={false}
                    showClear={true}
                    suggestionsListMaxHeight ={scale(100)}
                    containerStyle={{ flexGrow: 1, flexShrink: 1  ,marginStart: -10}}
                    rightButtonsContainerStyle ={{
                        backgroundColor:'white',
                        borderTopRightRadius: scale(5),
                        height: scale(35),
                         borderBottomRightRadius: scale(5)
                    }}
                    textInputProps ={{
                        style: {
              backgroundColor: "white",
            height: scale(35),
            fontSize: scale(11),
              color: "#fff",
              borderColor:'black',
               borderWidth:scale(0), 
               color:'#00a9cd'
            },
            
                    }}
                    clearOnFocus={false}
                    closeOnBlur={true}
                    useFilter={true} 
                    closeOnSubmit={false}
                    onChangeText ={(async (text) =>{

                        if(Platform.OS == 'android')
        {
            await Controller.getInstance().checkLocationNbluetooth().then(async (status) =>{
                console.log(status)

                if(status.bluetoothStatus == "enabled" && status.locationStatus == "enabled" )
                {
                    console.log(this.state.isScanning)
                        if(!this.state.isScanning)
                        {
                            this.startScan()
                        }
                }
                else
                {
                    var message = "Please enable bluetooth and location"
                    if(status.bluetoothStatus == "not enabled" && status.locationStatus == "not enabled" )
                    {
                        message = "Please enable bluetooth and location"
                    }
                    else if(status.bluetoothStatus == "enabled" && status.locationStatus == "not enabled")
                    {
                        message = "Please enable location"
                    }

                    else if(status.bluetoothStatus == "not enabled" && status.locationStatus == "enabled")
                    {
                        message = "Please enable bluetooth"
                    }
                    this.setState({
                        showAlert: true,
                        alertMessage: message
                    })
                }

            })
        }
        else if(Platform.OS == "ios")
        {
            await Controller.getInstance().checkBluetooth().then(async (bluetoothStatus) =>{

                if(bluetoothStatus == "enabled" )
            {
                console.log(this.state.isScanning)
                        if(!this.state.isScanning)
                        {
                            this.startScan()
                        }
                
            }
            else{
                this.enableIosBluetooth()
            }

            })
        }
        
                    })}

                    onClear = {(() =>{
                        this.setState({
                            deviceNameFilter:""
                        })
                    })}

                    onBlur = {(() =>{
                        if(this.state.deviceSuggesionScan)
                        {
                            this.stopScan()
                        }
                    })}


                    onSelectItem={(item) => {
                        if(item != null)
                        {
                        console.log(item)
                        this.stopScan()
                        this.setState({deviceNameFilter:item.title})
                        console.log("deviceNameFilter")
                        console.log(this.state.deviceNameFilter)
                        }

          }}
                    dataSet={this.state.devicesSuggesionList}
                    />
    
                    </View>
    
                    <View style={{flexDirection:'row', height:scale(35), alignItems:'center', paddingStart:scale(10), marginBottom:scale(10),marginHorizontal:'5%',borderRadius:scale(5), backgroundColor:'white'}}>
                    <Text style= {{fontWeight:'bold', color:'#00a9cd'}}>Firmware Version: </Text>
                    <TextInput keyboardType="numbers-and-punctuation" style={{borderColor:'black', borderWidth:scale(0),color:'#00a9cd',flex:1,fontSize: scale(11), height:'100%'}}
                    // editable ={this.state.isScanning ? false:true}
                    onChangeText ={((text) =>{this.setState({firnwareVersionFilter:text})})}
                    ></TextInput>
                    </View> */}
    
                    <View style={{width:'100%',marginVertical:verticalScale(10), height:verticalScale(40)}}>
                    
                    
                    {this.state.firmwarefilepath == "" ? (
                        <TouchableOpacity style={{backgroundColor:'#99ddeb',alignSelf:'center',justifyContent:'center', alignItems:'center', marginTop:'auto',paddingHorizontal:'5%',paddingVertical:verticalScale(5),borderRadius:scale(5), marginBottom:'auto', marginRight:'auto', marginLeft:'auto'}}
                    onPress={(async () =>{

                        await this.createlogFile();
                        var firmwareFilePath = await MNSIT.getFilePath(
                          'EISAI_WEARABLE_PH3_REV_0_8_4_PKG.zip',
                        );
                        var bootloaderFliePath = await MNSIT.getFilePath('EISAI_BOOTLOADER_REV_0_2_1_PKG.zip')


                        if(Platform.OS == "android")
                    {

                        // destination = RNFS.CachesDirectoryPath + "/" + packageFile[0].name;
                        // await RNFS.copyFile(packageFile[0].uri, destination);

                        var destination =
                          RNFS.CachesDirectoryPath +
                          '/' +
                          'EISAI_WEARABLE_PH3_REV_0_8_4_PKG.zip';
                        await RNFS.copyFile(firmwareFilePath, destination);

                        var bootloaderDestination = RNFS.CachesDirectoryPath + "/" + 'EISAI_BOOTLOADER_REV_0_2_1_PKG.zip';
                        await RNFS.copyFile(bootloaderFliePath, bootloaderDestination);
                        bootloaderFliePath
                        await Controller.getInstance().checkLocationNbluetooth().then(async (status) =>{

                            if(status.bluetoothStatus == "enabled" && status.locationStatus == "enabled" )
                            {
                                if(this.state.isScanning)
                                {
                                    this.stopScan()
                                }
                                Controller.getInstance().scanDevices();
                                this.setState({
                                isProcessCompleted: true,
                                aborted: false,
                                progress:0,
                                totalProgress:0,
                                devicesList: [],
                                logs: [],
                                peripherals: new Map(),
                                connectionStatus: 'Not Connected',
                                autoDFUStatus: 'Scanning for devices',
                                showConnectionDialog: true,
                                firmwarefilepath: { bootloader: bootloaderDestination, firmware: destination},
                                deviceSuggesionScan: false,
                                dfuState:'Not Started',
                                autoDFUStatus:'Scanning',
                                isProcessCompleted:false,
                                dfuFailedDevices: 0
                            })

                            }
                            else{
                                var message = "Please enable bluetooth and location"
                            if(status.bluetoothStatus == "not enabled" && status.locationStatus == "not enabled" )
                            {
                                message = "Please enable bluetooth and location"
                            }
                            else if(status.bluetoothStatus == "enabled" && status.locationStatus == "not enabled")
                            {
                                message = "Please enable location"
                            }

                            else if(status.bluetoothStatus == "not enabled" && status.locationStatus == "enabled")
                            {
                                message = "Please enable bluetooth"
                            }
                            this.setState({
                                showAlert: true,
                                alertMessage: message
                            })
                            }
                        })
                    }



                    else if(Platform.OS == "ios")
                    {
                        await Controller.getInstance().checkBluetooth().then(async (bluetoothStatus) =>{
                            if(bluetoothStatus == "enabled" )
                        {
                            
                                if(this.state.isScanning)
                                {
                                    this.stopScan()
                                }
                                

                                Controller.getInstance().scanDevices();
                                this.setState({
                                isProcessCompleted: true,
                                aborted: false,
                                progress:0,
                                totalProgress:0,
                                devicesList: [],
                                logs: [],
                                peripherals: new Map(),
                                connectionStatus: 'Not Connected',
                                autoDFUStatus: 'Scanning for devices',
                                showConnectionDialog: true,
                                firmwarefilepath: firmwareFilePath,
                                deviceSuggesionScan: false,
                                dfuState:'Not Started',
                                autoDFUStatus:'Scanning',
                                isProcessCompleted:false,
                                dfuFailedDevices: 0
                    
                            })
                            
                        }
                        else{
                            this.enableIosBluetooth()
                        }
                        })
                    }






                        
                    //     this.setState({
                    //     firmwarefilepath: firmwareFilePath,
                    //     deviceSuggesionScan: false,
                    //     dfuState:'Not Started', autoDFUStatus:'Scanning', isProcessCompleted:false, dfuFailedDevices: 0
                    // })

                    // Controller.getInstance().scanDevices();

                    // this.setState({firmwarefilepath: destination, })

                    //     if(Platform.OS == "android")
                    // {
                    //     await Controller.getInstance().checkLocationNbluetooth().then(async (status) =>{
                    //     console.log(status)
                    //     if(status.bluetoothStatus == "enabled" && status.locationStatus == "enabled" )
                    //     {
                            
                    //         if(this.state.deviceNameFilter == '')
                    //         {
                    //             this.setState({
                    //             isProcessCompleted: true,
                    //             devicesList: [],
                    //             peripherals: new Map(),
                    //             progress:0,
                    //             totalProgress:0,
                    //             connectionStatus: 'Not Connected',
                    //             autoDFUStatus: 'Not Started',
                    //             showConnectionDialog: false,
                    //             showAlert: true,
                    //             alertMessage: 'Please select a device',
                    //         })
                    //         }
                    //         else{
                    //             if(this.state.isScanning)
                    //             {
                    //                 this.stopScan()
                    //             }
                    //             this.setState({
                    //             isProcessCompleted: true,
                    //             aborted: false,
                    //             progress:0,
                    //             totalProgress:0,
                    //             devicesList: [],
                    //             logs: [],
                    //             peripherals: new Map(),
                    //             connectionStatus: 'Not Connected',
                    //             autoDFUStatus: 'Scanning for devices',
                    //             showConnectionDialog: true,
                    //         })
                    //         }
                    //     }
                    //     else{
                    //         var message = "Please enable bluetooth and location"
                    //         if(status.bluetoothStatus == "not enabled" && status.locationStatus == "not enabled" )
                    //         {
                    //             message = "Please enable bluetooth and location"
                    //         }
                    //         else if(status.bluetoothStatus == "enabled" && status.locationStatus == "not enabled")
                    //         {
                    //             message = "Please enable location"
                    //         }

                    //         else if(status.bluetoothStatus == "not enabled" && status.locationStatus == "enabled")
                    //         {
                    //             message = "Please enable bluetooth"
                    //         }
                    //         this.setState({
                    //             showAlert: true,
                    //             alertMessage: message
                    //         })
                    //     }

                    // })
                    // }



                    // else if(Platform.OS == "ios")
                    // {
                    //     console.log("CHECK HERE")
                    //     await Controller.getInstance().checkBluetooth().then(async (bluetoothStatus) =>{

                    //         if(bluetoothStatus == "enabled" )
                    //     {
                    //         if(this.state.deviceNameFilter == '')
                    //         {
                    //             this.setState({
                    //             isProcessCompleted: true,
                    //             devicesList: [],
                    //             peripherals: new Map(),
                    //             progress:0,
                    //             totalProgress:0,
                    //             connectionStatus: 'Not Connected',
                    //             autoDFUStatus: 'Not Started',
                    //             showConnectionDialog: false,
                    //             showAlert: true,
                    //             alertMessage: 'Please select a device',
                    //         })
                    //         }
                    //         else{
                    //             if(this.state.isScanning)
                    //             {
                    //                 this.stopScan()
                    //             }
                                
                    //             this.setState({
                    //             isProcessCompleted: true,
                    //             aborted: false,
                    //             progress:0,
                    //             totalProgress:0,
                    //             devicesList: [],
                    //             logs: [],
                    //             peripherals: new Map(),
                    //             connectionStatus: 'Not Connected',
                    //             autoDFUStatus: 'Scanning for devices',
                    //             showConnectionDialog: true,
                    //         })
                    //         }
                    //     }
                    //     else{
                    //         this.enableIosBluetooth()
                    //     }

                    //     })
                    // }

                      



                    })}>
                    
                        <Text style={{fontWeight:'bold', color:'white'}}>START DFU</Text>
                        
                    </TouchableOpacity>
                    ):(null)}
                   

                    {!this.state.isProcessCompleted ? (<ActivityIndicator color={'#0586DD'} size={'large'} style={{top:0,bottom:0,right:'5%', position:'absolute'}}></ActivityIndicator>):(null)}
                    </View>
                 </View>


                <FlatList
                style = {{marginVertical:verticalScale(5)}}
                        data={this.state.logs}
                        renderItem={({ item }) => renderItem(item) }
                        // keyExtractor={item => item.id}
                        keyExtractor={(item, index) => {
                        // console.log('item', item);
                        return item.time;
                        }}

                        />  


<Text style={{justifyContent:'center',textAlign:'center', width:'100%',marginVertical: verticalScale(10), fontSize:scale(15)}}>Version: 1.0.0</Text>


{this.state.showConnectionDialog ? (

    <Dialog.Container
          contentStyle={
              Platform.OS == "android" ? (
                {
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor:'white'
          }
              ):(
                  this.state.autoDFUStatus == "Performing Dfu" ? (
            {
            borderRadius: 10,
            width:'90%',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor:'white'
          }
          ):(
            {
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor:'white'
          }
          ))
 }
          headerStyle={{justifyContent: 'center', alignItems: 'center'}}
          footerStyle={{justifyContent: 'center', alignItems: 'center'}}
          visible={true}>
          {this.state.firmwarefilepath == "" ? (
            <TouchableOpacity
            onPress={() => {
              this.setState({
                  showConnectionDialog:false
              })
            }}
            style={{position: 'absolute', top: scale(5), right: scale(5)}}>
            <Icon name="close" size={scale(25)} color="#5e5e5e" />
          </TouchableOpacity>
          ):(null)}

          <Dialog.Title style={{fontSize: scale(20), fontWeight: 'bold', color:'#00a9cd'}}>
            Brust DFU
          </Dialog.Title>

          {/* <Dialog.Description><Text>Device is already configured, would you like to unlink?</Text></Dialog.Description> */}
          
          {this.state.firmwarefilepath == "" ? (
            <View style={{}}>

                <View style={{justifyContent:"center", alignItems:'center', alignSelf:'center', marginTop:'auto', marginBottom:'auto'}}>

                <Text style={{fontSize:scale(15), marginBottom:scale(10)}}>Please Select Firmware File</Text>

<TouchableOpacity style={{backgroundColor:'#00a9cd', padding:scale(5), marginTop:scale(10), borderRadius:scale(5), marginBottom:Platform.OS == 'ios' ? (verticalScale(10)):(null)}}
        onPress ={(async () =>{
            if(this.state.firmwarefilepath == '')
            {
                try{


                    var destination = null;

if(Platform.OS == "android")
{
    const packageFile = await DocumentPicker.pick({
    type: [DocumentPicker.types.zip],
})

console.log(packageFile[0])

destination = RNFS.CachesDirectoryPath + "/" + packageFile[0].name;
await RNFS.copyFile(packageFile[0].uri, destination);
}

else if(Platform.OS == "ios")
{
    const packageFile = await DocumentPicker.pick({
    type: ["public.archive"],
})

destination = packageFile[0].uri
}

                    
                    // var destination = null;

                    // if(Platform.OS == "android")
                    // {
                    //     const packageFile = await DocumentPicker.pick({
                    //     type: [DocumentPicker.types.zip],
                    // })

                    // console.log(packageFile[0])

                    // destination = RNFS.CachesDirectoryPath + "/" + packageFile[0].name;
                    // await RNFS.copyFile(packageFile[0].uri, destination);
                    // }
                    
                    // else if(Platform.OS == "ios")
                    // {
                    //     const packageFile = await DocumentPicker.pick({
                    //     type: ["public.archive"],
                    // })
                    // destination = packageFile[0].uri
                    // }
                    await this.createlogFile();
                    this.setState({
                         deviceSuggesionScan: false
                    })
                    Controller.getInstance().scanDevices();
                    console.log("FIRMWARE FILE DESTINATION: " + destination)

                    this.setState({firmwarefilepath: destination, dfuState:'Not Started', autoDFUStatus:'Scanning', isProcessCompleted:false, dfuFailedDevices: 0})

               
                }
                catch (err) {
                if (DocumentPicker.isCancel(err)) {
                } else {
                }
                }

            }
            
        })}
        >
    <Text style = {{color:'white'}}>
        Select package file
    </Text>
    </TouchableOpacity>

                </View>


</View>
          ):(    <View style = {{justifyContent:'center', alignItems:'center'}}>
                 {this.state.autoDFUStatus === 'Scanning' ? (
                     <View style = {{justifyContent:'center', alignItems:'center'}}>
                         <Text style = {{fontSize:scale(15)}}>Scanning for devices</Text>
                         <Text style = {{fontSize:scale(15)}}>{'Devices Found: ' + this.state.devicesList.length}</Text>
                     </View>
                 ):(null)}

                 {this.state.autoDFUStatus === 'Filtering' || this.state.autoDFUStatus === "Fetching Device Information"? (
                     
                    <View style = {{justifyContent:'center', alignItems:'center'}}>
                         <Text style = {{fontSize:scale(15)}}>{this.state.autoDFUStatus === 'Filtering' ? ('Filtering Device'):('Fetching Device Information')}</Text>
                         <Text style = {{fontSize:scale(15)}}>{this.state.autoDFUStatus === 'Filtering' ? ('Filteing Device: '+this.state.currentDevice+'/'+this.state.totalDevices):('Device: '+this.state.currentDevice+'/'+this.state.totalDevices) }</Text>
                     </View>
                     
                     ):(null)}



                     {this.state.autoDFUStatus === 'Performing Dfu' ? (
                     
                     <View style = {{justifyContent:'center', alignItems:'center'}}>
                     <View style={{marginLeft:'auto', marginBottom:'auto', marginRight:Platform.OS == 'ios' ? (scale(10)):(null)}}>
                     <Text style = {{fontSize:scale(15)}}>{'Device: '  + this.state.currentDevice+ '/' + this.state.totalDevices}</Text>
                     </View>
                         
                         <View style={{flexDirection:'row',justifyContent:'center', alignContent:'center', alignItems:'center', alignSelf:'center'}}>

                     
                     <View style={{width:'40%', alignItems:'flex-end',justifyContent:'center'}}>
                     <Text style={{fontSize:scale(15)}}>{'DFU State: '}</Text>
                    </View>

                    <View style={{width:'60%', paddingLeft:scale(15), justifyContent:'center'}}>
                    <Text style={{fontSize:scale(15)}}>{this.state.dfuState}</Text>
                    </View>
                    
                    </View>



                    <View style={{flexDirection:'row', justifyContent:'center', alignItems:'center', width:'100%',paddingHorizontal:'3%' ,marginTop: verticalScale(5)}}>
                    <View style={{width:'40%', alignItems:'flex-end', justifyContent:'center'}}>
                    <Text style={{fontSize:scale(15)}}>Dfu Progress: </Text>
                    </View>
                    
                    <View style={{justifyContent:'center', width:'60%', alignItems:'center', alignContent:'center'}}>
                        <Text style={{fontSize:scale(12),color:'#007690', fontWeight:'bold', alignSelf:'center', position:'absolute', elevation:99, zIndex:99, marginTop:'auto', marginBottom:'auto', flex:1}}>{this.state.progress + '%'}</Text>
                        <Progress.Bar progress={this.state.progress/100} height={verticalScale(20)} width ={scale(150)} color = {'#80d4e6'}  style={{ borderColor:'#80d4e6', justifyContent:'center', marginLeft:scale(10)}} />
                    </View>
                    </View>

                    <View style={{flexDirection:'row', justifyContent:'center', alignItems:'center', width:'100%',paddingHorizontal:'3%' ,marginTop: verticalScale(5)}}>
                    <View style={{width:'40%', alignItems:'flex-end', justifyContent:'center'}}>
                    <Text style={{fontSize:scale(15)}}>Total Progress: </Text>
                    </View>
                    <View style={{justifyContent:'center', width:'60%', alignItems:'center', alignContent:'center'}}>
                        <Text style={{fontSize:scale(12),color:'#007690', fontWeight:'bold', alignSelf:'center', position:'absolute', elevation:99, zIndex:99, marginTop:'auto', marginBottom:'auto', flex:1}}>{this.state.totalProgress + '%'}</Text>
                        <Progress.Bar progress={this.state.totalProgress/100} height={verticalScale(20)}  width ={scale(150)} color = {'#80d4e6'} style={{ borderColor:'#80d4e6', justifyContent:'center', marginLeft:scale(10)}} />
                    </View>
                    </View>
                    
                    
                      </View>
                      
                      ):(null)}

                      {this.state.autoDFUStatus == "Performing Dfu" && this.state.currentDevice == this.state.devicesList.length ? 
                      (
                          <View style={{alignSelf:'baseline',justifyContent:'center', alignItems:'center', marginTop:verticalScale(20) ,paddingHorizontal:'5%',paddingVertical:verticalScale(5),borderRadius:scale(5), marginRight:'auto', marginLeft:'auto', marginBottom:Platform.OS == 'ios' ? (verticalScale(10)):(null)}}>
                          </View>
                      ):(
                          
                        !this.state.aborted ? (
                        <TouchableOpacity style={{backgroundColor:'#00a9cd',alignSelf:'baseline',justifyContent:'center', alignItems:'center', marginTop:verticalScale(20) ,paddingHorizontal:'5%',paddingVertical:verticalScale(5),borderRadius:scale(5), marginRight:'auto', marginLeft:'auto', marginBottom:Platform.OS == 'ios' ? (verticalScale(10)):(null)}}
                    onPress={( async () =>{
                          
                            await Controller.getInstance().stopScan();
                            console.log("DFU STATE: " + this.state.dfuState)
                            // if((this.state.dfuState == 'Not Started' || this.state.dfuState == 'Dfu Completed' || this.state.dfuState == 'Dfu Failed') && (this.state.autoDFUStatus != 'Filtering' && this.state.autoDFUStatus != 'Fetching Device Information'))
                            if((this.state.dfuState == 'Not Started') && (this.state.autoDFUStatus != 'Filtering' && this.state.autoDFUStatus != 'Fetching Device Information'))
                            {
                            
  
                                
                            this.setState({
                                isProcessCompleted: true,
                                aborted: true,
                                devicesList: [],
                                totalDevices:0,
                                currentDevice:0,
                                peripherals: new Map(),
                                connectionStatus: 'Not Connected',
                                autoDFUStatus: 'Dfu Aborted',
                                showConnectionDialog: false,
                                firmwarefilepath:''
                            })

                            console.log('ABORTING PROCESS')
                            this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"Dfu Aborted" , type:'error'});
                            console.log("----------------------------CHECK HERE ----------------------------")

                            console.log(this.state.csvFileLog)
                            if(this.state.csvFileLog != null && this.state.csvFileLog.length > 0)
                            {
                                console.log(this.state.csvFileLog)
                            var lengthOfFile  = this.state.csvFileLog.length
                            console.log("LENGTH OF FILE: "  + lengthOfFile)
                            console.log("FILE: ")
                            console.log(this.state.csvFileLog)
                            if(lengthOfFile > 0)
                            {
                            for(var a=0;a<lengthOfFile;a++)
                                {
                                    console.log("3 VALUE OF A IS:    " + a)
                                    console.log("3 OBJECT AT INDEX: " + a)
                                    console.log(this.state.csvFileLog[0])
                                    // console.log("3 WRITING DATA OF DEVICE: "+ this.state.csvFileLog[0].deviceId + 'TO CSV')
                                    if (this.state.csvFileLog[0].dfuStatus == 'Not Started')
                                    {
                                        this.state.csvFileLog[0].dfuStatus = 'Process Aborted'
                                    }
                                    await this.writeToCsv(this.state.csvFileLog[0].deviceId) //this line adds line to csv file and remove the added object from the list
                                }
                                console.log("this.uploadLogFile() 7")
                                await this.uploadLogFile()
                            }


                            // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Aborted", 'error')
                            
                            }
                            else{
                                
                                RNFS.unlink(this.state.outputFilePath).then(() =>{
                                    console.log('Log File Deleted')
                                }).catch((err) =>{
                                    console.log(err)
                                })
                            }

                        }
                        else{
                            console.log('WAITING TO ABORT PROCESS')
                             this.setState({
                                 aborted:true
                             })
                        }
                    })}>
                    
                        <Text style={{fontWeight:'bold', color:'white'}}>Abort DFU</Text>
                        
                    </TouchableOpacity>
                      )
                      :
                      (
                          <View style={{justifyContent:'center', alignItems:'center', flexDirection:'column', marginTop:verticalScale(10)}}>
                          <Text style={{fontSize:scale(15)}}>Please Wait, aborting</Text>
                              <ActivityIndicator size={'large'}></ActivityIndicator>
                              
                          </View>
                      )

                      )}
                      



                 </View>)}
          <View style={{flexDirection: 'column'}}>

          </View>
        </Dialog.Container>
):(null)}


{this.state.showLoadingDialog ? (
    <Dialog.Container
              contentStyle={{
                borderRadius: 10,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'white'
              }}
              headerStyle={{justifyContent: 'center', alignItems: 'center'}}
              footerStyle={{justifyContent: 'center', alignItems: 'center'}}
              visible={true}>
              <Dialog.Title style={{color: 'black'}}>Please Wait, Uploading Log File</Dialog.Title>
              <ActivityIndicator color="red" size="large" />
            </Dialog.Container>
):(null)}


{this.state.showAlert ? (
                  <Dialog.Container
                    contentStyle={{
                        backgroundColor:'white',
                      borderRadius: 10,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    headerStyle={{
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    footerStyle={{
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    visible={true}>
                    <Dialog.Title style ={{color:'black'}}>Error</Dialog.Title>
                    <Dialog.Description style ={{color:'black'}}>
                      {this.state.alertMessage}
                    </Dialog.Description>
                    <Dialog.Button
                      label="OK"
                      onPress={() => {
                        this.setState({showAlert: false});
                        
                      }}
                    />
                  </Dialog.Container>
                ) : null}


            </View>
        )
   }
}
