import {NativeModules} from 'react-native';

export interface MNISTInput {
  [name: string]: {
    dims: number[]; type: string; data: string;  // encoded tensor data
  };
}

export interface MNISTOutput {
  [name: string]: {
    data: string;  // encoded tensor data
  };
}

export interface MNISTResult {
  result: string;
}

type MNISTType = {
    getFilePath(fileName: String): Promise<string>
};

const MNIST = NativeModules.FilesHandler;

export default MNIST as MNISTType;
