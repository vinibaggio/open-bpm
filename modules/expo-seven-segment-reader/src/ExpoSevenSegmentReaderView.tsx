import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoSevenSegmentReaderViewProps } from './ExpoSevenSegmentReader.types';

const NativeView: React.ComponentType<ExpoSevenSegmentReaderViewProps> =
  requireNativeView('ExpoSevenSegmentReader');

export default function ExpoSevenSegmentReaderView(props: ExpoSevenSegmentReaderViewProps) {
  return <NativeView {...props} />;
}
