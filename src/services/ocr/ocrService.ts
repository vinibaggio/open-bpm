import { OCRService } from './types';
import ExpoTextExtractor from 'expo-text-extractor';

class ExpoOCRService implements OCRService {
  async recognizeText(imageUri: string) {
    const result = await ExpoTextExtractor.extractText(imageUri);
    return {
      rawText: result.map((block: { text: string }) => block.text),
      confidence: 1,
    };
  }
}

export function createOCRService(): OCRService {
  return new ExpoOCRService();
}
