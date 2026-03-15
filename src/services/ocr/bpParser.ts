export interface ParsedBP {
  systolic: number;
  diastolic: number;
  heartRate: number | null;
}

const MIN_BP = 30;
const MAX_BP = 300;
const MIN_HR = 30;
const MAX_HR = 250;

function isReasonableBP(n: number): boolean {
  return n >= MIN_BP && n <= MAX_BP;
}

function isReasonableHR(n: number): boolean {
  return n >= MIN_HR && n <= MAX_HR;
}

export function parseBPFromText(rawText: string[]): ParsedBP | null {
  const joined = rawText.join(' ');

  // If we see a slash pattern like "120/80", prioritize it
  const slashMatch = joined.match(/(\d+)\s*\/\s*(\d+)/);
  if (slashMatch) {
    const systolic = Number(slashMatch[1]);
    const diastolic = Number(slashMatch[2]);
    if (isReasonableBP(systolic) && isReasonableBP(diastolic)) {
      const remaining = joined.replace(slashMatch[0], '');
      const hrMatch = remaining.match(/\d+/);
      const heartRate = hrMatch && isReasonableHR(Number(hrMatch[0]))
        ? Number(hrMatch[0])
        : null;
      return { systolic, diastolic, heartRate };
    }
  }

  // Extract all numbers and filter to reasonable BP range
  const numbers = (joined.match(/\d+/g) || [])
    .map(Number)
    .filter(isReasonableBP);

  if (numbers.length < 2) return null;

  const systolic = numbers[0];
  const diastolic = numbers[1];
  const heartRate = numbers.length >= 3 && isReasonableHR(numbers[2])
    ? numbers[2]
    : null;

  return { systolic, diastolic, heartRate };
}
