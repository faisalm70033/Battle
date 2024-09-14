import React, {Component} from 'react';
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
  TouchableHighlight,
  Platform,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import Controller from '../utils/Controller';
import {EventRegister} from 'react-native-event-listeners';
import {NordicDFU, DFUEmitter} from '@domir/react-native-nordic-dfu';
import StatusBar from '../utils/StatusBar';
import * as Progress from 'react-native-progress';
// import { Dialog } from 'react-native-simple-dialogs';
import {scale, verticalScale, moderateScale} from '../utils/scale';
import DocumentPicker from 'react-native-document-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import Dialog from 'react-native-dialog';
var RNFS = require('react-native-fs');
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
export default class ManualMode extends Component {
  dfuProgressListener = null;
  dfuStateListener = null;
  constructor(props) {
    super(props);
    this.state = {
      isScanning: false,
      devicesList: [],
      peripherals: new Map(),
      showConnectionDialog: false,
      showAlert: false,
      connectionStatus: 'Not Connected',
      peripheral: null,
      dfuState: 'Please Select Firmware File',
      // dfuState: "Dfu Completed",
      progress: 0,
      deviceNameFilter: '',
      firnwareVersionFilter: '',
      firmwarefilepath: '',
      alertMessage: '',
    };
  }

  toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  componentDidMount() {
    this.blurListener = this.props.navigation.addListener('blur', async () => {
      if (this.state.isScanning) {
        Controller.getInstance().stopScan();
      }
    });

    this.dfuProgressListener = DFUEmitter.addListener(
      'DFUProgress',
      ({percent}) => {
        console.log('DFU progress:', percent);
        this.setState({progress: percent});
      },
    );
    this.dfuStateListener = DFUEmitter.addListener(
      'DFUStateChanged',
      ({state}) => {
        console.log('DFU state:', state);
        // || state == ''
        // if(state.includes('_'))
        // {
        state = state.replace(/_/g, ' ');
        state = this.toTitleCase(state);
        state = state.replace('State ', '');
        this.setState({dfuState: state});
        // }
        // else{
        //     state = this.toTitleCase(state)
        //     this.setState({ dfuState: state });
        // }
        // if(state == 'DFU_PROCESS_STARTING' || state == 'DFU_STATE_UPLOADING' || state == 'CONNECTING' || state == 'FIRMWARE_VALIDATING' || state == 'ENABLING_DFU_MODE' || state == 'DEVICE_DISCONNECTING')
        // {
        //     this.setState({dfuState: 'DFU Started'})
        // }
        // else if(state == 'DFU_COMPLETED'){
        //     this.setState({dfuState: 'DFU Completed'})
        // }
        // else{
        //     this.setState({dfuState: 'DFU Failed'})
        // }
        // this.setState({ dfuState: state });
      },
    );

    // Controller.instance.scanDevices();
    this.devicesListener = EventRegister.addEventListener(
      'scanDevicesEvent',
      peripheral => {
        console.log(peripheral);
        if (
          this.state.deviceNameFilter == '' ||
          peripheral.name
            .toUpperCase()
            .startsWith(this.state.deviceNameFilter.toUpperCase())
        ) {
          this.state.peripherals.set(peripheral.id, peripheral);
          this.setState({
            devicesList: Array.from(this.state.peripherals.values()),
          });
        }
        // setList(Array.from(peripherals.values()));
      },
    );
    this.statusListener = EventRegister.addEventListener(
      'scanningStatus',
      status => {
        console.log(status);
        this.setState({
          isScanning: status,
        });
      },
    );
  }

  componentWillUnmount() {
    if (this.blurListener != null && this.blurListener.remove) {
      this.blurListener.remove();
    }
    if (this.state.isScanning) {
      Controller.getInstance().stopScan();
    }
    EventRegister.removeEventListener(this.devicesListener);
    EventRegister.removeEventListener(this.statusListener);
    this.dfuProgressListener.remove();
    this.dfuStateListener.remove();
  }

  manualDFU(peripheral) {
    Controller.getInstance().stopScan();
    console.log(peripheral);
    console.log(peripheral.connected);
    this.setState({
      showConnectionDialog: true,
      peripheral: peripheral,
      dfuState: 'Please Select Firmware File',
      progress: 0,
      firmwarefilepath: '',
    });
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

  render() {
    const renderItem = item => {
      if (
        this.state.deviceNameFilter == '' ||
        item.name
          .toUpperCase()
          .startsWith(this.state.deviceNameFilter.toUpperCase())
      ) {
        const color = item.connected ? 'green' : '#fff';
        return (
          <TouchableOpacity
            style={{
              backgroundColor: '#00a9cd',
              marginTop: '2%',
              borderRadius: 10,
              marginHorizontal: '5%',
            }}
            onPress={() => this.manualDFU(item)}>
            <View style={{}}>
              <Text
                style={{
                  fontSize: 12,
                  textAlign: 'center',
                  color: 'white',
                  padding: 10,
                }}>
                {item.name}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  textAlign: 'center',
                  color: 'white',
                  padding: 2,
                }}>
                RSSI: {item.rssi}
              </Text>
              <Text
                style={{
                  fontSize: 8,
                  textAlign: 'center',
                  color: 'white',
                  padding: 2,
                  paddingBottom: 20,
                }}>
                {item.id}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }
    };
    return (
      <View style={{flex: 1}}>
        <StatusBar backgroundColor="#013C4E" barStyle="light-content" />

        <View style={{backgroundColor: '#00a9cd'}}>
          <TouchableOpacity
            onPress={() => {
              this.props.navigation.goBack();
            }}
            // style={{top: scale(5), left: scale(5)}}>
            style={{top: scale(5), left: scale(5), width: scale(30)}}>
            <Icon
              name="chevron-back-outline"
              size={scale(30)}
              color="#5e5e5e"
            />
          </TouchableOpacity>

          <View
            style={{
              flexDirection: 'row',
              height: scale(35),
              alignItems: 'center',
              paddingStart: scale(10),
              marginVertical: scale(10),
              marginHorizontal: '5%',
              borderRadius: scale(5),
              backgroundColor: 'white',
            }}>
            <Text style={{fontWeight: 'bold', color: '#00a9cd'}}>
              Device Name:{' '}
            </Text>
            <TextInput
              style={{
                borderColor: 'black',
                borderWidth: scale(0),
                flex: 1,
                height: '100%',
                color: '#00a9cd',
              }}
              // editable ={this.state.isScanning ? false:true}
              onChangeText={text => {
                this.setState({deviceNameFilter: text});
              }}></TextInput>
          </View>

          <View
            style={{
              flexDirection: 'row',
              height: scale(35),
              alignItems: 'center',
              paddingStart: scale(10),
              marginBottom: scale(10),
              marginHorizontal: '5%',
              borderRadius: scale(5),
              backgroundColor: 'white',
            }}>
            <Text style={{fontWeight: 'bold', color: '#00a9cd'}}>
              Firmware Version:{' '}
            </Text>
            <TextInput
              keyboardType="numbers-and-punctuation"
              style={{
                borderColor: 'black',
                borderWidth: scale(0),
                color: '#00a9cd',
                flex: 1,
                height: '100%',
              }}
              // editable ={this.state.isScanning ? false:true}
              onChangeText={text => {
                this.setState({firnwareVersionFilter: text});
              }}></TextInput>
          </View>

          <View
            style={{
              width: '100%',
              marginBottom: verticalScale(10),
              height: verticalScale(40),
            }}>
            <TouchableOpacity
              style={{
                backgroundColor: '#99ddeb',
                alignSelf: 'center',
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: 'auto',
                paddingHorizontal: '5%',
                paddingVertical: verticalScale(5),
                borderRadius: scale(5),
                marginBottom: 'auto',
                marginRight: 'auto',
                marginLeft: 'auto',
              }}
              onPress={async () => {
                if (this.state.isScanning) {
                  Controller.getInstance().stopScan();
                } else {
                  if (Platform.OS == 'android') {
                    await Controller.getInstance()
                      .checkLocationNbluetooth()
                      .then(async status => {
                        console.log(status);
                        if (
                          status.bluetoothStatus == 'enabled' &&
                          status.locationStatus == 'enabled'
                        ) {
                          this.setState({
                            devicesList: [],
                            peripherals: new Map(),
                            connectionStatus: 'Not Connected',
                          });

                          await Controller.getInstance().scanDevices();
                        } else {
                          var message = 'Please enable bluetooth and location';
                          if (
                            status.bluetoothStatus == 'not enabled' &&
                            status.locationStatus == 'not enabled'
                          ) {
                            message = 'Please enable bluetooth and location';
                          } else if (
                            status.bluetoothStatus == 'enabled' &&
                            status.locationStatus == 'not enabled'
                          ) {
                            message = 'Please enable location';
                          } else if (
                            status.bluetoothStatus == 'not enabled' &&
                            status.locationStatus == 'enabled'
                          ) {
                            message = 'Please enable bluetooth';
                          }
                          this.setState({
                            showAlert: true,
                            alertMessage: message,
                          });
                        }
                      });
                  } else if (Platform.OS == 'ios') {
                    console.log('CHECK HERE');
                    await Controller.getInstance()
                      .checkBluetooth()
                      .then(async bluetoothStatus => {
                        if (bluetoothStatus == 'enabled') {
                          this.setState({
                            devicesList: [],
                            peripherals: new Map(),
                            connectionStatus: 'Not Connected',
                          });

                          await Controller.getInstance().scanDevices();
                        } else {
                          this.enableIosBluetooth();
                        }
                      });
                  }
                }
              }}>
              <Text style={{fontWeight: 'bold', color: 'white'}}>
                {this.state.isScanning ? 'STOP SCANNING' : 'SCAN'}
              </Text>
            </TouchableOpacity>
            {this.state.isScanning ? (
              <ActivityIndicator
                color={'#0586DD'}
                size={'large'}
                style={{
                  top: 0,
                  bottom: 0,
                  right: '5%',
                  position: 'absolute',
                }}></ActivityIndicator>
            ) : null}
          </View>
        </View>

        {/* dialog */}

        {this.state.showConnectionDialog ? (
          <Dialog.Container
            contentStyle={{
              borderRadius: 10,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'white',
            }}
            headerStyle={{justifyContent: 'center', alignItems: 'center'}}
            footerStyle={{justifyContent: 'center', alignItems: 'center'}}
            visible={true}>
            {this.state.firmwarefilepath == '' ? (
              <TouchableOpacity
                onPress={() => {
                  this.setState({
                    showConnectionDialog: false,
                  });
                }}
                style={{position: 'absolute', top: scale(5), right: scale(5)}}>
                <Icon name="close" size={scale(25)} color="#5e5e5e" />
              </TouchableOpacity>
            ) : null}

            <Dialog.Title
              style={{
                fontSize: scale(20),
                fontWeight: 'bold',
                color: '#00a9cd',
              }}>
              Manual DFU
            </Dialog.Title>

            {this.state.firmwarefilepath == '' ? (
              <View style={{}}>
                <View
                  style={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    alignSelf: 'center',
                    marginTop: 'auto',
                    marginBottom: 'auto',
                  }}>
                  <Text style={{fontSize: scale(15), marginBottom: scale(10)}}>
                    Please Select Firmware File
                  </Text>

                  <TouchableOpacity
                    style={{
                      backgroundColor: '#00a9cd',
                      padding: scale(5),
                      marginTop: scale(10),
                      borderRadius: scale(5),
                      marginBottom:
                        Platform.OS == 'ios' ? verticalScale(10) : null,
                    }}
                    onPress={async () => {
                      if (this.state.firmwarefilepath == '') {
                        try {
                          var destination = null;

                          if (Platform.OS == 'android') {
                            const packageFile = await DocumentPicker.pick({
                              type: [DocumentPicker.types.zip],
                            });

                            console.log(packageFile[0]);

                            destination =
                              RNFS.CachesDirectoryPath +
                              '/' +
                              packageFile[0].name;
                            await RNFS.copyFile(
                              packageFile[0].uri,
                              destination,
                            );
                          } else if (Platform.OS == 'ios') {
                            const packageFile = await DocumentPicker.pick({
                              type: ['public.archive'],
                            });
                            destination = packageFile[0].uri;
                          }

                          this.setState({
                            firmwarefilepath: destination,
                            dfuState: 'Please Wait',
                          });

                          if (this.state.firnwareVersionFilter == '') {
                            NordicDFU.startDFU({
                              deviceAddress: this.state.peripheral.id,
                              deviceName: this.state.peripheral.name,
                              filePath: destination,
                              alternativeAdvertisingNameEnabled:
                                Platform.OS == 'ios' ? false : null,
                            })
                              .then(res => console.log('Transfer done:', res))
                              .catch(err => {
                                console.log(err);
                              });
                          } else {
                            this.setState({
                              dfuState: 'Preparing Device',
                            });
                            Controller.getInstance()
                              .getDeviceInformation(this.state.peripheral.id)
                              .then(async deviceInformation => {
                                console.log(
                                  parseFloat(deviceInformation.firmwareVersion),
                                  parseFloat(this.state.firnwareVersionFilter),
                                );

                                if (
                                  deviceInformation.firmwareVersion >=
                                  this.state.firnwareVersionFilter
                                ) {
                                  this.setState({
                                    showConnectionDialog: false,
                                  });

                                  setTimeout(() => {
                                    this.setState({
                                      showAlert: true,
                                      // alertMessage: 'Device firmware is already up to date. Current firmware version: ' + deviceInformation.firmwareVersion
                                      alertMessage:
                                        'Device: ' +
                                        this.state.peripheral.id +
                                        ' is already up to date. (Current package version : ' +
                                        deviceInformation.firmwareVersion +
                                        ', Update version: ' +
                                        this.state.firnwareVersionFilter +
                                        ')',
                                      dfuState: 'Please Select Firmware File',
                                      progress: 0,
                                      firmwarefilepath: '',
                                    });
                                  }, 200);
                                  //package is already updated
                                } else {
                                  await this.sleep(500);

                                  setTimeout(() => {
                                    NordicDFU.startDFU({
                                      deviceAddress: this.state.peripheral.id,
                                      deviceName: this.state.peripheral.name,
                                      filePath: destination,
                                      alternativeAdvertisingNameEnabled:
                                        Platform.OS == 'ios' ? false : null,
                                    })
                                      .then(res =>
                                        console.log('Transfer done:', res),
                                      )
                                      .catch(err => {
                                        console.log(err);
                                      });
                                  }, 200);
                                }
                              })
                              .catch(err => {
                                console.log(err);
                                this.setState({
                                  dfuState: 'Dfu Failed',
                                });
                              });
                          }
                        } catch (err) {
                          if (DocumentPicker.isCancel(err)) {
                          } else {
                          }
                        }
                      }
                    }}>
                    <Text style={{color: 'white'}}>Select package file</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: verticalScale(10),
                }}>
                <Text style={{fontSize: scale(15), marginBottom: scale(10)}}>
                  {'DFU State:'}
                </Text>
                <Text style={{fontSize: scale(15), marginBottom: scale(10)}}>
                  {this.state.dfuState}
                </Text>

                <View
                  style={{
                    justifyContent: 'center',
                    width: '50%',
                    alignItems: 'center',
                    alignContent: 'center',
                  }}>
                  <Text
                    style={{
                      fontSize: scale(12),
                      color: '#007690',
                      fontWeight: 'bold',
                      alignSelf: 'center',
                      position: 'absolute',
                      elevation: 99,
                      zIndex: 99,
                      marginTop: 'auto',
                      marginBottom: 'auto',
                      flex: 1,
                    }}>
                    {this.state.progress + '%'}
                  </Text>
                  <Progress.Bar
                    progress={this.state.progress / 100}
                    height={verticalScale(20)}
                    width={scale(100)}
                    color={'#80d4e6'}
                    style={{borderColor: '#80d4e6', justifyContent: 'center'}}
                  />
                </View>

                {this.state.dfuState == 'Dfu Completed' ||
                this.state.dfuState == 'Dfu Failed' ? (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#00a9cd',
                      padding: scale(5),
                      marginTop: scale(10),
                      borderRadius: scale(5),
                    }}
                    onPress={() => {
                      this.setState({showConnectionDialog: false});
                    }}>
                    <Text style={{color: 'white'}}>Close</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </Dialog.Container>
        ) : null}

        {this.state.showAlert ? (
          <Dialog.Container
            contentStyle={{
              backgroundColor: 'white',
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
            <Dialog.Title style={{color: 'black'}}>Error</Dialog.Title>
            <Dialog.Description style={{color: 'black'}}>
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

        <FlatList
          style={{marginVertical: verticalScale(10)}}
          data={this.state.devicesList}
          renderItem={({item}) => renderItem(item)}
          keyExtractor={item => item.id}
        />
      </View>
    );
  }
}
