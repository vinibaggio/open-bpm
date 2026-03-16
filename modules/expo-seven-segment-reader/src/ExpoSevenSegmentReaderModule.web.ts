import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './ExpoSevenSegmentReader.types';

type ExpoSevenSegmentReaderModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class ExpoSevenSegmentReaderModule extends NativeModule<ExpoSevenSegmentReaderModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(ExpoSevenSegmentReaderModule, 'ExpoSevenSegmentReaderModule');
