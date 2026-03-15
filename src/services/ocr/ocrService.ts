import { OCRService } from './types';
import { extractTextFromImage } from 'expo-text-extractor';

class ExpoOCRService implements OCRService {
  async recognizeText(imageUri: string) {
    const result = await extractTextFromImage(imageUri);
    return {
      rawText: result,
      confidence: 1,
    };
  }
}

export function createOCRService(): OCRService {
  return new ExpoOCRService();
}
