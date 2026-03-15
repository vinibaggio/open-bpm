import { classifyBP, BPCategory } from '../bloodPressure';

describe('classifyBP', () => {
  it('classifies normal BP', () => {
    expect(classifyBP(110, 70)).toBe(BPCategory.Normal);
  });

  it('classifies elevated BP', () => {
    expect(classifyBP(125, 75)).toBe(BPCategory.Elevated);
  });

  it('classifies elevated requires diastolic < 80', () => {
    expect(classifyBP(125, 82)).toBe(BPCategory.HighStage1);
  });

  it('classifies high stage 1 by systolic', () => {
    expect(classifyBP(135, 75)).toBe(BPCategory.HighStage1);
  });

  it('classifies high stage 1 by diastolic', () => {
    expect(classifyBP(115, 85)).toBe(BPCategory.HighStage1);
  });

  it('classifies high stage 2 by systolic', () => {
    expect(classifyBP(145, 75)).toBe(BPCategory.HighStage2);
  });

  it('classifies high stage 2 by diastolic', () => {
    expect(classifyBP(115, 95)).toBe(BPCategory.HighStage2);
  });

  it('classifies crisis by systolic', () => {
    expect(classifyBP(185, 75)).toBe(BPCategory.Crisis);
  });

  it('classifies crisis by diastolic', () => {
    expect(classifyBP(115, 125)).toBe(BPCategory.Crisis);
  });
});
