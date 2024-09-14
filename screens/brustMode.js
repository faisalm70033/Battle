import React, { Component } from "react";
import {
  Text,
  View,
  NativeModules,
  NativeEventEmitter,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  FlatList,
  Platform,
  TextInput,
  Alert,
  Linking,
  PermissionsAndroid,
  BackHandler,
  AppState,
} from "react-native";
import Controller from "../utils/Controller";
import { EventRegister } from "react-native-event-listeners";
import { NordicDFU, DFUEmitter } from '@domir/react-native-nordic-dfu';  //react-native-nordic-dfu
import StatusBar from "../utils/StatusBar";
import * as Progress from "react-native-progress";
// import { Dialog } from 'react-native-simple-dialogs';
import Dialog from "react-native-dialog";
import { scale, verticalScale, moderateScale } from "../utils/scale";
import DocumentPicker from "react-native-document-picker";
import Icon from "react-native-vector-icons/Ionicons";
var RNFS = require("react-native-fs");
import storage from "@react-native-firebase/storage";
import moment from "moment";
import { AutocompleteDropdown } from "react-native-autocomplete-dropdown";
import MNSIT from "../utils/files-handler";
import BleManager from "react-native-ble-manager";
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
export default class brustMode extends Component {
  childKey = 0;
  dfuProgressListener = null;
  dfuStateListener = null;
  deviceScanTimeout = null;
  constructor(props) {
    super(props);
    this.state = {
      scannedMacAddress: "",
      isScanning: false,
      // isLocalScanning: false,
      isProcessCompleted: true,
      devicesList: [],
      closestDevice: [],
      peripherals: new Map(),
      showConnectionDialog: false,
      showLoadingDialog: false,
      showAlert: false,
      connectionStatus: "Not Connected",
      peripheral: null,
      dfuState: "Not started",
      progress: 0,
      totalProgress: 0,
      deviceNameFilter: "Beetle",
      firnwareVersionFilter: "0.3.1",
      bootloaderVersion: "0.2.2",
      // 0.6.3
      // autoDFUStatus: 'Not Started',
      autoDFUStatus: "Not started",
      firmwarefilepath: "",
      alertMessage: "",
      alertTitle: "Alert",
      totalDevices: 0,
      currentDevice: 0,
      aborted: false,
      logs: [],
      outputFilePath: "",
      csvFileLog: [],
      devicesSuggesionList: [],
      deviceSuggesionScan: false,
      dfuFailedDevices: 0,
      isDeviceFoundAfterBootloader: false,
      showFilesUpLoadingDialog: false,
      totalFiles: 0,
      currentFile: 0,
      locationPermission: "not granted",
      storagePermission: "not granted",
      showSearchingDialog: false,
     expiryDate: "2024-12-31T23:59:59Z",

      showExpiryAlert: false,
      expiryMessage:
        "Beetle OTA App has expired. Please contact app developers!",
      appState: AppState.currentState,
    };
  }

  async getData(key) {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      // console.log (jsonValue)
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
      // error reading value
    }
  }
  async createlogFile() {
    var currentDirectory = "Beetle_LOGS";
    let absolutePath = "";
    // if(Platform.OS == "android")
    // {
    //     console.log("ANDORID")
    //     absolutePath = `/storage/emulated/0/${currentDirectory}`
    // }
    // else{
    //     console.log("IOS")
    //     absolutePath = `${RNFS.DocumentDirectoryPath}/${currentDirectory}`
    // }
    absolutePath = `${RNFS.DocumentDirectoryPath}/${currentDirectory}`;
    if (await RNFS.exists(absolutePath)) {
      console.log("Folder already exists");
    } else {
      console.log("Creating folder");
      RNFS.mkdir(absolutePath);
    }

    var outputFilePath =
      absolutePath +
      "/beetle_ota_Log_" +
      moment().format("DD_MM_YYYY_hh_mm_ss_A") +
      ".csv";
    this.setState({ outputFilePath: outputFilePath });
    await RNFS.writeFile(
      outputFilePath,
      "Date,Time,Device Id,Mac address,Update Firmware,Firmware Version,Bootloader Version,Dfu Status",
      "utf8"
    )
      .then((success) => {
        // resolve('success')
        console.log("CSV FILE WRITTEN!");
      })
      .catch((err) => {
        // reject(err)
        console.log(err.message);
      });
  }

  async checkPermissions() {
    return new Promise(async function (resolve, reject) {
      var locationPermission = "denied";
      var storagePermission = "denied";

      if (Platform.OS === "android" && Platform.Version >= 23) {
        await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        ).then(async (result) => {
          if (result) {
            locationPermission = "granted";
          } else {
            return new Promise(async function (resolve, reject) {
              Alert.alert(
                "Location Permission",
                "This permission is required to find nearby Beetles. ",
                [
                  {
                    text: "OK",
                    onPress: async () => {
                      await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                      ).then((result) => {
                        if (result == "granted") {
                          locationPermission = "granted";
                        } else if (result == "denied") {
                          locationPermission = "denied";
                        } else if (result == "never_ask_again") {
                          locationPermission = "never_ask_again";
                          Toast.show(
                            "APP will not work properly. Please Go into Settings -> Applications -> APP_NAME -> Permissions and Allow permissions to continue"
                          );
                        }
                        resolve();
                      });
                    },
                  },
                ],
                { cancelable: false }
              );
            });
          }
        });
      }

      if (Platform.OS === "android" && Platform.Version >= 23) {
        await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
        ).then(async (result) => {
          if (result) {
            storagePermission = "granted";
          } else {
            return new Promise(async function (resolve, reject) {
              Alert.alert(
                "Storage Permission",
                "This permission is required to load firmware file save log files in storage. ",
                [
                  {
                    text: "OK",
                    onPress: async () => {
                      await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
                      ).then((result) => {
                        if (result == "granted") {
                          storagePermission = "granted";
                        } else if (result == "denied") {
                          storagePermission = "denied";
                        } else if (result == "never_ask_again") {
                          storagePermission = "never_ask_again";
                          Toast.show(
                            "APP will not work properly. Please Go into Settings -> Applications -> APP_NAME -> Permissions and Allow permissions to continue"
                          );
                        }
                        resolve();
                      });
                    },
                  },
                ],
                { cancelable: false }
              );
            });
          }
        });
      }

      resolve({
        locationPermission: locationPermission,
        storagePermission: storagePermission,
      });
    });
  }

  writeLog(time, log, type) {
    var thisClass = this;
    return new Promise(async function (resolve, reject) {
      thisClass.state.logs.push({ time: time, message: log, type: type });

      if (await RNFS.exists(thisClass.state.outputFilePath)) {
        console.log("File Existed");
        await RNFS.readFile(thisClass.state.outputFilePath, "utf8")
          .then(async (data) => {
            console.log(data);

            var appendData = data + "\n" + time + " " + log;
            await RNFS.writeFile(
              thisClass.state.outputFilePath,
              appendData,
              "utf8"
            )
              .then((success) => {
                resolve("success");
                console.log("FILE WRITTEN!");
              })
              .catch((err) => {
                reject(err);
                console.log(err.message);
              });
          })
          .catch((err) => {
            console.log(err);
          });
      } else {
        console.log("File Created");

        await RNFS.writeFile(
          thisClass.state.outputFilePath,
          time + " " + log,
          "utf8"
        )
          .then((success) => {
            resolve("success");
            console.log("FILE WRITTEN!");
          })
          .catch((err) => {
            reject(err);
            console.log(err.message);
          });
      }
    });
  }

  getIndexOfDevice(deviceId) {
    var index = this.state.csvFileLog
      .map((item) => {
        return item.deviceId;
      })
      .indexOf(deviceId);
    return index;
  }

  async writeToCsv(deviceId) {
    var thisClass = this;
    return new Promise(async function (resolve, reject) {
      var deviceData =
        thisClass.state.csvFileLog[thisClass.getIndexOfDevice(deviceId)];
      console.log("WRITING DATA OF DEVICE: " + deviceId + " TO CSV");

      if (thisClass.getIndexOfDevice(deviceId) != -1) {
        var csvRow =
          deviceData["date"] +
          "," +
          deviceData["time"] +
          "," +
          deviceData["deviceId"] +
          "," +
          deviceData["macAddress"] +
          "," +
          deviceData["packageFile"] +
          "," +
          deviceData["firmwareVersion"] +
          "," +
          deviceData["bootloaderVersion"] +
          "," +
          deviceData["dfuStatus"];

        var data = null;
        console.log("READING FILES FROM STORAGE");
        data = await RNFS.readFile(thisClass.state.outputFilePath, "utf8");
        console.log("DATA IS: " + data);
        if (data != null) {
          console.log("DATA IN NOT NULL");
          var appendData = data + "\n" + csvRow;
          await RNFS.writeFile(
            thisClass.state.outputFilePath,
            appendData,
            "utf8"
          );
        }
        console.log(
          "getIndexOfDevice(deviceId): " + thisClass.getIndexOfDevice(deviceId)
        );
        console.log(
          "Removing deivce: " +
            deviceId +
            " from list at index: " +
            thisClass.getIndexOfDevice(deviceId)
        );
        thisClass.state.csvFileLog.splice(
          thisClass.getIndexOfDevice(deviceId),
          1
        );
        resolve("Success");
      } else {
        resolve("No Data for the given device");
        console.log("DATA NOT PRESENT");
      }
    });
  }

  async startManualProcess(macAddressObject) {
    var macAddress = macAddressObject.id;
    console.log("my device scanned", macAddress);
    if (macAddress != null && macAddress != "") {
      macAddress = await this.perpherialMac(macAddress);
      this.setState({
        scannedMacAddress: macAddress,
      });

      await AsyncStorage.removeItem("scannedMacAddress");

      console.log("CHECK HEREEEEE");
      this.startProcess();
    } else if (macAddress == null) {
      NetInfo.fetch().then((state) => {
        console.log(state);
        console.log("Is Internet Connected? ", state.isConnected);
        console.log("IS Internet Reachable? ", state.isInternetReachable);
        if (
          state.isConnected == true &&
          (state.isInternetReachable || state.isInternetReachable == null)
        ) {
          var currentDirectory = "Beetle_LOGS";
          let absolutePath = "";
          absolutePath = `${RNFS.DocumentDirectoryPath}/${currentDirectory}`;
          if (RNFS.exists(absolutePath)) {
            console.log("Reading folder");
            RNFS.readDir(absolutePath)
              .then(async (files) => {
                if (files != null && files.length > 0) {
                  console.log(files);
                  this.setState({
                    showFilesUpLoadingDialog: true,
                    totalFiles: files.length,
                  });

                  for (var a = 0; a < files.length; a++) {
                    this.setState({
                      currentFile: a + 1,
                    });
                    await this.uploadOldLogFiles(files[a].path)
                      .then((status) => {
                        console.log(status);
                      })
                      .catch((err) => {
                        console.log(err);
                      });
                  }

                  this.setState({
                    showFilesUpLoadingDialog: false,
                  });
                } else {
                  console.log("Empty Folder");
                }
              })
              .catch((err) => {
                console.log("ERROR: " + err);
              });
          } else {
            console.log("Folder not available");
          }
        }
      });
    }
    console.log("this.state.scannedMacAddress", this.state.scannedMacAddress);
    console.log(this.state.firmwarefilepath);
  }

  componentWillUnmount() {
    AppState.remove("change", this._handleAppStateChange);
    // bleManagerEmitter.removeListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral);
    bleManagerEmitter.removeAllListeners("BleManagerDiscoverPeripheral");
    // this.peripheralsListener.remove()
    if (this.focusListener != null && this.focusListener.remove) {
      this.focusListener.remove();
    }

    if (this.blurListener != null && this.blurListener.remove) {
      this.blurListener.remove();
    }

    EventRegister.removeEventListener(this.devicesListener);
    EventRegister.removeEventListener(this.statusListener);
    this.dfuProgressListener.remove();
    this.dfuStateListener.remove();
  }

  async uploadOldLogFiles(filePath) {
    return new Promise(function (resolve, reject) {
      var fileUploaded = false;
      var fileUploadTimer = null;
      var fileName = filePath.split("/");
      fileName = fileName[fileName.length - 1];
      const uploadUri = filePath;

      const task = storage()
        .ref("Beetle_LOGS_PH3.5/" + fileName)
        .putFile(uploadUri);
      if (fileUploadTimer == null) {
        fileUploadTimer = setTimeout(() => {
          console.log("File Upload TimeOut");
          fileUploadTimer = false;
          if (fileUploaded == false) {
            task.cancel();
            reject("Timeout");
          } else {
            resolve("Success");
          }
        }, 7000);
      }

      task
        .then(() => {
          console.log("Log File Uploaded");
          fileUploaded = true;
          clearTimeout(fileUploadTimer);
          fileUploadTimer = null;
          RNFS.unlink(filePath)
            .then(() => {
              console.log("Log File: " + filePath + " Deleted");
              resolve("Success");
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        })
        .catch((err) => {
          console.log("Log File Upload Fail Due To Error " + err);
          fileUploaded = false;
          clearTimeout(fileUploadTimer);
          fileUploadTimer = null;
          reject(err);
        });
    });
  }
  async perpherialMac(params) {
    return params;
    // return (
    //   params.substring(0, 2) +
    //   ":" +
    //   params.substring(2, 4) +
    //   ":" +
    //   params.substring(4, 6) +
    //   ":" +
    //   params.substring(6, 8) +
    //   ":" +
    //   params.substring(8, 10) +
    //   ":" +
    //   params.substring(10, 12)
    // );
  }
  _handleAppStateChange = (nextAppState) => {
    if (
      this.state.appState.match(/inactive|background/) &&
      nextAppState === "active"
    ) {
      console.log("App has come to the foreground!");
      let today = new Date().getTime();
      console.log(today);

      let appExpiryDate = new Date(this.state.expiryDate).getTime();
      if (appExpiryDate < today) {
        console.log(`session expired`);
        this.setState({ showExpiryAlert: true });
      } else {
        this.setState({ showExpiryAlert: false });
      }
    }
    this.setState({ appState: nextAppState });
  };

  componentDidMount() {
    AppState.addEventListener("change", this._handleAppStateChange);
    this.focusListener = this.props.navigation.addListener(
      "focus",
      async () => {
        let today = new Date().getTime();
        console.log(today);

        let appExpiryDate = new Date(this.state.expiryDate).getTime();
        if (appExpiryDate > today) {
          console.log(`${appExpiryDate} is less than ${today}`);
          this.setState({ showExpiryAlert: false });

          // ;
          var macAddress = await this.getData("scannedMacAddress");
          if (macAddress != null && macAddress != "") {
            macAddress = await this.perpherialMac(macAddress);
            this.setState({
              scannedMacAddress: macAddress,
            });

            await AsyncStorage.removeItem("scannedMacAddress");

            console.log("CHECK HEREEEEE");
            this.startProcess();
          } else if (macAddress == null) {
            NetInfo.fetch().then((state) => {
              console.log(state);
              console.log("Is Internet Connected? ", state.isConnected);
              console.log("IS Internet Reachable? ", state.isInternetReachable);
              if (
                state.isConnected == true &&
                (state.isInternetReachable || state.isInternetReachable == null)
              ) {
                var currentDirectory = "Beetle_LOGS";
                let absolutePath = "";
                absolutePath = `${RNFS.DocumentDirectoryPath}/${currentDirectory}`;
                if (RNFS.exists(absolutePath)) {
                  console.log("Reading folder");
                  RNFS.readDir(absolutePath)
                    .then(async (files) => {
                      if (files != null && files.length > 0) {
                        console.log(files);
                        this.setState({
                          showFilesUpLoadingDialog: true,
                          totalFiles: files.length,
                        });

                        for (var a = 0; a < files.length; a++) {
                          this.setState({
                            currentFile: a + 1,
                          });
                          await this.uploadOldLogFiles(files[a].path)
                            .then((status) => {
                              console.log(status);
                            })
                            .catch((err) => {
                              console.log(err);
                            });
                        }

                        this.setState({
                          showFilesUpLoadingDialog: false,
                        });
                      } else {
                        console.log("Empty Folder");
                      }
                    })
                    .catch((err) => {
                      console.log("ERROR: " + err);
                    });
                } else {
                  console.log("Folder not available");
                }
              }
            });
          }
          console.log(
            "this.state.scannedMacAddress",
            this.state.scannedMacAddress
          );
          console.log(this.state.firmwarefilepath);

          await this.sleep(500);

          if (Platform.OS == "android") {
            this.checkPermissions().then(async (permissions) => {
              // Controller.getInstance().checkPermissions().then(async(permissions) =>{
              this.setState({
                locationPermission: permissions.locationPermission,
                storagePermission: permissions.storagePermission,
              });
              console.log(
                "locationPermission: " +
                  permissions.locationPermission +
                  " storagePermission: " +
                  permissions.storagePermission
              );
              if (
                permissions.locationPermission == "granted" &&
                permissions.storagePermission == "granted"
              ) {
                await Controller.getInstance()
                  .checkLocationNbluetooth()
                  .then(async (status) => {
                    console.log(status);

                    if (
                      status.bluetoothStatus == "enabled" &&
                      status.locationStatus == "enabled"
                    ) {
                    } else {
                      var message = "Please enable bluetooth and location";
                      if (
                        status.bluetoothStatus == "not enabled" &&
                        status.locationStatus == "not enabled"
                      ) {
                        message = "Please enable bluetooth and location";
                      } else if (
                        status.bluetoothStatus == "enabled" &&
                        status.locationStatus == "not enabled"
                      ) {
                        message = "Please enable location";
                      } else if (
                        status.bluetoothStatus == "not enabled" &&
                        status.locationStatus == "enabled"
                      ) {
                        message = "Please enable bluetooth";
                      }
                      this.setState({
                        showAlert: true,
                        alertMessage: message,
                      });
                    }
                  });
              } else {
                this.setState({
                  showAlert: true,
                  alertMessage: "Please allow location and storage permissions",
                });
              }
            });
          } else if (Platform.OS == "ios") {
            await Controller.getInstance()
              .checkBluetooth()
              .then(async (bluetoothStatus) => {
                console.log("bluetoothStatus: " + bluetoothStatus);

                if (bluetoothStatus == "enabled") {
                } else {
                  this.enableIosBluetooth();
                }
              });
          }
        } else {
          console.log(`session expired`);
          this.setState({ showExpiryAlert: true });
        }

        console.log("FOCUS LISTENER CALLED");
      }
    );

    this.blurListener = this.props.navigation.addListener("blur", async () => {
      bleManagerEmitter.removeAllListeners("BleManagerDiscoverPeripheral");
      // bleManagerEmitter.removeListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral);
      // this.peripheralsListener.remove()
      console.log("BLUR LISTENER CALLED");
      this.stopScan();
      Controller.getInstance().stopScan();
    });

    this.dfuProgressListener = DFUEmitter.addListener(
      "DFUProgress",
      ({ percent }) => {
        console.log(
          "DFU progress:",
          percent,
          "DFU PROGRESS: ",
          this.state.progress
        );
        // if(percent != 0)
        // {

        console.log(
          this.state.csvFileLog[
            this.getIndexOfDevice(
              this.state.devicesList[this.state.currentDevice - 1].id
            )
          ].bootloaderVersion,
          this.state.bootloaderVersion
        );
        if (
          this.state.csvFileLog[
            this.getIndexOfDevice(
              this.state.devicesList[this.state.currentDevice - 1].id
            )
          ].bootloaderVersion != this.state.bootloaderVersion
        ) {
        }
        var totalPerent = Math.round(
          ((this.state.currentDevice - 1) / this.state.totalDevices) * 100 +
            (1 / this.state.totalDevices) * percent
        );
        // this.setState({ totalProgress: totalPerent });
        // }
        this.setState({ progress: percent, totalProgress: totalPerent });
      }
    );
    this.dfuStateListener = DFUEmitter.addListener(
      "DFUStateChanged",
      async ({ state }) => {
        console.log("DFU state:", state);
        state = state.replace(/_/g, " ");
        state = this.toTitleCase(state);
        state = state.replace("State ", "");

        if (state != "Dfu Completed" && state != "Dfu Failed") {
          if (state == "Dfu Process Starting") {
            var logData =
              state +
              ": " +
              this.state.devicesList[this.state.currentDevice - 1].id;
            if (
              !this.state.logs
                .map((item) => {
                  return item.message;
                })
                .includes(logData)
            ) {
              this.state.logs.push({
                time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
                message: logData,
                type: "info",
              });
              // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , logData, 'info')
            }
          } else {
            this.state.logs.push({
              time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
              message: state,
              type: "info",
            });
            // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , state, 'info')
          }
        }
        this.setState({ dfuState: state });
      }
    );

    // Controller.instance.scanDevices();
    this.devicesListener = EventRegister.addEventListener(
      "scanDevicesEvent",
      async (peripheral) => {
        if (this.state.autoDFUStatus == "Scanning") {
          console.log(peripheral.name, peripheral.id);
          // 'C4:5F:B4:31:B4:A0'
          // 'D1:B9:2E:4C:9B:1B'
          // if(peripheral.id == 'C4:5F:B4:31:B4:A0')
          // {
          if (peripheral.id === this.state.scannedMacAddress) {
            //    ||
            //
            var logData = "Found: " + peripheral.id;
            if (
              !this.state.logs
                .map((item) => {
                  return item.message;
                })
                .includes(logData)
            ) {
              this.state.logs.push({
                time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
                message: logData,
                type: "info",
              });
              this.state.csvFileLog.push({
                date: "'" + moment().format("DD-MM-YYYY") + "'",
                time: "'" + moment().format("HH:mm:ss.SSS") + "'",
                deviceName: peripheral.name,
                deviceId: peripheral.id,
                packageFile:
                  this.state.firmwarefilepath["firmware"].split("/")[
                    this.state.firmwarefilepath["firmware"].split("/").length -
                      1
                  ],
                macAddress: null,
                firmwareVersion: null,
                bootloaderVersion: null,
                dfuStatus: "Not Started",
              });
              console.log(this.state.csvFileLog);
              // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , logData, 'info')
            }

            this.state.peripherals.set(peripheral.id, peripheral);
            this.setState({
              devicesList: Array.from(this.state.peripherals.values()),
            });

            this.stopScan();
          }
          // }
        }

        // setList(Array.from(peripherals.values()));
      }
    );
    this.statusListener = EventRegister.addEventListener(
      "scanningStatus",
      async (status) => {
        if (status == true) {
          this.state.logs.push({
            time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
            message: "Scanning Started",
            type: "info",
          });
          // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Scanning Started", 'info')
        }
        if (status == false) {
          bleManagerEmitter.removeAllListeners("BleManagerDiscoverPeripheral");
          this.setState({
            deviceSuggesionScan: false,
          });
        }

        // if(status == false)
        // {
        //     this.state.logs.push({time: moment().format('DD/MM/YYYY HH:mm:ss.SSS') , message: "Scanning Stopped", type:'info'});
        //     await this.autoDFU()
        // }
        if (
          status == false &&
          this.state.aborted == false &&
          this.state.autoDFUStatus == "Scanning"
        ) {
          console.log("CHECK HERE: ======================================");
          console.log(status, this.state.aborted, this.state.autoDFUStatus);
          this.state.logs.push({
            time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
            message: "Scanning Stopped",
            type: "info",
          });
          // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Scanning Stopped", 'info')
          await this.autoDFU();
        } else if (status == false && this.state.aborted == true) {
        }

        this.setState({
          isScanning: status,
        });
      }
    );
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  isDeviceFound() {
    var thisClass = this;
    var interval = null;
    return new Promise(async function (resolve, reject) {
      thisClass.deviceScanTimeout = setTimeout(async () => {
        clearImmediate(interval);
        thisClass.stopScan();

        if (!thisClass.state.isDeviceFoundAfterBootloader) {
          console.log("returning false");
          resolve(false);
        } else {
          console.log("returning true1");
          resolve(true);
        }
      }, 30000);

      interval = setInterval(() => {
        //   console.log(thisClass.state.isDeviceFoundAfterBootloader)
        if (thisClass.state.isDeviceFoundAfterBootloader) {
          clearTimeout(thisClass.deviceScanTimeout);
          clearInterval(interval);
          resolve(true);
        }
      }, 100);
    });
  }

  isDeviceFoundBeforeDFU() {
    var thisClass = this;
    var interval = null;
    return new Promise(async function (resolve, reject) {
      thisClass.deviceScanTimeout = setTimeout(async () => {
        clearImmediate(interval);
        thisClass.stopScan();

        if (!thisClass.state.isDeviceFoundAfterBootloader) {
          console.log("returning false");
          resolve(false);
        } else {
          console.log("returning true1");
          resolve(true);
        }
      }, 30000);

      interval = setInterval(() => {
        //   console.log(thisClass.state.isDeviceFoundAfterBootloader)
        if (thisClass.state.isDeviceFoundAfterBootloader) {
          clearTimeout(thisClass.deviceScanTimeout);
          clearInterval(interval);
          resolve(true);
        }
      }, 100);
    });
  }

  async uploadLogFile() {
    var thisClass = this;
    return new Promise(function (resolve, reject) {
      thisClass.setState({
        showConnectionDialog: false,
        showLoadingDialog: true,
      });

      setTimeout(async () => {
        var fileUploaded = false;
        var fileUploadTimer = null;
        var fileName = thisClass.state.outputFilePath.split("/");
        fileName = fileName[fileName.length - 1];
        console.log("fileName: ");
        console.log(fileName);
        const uploadUri = thisClass.state.outputFilePath;

        // var fileUploaded = false
        // var fileUploadTimer = null;
        // var fileName = this.state.outputFilePath.split('/')
        // fileName = fileName[fileName.length-1]
        // const uploadUri = this.state.outputFilePath

        const task = storage()
          .ref("Beetle_LOGS_PH3.5/" + fileName)
          .putFile(uploadUri);
        if (fileUploadTimer == null) {
          fileUploadTimer = setTimeout(async () => {
            console.log("File Upload TimeOut");
            fileUploadTimer = false;
            if (fileUploaded == false) {
              await task.cancel();
            }
            thisClass.setState({ showLoadingDialog: false });
            resolve("Not Uploaded");
          }, 30000);
        }

        await task
          .then(async () => {
            console.log("Log File Uploaded");
            fileUploaded = true;
            clearTimeout(fileUploadTimer);
            fileUploadTimer = null;
            await RNFS.unlink(thisClass.state.outputFilePath)
              .then(() => {
                console.log(
                  "Log File: " + thisClass.state.outputFilePath + " Deleted"
                );
              })
              .catch((err) => {
                console.log(err);
              });
            thisClass.setState({ showLoadingDialog: false });
            resolve("Uploaded");
          })
          .catch((err) => {
            console.log("Log File Upload Fail Due To Error " + err);
            fileUploaded = false;
            clearTimeout(fileUploadTimer);
            fileUploadTimer = null;
            thisClass.setState({ showLoadingDialog: false });
            resolve("Not Uploaded");
          });
      }, 500);
    });
  }

  toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }

  async performDfu(peripheral) {
    this.setState({
      isDeviceFoundAfterBootloader: false,
    });

    this.startScan();
    await this.isDeviceFound();

    this.setState({
      isDeviceFoundAfterBootloader: false,
    });

    var isSuccess = false;
    var response = "";
    for (var a = 1; a < 2; a++) {
      console.log("console.log('Performing Dfu');");
      var deviceInfo =
        this.state.csvFileLog[this.getIndexOfDevice(peripheral.id)];
      console.log(deviceInfo);

      if (a == 0 || a == 1) {
        console.log("Performing Dfu");
        var file =
          this.state.firmwarefilepath[
            Object.keys(this.state.firmwarefilepath)[a]
          ];
        console.log(
          console.log("DFU STATE IN PERFROM DFU: " + this.state.dfuState)
        );
        console.log("FIRMWAREFILEPATH: " + file);
        await NordicDFU.startDFU({
          deviceAddress: peripheral.id,
          //   deviceName: peripheral.name,
          filePath: file,
          //   alternativeAdvertisingNameEnabled: Platform.OS == 'ios' ? false:null
        })

          .then(async (res) => {
            isSuccess = true;
            response = res;
            // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Success On Device: " + res.deviceAddress, 'success')
            console.log("Transfer done:", res);
          })
          .catch(async (err) => {
            console.log(err);
            console.log(typeof err);
            isSuccess = false;
            response = err;
            //   err = err.substring(1, err.length-1);
          });

        // if (a != 0 && !isSuccess) {
        //   break;

        if (a === 0 && isSuccess) {
          this.state.logs.push(
            {
              time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
              message:
                "Bootloader updated. New version: " +
                this.state.bootloaderVersion,
              type: "success",
            },
            5
          );
        }

        if (!isSuccess) {
          var message =
            "Starting firmware update  on device: " +
            this.state.devicesList[this.state.currentDevice - 1].id +
            " " +
            response;
          if (a === 0) {
            message =
              "Bootloader update  on device: " +
              this.state.devicesList[this.state.currentDevice - 1].id +
              ". " +
              response +
              ". Old version: " +
              deviceInfo.bootloaderVersion +
              " New Version: " +
              this.state.bootloaderVersion;
            // deviceInfo.bootloaderVersion < this.state.bootloaderVersion;
          }
          this.state.logs.push(
            {
              time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
              message: message,
              type: "error",
            },
            5
          );

          break;
        } else if (a == 0 && response == "Error: FW version failure") {
          // console.log('Skippig Bootloader File');
          // this.setState({progress: 50, totalProgress: 50});
          // this.state.logs.push({
          //   time: moment().format('DD/MM/YYYY HH:mm:ss.SSS'),
          //   message: 'Bootloader version is already up to date ',
          //   type: 'info',
          // });

          // setTimeout(() => {
          //   this.state.logs.push(
          //     {
          //       time: moment().format('DD/MM/YYYY HH:mm:ss.SSS'),
          //       message:
          //         'Starting firmware update  on deice: ' +
          //         this.state.devicesList[this.state.currentDevice - 1].id,
          //       type: 'info',
          //     },
          //     5,
          //   );
          // });
          break;
        }
        if (a == 0) {
          this.startScan();
          await this.isDeviceFound();
        }
      }
    }

    if (isSuccess) {
      var index = this.getIndexOfDevice(response.deviceAddress);
      if (index != -1) {
        var tuple = this.state.csvFileLog[index];

        tuple["date"] = "'" + moment().format("DD-MM-YYYY") + "'";
        tuple["time"] = "'" + moment().format("HH:mm:ss.SSS") + "'";
        tuple["dfuStatus"] = "Success";
        this.state.csvFileLog[index] = tuple;
        await this.writeToCsv(response.deviceAddress);
      }

      console.log(this.state.csvFileLog);
      this.state.logs.push({
        time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
        message: "Dfu Success On Device: " + response.deviceAddress,
        type: "success",
      });
    } else {
      var index = this.getIndexOfDevice(
        this.state.devicesList[this.state.currentDevice - 1].id
      );
      if (index != -1) {
        var tuple = this.state.csvFileLog[index];
        tuple["date"] = "'" + moment().format("DD-MM-YYYY") + "'";
        tuple["time"] = "'" + moment().format("HH:mm:ss.SSS") + "'";
        tuple["dfuStatus"] = "Failed";
        this.state.csvFileLog[index] = tuple;
        await this.writeToCsv(
          this.state.devicesList[this.state.currentDevice - 1].id
        );
      }

      this.state.logs.push({
        time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
        message:
          "Dfu Failed On Device: " +
          this.state.devicesList[this.state.currentDevice - 1].id,
        type: "error",
      });
      // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Failed On Device: " + this.state.devicesList[this.state.currentDevice-1].id + res.deviceAddress, 'error')
      this.setState({
        dfuFailedDevices: this.state.dfuFailedDevices + 1,
        totalProgress: this.state.totalProgress,
      });

      //FW version check failed
      if (
        response == "Error: Firmware not specified" ||
        response == "FW version check failed"
      ) {
        this.setState({
          isProcessCompleted: true,
          aborted: true,
          devicesList: [],
          totalDevices: 0,
          currentDevice: 0,
          peripherals: new Map(),
          connectionStatus: "Not Connected",
          autoDFUStatus: "Dfu Aborted",
          showAlert: true,
          alertMessage: "Please restart the application",
          showConnectionDialog: false,
          firmwarefilepath: "",
        });
      }
    }
  }

  async performDfu2(peripheral) {
    clearTimeout(this.deviceScanTimeout);
    this.stopScan();
    this.deviceScanTimeout = null;
    this.setState({ isDeviceFoundAfterBootloader: true });

    console.log("1111");
    await this.isDeviceFound();
    console.log("2222");
    this.setState({
      isDeviceFoundAfterBootloader: false,
    });

    console.log("STARRRTTTTING DFU");

    var isSuccess = false;
    var response = "";
    for (var a = 1; a < 2; a++) {
      console.log("console.log('Performing Dfu');");
      var deviceInfo =
        this.state.csvFileLog[this.getIndexOfDevice(peripheral.id)];
      console.log(deviceInfo);

      if (a == 0 || a == 1) {
        console.log("Performing Dfu");
        var file =
          this.state.firmwarefilepath[
            Object.keys(this.state.firmwarefilepath)[a]
          ];
        console.log(
          console.log("DFU STATE IN PERFROM DFU: " + this.state.dfuState)
        );
        console.log("FIRMWAREFILEPATH: " + file);
        await NordicDFU.startDFU({
          deviceAddress: peripheral.id,
          //   deviceName: peripheral.name,
          filePath: file,
          //   alternativeAdvertisingNameEnabled: Platform.OS == 'ios' ? false:null
        })

          .then(async (res) => {
            isSuccess = true;
            response = res;
            // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Success On Device: " + res.deviceAddress, 'success')
            console.log("Transfer done:", res);
          })
          .catch(async (err) => {
            console.log(err);
            console.log(typeof err);
            isSuccess = false;
            response = err;
            //   err = err.substring(1, err.length-1);
          });

        // if (a != 0 && !isSuccess) {
        //   break;

        if (a === 0 && isSuccess) {
          this.state.logs.push(
            {
              time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
              message:
                "Bootloader updated. New version: " +
                this.state.bootloaderVersion,
              type: "success",
            },
            5
          );
        }

        if (!isSuccess) {
          var message =
            "Starting firmware update  on device: " +
            peripheral.id +
            " " +
            response;
          if (a === 0) {
            message =
              "Bootloader update  on device: " +
              peripheral.id +
              ". " +
              response +
              ". Old version: " +
              deviceInfo.bootloaderVersion +
              " New Version: " +
              this.state.bootloaderVersion;
            // deviceInfo.bootloaderVersion < this.state.bootloaderVersion;
          }
          this.state.logs.push(
            {
              time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
              message: message,
              type: "error",
            },
            5
          );

          break;
        } else if (a == 0 && response == "Error: FW version failure") {
          // console.log('Skippig Bootloader File');
          // this.setState({progress: 50, totalProgress: 50});
          // this.state.logs.push({
          //   time: moment().format('DD/MM/YYYY HH:mm:ss.SSS'),
          //   message: 'Bootloader version is already up to date ',
          //   type: 'info',
          // });

          // setTimeout(() => {
          //   this.state.logs.push(
          //     {
          //       time: moment().format('DD/MM/YYYY HH:mm:ss.SSS'),
          //       message:
          //         'Starting firmware update  on deice: ' +
          //         this.state.devicesList[this.state.currentDevice - 1].id,
          //       type: 'info',
          //     },
          //     5,
          //   );
          // });
          break;
        }
        if (a == 0) {
          this.startScan();
          await this.isDeviceFound();
        }
      }
    }

    if (isSuccess) {
      var index = this.getIndexOfDevice(response.deviceAddress);
      if (index != -1) {
        var tuple = this.state.csvFileLog[index];

        tuple["date"] = "'" + moment().format("DD-MM-YYYY") + "'";
        tuple["time"] = "'" + moment().format("HH:mm:ss.SSS") + "'";
        tuple["dfuStatus"] = "Success";
        this.state.csvFileLog[index] = tuple;
        await this.writeToCsv(response.deviceAddress);
      }

      console.log(this.state.csvFileLog);
      this.state.logs.push({
        time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
        message: "Dfu Success On Device: " + response.deviceAddress,
        type: "success",
      });
    } else {
      var index = this.getIndexOfDevice(peripheral.id);
      if (index != -1) {
        var tuple = this.state.csvFileLog[index];
        tuple["date"] = "'" + moment().format("DD-MM-YYYY") + "'";
        tuple["time"] = "'" + moment().format("HH:mm:ss.SSS") + "'";
        tuple["dfuStatus"] = "Failed";
        this.state.csvFileLog[index] = tuple;
        await this.writeToCsv(peripheral.id);
      }

      this.state.logs.push({
        time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
        message: "Dfu Failed On Device: " + peripheral.id,
        type: "error",
      });
      // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Failed On Device: " + this.state.devicesList[this.state.currentDevice-1].id + res.deviceAddress, 'error')
      this.setState({
        dfuFailedDevices: this.state.dfuFailedDevices + 1,
        totalProgress: this.state.totalProgress,
      });

      //FW version check failed
      if (
        response == "Error: Firmware not specified" ||
        response == "FW version check failed"
      ) {
        this.setState({
          isProcessCompleted: true,
          aborted: true,
          devicesList: [],
          totalDevices: 0,
          currentDevice: 0,
          peripherals: new Map(),
          connectionStatus: "Not Connected",
          autoDFUStatus: "Dfu Aborted",
          showAlert: true,
          alertMessage: "Please restart the application",
          showConnectionDialog: false,
          firmwarefilepath: "",
        });
      }
    }
  }

  handleStopScan = (peripheral) => {
    if (this.state.closestDevice.length === 0) {
      this.setState({
        showSearchingDialog: false,
        closestDevice: [],
        //devicesList: [],
      });
    }
  };

  handleManualDiscoverPeripheralForSuggestions = (peripheral) => {
    if (this.state.deviceSuggesionScan) {
      if (
        (peripheral.name ? peripheral.name : "")
          .toLowerCase()
          .startsWith("palarum")
      ) {
        console.log(peripheral.id + " -- " + peripheral.rssi);

        let isFound = false;

        for (let i = 0; i < this.state.devicesList.length; i++) {
          if (this.state.devicesList[i].id == peripheral.id) {
            this.state.devicesList[i] = peripheral;
            isFound = true;
          }
        }

        if (!isFound) {
          this.state.devicesList.push(peripheral);
        }

        let filteredDevices = [];

        for (let i = 0; i < this.state.devicesList.length; i++) {
          if (this.state.devicesList[i].rssi > -45) {
            filteredDevices.push(this.state.devicesList[i]);
          }
        }

        if (filteredDevices.length == 0) return;
        let tempDeviceList = filteredDevices.sort((a, b) => {
          return b.rssi - a.rssi;
        });

        if (tempDeviceList.length == 0) return;
        this.setState({
          closestDevice: [tempDeviceList[0]],
        });

        console.log(
          " NEAREST DEVICE -> " +
            this.state.closestDevice[0].id +
            " -- " +
            this.state.closestDevice[0].rssi
        );
      }
    }
  };

  handleDiscoverPeripheralForSuggestions = (peripheral) => {
    if (this.state.deviceSuggesionScan) {
      if (
        peripheral.id == this.state.devicesList[this.state.currentDevice - 1].id
      ) {
        console.log(
          "Clearing bluetooth timeout, device found: ",
          peripheral.id,
          peripheral.name
        );
        clearTimeout(this.deviceScanTimeout);
        this.stopScan();
        this.deviceScanTimeout = null;
        this.setState({ isDeviceFoundAfterBootloader: true });
      }
      // var deviceList = this.state.devicesSuggesionList
      // var tuple = {}
      // // console.log('Got ble peripheral', peripheral);
      // if (!peripheral.name) {
      //   peripheral.name = 'NO NAME';
      // }

      // // if(deviceList.indexOf(peripheral.name) == -1)
      // if(deviceList.map((dataPoint) =>{
      //     return dataPoint.title
      //     }).indexOf(peripheral.name) == -1)
      // {

      //     tuple = {
      //         id: deviceList.length + 1,
      //         title: peripheral.name
      //     }
      //     deviceList.push(tuple)
      // }

      // this.setState({
      //     devicesSuggesionList: deviceList
      // })

      // console.log(this.state.devicesSuggesionList)
    }
  };

  connectDevice() {
    console.log(
      "Clearing bluetooth timeout, device found: ",
      peripheralP.id,
      peripheralP.name
    );
    clearTimeout(this.deviceScanTimeout);
    this.stopScan();
    this.deviceScanTimeout = null;
    this.setState({ isDeviceFoundAfterBootloader: true });
  }

  async startScan() {
    bleManagerEmitter.removeAllListeners("BleManagerDiscoverPeripheral");
    //bleManagerEmitter.removeAllListeners("BleManagerStopScan");
    await this.sleep(250);
    this.peripheralsListener = bleManagerEmitter.addListener(
      "BleManagerDiscoverPeripheral",
      this.handleDiscoverPeripheralForSuggestions.bind(this)
    );
    await this.sleep(250);
    BleManager.scan([], 30, false)
      .then(() => {
        // Success code

        console.log("Local Scan started");
        this.setState({ isScanning: true, deviceSuggesionScan: true });
      })
      .catch((err) => {
        console.log(err);
        this.setState({ isScanning: false });
      });
  }

  async startManualScan() {
    bleManagerEmitter.removeAllListeners("BleManagerDiscoverPeripheral");
    await this.sleep(250);
    this.peripheralsListener = bleManagerEmitter.addListener(
      "BleManagerDiscoverPeripheral",
      this.handleManualDiscoverPeripheralForSuggestions.bind(this)
    );
    this.stopScanListener = bleManagerEmitter.addListener(
      "BleManagerStopScan",
      this.handleStopScan.bind(this)
    );
    await this.sleep(250);
    BleManager.scan([], 30, false)
      .then(() => {
        // Success code

        console.log("Local Scan started");
        this.setState({ isScanning: true, deviceSuggesionScan: true });
      })
      .catch((err) => {
        console.log(err);
        this.setState({ isScanning: false });
      });
  }

  async stopScan() {
    BleManager.stopScan().then(() => {
      bleManagerEmitter.removeAllListeners("BleManagerDiscoverPeripheral");
      // Success code
      console.log("Local Scan stopped");
      this.setState({ isScanning: false, deviceSuggesionScan: false });
    });
  }

  async disconnectConnectedPeripherals() {
    await BleManager.getConnectedPeripherals([])
      .then(async (peripheralsArray) => {
        // Success code
        if (peripheralsArray.length > 0) {
          for (var a = 0; a < peripheralsArray.length; a++) {
            await BleManager.disconnect(peripheralsArray[a].id)
              .then(() => {
                console.log("Peripheral Disconnected");
              })
              .catch((err) => {
                console.log(err);
              });
          }
        }
      })
      .catch((err) => {
        console.log("getConnectedPeripherals: " + err);
      });
  }

  async startProcess() {
    console.log("Coming Here");
    await this.createlogFile();
    var firmwareFilePath = await MNSIT.getFilePath("PALARUM_v3_1.zip");
    var bootloaderFliePath = await MNSIT.getFilePath(
      "EISAI_BOOTLOADER_REV_0_2_1_PKG.zip"
    );

    if (Platform.OS == "android") {
      var destination = RNFS.CachesDirectoryPath + "/" + "PALARUM_v3_1.zip";
      await RNFS.copyFile(firmwareFilePath, destination);

      var bootloaderDestination =
        RNFS.CachesDirectoryPath + "/" + "EISAI_BOOTLOADER_REV_0_2_1_PKG.zip";
      await RNFS.copyFile(bootloaderFliePath, bootloaderDestination);

      //  Controller.getInstance().checkPermissions().then(async (permissions) =>{
      this.checkPermissions().then(async (permissions) => {
        this.setState({
          locationPermission: permissions.locationPermission,
          storagePermission: permissions.storagePermission,
        });
        console.log(
          "locationPermission: " +
            permissions.locationPermission +
            " storagePermission: " +
            permissions.storagePermission
        );
        if (
          permissions.locationPermission == "granted" &&
          permissions.storagePermission == "granted"
        ) {
          await Controller.getInstance()
            .checkLocationNbluetooth()
            .then(async (status) => {
              if (
                status.bluetoothStatus == "enabled" &&
                status.locationStatus == "enabled"
              ) {
                if (this.state.isScanning) {
                  this.stopScan();
                }
                console.log("SCANNING HAS BEEN STARTED");
                Controller.getInstance().scanDevices();
                this.setState({
                  isProcessCompleted: true,
                  aborted: false,
                  progress: 0,
                  totalProgress: 0,
                  devicesList: [],
                  logs: [],
                  peripherals: new Map(),
                  connectionStatus: "Not Connected",
                  autoDFUStatus: "Scanning for devices",
                  showConnectionDialog: true,
                  firmwarefilepath: {
                    bootloader: bootloaderDestination,
                    firmware: destination,
                  },
                  deviceSuggesionScan: false,
                  dfuState: "Not Started",
                  autoDFUStatus: "Scanning",
                  isProcessCompleted: false,
                  dfuFailedDevices: 0,
                });
              } else {
                var message = "Please enable bluetooth and location";
                if (
                  status.bluetoothStatus == "not enabled" &&
                  status.locationStatus == "not enabled"
                ) {
                  message = "Please enable bluetooth and location";
                } else if (
                  status.bluetoothStatus == "enabled" &&
                  status.locationStatus == "not enabled"
                ) {
                  message = "Please enable location";
                } else if (
                  status.bluetoothStatus == "not enabled" &&
                  status.locationStatus == "enabled"
                ) {
                  message = "Please enable bluetooth";
                }
                this.setState({
                  showAlert: true,
                  alertMessage: message,
                });
              }
            });
        } else {
          this.setState({
            showAlert: true,
            alertMessage: "Please allow location and storage permissions",
          });
        }
      });

      //  bootloaderFliePath
    } else if (Platform.OS == "ios") {
      await Controller.getInstance()
        .checkBluetooth()
        .then(async (bluetoothStatus) => {
          if (bluetoothStatus == "enabled") {
            if (this.state.isScanning) {
              this.stopScan();
            }

            Controller.getInstance().scanDevices();
            this.setState({
              isProcessCompleted: true,
              aborted: false,
              progress: 0,
              totalProgress: 0,
              devicesList: [],
              logs: [],
              peripherals: new Map(),
              connectionStatus: "Not Connected",
              autoDFUStatus: "Scanning for devices",
              showConnectionDialog: true,
              firmwarefilepath: firmwareFilePath,
              deviceSuggesionScan: false,
              dfuState: "Not Started",
              autoDFUStatus: "Scanning",
              isProcessCompleted: false,
              dfuFailedDevices: 0,
            });
          } else {
            this.enableIosBluetooth();
          }
        });
    }
  }
  async autoDFU() {
    if (this.state.devicesList == null || this.state.devicesList.length == 0) {
      this.setState({
        isProcessCompleted: true,
        aborted: false,
        devicesList: [],
        totalDevices: 0,
        currentDevice: 0,
        peripherals: new Map(),
        connectionStatus: "Not Connected",
        autoDFUStatus: "Dfu Aborted",
        showConnectionDialog: false,
        firmwarefilepath: "",
      });
      if (!this.state.aborted) {
        this.state.logs.push({
          time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
          message:
            "No " + this.state.deviceNameFilter + " found, process aborted",
          type: "error",
        });
      }
      await RNFS.unlink(this.state.outputFilePath)
        .then(() => {
          console.log("FILE DELETED");
        })
        .catch((err) => {
          console.log(err);
        });
    } else {
      var filteredDevices = [];
      this.setState({
        autoDFUStatus:
          this.state.firnwareVersionFilter === ""
            ? "Fetching Device Information"
            : "Filtering",
        totalDevices: this.state.devicesList.length,
        currentDevice: 1,
      });

      //loop for getting device iformation

      for (var a = 0; a < this.state.totalDevices; a++) {
        this.setState({ currentDevice: a + 1 });
        var currentDevice = this.state.devicesList[a];

        console.log(
          "FETCHING DEVICE INFORMATION OF DEVICE: " + currentDevice.id
        );
        await Controller.getInstance()
          .getDeviceInformation(currentDevice.id, this.state.bootloaderVersion)
          .then(async (deviceInformation) => {
            var deviceIndex = this.getIndexOfDevice(currentDevice.id);
            if (deviceIndex != -1) {
              var bootloaderVersion = deviceInformation.bootloaderVersion;

              var tuple = this.state.csvFileLog[deviceIndex];
              console.log(tuple);
              if (tuple.deviceName == "EISAI PH3 DFU V2") {
                bootloaderVersion = this.state.bootloaderVersion;
              }
              // deviceInformation = {serialNumber: sn, firmwareVersion:fv, bootloaderVersion: bv}
              tuple["date"] = "'" + moment().format("DD-MM-YYYY") + "'";
              tuple["time"] = "'" + moment().format("HH:mm:ss.SSS") + "'";
              tuple["macAddress"] = deviceInformation.serialNumber;
              tuple["firmwareVersion"] = deviceInformation.firmwareVersion;
              tuple["bootloaderVersion"] = bootloaderVersion;
              this.state.csvFileLog[deviceIndex] = tuple;
            }

            if (this.state.firnwareVersionFilter !== "") {
              if (
                deviceInformation.firmwareVersion <
                this.state.firnwareVersionFilter
              ) {
                currentDevice.previousPackageVersion =
                  deviceInformation.firmwareVersion;
                filteredDevices.push(currentDevice);
              } else {
                // console.log("check this later, below line is causing error")
                // console.log(this.state.csvFileLog)
                if (this.getIndexOfDevice(currentDevice.id) != -1) {
                  this.state.csvFileLog[
                    this.getIndexOfDevice(currentDevice.id)
                  ].dfuStatus = "Device skipped. Device is already up to date";
                  await this.writeToCsv(currentDevice.id);
                }

                //  this.state.csvFileLog[a].dfuStatus = 'Device skipped, device is already up to date'
                //  await this.writeToCsv(this.state.csvFileLog[a].deviceId)
                // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , 'Device: '+ currentDevice.id +' is already up to date. (Current package version : '+ FirmwareVerison +', Update version: '+this.state.firnwareVersionFilter+')', 'info')
                this.state.logs.push({
                  time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
                  message:
                    "Device: " +
                    currentDevice.id +
                    " is already up to date. (Current package version : " +
                    deviceInformation.firmwareVersion +
                    ", Update version: " +
                    this.state.firnwareVersionFilter +
                    ")",
                  type: "info",
                });
              }
            } else {
              filteredDevices.push(currentDevice);
            }
          })
          .catch(async (err) => {
            this.state.logs.push({
              time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
              message:
                "Failed to fetch information of device: " +
                currentDevice.id +
                ", trying again",
              type: "error",
            });
            // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , 'Failed to fetch current package version of device: : '+ currentDevice.id +', trying again', 'error')
            console.log(err);
            await Controller.getInstance()
              .getDeviceInformation(
                currentDevice.id,
                this.state.bootloaderVersion
              )
              .then(async (deviceInformation) => {
                var deviceIndex = this.getIndexOfDevice(currentDevice.id);
                if (deviceIndex != -1) {
                  var tuple = this.state.csvFileLog[deviceIndex];

                  var bootloaderVersion = deviceInformation.bootloaderVersion;

                  var tuple = this.state.csvFileLog[deviceIndex];
                  if (tuple.deviceName == "EISAI PH3 DFU V2") {
                    bootloaderVersion = this.state.bootloaderVersion;
                  }

                  // deviceInformation = {serialNumber: sn, firmwareVersion:fv, bootloaderVersion: bv}
                  tuple["date"] = "'" + moment().format("DD-MM-YYYY") + "'";
                  tuple["time"] = "'" + moment().format("HH:mm:ss.SSS") + "'";
                  tuple["macAddress"] = deviceInformation.serialNumber;
                  tuple["firmwareVersion"] = deviceInformation.firmwareVersion;
                  tuple["bootloaderVersion"] = bootloaderVersion;

                  this.state.csvFileLog[deviceIndex] = tuple;
                }

                if (this.state.firnwareVersionFilter !== "") {
                  if (
                    deviceInformation.firmwareVersion <
                    this.state.firnwareVersionFilter
                  ) {
                    currentDevice.previousPackageVersion =
                      deviceInformation.firmwareVersion;
                    filteredDevices.push(currentDevice);
                  } else {
                    if (this.getIndexOfDevice(currentDevice.id) !== -1) {
                      this.state.csvFileLog[
                        this.getIndexOfDevice(currentDevice.id)
                      ].dfuStatus =
                        "Device skipped. Device is already up to date";
                      await this.writeToCsv(currentDevice.id);
                    }

                    // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , 'Device: '+ currentDevice.id +' is already up to date. (Current package version : '+ FirmwareVerison +', Update version: '+this.state.firnwareVersionFilter+')', 'info')
                    this.state.logs.push({
                      time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
                      message:
                        "Device: " +
                        currentDevice.id +
                        " is already updated. current package version : " +
                        deviceInformation.firmwareVersion,
                      type: "info",
                    });
                  }
                } else {
                  filteredDevices.push(currentDevice);
                }
              })
              .catch(async (err) => {
                this.state.logs.push({
                  time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
                  message:
                    "Failed to fetch information of device: " +
                    currentDevice.id +
                    ", skipping device",
                  type: "error",
                });
                console.log(err);

                var deviceIndex = this.getIndexOfDevice(currentDevice.id);
                if (deviceIndex != -1) {
                  var tuple = this.state.csvFileLog[deviceIndex];
                  // deviceInformation = {serialNumber: sn, firmwareVersion:fv, bootloaderVersion: bv}
                  tuple["date"] = "'" + moment().format("DD-MM-YYYY") + "'";
                  tuple["time"] = "'" + moment().format("HH:mm:ss.SSS") + "'";
                  tuple["macAddress"] = null;
                  tuple["firmwareVersion"] = null;
                  tuple["bootloaderVersion"] = null;
                  tuple["dfuStatus"] =
                    "Failed. Error while fetching device information";
                  await this.writeToCsv(
                    this.state.csvFileLog[deviceIndex].deviceId
                  );
                }
              });
          });

        if (this.state.aborted) {
          console.log("Exiting Loop");
          break;
        }
        await this.sleep(1000);
      }

      //write csv file

      if (this.state.aborted) {
        console.log(
          "----------------------------CHECK HERE ----------------------------"
        );
        console.log(this.state.csvFileLog);
        console.log(this.state.csvFileLog.length);
        var lengthOfFile = this.state.csvFileLog.length;
        console.log("LENGTH OF FILE: " + lengthOfFile);
        console.log("FILE: ");
        console.log(this.state.csvFileLog);

        if (lengthOfFile > 0) {
          for (var a = 0; a < lengthOfFile; a++) {
            console.log("VALUE OF A IS:    " + a);
            console.log("OBJECT AT INDEX: " + a);
            console.log(this.state.csvFileLog[0]);
            // console.log("WRITING DATA OF DEVICE: "+ this.state.csvFileLog[0].deviceId + 'TO CSV')
            if (this.state.csvFileLog[0].dfuStatus === "Not Started") {
              this.state.csvFileLog[0].dfuStatus = "Process Aborted";
              await this.writeToCsv(this.state.csvFileLog[0].deviceId);
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

        console.log("ABORTING PROCESS");
        console.log(this.state.devicesList[this.state.currentDevice - 1].id);
        await this.disconnectConnectedPeripherals();
        //  await Controller.getInstance().disconnect(this.state.devicesList[this.state.currentDevice-1].id)
        this.setState({
          isProcessCompleted: true,
          aborted: true,
          devicesList: [],
          totalDevices: 0,
          currentDevice: 0,
          peripherals: new Map(),
          connectionStatus: "Not Connected",
          autoDFUStatus: "Dfu Aborted",
          showConnectionDialog: false,
          firmwarefilepath: "",
        });
        this.state.logs.push({
          time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
          message: "Dfu Aborted",
          type: "error",
        });
        // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Aborted", 'error')
        console.log("this.uploadLogFile() 1");
        // await this.uploadLogFile();
      } else {
        //not aborted

        // if(this.state.firnwareVersionFilter !== "")
        // {
        if (filteredDevices.length == 0) {
          if (
            this.state.logs
              .map((log) => {
                return log.message.includes("skipping device");
              })
              .reduce((a, v) => (v === true ? a + 1 : a), 0) ==
            this.state.devicesList.length
          ) {
            this.state.logs.push({
              time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
              message: "Failed to fetch device information, process aborted",
              type: "error",
            });
            // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "All devices already have updated version", 'success')
            console.log("this.uploadLogFile() 2");
            // await this.uploadLogFile();
            console.log("LOG FILE UPLOADED");

            this.setState({
              totalDevices: 0,
              currentDevice: 0,
              isProcessCompleted: true,
              showAlert: true,
              alertMessage:
                "Failed to fetch device information, process aborted",
              autoDFUStatus: "Process Completed",
              firmwarefilepath: "",
              devicesList: [],
              peripherals: new Map(),
              showConnectionDialog: false,
            });
          } else {
            if (
              this.state.logs
                .map((log) => {
                  return log.message.includes("skipping device");
                })
                .reduce((a, v) => (v === true ? a + 1 : a), 0) === 0
            ) {
              this.state.logs.push({
                time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
                message: "Version is already upto date",
                type: "success",
              });
              // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "All devices already have updated version", 'success')
              console.log("this.uploadLogFile() 3");
              // await this.uploadLogFile();

              this.setState({
                totalDevices: 0,
                currentDevice: 0,
                isProcessCompleted: true,
                showAlert: true,
                alertMessage: "Version is already upto date",
                autoDFUStatus: "Process Completed",
                firmwarefilepath: "",
                devicesList: [],
                peripherals: new Map(),
                showConnectionDialog: false,
              });
            } else {
              this.state.logs.push({
                time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
                message:
                  "Devices already have updated version, skipped: " +
                  this.state.logs
                    .map((log) => {
                      return log.message.includes("skipping device");
                    })
                    .reduce((a, v) => (v === true ? a + 1 : a), 0),
                type: "success",
              });
              // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "All devices already have updated version", 'success')
              console.log("this.uploadLogFile() 4");
              // await this.uploadLogFile();

              this.setState({
                totalDevices: 0,
                currentDevice: 0,
                isProcessCompleted: true,
                showAlert: true,
                alertMessage:
                  "Devices already have updated version, skipped: " +
                  this.state.logs
                    .map((log) => {
                      return log.message.includes("skipping device");
                    })
                    .reduce((a, v) => (v === true ? a + 1 : a), 0),
                autoDFUStatus: "Process Completed",
                firmwarefilepath: "",
                devicesList: [],
                peripherals: new Map(),
                showConnectionDialog: false,
              });
            }
          }
        } else {
          this.setState({
            devicesList: filteredDevices,
            totalDevices: filteredDevices.length,
            currentDevice: 1,
            autoDFUStatus: "Performing Dfu",
          });
        }
        // }
        // else{
        //  this.setState({
        //      currentDevice : 1,
        //      autoDFUStatus: 'Performing Dfu'
        //  })
        // }
      }

      if (!this.state.aborted && this.state.devicesList.length > 0) {
        this.setState({
          dfuState: "Preparing",
        });
        await this.sleep(1000);
        //loop for performing dfu
        for (var a = 0; a < this.state.totalDevices; a++) {
          this.setState({ currentDevice: a + 1 });
          var currentDevice = this.state.devicesList[a];
          this.setState({
            currentDevice: a + 1,
            progress: 0,
          });
          await this.performDfu(this.state.devicesList[a]);
          await this.checkDfuStatus().then((status) => {
            console.log("checkDfuStatus: " + status);
          });

          if (this.state.aborted) {
            if (a == this.state.totalDevices - 1) {
              this.setState({
                aborted: false,
              });
            } else {
              console.log("ABORTING LOOP");
              break;
            }
          }
          await this.sleep(1000);
        }

        if (this.state.aborted) {
          await this.disconnectConnectedPeripherals();
          //  await Controller.getInstance().disconnect(this.state.devicesList[this.state.currentDevice-1].id)

          var lengthOfFile = this.state.csvFileLog.length;
          console.log("LENGTH OF FILE: " + lengthOfFile);
          console.log("FILE: ");
          console.log(this.state.csvFileLog);

          if (lengthOfFile > 0) {
            for (var a = 0; a < lengthOfFile; a++) {
              console.log("2 VALUE OF A IS:    " + a);

              console.log("2 DATA OBJECT: ");
              console.log(this.state.csvFileLog);

              console.log("2 OBJECT AT INDEX: " + a);
              console.log(this.state.csvFileLog[0]);
              // console.log("2 WRITING DATA OF DEVICE: "+ this.state.csvFileLog[0].deviceId + 'TO CSV')
              if (this.state.csvFileLog[0].dfuStatus == "Not Started") {
                this.state.csvFileLog[0].dfuStatus = "Process Aborted";
              }

              await this.writeToCsv(this.state.csvFileLog[0].deviceId)
                .then((data) => {
                  console.log("SUCCES IN LOOP WITH RESPONSE: " + data);
                })
                .catch((err) => {
                  console.log("FAILED IN LOOP WITH ERROR: " + err);
                });
            }
          }

          this.setState({
            isProcessCompleted: true,
            aborted: true,
            devicesList: [],
            totalDevices: 0,
            currentDevice: 0,
            peripherals: new Map(),
            connectionStatus: "Not Connected",
            autoDFUStatus: "Dfu Aborted",
            showConnectionDialog: false,
            firmwarefilepath: "",
          });
          this.state.logs.push({
            time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
            message: "Dfu Aborted",
            type: "error",
          });
          // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Aborted", 'error')
          console.log("this.uploadLogFile() 5");
          // await this.uploadLogFile();
        } else {
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

          if (this.state.dfuFailedDevices == 0) {
            this.state.logs.push({
              time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
              message: "Dfu Process Completed",
              type: "success",
            });
          } else {
            if (this.state.dfuFailedDevices == 1) {
              if (
                this.state.dfuFailedDevices == this.state.devicesList.length
              ) {
                this.state.logs.push({
                  time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
                  message: "Dfu Failed",
                  type: "error",
                });
              } else {
                this.state.logs.push({
                  time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
                  message: "Dfu Process Completed. Failed On 1 Device",
                  type: "error",
                });
              }
            } else if (this.state.dfuFailedDevices > 1) {
              if (
                this.state.dfuFailedDevices == this.state.devicesList.length
              ) {
                this.state.logs.push({
                  time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
                  message: "Dfu Failed On All Devices",
                  type: "error",
                });
              } else {
                this.state.logs.push({
                  time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
                  message:
                    "Dfu Process Completed. Failed On " +
                    this.state.dfuFailedDevices +
                    " Devices",
                  type: "error",
                });
              }
            }
          }

          //  await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Process Completed", 'success')
          console.log("this.uploadLogFile() 6");
          // await this.uploadLogFile();
          this.setState({
            aborted: false,
            showConnectionDialog: false,
            isProcessCompleted: true,
            devicesList: [],
            totalDevices: 0,
            currentDevice: 0,
            peripherals: new Map(),
            firmwarefilepath: "",
            autoDFUStatus: "Process Completed",
          });
        }
      }
    }
  }

  async checkDfuStatus() {
    var thisClass = this;
    return new Promise(function (resolve, reject) {
      var dfuTimer = null;
      dfuTimer = setTimeout(() => {
        resolve(thisClass.state.dfuState);
      }, 3000);
      if (
        thisClass.state.dfuState == "Failed" ||
        thisClass.state.dfuState == "Dfu Completed"
      ) {
        resolve(thisClass.state.dfuState);
      }
    });
  }

  render() {
    const renderItem = (item) => {
      ++this.childKey;

      const colors =
        item.type == "info"
          ? { timeColor: "#4d4d4d", messageColor: "#000000" }
          : item.type == "error"
          ? { timeColor: "#dd5c63", messageColor: "#ce1620" }
          : { timeColor: "#5eaa4f", messageColor: "#8ec484" };
      return (
        <View
          key={this.childKey}
          style={{
            marginVertical: verticalScale(1),
            flexDirection: "row",
            marginHorizontal: scale(1),
          }}
        >
          <Text
            style={{
              fontSize: Platform.OS == "ios" ? scale(13) : scale(10.2),
              color: colors.timeColor,
              width: "45%",
              textAlign: "left",
            }}
          >
            {item.time}
          </Text>
          <Text
            style={{
              fontSize: Platform.OS == "ios" ? scale(13) : scale(10.2),
              color: colors.messageColor,
              width: "55%",
              fontWeight: "bold",
            }}
          >
            {item.message}
          </Text>
        </View>
      );
    };

    return (
      <View style={{ flex: 1 }}>
        <StatusBar backgroundColor="#013C4E" barStyle="light-content" />

        <View style={{ backgroundColor: "#00a9cd" }}>
          <Text
            style={{
              fontWeight: "bold",
              color: "white",
              justifyContent: "center",
              textAlign: "center",
              width: "100%",
              marginTop: verticalScale(10),
              fontSize: scale(20),
            }}
          >
            BEETLE OTA
          </Text>

          <View
            style={{
              width: "100%",
              marginVertical: verticalScale(10),
              height: verticalScale(40),
            }}
          >
            {this.state.firmwarefilepath == "" ? (
              <TouchableOpacity
                style={{
                  backgroundColor: "#99ddeb",
                  alignSelf: "center",
                  justifyContent: "center",
                  alignItems: "center",
                  marginTop: "auto",
                  paddingHorizontal: "5%",
                  paddingVertical: verticalScale(5),
                  borderRadius: scale(5),
                  marginBottom: "auto",
                  marginRight: "auto",
                  marginLeft: "auto",
                }}
                onPress={async () => {
                  //this.setState({ scannedMacAddress: "" });
                  //this.props.navigation.navigate("qrScan");

                  this.setState({
                    showSearchingDialog: true,
                    isDeviceFoundAfterBootloader: false,
                    closestDevice: [],
                  });

                  this.startManualScan();
                }}
              >
                <Text style={{ fontWeight: "bold", color: "white" }}>
                  START DFU
                </Text>
              </TouchableOpacity>
            ) : null}

            {!this.state.isProcessCompleted ? (
              <ActivityIndicator
                color={"#0586DD"}
                size={"large"}
                style={{
                  top: 0,
                  bottom: 0,
                  right: "5%",
                  position: "absolute",
                }}
              ></ActivityIndicator>
            ) : null}
          </View>
        </View>

        <FlatList
          style={{ marginVertical: verticalScale(5) }}
          data={this.state.logs}
          renderItem={({ item }) => renderItem(item)}
          // keyExtractor={item => item.id}
          keyExtractor={(item, index) => {
            // console.log('item', item);
            return item.time;
          }}
        />

        <Text
          style={{
            justifyContent: "center",
            textAlign: "center",
            width: "100%",
            marginVertical: verticalScale(10),
            fontSize: scale(15),
          }}
        >
          Version: 1.0.7
        </Text>

        {/* {this.state.showFilesUpLoadingDialog ? (
          <Dialog.Container
            contentStyle={{
              borderRadius: 10,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "white",
            }}
            headerStyle={{ justifyContent: "center", alignItems: "center" }}
            footerStyle={{ justifyContent: "center", alignItems: "center" }}
            visible={true}
          >
            <Dialog.Title
              style={{ color: "black", marginTop: verticalScale(10) }}
            >
              Please Wait
            </Dialog.Title>
            <Text style={{ fontSize: scale(15) }}>
              {"Uploading Log File " +
                this.state.currentFile +
                "/" +
                this.state.totalFiles}
            </Text>
            <ActivityIndicator color="red" size="large" />
          </Dialog.Container>
        ) : null} */}

        {this.state.showConnectionDialog ? (
          <Dialog.Container
            contentStyle={
              Platform.OS == "android"
                ? {
                    borderRadius: 10,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "white",
                  }
                : this.state.autoDFUStatus == "Performing Dfu"
                ? {
                    borderRadius: 10,
                    width: "90%",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "white",
                  }
                : {
                    borderRadius: 10,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "white",
                  }
            }
            headerStyle={{ justifyContent: "center", alignItems: "center" }}
            footerStyle={{ justifyContent: "center", alignItems: "center" }}
            visible={true}
          >
            {this.state.firmwarefilepath == "" ? (
              <TouchableOpacity
                onPress={() => {
                  this.setState({
                    showConnectionDialog: false,
                  });
                }}
                style={{ position: "absolute", top: scale(5), right: scale(5) }}
              >
                <Icon name="close" size={scale(25)} color="#5e5e5e" />
              </TouchableOpacity>
            ) : null}

            <Dialog.Title
              style={{
                fontSize: scale(20),
                fontWeight: "bold",
                color: "#00a9cd",
              }}
            >
              DFU
            </Dialog.Title>

            {/* <Dialog.Description><Text>Device is already configured, would you like to unlink?</Text></Dialog.Description> */}

            {this.state.firmwarefilepath == "" ? (
              <View style={{}}>
                <View
                  style={{
                    justifyContent: "center",
                    alignItems: "center",
                    alignSelf: "center",
                    marginTop: "auto",
                    marginBottom: "auto",
                  }}
                >
                  <Text
                    style={{ fontSize: scale(15), marginBottom: scale(10) }}
                  >
                    Please Select Firmware File
                  </Text>

                  <TouchableOpacity
                    style={{
                      backgroundColor: "#00a9cd",
                      padding: scale(5),
                      marginTop: scale(10),
                      borderRadius: scale(5),
                      marginBottom:
                        Platform.OS == "ios" ? verticalScale(10) : null,
                    }}
                    onPress={async () => {
                      if (this.state.firmwarefilepath == "") {
                        try {
                          var destination = null;

                          if (Platform.OS == "android") {
                            const packageFile = await DocumentPicker.pick({
                              type: [DocumentPicker.types.zip],
                            });

                            console.log(packageFile[0]);

                            destination =
                              RNFS.CachesDirectoryPath +
                              "/" +
                              packageFile[0].name;
                            await RNFS.copyFile(
                              packageFile[0].uri,
                              destination
                            );
                          } else if (Platform.OS == "ios") {
                            const packageFile = await DocumentPicker.pick({
                              type: ["public.archive"],
                            });

                            destination = packageFile[0].uri;
                          }

                          await this.createlogFile();
                          this.setState({
                            deviceSuggesionScan: false,
                          });
                          Controller.getInstance().scanDevices();
                          console.log(
                            "FIRMWARE FILE DESTINATION: " + destination
                          );

                          this.setState({
                            firmwarefilepath: destination,
                            dfuState: "Not Started",
                            autoDFUStatus: "Scanning",
                            isProcessCompleted: false,
                            dfuFailedDevices: 0,
                          });
                        } catch (err) {
                          if (DocumentPicker.isCancel(err)) {
                          } else {
                          }
                        }
                      }
                    }}
                  >
                    <Text style={{ color: "white" }}>Select package file</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ justifyContent: "center", alignItems: "center" }}>
                {this.state.autoDFUStatus === "Scanning" ? (
                  <View
                    style={{ justifyContent: "center", alignItems: "center" }}
                  >
                    <Text style={{ fontSize: scale(15) }}>
                      Scanning for devices
                    </Text>
                    <Text style={{ fontSize: scale(15) }}>
                      {"Devices Found: " + this.state.devicesList.length}
                    </Text>
                  </View>
                ) : null}

                {this.state.autoDFUStatus === "Filtering" ||
                this.state.autoDFUStatus === "Fetching Device Information" ? (
                  <View
                    style={{ justifyContent: "center", alignItems: "center" }}
                  >
                    <Text style={{ fontSize: scale(15) }}>
                      {this.state.autoDFUStatus === "Filtering"
                        ? "Filtering Device"
                        : "Fetching Device Information"}
                    </Text>
                    <Text style={{ fontSize: scale(15) }}>
                      {this.state.autoDFUStatus === "Filtering"
                        ? "Filtering Device: " +
                          this.state.currentDevice +
                          "/" +
                          this.state.totalDevices
                        : "Device: " +
                          this.state.currentDevice +
                          "/" +
                          this.state.totalDevices}
                    </Text>
                  </View>
                ) : null}

                {this.state.autoDFUStatus === "Performing Dfu" ? (
                  <View
                    style={{ justifyContent: "center", alignItems: "center" }}
                  >
                    <View
                      style={{
                        marginLeft: "auto",
                        marginBottom: "auto",
                        marginRight: Platform.OS == "ios" ? scale(10) : null,
                      }}
                    >
                      <Text style={{ fontSize: scale(15) }}>
                        {"Device: " +
                          this.state.currentDevice +
                          "/" +
                          this.state.totalDevices}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        alignContent: "center",
                        alignItems: "center",
                        alignSelf: "center",
                      }}
                    >
                      <View
                        style={{
                          width: "40%",
                          alignItems: "flex-end",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: scale(15) }}>
                          {"DFU State: "}
                        </Text>
                      </View>

                      <View
                        style={{
                          width: "60%",
                          paddingLeft: scale(15),
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: scale(15) }}>
                          {this.state.dfuState}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "100%",
                        paddingHorizontal: "3%",
                        marginTop: verticalScale(5),
                      }}
                    >
                      <View
                        style={{
                          width: "40%",
                          alignItems: "flex-end",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: scale(15) }}>
                          Dfu Progress:{" "}
                        </Text>
                      </View>

                      <View
                        style={{
                          justifyContent: "center",
                          width: "60%",
                          alignItems: "center",
                          alignContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: scale(12),
                            color: "#007690",
                            fontWeight: "bold",
                            alignSelf: "center",
                            position: "absolute",
                            elevation: 99,
                            zIndex: 99,
                            marginTop: "auto",
                            marginBottom: "auto",
                            flex: 1,
                          }}
                        >
                          {Math.round(this.state.progress) + "%"}
                        </Text>
                        <Progress.Bar
                          progress={this.state.progress / 100}
                          height={verticalScale(20)}
                          width={scale(150)}
                          color={"#80d4e6"}
                          style={{
                            borderColor: "#80d4e6",
                            justifyContent: "center",
                            marginLeft: scale(10),
                          }}
                        />
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "100%",
                        paddingHorizontal: "3%",
                        marginTop: verticalScale(5),
                      }}
                    >
                      {/* <View
                        style={{
                          width: "40%",
                          alignItems: "flex-end",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: scale(15) }}>
                          Total Progress:{" "}
                        </Text>
                      </View> */}
                      {/* <View
                        style={{
                          justifyContent: "center",
                          width: "60%",
                          alignItems: "center",
                          alignContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: scale(12),
                            color: "#007690",
                            fontWeight: "bold",
                            alignSelf: "center",
                            position: "absolute",
                            elevation: 99,
                            zIndex: 99,
                            marginTop: "auto",
                            marginBottom: "auto",
                            flex: 1,
                          }}
                        >
                          {this.state.totalProgress + "%"}
                        </Text>
                        <Progress.Bar
                          progress={this.state.totalProgress / 100}
                          height={verticalScale(20)}
                          width={scale(150)}
                          color={"#80d4e6"}
                          style={{
                            borderColor: "#80d4e6",
                            justifyContent: "center",
                            marginLeft: scale(10),
                          }}
                        />
                      </View> */}
                    </View>
                  </View>
                ) : null}

                {this.state.autoDFUStatus == "Performing Dfu" &&
                this.state.currentDevice == this.state.devicesList.length ? (
                  <View
                    style={{
                      alignSelf: "baseline",
                      justifyContent: "center",
                      alignItems: "center",
                      marginTop: verticalScale(20),
                      paddingHorizontal: "5%",
                      paddingVertical: verticalScale(5),
                      borderRadius: scale(5),
                      marginRight: "auto",
                      marginLeft: "auto",
                      marginBottom:
                        Platform.OS == "ios" ? verticalScale(10) : null,
                    }}
                  ></View>
                ) : !this.state.aborted ? (
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#00a9cd",
                      alignSelf: "baseline",
                      justifyContent: "center",
                      alignItems: "center",
                      marginTop: verticalScale(20),
                      paddingHorizontal: "5%",
                      paddingVertical: verticalScale(5),
                      borderRadius: scale(5),
                      marginRight: "auto",
                      marginLeft: "auto",
                      marginBottom:
                        Platform.OS == "ios" ? verticalScale(10) : null,
                    }}
                    onPress={async () => {
                      await Controller.getInstance().stopScan();
                      console.log("DFU STATE: " + this.state.dfuState);
                      // if((this.state.dfuState == 'Not Started' || this.state.dfuState == 'Dfu Completed' || this.state.dfuState == 'Dfu Failed') && (this.state.autoDFUStatus != 'Filtering' && this.state.autoDFUStatus != 'Fetching Device Information'))
                      if (
                        this.state.dfuState == "Not Started" &&
                        this.state.autoDFUStatus != "Filtering" &&
                        this.state.autoDFUStatus !=
                          "Fetching Device Information"
                      ) {
                        this.setState({
                          isProcessCompleted: true,
                          aborted: true,
                          devicesList: [],
                          totalDevices: 0,
                          currentDevice: 0,
                          peripherals: new Map(),
                          connectionStatus: "Not Connected",
                          autoDFUStatus: "Dfu Aborted",
                          showConnectionDialog: false,
                          firmwarefilepath: "",
                        });

                        console.log("ABORTING PROCESS");
                        this.state.logs.push({
                          time: moment().format("DD/MM/YYYY HH:mm:ss.SSS"),
                          message: "Dfu Aborted",
                          type: "error",
                        });
                        console.log(
                          "----------------------------CHECK HERE ----------------------------"
                        );

                        console.log(this.state.csvFileLog);
                        if (
                          this.state.csvFileLog != null &&
                          this.state.csvFileLog.length > 0
                        ) {
                          console.log(this.state.csvFileLog);
                          var lengthOfFile = this.state.csvFileLog.length;
                          console.log("LENGTH OF FILE: " + lengthOfFile);
                          console.log("FILE: ");
                          console.log(this.state.csvFileLog);
                          if (lengthOfFile > 0) {
                            for (var a = 0; a < lengthOfFile; a++) {
                              console.log("3 VALUE OF A IS:    " + a);
                              console.log("3 OBJECT AT INDEX: " + a);
                              console.log(this.state.csvFileLog[0]);
                              // console.log("3 WRITING DATA OF DEVICE: "+ this.state.csvFileLog[0].deviceId + 'TO CSV')
                              if (
                                this.state.csvFileLog[0].dfuStatus ==
                                "Not Started"
                              ) {
                                this.state.csvFileLog[0].dfuStatus =
                                  "Process Aborted";
                              }
                              await this.writeToCsv(
                                this.state.csvFileLog[0].deviceId
                              ); //this line adds line to csv file and remove the added object from the list
                            }
                            console.log("this.uploadLogFile() 7");
                            // await this.uploadLogFile();
                          }

                          // await this.writeLog(moment().format('DD/MM/YYYY HH:mm:ss.SSS') , "Dfu Aborted", 'error')
                        } else {
                          RNFS.unlink(this.state.outputFilePath)
                            .then(() => {
                              console.log("Log File Deleted");
                            })
                            .catch((err) => {
                              console.log(err);
                            });
                        }
                      } else {
                        console.log("WAITING TO ABORT PROCESS");
                        this.setState({
                          aborted: true,
                        });
                      }
                    }}
                  >
                    <Text style={{ fontWeight: "bold", color: "white" }}>
                      Abort DFU
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View
                    style={{
                      justifyContent: "center",
                      alignItems: "center",
                      flexDirection: "column",
                      marginTop: verticalScale(10),
                    }}
                  >
                    <Text style={{ fontSize: scale(15) }}>
                      Please Wait, aborting
                    </Text>
                    <ActivityIndicator size={"large"}></ActivityIndicator>
                  </View>
                )}
              </View>
            )}
            <View style={{ flexDirection: "column" }}></View>
          </Dialog.Container>
        ) : null}

        {/* {this.state.showLoadingDialog ? (
          <Dialog.Container
            contentStyle={{
              borderRadius: 10,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "white",
            }}
            headerStyle={{ justifyContent: "center", alignItems: "center" }}
            footerStyle={{ justifyContent: "center", alignItems: "center" }}
            visible={true}
          >
            <Dialog.Title style={{ color: "black" }}>
              Please Wait, Uploading Log File
            </Dialog.Title>
            <ActivityIndicator color="red" size="large" />
          </Dialog.Container>
        ) : null} */}

        {this.state.showAlert ? (
          <Dialog.Container
            contentStyle={{
              backgroundColor: "white",
              borderRadius: 10,
              justifyContent: "center",
              alignItems: "center",
            }}
            headerStyle={{
              justifyContent: "center",
              alignItems: "center",
            }}
            footerStyle={{
              justifyContent: "center",
              alignItems: "center",
            }}
            visible={true}
          >
            <Dialog.Title style={{ color: "black" }}>Alert</Dialog.Title>
            <Dialog.Description style={{ color: "black" }}>
              {this.state.alertMessage}
            </Dialog.Description>
            <Dialog.Button
              label="OK"
              onPress={() => {
                this.setState({ showAlert: false });
              }}
            />
          </Dialog.Container>
        ) : null}

        {this.state.showExpiryAlert ? (
          <Dialog.Container
            contentStyle={{
              backgroundColor: "white",
              borderRadius: 10,
              justifyContent: "center",
              alignItems: "center",
            }}
            headerStyle={{
              justifyContent: "center",
              alignItems: "center",
            }}
            footerStyle={{
              justifyContent: "center",
              alignItems: "center",
            }}
            visible={true}
          >
            <Dialog.Title style={{ color: "black" }}>Expiry Alert</Dialog.Title>
            <Dialog.Description style={{ color: "black" }}>
              {this.state.expiryMessage}
            </Dialog.Description>
            <Dialog.Button
              label="OK"
              onPress={() => {
                BackHandler.exitApp();
                this.setState({ showExpiryAlert: false });
              }}
            />
          </Dialog.Container>
        ) : null}

        {this.state.showSearchingDialog ? (
          <Dialog.Container
            contentStyle={{
              borderRadius: 10,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "white",
            }}
            headerStyle={{ justifyContent: "center", alignItems: "center" }}
            footerStyle={{ justifyContent: "center", alignItems: "center" }}
            visible={true}
          >
            {/* <Dialog.Title style={{ color: "black", padding: 0 }}>
              <View style={{ flexDirection: "row" }}>
                <Text style={{ flex: 1 }}>Searching</Text>
                <ActivityIndicator color="red" size="small" />
              </View>
            </Dialog.Title> */}

            <View>
              <View style={{ flexDirection: "row" }}>
                <Text style={{ fontSize: 18 }}>Searching...</Text>
                <View style={{ width: 150 }} />
                {this.state.isScanning ? (
                  <ActivityIndicator color="red" size="small" />
                ) : (
                  <View />
                )}
                <TouchableOpacity
                  onPress={() => {
                    if (this.state.isScanning) {
                      this.stopScan();
                    }
                    this.setState({
                      showSearchingDialog: false,
                      closestDevice: [],
                    });
                  }}
                >
                  <Text
                    style={{
                      color: "black",
                      paddingVertical: 6,
                      paddingHorizontal: 6,
                    }}
                  >
                    close
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 20 }} />
              {this.state.closestDevice.length > 0 &&
              this.state.closestDevice[0] ? (
                <View style={{ flexDirection: "row" }}>
                  <View style={{ flex: 1, flexDirection: "column" }}>
                    <Text
                      style={{
                        color: this.state.closestDevice[0].name
                          ? "black"
                          : "grey",
                      }}
                    >
                      {" "}
                      {this.state.closestDevice[0].name
                        ? this.state.closestDevice[0].name
                        : "N/A (Bluetooth Mesh)"}
                    </Text>
                    <Text style={{ color: "grey" }}>
                      {this.state.closestDevice[0].id}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      if (this.state.isScanning) {
                        this.stopScan();
                      }
                      this.setState({ showSearchingDialog: false });
                      this.startManualProcess(this.state.closestDevice[0]);
                      this.setState({ closestDevice: [] });
                       this.performDfu2(this.state.closestDevice[0]);
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        backgroundColor: "grey",
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                      }}
                    >
                      Connect
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View />
              )}
            </View>
          </Dialog.Container>
        ) : null}
      </View>
    );
  }
}
