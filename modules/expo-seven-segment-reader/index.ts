// Reexport the native module. On web, it will be resolved to ExpoSevenSegmentReaderModule.web.ts
// and on native platforms to ExpoSevenSegmentReaderModule.ts
export { default } from './src/ExpoSevenSegmentReaderModule';
export { default as ExpoSevenSegmentReaderView } from './src/ExpoSevenSegmentReaderView';
export * from  './src/ExpoSevenSegmentReader.types';
