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


export default class brustMode extends Component {

    childKey = 0;
    dfuProgressListener = null;
dfuStateListener = null;
constructor(props)
{

    super(props);
    this.state = {
        isScanning: false,
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
        deviceNameFilter:'EISAI Wearable',
        // Eisai wearable
        firnwareVersionFilter: '',
        // firnwareVersionFilter: '0.1',
        // autoDFUStatus: 'Not Started',
        autoDFUStatus:'Performing Dfu',
        firmwarefilepath : '',
        alertMessage:'',
        alertTitle: 'Alert',
        totalDevices:0,
        currentDevice:0,
        aborted: false,
        logs: [],
        outputFilePath: '',
        csvFileLog:[]
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
  
componentDidMount()
{

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
            if(this.state.deviceNameFilter == '' || this.state.deviceNameFilter.toUpperCase() == peripheral.name.toUpperCase())
            {
                var logData = "Found: " + peripheral.id
                if(!this.state.logs.map((item) =>{ return item.message}).includes(logData))
                {
                    this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: logData, type:'info'});
                    this.state.csvFileLog.push({date: "'"+moment().format('DD-MM-YYYY')+"'", time: "'"+moment().format('HH:mm:ss.SSS')+"'", deviceName: peripheral.name, deviceId: peripheral.id, packageFile: this.state.firmwarefilepath.split('/')[this.state.firmwarefilepath.split('/').length-1], macAddress:null, firmwareVersion: null, bootloaderVersion: null, dfuStatus: 'Not Started'})
                    console.log(this.state.csvFileLog)
                    // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , logData, 'info')
                }
    
                this.state.peripherals.set(peripheral.id, peripheral);
                this.setState({
                    devicesList: Array.from(this.state.peripherals.values())
                })
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
      this.setState({
        showLoadingDialog: true
      })
    var fileUploaded = false
    var fileUploadTimer = null;
    var fileName = this.state.outputFilePath.split('/')
    fileName = fileName[fileName.length-1]
    const uploadUri = this.state.outputFilePath

    const task = storage()
    .ref('Pkd_Ota_Logs/'+fileName)
    .putFile(uploadUri);
    if(fileUploadTimer == null)
    {
        fileUploadTimer = setTimeout(() =>{
            console.log('File Upload TimeOut')
            fileUploadTimer = false
            if(fileUploaded == false)
            {
              task.cancel()
            }
            this.setState({showLoadingDialog: false})
        },10000);
    }


    task.then(() =>{
        console.log('Log File Uploaded')
        fileUploaded = true
        clearTimeout(fileUploadTimer)
        fileUploadTimer = null
        RNFS.unlink(this.state.outputFilePath).then(() =>{
            console.log("Log File: "+ this.state.outputFilePath+ ' Deleted')
        }).catch((err) =>{
            console.log(err)
        })
        this.setState({showLoadingDialog: false})
    }).catch((err) =>{
        console.log('Log File Upload Fail Due To Error ' + err)
        fileUploaded = false
        clearTimeout(fileUploadTimer)
        fileUploadTimer = null
        this.setState({showLoadingDialog: false})
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
  
  async performDfu(peripheral)
  {
      console.log(console.log("DFU STATE IN PERFROM DFU: " + this.state.dfuState))
      await NordicDFU.startDFU({
          deviceAddress: peripheral.id,
          deviceName: peripheral.name,
          filePath: this.state.firmwarefilepath,
          alternativeAdvertisingNameEnabled: Platform.OS == 'ios' ? false:null
          })
  
          .then(async (res) => {
  
              
              var index = this.getIndexOfDevice(res.deviceAddress)
              if(index != -1)
              {
                  var tuple = this.state.csvFileLog[index]

                  tuple['date'] = "'"+moment().format('DD-MM-YYYY')+"'"
                  tuple['time'] = "'"+moment().format('HH:mm:ss.SSS')+"'"
                  tuple['dfuStatus'] = 'Success'
                  this.state.csvFileLog[index] = tuple
                  this.writeToCsv(res.deviceAddress)
              }
  
              console.log(this.state.csvFileLog)
              this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"Dfu Success On Device: " + res.deviceAddress, type:'success'});
              // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Success On Device: " + res.deviceAddress, 'success')
              console.log("Transfer done:", res)})
          .catch(async(err) =>{
              console.log(err)
              var index = this.getIndexOfDevice(this.state.devicesList[this.state.currentDevice-1].id)
              if(index != -1)
              {
                  var tuple = this.state.csvFileLog[index]
                  tuple['date'] = "'"+moment().format('DD-MM-YYYY')+"'"
                  tuple['time'] = "'"+moment().format('HH:mm:ss.SSS')+"'"
                  tuple['dfuStatus'] = 'Failed'
                  this.state.csvFileLog[index] = tuple
                  this.writeToCsv(this.state.devicesList[this.state.currentDevice-1].id)
              }
  
              this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"Dfu Failed On Device: " + this.state.devicesList[this.state.currentDevice-1].id, type:'error'});
              // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Failed On Device: " + this.state.devicesList[this.state.currentDevice-1].id + res.deviceAddress, 'error')
              this.setState({
                  totalProgress: this.state.totalProgress + Math.round((1/this.state.totalDevices)* 100)
              })
          })
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
        this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"No " + this.state.deviceNameFilter +" devices found, aborting process", type:'error'});
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
                     this.state.csvFileLog[a].dfuStatus = 'Device skipped, device is already up to date'
                     await this.writeToCsv(this.state.csvFileLog[a].deviceId)
                     // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , 'Device: '+ currentDevice.id +' is already up to date. (Current package version : '+ FirmwareVerison +', Update version: '+this.state.firnwareVersionFilter+')', 'info')
                     this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'Device: '+ currentDevice.id +' is already up to date. (Current package version : '+ deviceInformation.firmwareVersion +', Update version: '+this.state.firnwareVersionFilter+')', type:'info'});
                 }

             }

         }).catch(async (err) =>{

             this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'Failed to fetch current package version of device: '+ currentDevice.id +', trying again', type:'error'});
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

                         
                         this.state.csvFileLog[a].dfuStatus = 'Device skipped, device is already up to date'
                         await this.writeToCsv(this.state.csvFileLog[a].deviceId)
     
                         // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , 'Device: '+ currentDevice.id +' is already up to date. (Current package version : '+ FirmwareVerison +', Update version: '+this.state.firnwareVersionFilter+')', 'info')
                         this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'Device: '+ currentDevice.id +' is already updated. current package version : '+ deviceInformation.firmwareVersion, type:'info'});
                     }
                 }

             }).catch(async (err) =>{
                 this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'Failed to fetch current package version of device: '+ currentDevice.id +', skipping device', type:'error'});
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
                     tuple['dfuStatus'] = 'Failed. error while fetching device information';
                     await this.writeToCsv(this.state.csvFileLog[deviceIndex].deviceId)

                     
                 }

                //  var deviceIndexinList = this.state.devicesList.map((device) =>{
                //     return device.id
                // }).indexOf(currentDevice.id)
                // if(deviceIndexinList != -1)
                // {
                //     this.state.devicesList.splice(deviceIndexinList, 1);
                // }

                // console.log("REMOVING DEVICE")
                // console.log(this.state.devicesList)
                 
                 // console.log('REMOVING DEVICE: '+ currentDevice.id)
                 // var index = this.state.devicesList.map((item) =>{
                 //     return (item.id)
                 //     }).indexOf(currentDevice.id)

                 // if(index != -1)
                 // {
                 //     this.state.devicesList.splice(index, 1);
                 // }
                 


             })
             
         })

         if(this.state.aborted)
         {
             console.log('Exiting Loop')
             break;
         }
         await this.sleep(500);

     }

     //write csv file


     if(this.state.aborted)
     {

         console.log("----------------------------CHECK HERE ----------------------------")
         console.log(this.state.csvFileLog)
         console.log(this.state.csvFileLog.length)
         var lengthOfFile  = this.state.csvFileLog.length
         for(var a=0;a<lengthOfFile;a++)
             {
                 console.log("VALUE OF A IS:    " + a)
                 console.log("WRITING DATA OF DEVICE: "+ this.state.csvFileLog[0].deviceId + 'TO CSV')
                 this.state.csvFileLog[0].dfuStatus = 'Process Aborted'
                 await this.writeToCsv(this.state.csvFileLog[0].deviceId)
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
         await Controller.getInstance().disconnect(this.state.devicesList[this.state.currentDevice-1].id)
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
         await this.uploadLogFile()
     }

else{
if(this.state.firnwareVersionFilter !== "")
{
 if(filteredDevices.length == 0)
 {
     this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: 'All devices already have updated version', type:'success'});
     // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "All devices already have updated version", 'success')

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
     this.setState({
         devicesList : filteredDevices,
         totalDevices: filteredDevices.length,
         currentDevice : 1,
         autoDFUStatus: 'Performing Dfu'
     })
 }
}
else{
 this.setState({
     currentDevice : 1,
     autoDFUStatus: 'Performing Dfu'
 })
}
}

await this.sleep(200);
//loop for performing dfu
     for(var a=0; a<this.state.totalDevices;a++)
     {
         this.setState({currentDevice: a+1})
         var currentDevice = this.state.devicesList[a]
         this.setState({
             currentDevice : a+1,
             progress:0,
             dfuState:'Preparing'
         })
         await this.performDfu(this.state.devicesList[a])

         if(this.state.aborted)
         {
             break;
             
         }
         await this.sleep(500);


     }

     if(this.state.aborted)
     {
         await Controller.getInstance().disconnect(this.state.devicesList[this.state.currentDevice-1].id)
         

         var lengthOfFile  = this.state.csvFileLog.length
         for(var a=0;a<lengthOfFile;a++)
             {

                 if (this.state.csvFileLog[0].dfuStatus == 'Not Started')
                 {
                     this.state.csvFileLog[0].dfuStatus = 'Process Aborted'
                 }

                 await this.writeToCsv(this.state.csvFileLog[0].deviceId)
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
         await this.uploadLogFile()
     }
     else{
         this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message:"Dfu Process Completed", type:'success'});
         // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Process Completed", 'success')
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

getIndexOfDevice(deviceId)
{
    var index = this.state.csvFileLog.map((item) =>{
        return (item.deviceId)
        }).indexOf(deviceId)
        return index
}

async writeToCsv(deviceId)
{

var deviceData = this.state.csvFileLog[this.getIndexOfDevice(deviceId)]

console.log('-----------------------------------')
    console.log(deviceId)
    console.log(this.getIndexOfDevice(deviceId))
    console.log(deviceData)
    console.log(this.state.csvFileLog)
    console.log('-----------------------------------')

if(this.getIndexOfDevice(deviceId) != -1)
{
    var csvRow = deviceData['date']+','+deviceData['time']+','+deviceData['deviceId']+','+deviceData['macAddress']+','+deviceData['packageFile']+','+deviceData['firmwareVersion']+','+deviceData['bootloaderVersion']+','+deviceData['dfuStatus']
console.log(csvRow)


console.log("ROW DATA: " + csvRow)
console.log("ROW DATA: " + csvRow)
console.log("ROW DATA: " + csvRow)
console.log("ROW DATA: " + csvRow)
await RNFS.readFile(this.state.outputFilePath, 'utf8').then(async (data) =>{
    console.log(data)
    
    var appendData = data+'\n'+csvRow
    await RNFS.writeFile(this.state.outputFilePath,appendData, 'utf8')
    .then((success) => {
        console.log('FILE WRITTEN!');
    })
    .catch((err) => {
        console.log(err.message);
    });

    
}).catch((err) =>{
    console.log(err)
})
this.state.csvFileLog.splice(this.getIndexOfDevice(deviceId), 1);
}

else{
    console.log("DATA NOT PRESENT")
    console.log("DATA NOT PRESENT")
    console.log("DATA NOT PRESENT")
    console.log("DATA NOT PRESENT")
}


 }


async createlogFile()
{
    var currentDirectory = 'Pkd_Ota_Logs'
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
                
                <TouchableOpacity
                        onPress={() => {
                        this.props.navigation.goBack();
                        }}
                        style={{top: scale(5), left: scale(5)}}>
                        <Icon name="chevron-back-outline" size={scale(30)} color="#5e5e5e" />
                    </TouchableOpacity>
    
    
                <View style={{flexDirection:'row', height:scale(35) ,alignItems:'center', paddingStart:scale(10), marginVertical:scale(10),marginHorizontal:'5%',borderRadius:scale(5), backgroundColor:'white'}}>
                    <Text style= {{fontWeight:'bold', color:'#00a9cd'}}>Device Name: </Text>
                    <TextInput style={{borderColor:'black', borderWidth:scale(0), flex:1, height:'100%',color:'#00a9cd'}}
                    // editable ={this.state.isScanning ? false:true}
                    onChangeText ={((text) =>{
    
                        this.setState({deviceNameFilter:text})
                        })}
                    ></TextInput>
    
                    </View>
    
                    <View style={{flexDirection:'row', height:scale(35), alignItems:'center', paddingStart:scale(10), marginBottom:scale(10),marginHorizontal:'5%',borderRadius:scale(5), backgroundColor:'white'}}>
                    <Text style= {{fontWeight:'bold', color:'#00a9cd'}}>Firmware Version: </Text>
                    <TextInput keyboardType="numbers-and-punctuation" style={{borderColor:'black', borderWidth:scale(0),color:'#00a9cd',flex:1, height:'100%'}}
                    // editable ={this.state.isScanning ? false:true}
                    onChangeText ={((text) =>{this.setState({firnwareVersionFilter:text})})}
                    ></TextInput>
                    </View>
    
                    <View style={{width:'100%',marginBottom:verticalScale(10), height:verticalScale(40)}}>
                    
                    
                    {this.state.firmwarefilepath == "" ? (
                        <TouchableOpacity style={{backgroundColor:'#99ddeb',alignSelf:'center',justifyContent:'center', alignItems:'center', marginTop:'auto',paddingHorizontal:'5%',paddingVertical:verticalScale(5),borderRadius:scale(5), marginBottom:'auto', marginRight:'auto', marginLeft:'auto'}}
                    onPress={(async () =>{

                        if(Platform.OS == "android")
                    {
                        await Controller.getInstance().checkLocationNbluetooth().then(async (status) =>{
                        console.log(status)
                        if(status.bluetoothStatus == "enabled" && status.locationStatus == "enabled" )
                        {
                            
                            if(this.state.deviceNameFilter == '')
                            {
                                this.setState({
                                isProcessCompleted: true,
                                devicesList: [],
                                peripherals: new Map(),
                                progress:0,
                                totalProgress:0,
                                connectionStatus: 'Not Connected',
                                autoDFUStatus: 'Not Started',
                                showConnectionDialog: false,
                                showAlert: true,
                                alertMessage: 'Please enter device name',
                            })
                            }
                            else{
                                
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
                            })
                            }
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
                        console.log("CHECK HERE")
                        await Controller.getInstance().checkBluetooth().then(async (bluetoothStatus) =>{

                            if(bluetoothStatus == "enabled" )
                        {
                            if(this.state.deviceNameFilter == '')
                            {
                                this.setState({
                                isProcessCompleted: true,
                                devicesList: [],
                                peripherals: new Map(),
                                progress:0,
                                totalProgress:0,
                                connectionStatus: 'Not Connected',
                                autoDFUStatus: 'Not Started',
                                showConnectionDialog: false,
                                showAlert: true,
                                alertMessage: 'Please enter device name',
                            })
                            }
                            else{
                                
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
                            })
                            }
                        }
                        else{
                            this.enableIosBluetooth()
                        }

                        })
                    }

                      



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
                        keyExtractor={item => item.id}
                        />  



{this.state.showConnectionDialog ? (

    <Dialog.Container
          contentStyle={{
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor:'white'
          }}
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
                    await this.createlogFile();
                    Controller.getInstance().scanDevices();

                    this.setState({firmwarefilepath: destination, dfuState:'Not Started', autoDFUStatus:'Scanning', isProcessCompleted:false})

               
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

                     <Text style={{fontSize:scale(15)}}>{'DFU State: '}</Text>
                    <Text style={{fontSize:scale(15)}}>{this.state.dfuState}</Text>
                    </View>



                    <View style={{flexDirection:'row', justifyContent:'center', alignItems:'center', width:'100%',paddingHorizontal:'3%' ,marginTop: verticalScale(5)}}>
                    <View style={{width:'50%', justifyContent:'center', alignItems:'center'}}>
                    <Text style={{fontSize:scale(15)}}>Dfu Progress: </Text>
                    </View>
                    <View style={{justifyContent:'center', width:'50%', alignItems:'center', alignContent:'center'}}>
                        <Text style={{fontSize:scale(12),color:'#007690', fontWeight:'bold', alignSelf:'center', position:'absolute', elevation:99, zIndex:99, marginTop:'auto', marginBottom:'auto', flex:1}}>{this.state.progress + '%'}</Text>
                        <Progress.Bar progress={this.state.progress/100} height={verticalScale(20)} width ={scale(100)} color = {'#80d4e6'}  style={{ borderColor:'#80d4e6', justifyContent:'center'}} />
                    </View>
                    </View>

                    <View style={{flexDirection:'row', justifyContent:'center', alignItems:'center', width:'100%',paddingHorizontal:'3%' ,marginTop: verticalScale(5)}}>
                    <View style={{width:'50%', justifyContent:'center', alignItems:'center'}}>
                    <Text style={{fontSize:scale(15)}}>Total Progress: </Text>
                    </View>
                    <View style={{justifyContent:'center', width:'50%', alignItems:'center', alignContent:'center'}}>
                        <Text style={{fontSize:scale(12),color:'#007690', fontWeight:'bold', alignSelf:'center', position:'absolute', elevation:99, zIndex:99, marginTop:'auto', marginBottom:'auto', flex:1}}>{this.state.totalProgress + '%'}</Text>
                        <Progress.Bar progress={this.state.totalProgress/100} height={verticalScale(20)}  width ={scale(100)} color = {'#80d4e6'} style={{ borderColor:'#80d4e6', justifyContent:'center'}} />
                    </View>
                    </View>
                    
                    
                      </View>
                      
                      ):(null)}

                      {!this.state.aborted ? (
                        <TouchableOpacity style={{backgroundColor:'#00a9cd',alignSelf:'baseline',justifyContent:'center', alignItems:'center', marginTop:verticalScale(20) ,paddingHorizontal:'5%',paddingVertical:verticalScale(5),borderRadius:scale(5), marginRight:'auto', marginLeft:'auto', marginBottom:Platform.OS == 'ios' ? (verticalScale(10)):(null)}}
                    onPress={( async () =>{
                          
                            await Controller.getInstance().stopScan();
                            console.log("DFU STATE: " + this.state.dfuState)
                            if((this.state.dfuState == 'Not Started' || this.state.dfuState == 'Dfu Completed' || this.state.dfuState == 'Dfu Failed') && (this.state.autoDFUStatus != 'Filtering' && this.state.autoDFUStatus != 'Fetching Device Information'))
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
                            for(var a=0;a<lengthOfFile;a++)
                                {
                                    this.state.csvFileLog[0].dfuStatus = 'Process Aborted'
                                    await this.writeToCsv(this.state.csvFileLog[0].deviceId)
                                }


                            // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Aborted", 'error')
                            await this.uploadLogFile()
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
                      }




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
