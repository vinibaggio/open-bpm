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

function extractNumberNear(text: string, label: RegExp): number | null {
  const match = text.match(label);
  if (!match) return null;
  // Look for digits after the label (within ~20 chars)
  const after = text.slice(match.index! + match[0].length, match.index! + match[0].length + 20);
  const numMatch = after.match(/\d+/);
  return numMatch ? Number(numMatch[0]) : null;
}

/**
 * Try label-based extraction first (SYS/DIA/PULSE labels on Omron-style monitors),
 * then fall back to positional extraction.
 */
export function parseBPFromText(rawText: string[]): ParsedBP | null {
  const joined = rawText.join(' ');
  const upper = joined.toUpperCase();

  // Label-based extraction: look for SYS/DIA/PULSE keywords
  const hasLabels = /\bSYS/i.test(joined) || /\bDIA/i.test(joined);
  if (hasLabels) {
    const systolic = extractNumberNear(upper, /\bSYS\b[^0-9]*/);
    const diastolic = extractNumberNear(upper, /\bDIA\b[^0-9]*/);
    if (systolic && diastolic && isReasonableBP(systolic) && isReasonableBP(diastolic)) {
      const pulse = extractNumberNear(upper, /\bPUL(?:SE)?\b[^0-9]*/);
      const heartRate = pulse && isReasonableHR(pulse) ? pulse : null;
      return { systolic, diastolic, heartRate };
    }
  }

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

  // Positional fallback: extract all reasonable numbers
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
