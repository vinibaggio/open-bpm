export interface OCRResult {
  rawText: string[];
  confidence: number;
}

export interface OCRService {
  recognizeText(imageUri: string): Promise<OCRResult>;
}
