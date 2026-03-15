export enum BPCategory {
  Normal = 'normal',
  Elevated = 'elevated',
  HighStage1 = 'highStage1',
  HighStage2 = 'highStage2',
  Crisis = 'crisis',
}

export function classifyBP(systolic: number, diastolic: number): BPCategory {
  if (systolic > 180 || diastolic > 120) return BPCategory.Crisis;
  if (systolic >= 140 || diastolic >= 90) return BPCategory.HighStage2;
  if (systolic >= 130 || diastolic >= 80) return BPCategory.HighStage1;
  if (systolic >= 120 && diastolic < 80) return BPCategory.Elevated;
  return BPCategory.Normal;
}

export const BP_COLORS: Record<BPCategory, string> = {
  [BPCategory.Normal]: '#4CAF50',
  [BPCategory.Elevated]: '#FFC107',
  [BPCategory.HighStage1]: '#FF9800',
  [BPCategory.HighStage2]: '#F44336',
  [BPCategory.Crisis]: '#B71C1C',
};

export const BP_LABELS: Record<BPCategory, string> = {
  [BPCategory.Normal]: 'Normal',
  [BPCategory.Elevated]: 'Elevated',
  [BPCategory.HighStage1]: 'High (Stage 1)',
  [BPCategory.HighStage2]: 'High (Stage 2)',
  [BPCategory.Crisis]: 'Crisis',
};
