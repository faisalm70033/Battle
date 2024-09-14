import React, {Component} from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import {scale, verticalScale, moderateScale} from '../utils/scale';
import StatusBar from '../utils/StatusBar';
var RNFS = require('react-native-fs');
import storage from '@react-native-firebase/storage';
import Dialog from 'react-native-dialog';
import NetInfo from '@react-native-community/netinfo';
import Controller from '../utils/Controller';
// import IntentLauncher, {IntentConstant} from 'react-native-intent-launcher';
//@yz1311/react-native-intent-launcher
import IntentLauncher, {IntentConstant} from '@yz1311/react-native-intent-launcher';

export default class modeSelectionScreen extends Component {
  constructor(props) {
    super(props);
    const newLocal = this;
    newLocal.state = {
      showLoadingDialog: false,
      totalFiles: 0,
      currentFile: 0,
      locationPermission: 'denied',
      storagePermission: 'denied',
      alertMessage: '',
      showAlert: false,
    };
  }

  async uploadLogFile(filePath) {
    return new Promise(function (resolve, reject) {
      var fileUploaded = false;
      var fileUploadTimer = null;
      var fileName = filePath.split('/');
      fileName = fileName[fileName.length - 1];
      const uploadUri = filePath;

      const task = storage()
        .ref('Pkd_Ota_Logs/' + fileName)
        .putFile(uploadUri);
      if (fileUploadTimer == null) {
        fileUploadTimer = setTimeout(() => {
          console.log('File Upload TimeOut');
          fileUploadTimer = false;
          if (fileUploaded == false) {
            task.cancel();
            reject('Timeout');
          } else {
            resolve('Success');
          }
        }, 7000);
      }

      task
        .then(() => {
          console.log('Log File Uploaded');
          fileUploaded = true;
          clearTimeout(fileUploadTimer);
          fileUploadTimer = null;
          RNFS.unlink(filePath)
            .then(() => {
              console.log('Log File: ' + filePath + ' Deleted');
              resolve('Success');
            })
            .catch(err => {
              console.log(err);
              reject(err);
            });
        })
        .catch(err => {
          console.log('Log File Upload Fail Due To Error ' + err);
          fileUploaded = false;
          clearTimeout(fileUploadTimer);
          fileUploadTimer = null;
          reject(err);
        });
    });
  }

  componentDidMount() {
    this.focusListener = this.props.navigation.addListener(
      'focus',
      async () => {
        console.log('FOCUS LISTENER CALLED');
        if (Platform.OS == 'android') {
          await Controller.getInstance()
            .checkPermissions()
            .then(permissions => {
              this.setState({
                locationPermission: permissions.locationPermission,
                storagePermission: permissions.storagePermission,
              });
            });
        }

        NetInfo.fetch().then(state => {
          console.log(state);
          console.log('Is Internet Connected? ', state.isConnected);
          console.log('IS Internet Reachable? ', state.isInternetReachable);
          if (
            state.isConnected == true &&
            (state.isInternetReachable || state.isInternetReachable == null)
          ) {
            var currentDirectory = 'Pkd_Ota_Logs';
            let absolutePath = '';
            absolutePath = `${RNFS.DocumentDirectoryPath}/${currentDirectory}`;
            console.log("------>>>>>>3",absolutePath);
            if (RNFS.exists(absolutePath)) {
              console.log('Reading folder');
              RNFS.readDir(absolutePath)
                .then(async files => {
                  if (files != null && files.length > 0) {
                    console.log(files);
                    this.setState({
                      showLoadingDialog: true,
                      totalFiles: files.length,
                    });

                    for (var a = 0; a < files.length; a++) {
                      this.setState({
                        currentFile: a + 1,
                      });
                      await this.uploadLogFile(files[a].path)
                        .then(status => {
                          console.log(status);
                        })
                        .catch(err => {
                          console.log(err);
                        });
                    }

                    this.setState({
                      showLoadingDialog: false,
                    });
                  } else {
                    console.log('Empty Folder');
                  }
                })
                .catch(err => {
                  console.log('ERROR: ' + err);
                });
            } else {
              console.log('Folder not available');
            }
          }
        });
      },
    );
  }

  componentWillUnmount() {
    if (this.focusListener != null && this.focusListener.remove) {
      this.focusListener.remove();
    }
  }
  render() {
    return (
      <View style={{flex: 1}}>
        {this.state.showLoadingDialog ? (
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
            <Dialog.Title
              style={{color: 'black', marginTop: verticalScale(10)}}>
              Please Wait
            </Dialog.Title>
            <Text style={{fontSize: scale(15)}}>
              {'Uploading Log File ' +
                this.state.currentFile +
                '/' +
                this.state.totalFiles}
            </Text>
            <ActivityIndicator color="red" size="large" />
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
                if (
                  this.state.locationPermission == 'never_ask_again' ||
                  this.state.storagePermission == 'never_ask_again'
                ) {
                  this.setState({showAlert: false});

                  IntentLauncher.startActivity({
                    action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
                    data: 'package:' + 'com.pkd_ota',
                  });
                } else {
                  this.setState({showAlert: false});
                }
              }}
            />
          </Dialog.Container>
        ) : null}

        <StatusBar backgroundColor="#013C4E" barStyle="light-content" />

        <View
          style={{
            backgroundColor: '#00a9cd',
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: verticalScale(10),
          }}>
          <Text
            style={{color: 'white', fontWeight: 'bold', fontSize: scale(15)}}>
            PKD OTA
          </Text>
        </View>

        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <TouchableOpacity
            style={{
              backgroundColor: 'skyblue',
              width: '60%',
              height: '5%',
              borderRadius: 5,
              justifyContent: 'center',
              alignItems: 'center',
              alignContent: 'center',
              marginBottom: '5%',
            }}
            onPress={() => {
              if (Platform.OS == 'android') {
                Controller.getInstance()
                  .checkPermissions()
                  .then(permissions => {
                    this.setState({
                      locationPermission: permissions.locationPermission,
                      storagePermission: permissions.storagePermission,
                    });
                    console.log(
                      'locationPermission: ' +
                        permissions.locationPermission +
                        ' storagePermission: ' +
                        permissions.storagePermission,
                    );
                    if (
                      permissions.locationPermission == 'granted' &&
                      permissions.storagePermission == 'granted'
                    ) {
                      this.props.navigation.navigate('manualMode');
                    } else {
                      this.setState({
                        showAlert: true,
                        alertMessage:
                          'Please allow location and storage permissions',
                      });
                    }
                  });
              } else if (Platform.OS == 'ios') {
                this.props.navigation.navigate('manualMode');
              }
            }}>
            <Text
              style={{fontSize: scale(15), color: 'white', fontWeight: 'bold'}}>
              Manual Mode
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: 'skyblue',
              width: '60%',
              height: '5%',
              borderRadius: 5,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => {
              if (Platform.OS == 'android') {
                Controller.getInstance()
                  .checkPermissions()
                  .then(permissions => {
                    this.setState({
                      locationPermission: permissions.locationPermission,
                      storagePermission: permissions.storagePermission,
                    });
                    console.log(
                      'locationPermission: ' +
                        permissions.locationPermission +
                        ' storagePermission: ' +
                        permissions.storagePermission,
                    );
                    if (
                      permissions.locationPermission == 'granted' &&
                      permissions.storagePermission == 'granted'
                    ) {
                      this.props.navigation.navigate('brustMode');
                    } else {
                      this.setState({
                        showAlert: true,
                        alertMessage:
                          'Please allow location and storage permissions',
                      });
                    }
                  });
              } else if (Platform.OS == 'ios') {
                this.props.navigation.navigate('brustMode');
              }
            }}>
            <Text
              style={{fontSize: scale(15), color: 'white', fontWeight: 'bold'}}>
              Brust Mode
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}
