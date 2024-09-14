/* eslint-disable prettier/prettier */

import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Button,
  DeviceEventEmitter,
  Image,
  Linking,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import React, { Component, Fragment } from "react";
import { moderateScale, scale, verticalScale } from "../utils/scale";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Dialog from "react-native-dialog";
import LinearGradient from "react-native-linear-gradient";
import QRCodeScanner from "react-native-qrcode-scanner";
import Toast from "react-native-simple-toast";
import styles from "../utils/scanStyle";
import StatusBar from "../utils/StatusBar";
import { RNCamera } from "react-native-camera";

var backButtonPressed = false;
class qrScan extends Component {
  _isMounted = false;
  isDevicefound = false;
  isDataRetrieved = false;
  constructor(props) {
    super(props);

    this.state = {
      scannedMacAddress: "",
      scan: false,
      ScanResult: false,
      result: null,
      scanning: false,
      appState: "",
      peripherals: new Map(),
      devicesList: [],
      myperihheral: null,
      isDeviceAdded: false,
      message: "Please Wait...",
      alertTitle: "",
      shouldShow: false,
      showAlert: false,
      attempted: false,
      light: false,
    };
  }

  showAlert() {
    this.setState({
      showAlert: true,
    });
  }

  show = (titlee, msg, otpflag) => {
    this.setState({
      showAlert: true,
      shouldShow: false,
      alertTitle: titlee,
      message: msg,
      otpFlag: otpflag,
    });
    console.log(this.state);
  };

  hideAlert = () => {
    this.setState({ showAlert: false, attempted: false });
  };
  createHexString(arr) {
    var result = "";
    var z;

    for (var i = 0; i < arr.length; i++) {
      var str = arr[i].toString(16);

      z = 8 - str.length + 1;
      str = Array(z).join("0") + str;

      result += str;
    }

    return result;
  }

  getConnectableStatus(isConnectable) {
    if (isConnectable) {
      return "CONNECTABLE DEVICE";
    } else {
      return "NON-CONNECTABLE DEVICE";
    }
  }

  bytesToHex(bytes) {
    for (var hex = [], i = 0; i < bytes.length; i++) {
      var current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
      hex.push((current >>> 4).toString(16));
      hex.push((current & 0xf).toString(16));
    }
    return hex.join("");
  }

  resetAndBackCall() {
    this.setState({
      scan: false,
      ScanResult: false,
      result: null,
      scanning: false,
      appState: "",
      peripherals: new Map(),
      devicesList: [],
      myperihheral: null,
      isDeviceAdded: false,
      message: "Please Wait...",
      alertTitle: "",
      shouldShow: false,
      showAlert: false,
    });

    // this.scanner.reactivate();
    this.props.navigation.goBack();
  }

  handleBackButton = () => {
    this.resetAndBackCall();
    return true;
  };

  componentDidMount() {
    const { navigation } = this.props;

    this.focusListener = navigation.addListener("focus", () => {
      this._isMounted = true;

      AppState.addEventListener("change", this.handleAppStateChange);

      BackHandler.addEventListener("hardwareBackPress", this.handleBackButton);
    });

    this.blurListener = this.props.navigation.addListener("blur", () => {
      BackHandler.removeEventListener(
        "hardwareBackPress",
        this.handleBackButton
      );
      this._isMounted = false;
    });
  }

  componentWillUnmount() {
    // Remove the event listener
    if (this.focusListener != null && this.focusListener.remove) {
      this.focusListener.remove();
    }
    if (this.blurListener != null && this.blurListener.remove) {
      this.blurListener.remove();
    }

    try {
      BackHandler.removeEventListener(
        "hardwareBackPress",
        this.handleBackButton
      );
    } catch (error) {
      console.log(error);
    }

    this._isMounted = false;
  }

  handleAppStateChange(nextAppState) {
    if (this._isMounted) {
      this.setState({ appState: nextAppState });
    }
  }

  parseManufecturerData(advertisedData) {
    if (Platform.OS === "ios") {
      return this.bytesToHex(advertisedData);
    } else {
      if (advertisedData) {
        var advertisementData;
        var offset = 0;
        while (offset < advertisedData.length - 2) {
          var len = advertisedData[offset++];
          if (len == 0) {
            break;
          }

          var type = advertisedData[offset++];
          switch (type) {
            case 0xff: // Manufacturer Specific Data
              var i = 0;
              var MfgData = [];
              MfgData.length = 8;
              while (len > 1) {
                if (i < 32) {
                  MfgData[i++] = advertisedData[offset++];
                }
                len -= 1;
              }

              // console.log(
              //   'Manufacturer Specific Data saved.' + this.bytesToHex(MfgData),
              // );

              advertisementData = this.bytesToHex(MfgData);
              break;
            default:
              offset += len - 1;
              break;
          }
        }

        return advertisementData;
      }
    }
  }

  getMacAddressValue(manufacturerData) {
    if (manufacturerData) {
      var data = manufacturerData.toUpperCase();
      // console.log(data);
      if (data.length === 16) {
        var val = data.substring(0, 12);
        return val;
      } else {
        return "";
      }
    } else {
      return "";
    }
  }

  perpherialMac(params) {
    return (
      params.substring(0, 2) +
      ":" +
      params.substring(2, 4) +
      ":" +
      params.substring(4, 6) +
      ":" +
      params.substring(6, 8) +
      ":" +
      params.substring(8, 10) +
      ":" +
      params.substring(10, 12)
    );
  }

  onSuccess = (e) => {
    console.log(e.data);
    var _scanResult = e.data.replace(/\s+/g, "");
    var length = _scanResult.length;
    if (length === 17) {
      const check = _scanResult.substring(0, 4);
      console.log("scanned data" + check);
      this.setState({
        result: e,
        scan: false,
        ScanResult: true,
        scannedMacAddress: _scanResult,
      });

      console.log("Device name is: " + e.data);
      setTimeout(() => {
        this.customBackPress();
      }, 500);
    } else {
      e.data = "Not a valid mac id.";
      this.setState({
        result: e,
        scan: false,
        ScanResult: true,
      });
    }
  };

  customBackPress() {
    this.setState({
      scan: false,
      ScanResult: false,
      result: null,
      scanning: false,
      appState: "",
      peripherals: new Map(),
      devicesList: [],
      myperihheral: null,
      isDeviceAdded: false,
      message: "Please Wait...",
      alertTitle: "",
      shouldShow: false,
      showAlert: false,
    });
    if (!backButtonPressed) {
      backButtonPressed = true;
      this.goBack();
      console.log("=====BACK BUTTON PRESSED====");

      setTimeout(() => {
        backButtonPressed = false;
      }, 1500);
    }
  }

  activeQR = () => {
    this.setState({
      scan: true,
      message: "Please Wait...",
      attempted: false,
    });
  };
  scanAgain = () => {
    this.setState({
      scan: true,
      ScanResult: false,
      message: "Please Wait...",
      attempted: false,
    });
  };

  async StoreData(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      console.log("Data Saved In AsyncStorage");
    } catch (e) {
      console.log(e);
    }
  }

  goBack() {
    this.props.navigation.goBack();
    this.StoreData("scannedMacAddress", this.state.scannedMacAddress);
    this.setState({ scannedMacAddress: "" });
  }

  render() {
    const list = Array.from(this.state.peripherals.values());
    let flexdirection = this.state.attempted ? "column" : "row";
    console.log(this.state.devicesList);
    console.log(this.state.myperihheral);

    const { scan, ScanResult, result } = this.state;
    const desccription =
      "QR code scanning is important to scan your Beetle with mobile app.After scanning your band you will be able to update its firmware.";
    return (
      <View style={{ flex: 1 }}>
        <StatusBar backgroundColor="#013C4E" barStyle="light-content" />
        <View style={styles.backgroundImage}>
          <ScrollView contentContainerStyle={styles.scrollviewstyle}>
            <View style={styles.mainContainer}>
              <View style={styles.logoContainer}>
                <TouchableOpacity
                  style={styles.imageDrawerContainer}
                  onPress={() => {
                    this.setState({
                      scan: false,
                      ScanResult: false,
                      result: null,
                      scanning: false,
                      appState: "",
                      peripherals: new Map(),
                      devicesList: [],
                      myperihheral: null,
                      isDeviceAdded: false,
                      message: "Please Wait...",
                      alertTitle: "",
                      shouldShow: false,
                      showAlert: false,
                    });
                    if (!backButtonPressed) {
                      backButtonPressed = true;
                      this.goBack();
                      console.log("=====BACK BUTTON PRESSED====");

                      setTimeout(() => {
                        backButtonPressed = false;
                      }, 1500);
                    }
                  }}
                >
                  <Image
                    source={require("../assets/back_button_coloured4.png")}
                    resizeMode="contain"
                    style={styles.imageDrawerContainer1}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.textAutomaticSetup}>Code Scanning</Text>
              <View style={styles.rect9} />
              <View style={styles.otherContainer}>
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Fragment>
                    {!scan && !ScanResult && (
                      <View style={styles.otherContainer}>
                        <Text style={styles.text1}>
                          Please scan the QR/bar code to update firmware. QR/Bar
                          code can be located at the botom of the packaging box.
                        </Text>
                        <View style={styles.cardView}>
                          <Image
                            source={require("../assets/image_autimaticsetup.png")}
                            resizeMode="contain"
                            style={{
                              width: scale(150),
                              height: scale(150),
                              marginTop: scale(10),
                            }}
                          />

                          <LinearGradient
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            colors={["#99ddeb", "#99ddeb"]}
                            style={[
                              styles.linearGradient,
                              styles.gradientstyle,
                              { marginTop: scale(32) },
                            ]}
                          >
                            <TouchableOpacity
                              onPress={this.activeQR}
                              style={styles.buttonTouchable}
                            >
                              <Text style={styles.buttonTextStyle}>
                                Click to Scan !
                              </Text>
                            </TouchableOpacity>
                          </LinearGradient>
                        </View>
                      </View>
                    )}

                    {ScanResult && (
                      <Fragment>
                        <Text style={styles.textTitle1}>Result !</Text>
                        <View
                          style={
                            ScanResult ? styles.scanCardView : styles.cardView
                          }
                        >
                          {/* <Text>Type : {result.type}</Text> */}
                          <Text>Device ID : {result.data}</Text>
                          {/* <Text numberOfLines={1}>RawData: {result.rawData}</Text> */}
                          <LinearGradient
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            colors={["#99ddeb", "#99ddeb"]}
                            style={[
                              styles.linearGradient,
                              styles.gradientstyle,
                              { marginTop: scale(32) },
                            ]}
                          >
                            <TouchableOpacity
                              onPress={this.scanAgain}
                              style={styles.buttonTouchable}
                            >
                              <Text style={styles.buttonTextStyle}>
                                Click to Scan again!
                              </Text>
                            </TouchableOpacity>
                          </LinearGradient>
                        </View>
                      </Fragment>
                    )}

                    {scan && (
                      <QRCodeScanner
                        // cameraStyle={{
                        //   height: '40%',
                        //   width: '100%',
                        //   justifyContent: 'center',
                        // }}
                        cameraStyle={{
                          height: scale(250),
                          width: scale(250),
                          alignSelf: "center",
                          justifyContent: "center",
                        }}
                        // topViewStyle={{height: '5%', width: '100%'}}
                        // bottomViewStyle={{height: scale(40), width: '100%'}}
                        reactivate={true}
                        showMarker={true}
                        fadeIn={false}
                        flashMode={
                          this.state.light
                            ? RNCamera.Constants.FlashMode.torch
                            : RNCamera.Constants.FlashMode.auto
                        }
                        reactivateTimeout={500}
                        ref={(node) => {
                          this.scanner = node;
                        }}
                        onRead={this.onSuccess}
                        topContent={
                          <Text style={styles.text1}>
                            Please Put Beetle In Front Of Camera
                          </Text>
                        }
                        bottomContent={
                          <View>
                            <LinearGradient
                              start={{ x: 0, y: 0.5 }}
                              end={{ x: 1, y: 0.5 }}
                              colors={["#99ddeb", "#99ddeb"]}
                              style={[
                                styles.linearGradient,
                                styles.gradientstyle_flash,
                              ]}
                            >
                              <TouchableOpacity
                                style={styles.buttonTouchable}
                                onPress={() => {
                                  this.setState({ light: !this.state.light });
                                }}
                              >
                                <Text style={styles.buttonTextStyle}>
                                  {`Flash ${this.state.light ? "OFF" : "ON"}`}
                                </Text>
                              </TouchableOpacity>
                            </LinearGradient>
                            {/* <TouchableOpacity
                        style={styles.buttonTouchable}
                        onPress={() => this.scanner.reactivate()}>
                        <Text style={styles.buttonTextStyle}>OK. Got it!</Text>
                      </TouchableOpacity> */}
                            <LinearGradient
                              start={{ x: 0, y: 0.5 }}
                              end={{ x: 1, y: 0.5 }}
                              colors={["#99ddeb", "#99ddeb"]}
                              style={[
                                styles.linearGradient,
                                styles.gradientstyle,
                              ]}
                            >
                              <TouchableOpacity
                                style={styles.buttonTouchable}
                                onPress={() => {
                                  this.setState({ scan: false });
                                }}
                              >
                                <Text style={styles.buttonTextStyle}>
                                  Stop Scan
                                </Text>
                              </TouchableOpacity>
                            </LinearGradient>
                          </View>
                        }
                      />
                    )}
                  </Fragment>
                </View>

                {this.state.shouldShow || this.state.attempted === true ? (
                  <Dialog.Container
                    contentStyle={{
                      flexDirection: "row",
                      borderRadius: 10,
                      alignItems: "center",
                      fontSize: "bold",
                      alignSelf: "center",
                      alignContent: "center",
                    }}
                    headerStyle={{
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    visible={true}
                  >
                    <Dialog.Title>
                      <ActivityIndicator color="red" size="large" />
                    </Dialog.Title>
                    <Dialog.Description
                      style={{
                        fontSize: scale(15),
                        marginLeft: scale(10),
                        // fontWeight: 'bold',
                        marginBottom: "auto",
                        marginTop: "auto",
                      }}
                    >
                      {this.state.message}
                    </Dialog.Description>
                  </Dialog.Container>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }
}

export default qrScan;
