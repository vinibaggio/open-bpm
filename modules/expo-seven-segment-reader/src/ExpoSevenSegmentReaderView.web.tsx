import * as React from 'react';

import { ExpoSevenSegmentReaderViewProps } from './ExpoSevenSegmentReader.types';

export default function ExpoSevenSegmentReaderView(props: ExpoSevenSegmentReaderViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
