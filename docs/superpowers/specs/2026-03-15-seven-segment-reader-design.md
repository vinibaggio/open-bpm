# 7-Segment Display Reader — Design Spec

## Overview

Replace the generic OCR approach (expo-text-extractor) with a purpose-built 7-segment LCD reader using OpenCV. The current OCR can read labels (SYS, DIA, PULSE) but completely fails on the segmented LCD digits. A custom CV pipeline that understands 7-segment display geometry will be far more reliable.

## Target Device

Omron upper-arm blood pressure monitor (single model for now). The display layout is fixed:
- Top: SYS (systolic) — largest digits
- Middle: DIA (diastolic) — medium digits
- Bottom: PULSE (heart rate) — smallest digits

## Pipeline

### 1. Capture
User takes a photo via camera or picks from photo library (existing functionality). The photo is passed as a URI to the native module.

### 2. Display Detection
OpenCV edge detection + contour analysis to find the LCD screen rectangle. The display is a light-colored rectangle with dark border on the Omron body. Use adaptive thresholding, find contours, filter by area and aspect ratio to identify the display.

### 3. Perspective Correction
Apply a perspective warp (4-point transform) to normalize the detected display rectangle into a flat, axis-aligned image. This handles photos taken at an angle.

### 4. Region Cropping
Split the normalized display into 3 horizontal zones based on known Omron layout proportions:
- Top ~40%: SYS zone
- Middle ~35%: DIA zone
- Bottom ~25%: PULSE zone

These proportions are calibrated from the reference photo.

### 5. Digit Segmentation
Within each zone:
1. Convert to grayscale
2. Apply adaptive threshold to get binary image (digits dark on light background)
3. Find contours to isolate individual digit blobs
4. Sort contours left-to-right
5. Extract bounding rects for each digit

### 6. 7-Segment Classification
For each isolated digit image:
1. Resize to a standard size (e.g., 40x70 pixels)
2. Define 7 probe regions corresponding to the standard segment positions:
   ```
    _
   |_|
   |_|
   ```
   - Top horizontal, middle horizontal, bottom horizontal
   - Top-left vertical, top-right vertical
   - Bottom-left vertical, bottom-right vertical
3. Sample each region — compute mean pixel intensity
4. Classify each segment as on (dark) or off (light) based on threshold
5. Map the 7-bit segment pattern to a digit (0-9)

Standard segment patterns:
| Digit | Top | TL | TR | Mid | BL | BR | Bot |
|-------|-----|----|----|-----|----|----|-----|
| 0     | 1   | 1  | 1  | 0   | 1  | 1  | 1   |
| 1     | 0   | 0  | 1  | 0   | 0  | 1  | 0   |
| 2     | 1   | 0  | 1  | 1   | 1  | 0  | 1   |
| 3     | 1   | 0  | 1  | 1   | 0  | 1  | 1   |
| 4     | 0   | 1  | 1  | 1   | 0  | 1  | 0   |
| 5     | 1   | 1  | 0  | 1   | 0  | 1  | 1   |
| 6     | 1   | 1  | 0  | 1   | 1  | 1  | 1   |
| 7     | 1   | 0  | 1  | 0   | 0  | 1  | 0   |
| 8     | 1   | 1  | 1  | 1   | 1  | 1  | 1   |
| 9     | 1   | 1  | 1  | 1   | 0  | 1  | 1   |

### 7. Result Assembly & Validation
Combine digit sequences into numbers. Validate:
- SYS: 70–250
- DIA: 40–150
- PULSE: 30–220
- DIA < SYS

If validation fails, return an error so the app falls back to manual entry.

## Architecture

### Native Module
A new Expo native module written in Swift + C++ (OpenCV):

- **Module name:** `ExpoSevenSegmentReader`
- **Single method:** `readDisplay(imageUri: string): Promise<{systolic: number, diastolic: number, heartRate: number | null}>`
- **Error cases:** throws if display not detected, digits unreadable, or validation fails

### Integration with Existing App
The module implements the existing `OCRService` interface via a new `SevenSegmentOCRService` class in `src/services/ocr/ocrService.ts`:

```typescript
class SevenSegmentOCRService implements OCRService {
  async recognizeText(imageUri: string) {
    // This path returns structured data directly,
    // bypassing the text parser
  }
}
```

Since this returns numbers directly (not raw text), we add a parallel method to the service interface:

```typescript
interface OCRService {
  recognizeText(imageUri: string): Promise<OCRResult>;
  recognizeReading?(imageUri: string): Promise<ParsedBP | null>;
}
```

The capture screen tries `recognizeReading` first (7-segment path). If it fails or isn't available, falls back to `recognizeText` + `parseBPFromText` (text OCR path).

### Dependencies
- **OpenCV iOS framework** — added via CocoaPods (`pod 'OpenCV'`)
- No JS-side dependencies added

## Testing

### Native Tests
- Unit tests for segment classification: given a thresholded digit image, assert correct digit
- Pipeline test: given the reference photo, assert correct extraction

### JS Integration Tests
- Pass sample photo URI through `SevenSegmentOCRService`, assert `{systolic: 120, diastolic: 69, heartRate: 59}`

### Validation Tests (JS)
- Unit tests for the sanity check logic (SYS range, DIA < SYS, etc.)

### Test Fixture
The reference Omron photo (120/69/59) is bundled as a test fixture.

## Failure Modes
- **Display not found:** glare, bad angle, obstructed — returns error, app shows manual entry
- **Digits unreadable:** partial segments, reflections — returns error, manual entry
- **Validation fails:** impossible values — returns error, manual entry
- The manual confirmation screen always shows before saving, so even partial recognition is useful (user corrects wrong digits)

## Future Extensibility
- Support additional Omron models by adjusting zone proportions
- Support other monitor brands by adding layout profiles
- Add guided capture overlay hints ("move closer", "reduce glare") based on detection confidence
