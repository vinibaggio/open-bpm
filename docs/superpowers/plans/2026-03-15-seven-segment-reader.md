# 7-Segment Display Reader Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic OCR with a custom OpenCV-based 7-segment LCD reader that reliably extracts blood pressure readings from Omron monitor photos.

**Architecture:** A local Expo native module (`expo-seven-segment-reader`) written in Swift/Objective-C++ wrapping OpenCV. The module exposes a single `readDisplay(imageUri)` method. On the JS side, a new `SevenSegmentOCRService` implements the existing `OCRService` interface and is tried first, with the text-based OCR as fallback.

**Tech Stack:** OpenCV 4.x (CocoaPods `OpenCV2`), Expo Modules API (Swift), Objective-C++ bridging for OpenCV C++ calls

**Spec:** `docs/superpowers/specs/2026-03-15-seven-segment-reader-design.md`

---

## File Structure

```
modules/
  expo-seven-segment-reader/
    expo-module.config.json        # Expo module config
    index.ts                       # JS API: readDisplay(imageUri)
    src/
      ExpoSevenSegmentReaderModule.swift  # Swift module definition
      SevenSegmentReader.h         # Obj-C++ header
      SevenSegmentReader.mm        # Obj-C++ implementation (OpenCV pipeline)
    test-fixtures/
      omron-sample.jpg             # Reference photo for testing

src/
  services/ocr/
    types.ts                       # Add recognizeReading? method to OCRService
    ocrService.ts                  # Add SevenSegmentOCRService, update factory
    validation.ts                  # BP reading validation (extracted for reuse)
    __tests__/validation.test.ts   # Tests for validation logic
  screens/
    CaptureScreen.tsx              # Update processImage to try 7-seg first
```

---

## Chunk 1: Native Module Scaffold & OpenCV Setup

### Task 1: Create Local Expo Module

**Files:**
- Create: `modules/expo-seven-segment-reader/` (scaffolded by CLI)

- [ ] **Step 1: Scaffold the local module**

```bash
npx create-expo-module@latest expo-seven-segment-reader --local
```

This creates the module in `modules/expo-seven-segment-reader/` with Swift and Kotlin stubs.

- [ ] **Step 2: Verify the module is auto-linked**

Check that `app.json` or `expo-module.config.json` is set up correctly. The local module should be automatically detected by Expo's autolinking.

```bash
cat modules/expo-seven-segment-reader/expo-module.config.json
```

Expected: JSON with `platforms.ios.modules` pointing to the Swift module class.

- [ ] **Step 3: Verify the app still builds**

```bash
npx expo run:ios --device "iphone de vinicius"
```

Expected: builds and runs (module exists but doesn't do anything yet).

- [ ] **Step 4: Commit**

```bash
git add modules/
git commit -m "chore: scaffold expo-seven-segment-reader local module"
```

---

### Task 2: Add OpenCV to iOS Build

**Files:**
- Modify: `modules/expo-seven-segment-reader/expo-seven-segment-reader.podspec`

- [ ] **Step 1: Add OpenCV dependency to the module's podspec**

Open `modules/expo-seven-segment-reader/expo-seven-segment-reader.podspec` and add the OpenCV dependency. Find the existing `s.dependency` lines and add:

```ruby
s.dependency 'OpenCV2', '~> 4.3'
```

Also ensure the podspec allows Objective-C++ compilation by adding:

```ruby
s.source_files = "**/*.{h,m,mm,swift}"
s.pod_target_xcconfig = {
  'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
  'CLANG_CXX_LIBRARY' => 'libc++',
}
```

- [ ] **Step 2: Install pods**

```bash
cd ios && pod install && cd ..
```

Expected: OpenCV2 pod is downloaded and linked.

- [ ] **Step 3: Verify the app still builds with OpenCV linked**

```bash
npx expo run:ios --device "iphone de vinicius"
```

Expected: builds successfully (OpenCV linked but not used yet).

- [ ] **Step 4: Commit**

```bash
git add modules/expo-seven-segment-reader/expo-seven-segment-reader.podspec ios/Podfile.lock
git commit -m "chore: add OpenCV2 dependency to seven-segment-reader module"
```

---

## Chunk 2: Native OpenCV Pipeline

### Task 3: Implement the Objective-C++ OpenCV Pipeline

**Files:**
- Create: `modules/expo-seven-segment-reader/ios/SevenSegmentReader.h`
- Create: `modules/expo-seven-segment-reader/ios/SevenSegmentReader.mm`

This is the core of the feature. The Obj-C++ file wraps OpenCV C++ calls and exposes a clean Obj-C interface that Swift can call.

- [ ] **Step 1: Create the header**

Create `modules/expo-seven-segment-reader/ios/SevenSegmentReader.h`:

```objc
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@interface BPReading : NSObject
@property (nonatomic, assign) int systolic;
@property (nonatomic, assign) int diastolic;
@property (nonatomic, assign) int heartRate;
@property (nonatomic, assign) BOOL hasHeartRate;
@end

@interface SevenSegmentReader : NSObject
+ (BPReading * _Nullable)readDisplayFromImage:(UIImage * _Nonnull)image
                                        error:(NSError * _Nullable * _Nullable)error;
@end
```

- [ ] **Step 2: Create the implementation**

Create `modules/expo-seven-segment-reader/ios/SevenSegmentReader.mm`:

```objc
#import "SevenSegmentReader.h"
#import <opencv2/opencv.hpp>
#import <opencv2/imgproc.hpp>

using namespace cv;
using namespace std;

@implementation BPReading
@end

// 7-segment digit patterns: [top, topLeft, topRight, middle, bottomLeft, bottomRight, bottom]
// 1 = segment ON, 0 = segment OFF
static int DIGIT_PATTERNS[10][7] = {
    {1, 1, 1, 0, 1, 1, 1}, // 0
    {0, 0, 1, 0, 0, 1, 0}, // 1
    {1, 0, 1, 1, 1, 0, 1}, // 2
    {1, 0, 1, 1, 0, 1, 1}, // 3
    {0, 1, 1, 1, 0, 1, 0}, // 4
    {1, 1, 0, 1, 0, 1, 1}, // 5
    {1, 1, 0, 1, 1, 1, 1}, // 6
    {1, 0, 1, 0, 0, 1, 0}, // 7
    {1, 1, 1, 1, 1, 1, 1}, // 8
    {1, 1, 1, 1, 0, 1, 1}, // 9
};

#pragma mark - Helper Functions

static Mat imageToMat(UIImage *image) {
    CGColorSpaceRef colorSpace = CGImageGetColorSpace(image.CGImage);
    size_t cols = CGImageGetWidth(image.CGImage);
    size_t rows = CGImageGetHeight(image.CGImage);

    Mat mat(static_cast<int>(rows), static_cast<int>(cols), CV_8UC4);
    CGContextRef contextRef = CGBitmapContextCreate(
        mat.data, cols, rows, 8, mat.step[0],
        colorSpace, kCGImageAlphaNoneSkipLast | kCGBitmapByteOrderDefault
    );
    CGContextDrawImage(contextRef, CGRectMake(0, 0, cols, rows), image.CGImage);
    CGContextRelease(contextRef);

    Mat bgr;
    cvtColor(mat, bgr, COLOR_RGBA2BGR);
    return bgr;
}

// Find the largest roughly-rectangular contour (the LCD display)
static vector<Point> findDisplayContour(const Mat &gray) {
    Mat blurred, edged;
    GaussianBlur(gray, blurred, Size(5, 5), 0);
    Canny(blurred, edged, 50, 150);

    // Dilate to close gaps in edges
    Mat kernel = getStructuringElement(MORPH_RECT, Size(3, 3));
    dilate(edged, edged, kernel, Point(-1, -1), 2);

    vector<vector<Point>> contours;
    findContours(edged, contours, RETR_EXTERNAL, CHAIN_APPROX_SIMPLE);

    double maxArea = 0;
    vector<Point> bestContour;
    double imageArea = gray.rows * gray.cols;

    for (const auto &contour : contours) {
        double area = contourArea(contour);
        // Display should be at least 5% and at most 80% of the image
        if (area < imageArea * 0.05 || area > imageArea * 0.80) continue;

        vector<Point> approx;
        double peri = arcLength(contour, true);
        approxPolyDP(contour, approx, 0.02 * peri, true);

        if (approx.size() == 4 && area > maxArea) {
            maxArea = area;
            bestContour = approx;
        }
    }

    return bestContour;
}

// Order 4 points as: top-left, top-right, bottom-right, bottom-left
static vector<Point2f> orderPoints(const vector<Point> &pts) {
    vector<Point2f> ordered(4);
    // Sum and diff to find corners
    float minSum = FLT_MAX, maxSum = 0;
    float minDiff = FLT_MAX, maxDiff = -FLT_MAX;
    int tlIdx = 0, brIdx = 0, trIdx = 0, blIdx = 0;

    for (int i = 0; i < 4; i++) {
        float sum = pts[i].x + pts[i].y;
        float diff = pts[i].y - pts[i].x;
        if (sum < minSum) { minSum = sum; tlIdx = i; }
        if (sum > maxSum) { maxSum = sum; brIdx = i; }
        if (diff < minDiff) { minDiff = diff; trIdx = i; }
        if (diff > maxDiff) { maxDiff = diff; blIdx = i; }
    }

    ordered[0] = Point2f(pts[tlIdx].x, pts[tlIdx].y);
    ordered[1] = Point2f(pts[trIdx].x, pts[trIdx].y);
    ordered[2] = Point2f(pts[brIdx].x, pts[brIdx].y);
    ordered[3] = Point2f(pts[blIdx].x, pts[blIdx].y);
    return ordered;
}

// Perspective warp to get a flat display image
static Mat fourPointTransform(const Mat &image, const vector<Point2f> &pts) {
    float widthA = norm(pts[2] - pts[3]);
    float widthB = norm(pts[1] - pts[0]);
    int maxWidth = static_cast<int>(max(widthA, widthB));

    float heightA = norm(pts[1] - pts[2]);
    float heightB = norm(pts[0] - pts[3]);
    int maxHeight = static_cast<int>(max(heightA, heightB));

    vector<Point2f> dst = {
        Point2f(0, 0),
        Point2f(maxWidth - 1, 0),
        Point2f(maxWidth - 1, maxHeight - 1),
        Point2f(0, maxHeight - 1)
    };

    Mat M = getPerspectiveTransform(pts, dst);
    Mat warped;
    warpPerspective(image, warped, M, Size(maxWidth, maxHeight));
    return warped;
}

// Classify a single digit image by checking 7 segment regions
static int classifyDigit(const Mat &digitBinary) {
    int h = digitBinary.rows;
    int w = digitBinary.cols;

    // Define segment probe regions as (y_start, y_end, x_start, x_end) fractions
    // Segments: top, topLeft, topRight, middle, bottomLeft, bottomRight, bottom
    struct Region {
        float y1, y2, x1, x2;
    };

    Region segments[7] = {
        {0.00f, 0.15f, 0.20f, 0.80f}, // top horizontal
        {0.10f, 0.45f, 0.00f, 0.25f}, // top-left vertical
        {0.10f, 0.45f, 0.75f, 1.00f}, // top-right vertical
        {0.40f, 0.60f, 0.20f, 0.80f}, // middle horizontal
        {0.55f, 0.90f, 0.00f, 0.25f}, // bottom-left vertical
        {0.55f, 0.90f, 0.75f, 1.00f}, // bottom-right vertical
        {0.85f, 1.00f, 0.20f, 0.80f}, // bottom horizontal
    };

    int segmentState[7];
    for (int i = 0; i < 7; i++) {
        int y1 = static_cast<int>(segments[i].y1 * h);
        int y2 = static_cast<int>(segments[i].y2 * h);
        int x1 = static_cast<int>(segments[i].x1 * w);
        int x2 = static_cast<int>(segments[i].x2 * w);

        // Clamp
        y1 = max(0, min(y1, h - 1));
        y2 = max(0, min(y2, h));
        x1 = max(0, min(x1, w - 1));
        x2 = max(0, min(x2, w));

        if (y2 <= y1 || x2 <= x1) {
            segmentState[i] = 0;
            continue;
        }

        Mat roi = digitBinary(Rect(x1, y1, x2 - x1, y2 - y1));
        double meanVal = mean(roi)[0];

        // In our binary image, dark pixels (segments ON) have low values
        // Threshold: if more than 40% of the region is dark, segment is ON
        segmentState[i] = (meanVal < 128) ? 1 : 0;
    }

    // Match against known patterns
    int bestDigit = -1;
    int bestScore = -1;
    for (int d = 0; d < 10; d++) {
        int score = 0;
        for (int s = 0; s < 7; s++) {
            if (segmentState[s] == DIGIT_PATTERNS[d][s]) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestDigit = d;
        }
    }

    // Require at least 6 of 7 segments to match
    return (bestScore >= 6) ? bestDigit : -1;
}

// Extract digits from a single zone (row of the display)
static int readZone(const Mat &zone) {
    Mat gray, binary;
    if (zone.channels() > 1) {
        cvtColor(zone, gray, COLOR_BGR2GRAY);
    } else {
        gray = zone.clone();
    }

    // Adaptive threshold — handles uneven lighting/glare
    adaptiveThreshold(gray, binary, 255, ADAPTIVE_THRESH_GAUSSIAN_C,
                      THRESH_BINARY, 31, 10);

    // Find digit contours
    vector<vector<Point>> contours;
    findContours(binary.clone(), contours, RETR_EXTERNAL, CHAIN_APPROX_SIMPLE);

    // Filter contours by size and aspect ratio
    struct DigitRect {
        Rect rect;
    };
    vector<DigitRect> digits;
    int zoneH = zone.rows;

    for (const auto &contour : contours) {
        Rect r = boundingRect(contour);
        float aspectRatio = static_cast<float>(r.height) / r.width;
        // Digits are tall and narrow: aspect ratio roughly 1.2 to 3.5
        // Height should be at least 30% of zone height
        if (aspectRatio > 1.0f && aspectRatio < 4.0f &&
            r.height > zoneH * 0.3 && r.width > 5) {
            digits.push_back({r});
        }
    }

    if (digits.empty()) return -1;

    // Sort left to right
    sort(digits.begin(), digits.end(), [](const DigitRect &a, const DigitRect &b) {
        return a.rect.x < b.rect.x;
    });

    // Classify each digit and assemble number
    int number = 0;
    bool foundAny = false;
    for (const auto &d : digits) {
        Mat digitImg = binary(d.rect);
        int digit = classifyDigit(digitImg);
        if (digit < 0) return -1; // unreadable digit
        number = number * 10 + digit;
        foundAny = true;
    }

    return foundAny ? number : -1;
}

#pragma mark - Public API

@implementation SevenSegmentReader

+ (BPReading *)readDisplayFromImage:(UIImage *)image error:(NSError **)error {
    Mat mat = imageToMat(image);
    Mat gray;
    cvtColor(mat, gray, COLOR_BGR2GRAY);

    // Step 1: Find the display rectangle
    vector<Point> displayContour = findDisplayContour(gray);
    if (displayContour.size() != 4) {
        if (error) {
            *error = [NSError errorWithDomain:@"SevenSegmentReader"
                                         code:1
                                     userInfo:@{NSLocalizedDescriptionKey: @"Could not detect display rectangle"}];
        }
        return nil;
    }

    // Step 2: Perspective correction
    vector<Point2f> ordered = orderPoints(displayContour);
    Mat warped = fourPointTransform(mat, ordered);

    // Step 3: Crop into 3 zones based on Omron layout proportions
    int displayH = warped.rows;
    int displayW = warped.cols;

    // Add some horizontal margin to avoid the labels (SYS, DIA, PULSE)
    int marginLeft = static_cast<int>(displayW * 0.20);
    int marginRight = static_cast<int>(displayW * 0.10);
    int contentW = displayW - marginLeft - marginRight;

    // Vertical zones
    int sysY1 = static_cast<int>(displayH * 0.05);
    int sysY2 = static_cast<int>(displayH * 0.40);
    int diaY1 = static_cast<int>(displayH * 0.40);
    int diaY2 = static_cast<int>(displayH * 0.70);
    int pulseY1 = static_cast<int>(displayH * 0.70);
    int pulseY2 = static_cast<int>(displayH * 0.95);

    Mat sysZone = warped(Rect(marginLeft, sysY1, contentW, sysY2 - sysY1));
    Mat diaZone = warped(Rect(marginLeft, diaY1, contentW, diaY2 - diaY1));
    Mat pulseZone = warped(Rect(marginLeft, pulseY1, contentW, pulseY2 - pulseY1));

    // Step 4: Read each zone
    int systolic = readZone(sysZone);
    int diastolic = readZone(diaZone);
    int heartRate = readZone(pulseZone);

    // Step 5: Validate
    if (systolic < 70 || systolic > 250) {
        if (error) {
            *error = [NSError errorWithDomain:@"SevenSegmentReader"
                                         code:2
                                     userInfo:@{NSLocalizedDescriptionKey:
                [NSString stringWithFormat:@"Invalid systolic value: %d", systolic]}];
        }
        return nil;
    }
    if (diastolic < 40 || diastolic > 150) {
        if (error) {
            *error = [NSError errorWithDomain:@"SevenSegmentReader"
                                         code:2
                                     userInfo:@{NSLocalizedDescriptionKey:
                [NSString stringWithFormat:@"Invalid diastolic value: %d", diastolic]}];
        }
        return nil;
    }
    if (diastolic >= systolic) {
        if (error) {
            *error = [NSError errorWithDomain:@"SevenSegmentReader"
                                         code:2
                                     userInfo:@{NSLocalizedDescriptionKey:
                @"Diastolic must be less than systolic"}];
        }
        return nil;
    }

    BPReading *reading = [[BPReading alloc] init];
    reading.systolic = systolic;
    reading.diastolic = diastolic;
    if (heartRate >= 30 && heartRate <= 220) {
        reading.heartRate = heartRate;
        reading.hasHeartRate = YES;
    } else {
        reading.heartRate = 0;
        reading.hasHeartRate = NO;
    }

    return reading;
}

@end
```

- [ ] **Step 3: Verify the .mm file compiles**

Build the project to make sure OpenCV headers are found and Obj-C++ compilation works:

```bash
npx expo run:ios --device "iphone de vinicius"
```

Expected: builds successfully. The `SevenSegmentReader` class exists but isn't called from Swift yet.

- [ ] **Step 4: Commit**

```bash
git add modules/expo-seven-segment-reader/ios/
git commit -m "feat: implement OpenCV 7-segment reader pipeline"
```

---

### Task 4: Wire Swift Module to OpenCV Pipeline

**Files:**
- Modify: `modules/expo-seven-segment-reader/ios/ExpoSevenSegmentReaderModule.swift`
- Modify: `modules/expo-seven-segment-reader/index.ts`

- [ ] **Step 1: Update the Swift module to expose `readDisplay`**

Replace the content of `modules/expo-seven-segment-reader/ios/ExpoSevenSegmentReaderModule.swift` with:

```swift
import ExpoModulesCore
import UIKit

public class ExpoSevenSegmentReaderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoSevenSegmentReader")

    AsyncFunction("readDisplay") { (imageUri: String, promise: Promise) in
      guard let url = URL(string: imageUri) else {
        promise.reject("INVALID_URI", "Invalid image URI")
        return
      }

      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let data = try Data(contentsOf: url)
          guard let image = UIImage(data: data) else {
            promise.reject("INVALID_IMAGE", "Could not load image from URI")
            return
          }

          var error: NSError?
          let reading = SevenSegmentReader.readDisplay(from: image, error: &error)

          if let error = error {
            promise.reject("READER_ERROR", error.localizedDescription)
            return
          }

          guard let reading = reading else {
            promise.reject("READER_ERROR", "Could not read display")
            return
          }

          var result: [String: Any] = [
            "systolic": reading.systolic,
            "diastolic": reading.diastolic,
          ]
          if reading.hasHeartRate {
            result["heartRate"] = reading.heartRate
          }

          promise.resolve(result)
        } catch {
          promise.reject("LOAD_ERROR", "Could not load image: \(error.localizedDescription)")
        }
      }
    }
  }
}
```

Note: You'll need a bridging header or to ensure the Obj-C header is visible to Swift. Add a file `modules/expo-seven-segment-reader/ios/ExpoSevenSegmentReader-Bridging-Header.h` if needed:

```objc
#import "SevenSegmentReader.h"
```

Also ensure the module's podspec or build settings include the bridging header, or use `#import` in the umbrella header.

- [ ] **Step 2: Update the JS index to export the typed function**

Replace the content of `modules/expo-seven-segment-reader/index.ts` with:

```typescript
import ExpoSevenSegmentReaderModule from './src/ExpoSevenSegmentReaderModule';

export interface SevenSegmentReading {
  systolic: number;
  diastolic: number;
  heartRate?: number;
}

export async function readDisplay(imageUri: string): Promise<SevenSegmentReading> {
  return ExpoSevenSegmentReaderModule.readDisplay(imageUri);
}
```

- [ ] **Step 3: Build and verify**

```bash
npx expo run:ios --device "iphone de vinicius"
```

Expected: builds. Module exposes `readDisplay` but nothing calls it yet.

- [ ] **Step 4: Commit**

```bash
git add modules/expo-seven-segment-reader/
git commit -m "feat: wire Swift module to OpenCV pipeline with JS API"
```

---

## Chunk 3: JS Integration

### Task 5: Add Validation Utility & Update OCR Service Interface

**Files:**
- Create: `src/services/ocr/validation.ts`
- Create: `src/services/ocr/__tests__/validation.test.ts`
- Modify: `src/services/ocr/types.ts`
- Modify: `src/services/ocr/ocrService.ts`

- [ ] **Step 1: Write failing tests for BP validation**

Create `src/services/ocr/__tests__/validation.test.ts`:

```typescript
import { validateReading } from '../validation';

describe('validateReading', () => {
  it('accepts a valid reading', () => {
    expect(validateReading(120, 69, 59)).toBe(true);
  });

  it('rejects systolic out of range', () => {
    expect(validateReading(50, 69, 59)).toBe(false);
    expect(validateReading(260, 69, 59)).toBe(false);
  });

  it('rejects diastolic out of range', () => {
    expect(validateReading(120, 30, 59)).toBe(false);
    expect(validateReading(120, 160, 59)).toBe(false);
  });

  it('rejects diastolic >= systolic', () => {
    expect(validateReading(120, 120, 59)).toBe(false);
    expect(validateReading(120, 130, 59)).toBe(false);
  });

  it('accepts null heart rate', () => {
    expect(validateReading(120, 80, null)).toBe(true);
  });

  it('rejects heart rate out of range', () => {
    expect(validateReading(120, 80, 20)).toBe(false);
    expect(validateReading(120, 80, 230)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/services/ocr/__tests__/validation.test.ts --verbose
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement validation**

Create `src/services/ocr/validation.ts`:

```typescript
export function validateReading(
  systolic: number,
  diastolic: number,
  heartRate: number | null
): boolean {
  if (systolic < 70 || systolic > 250) return false;
  if (diastolic < 40 || diastolic > 150) return false;
  if (diastolic >= systolic) return false;
  if (heartRate !== null && (heartRate < 30 || heartRate > 220)) return false;
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/services/ocr/__tests__/validation.test.ts --verbose
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Update OCRService interface**

Replace `src/services/ocr/types.ts`:

```typescript
import { ParsedBP } from './bpParser';

export interface OCRResult {
  rawText: string[];
  confidence: number;
}

export interface OCRService {
  recognizeText(imageUri: string): Promise<OCRResult>;
  recognizeReading?(imageUri: string): Promise<ParsedBP | null>;
}
```

- [ ] **Step 6: Update ocrService.ts with SevenSegmentOCRService**

Replace `src/services/ocr/ocrService.ts`:

```typescript
import { OCRService } from './types';
import { ParsedBP } from './bpParser';
import { extractTextFromImage } from 'expo-text-extractor';
import { readDisplay } from '../../modules/expo-seven-segment-reader';
import { validateReading } from './validation';

class SevenSegmentOCRService implements OCRService {
  async recognizeReading(imageUri: string): Promise<ParsedBP | null> {
    try {
      const result = await readDisplay(imageUri);
      const heartRate = result.heartRate ?? null;
      if (!validateReading(result.systolic, result.diastolic, heartRate)) {
        return null;
      }
      return {
        systolic: result.systolic,
        diastolic: result.diastolic,
        heartRate,
      };
    } catch (e) {
      console.log('[SevenSegment] Error:', e);
      return null;
    }
  }

  async recognizeText(imageUri: string): Promise<{ rawText: string[]; confidence: number }> {
    // Fallback: not used for 7-segment path, but satisfies interface
    const result = await extractTextFromImage(imageUri);
    return { rawText: result, confidence: 1 };
  }
}

export function createOCRService(): OCRService {
  return new SevenSegmentOCRService();
}
```

- [ ] **Step 7: Commit**

```bash
git add src/services/ocr/
git commit -m "feat: add validation utility and SevenSegmentOCRService"
```

---

### Task 6: Update CaptureScreen to Use 7-Segment Reader

**Files:**
- Modify: `src/screens/CaptureScreen.tsx`

- [ ] **Step 1: Update processImage to try recognizeReading first**

In `src/screens/CaptureScreen.tsx`, replace the `processImage` function:

```typescript
  async function processImage(uri: string) {
    setProcessing(true);
    setImageUri(uri);
    try {
      const ocr = createOCRService();

      // Try 7-segment reader first
      if (ocr.recognizeReading) {
        console.log('[OCR] Trying 7-segment reader...');
        const bp = await ocr.recognizeReading(uri);
        if (bp) {
          console.log('[OCR] 7-segment result:', JSON.stringify(bp));
          setParsed(bp);
          setScreen('form');
          return;
        }
        console.log('[OCR] 7-segment reader failed, falling back to text OCR');
      }

      // Fallback: text-based OCR
      const result = await ocr.recognizeText(uri);
      console.log('[OCR] Raw text:', JSON.stringify(result.rawText));
      const bp = parseBPFromText(result.rawText);
      console.log('[OCR] Parsed BP:', JSON.stringify(bp));
      setParsed(bp);
      setScreen('form');
    } catch (e) {
      console.log('[OCR] Error:', e);
      Alert.alert('OCR Error', 'Could not extract text. You can enter values manually.');
      setParsed(null);
      setScreen('form');
    } finally {
      setProcessing(false);
    }
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build and test on device**

```bash
npx expo run:ios --device "iphone de vinicius"
```

Test: pick the sample Omron photo from the library. The form should pre-fill with 120/69/59.

- [ ] **Step 4: Commit**

```bash
git add src/screens/CaptureScreen.tsx
git commit -m "feat: use 7-segment reader with text OCR fallback in CaptureScreen"
```

---

## Chunk 4: Test Fixture & Final Verification

### Task 7: Add Test Fixture & Integration Test

**Files:**
- Create: `modules/expo-seven-segment-reader/test-fixtures/` (copy sample photo)
- Modify: `src/services/ocr/__tests__/bpParser.test.ts` (no changes needed, existing tests still pass)

- [ ] **Step 1: Copy sample photo as test fixture**

```bash
mkdir -p modules/expo-seven-segment-reader/test-fixtures
sips -s format jpeg "/Users/vinibaggio/Pictures/Photos Library.photoslibrary/originals/6/67CC554F-7C29-4272-9E07-DACFEAB09A0D.heic" --out modules/expo-seven-segment-reader/test-fixtures/omron-sample.jpg --resampleWidth 1200
```

- [ ] **Step 2: Run all existing tests to verify nothing is broken**

```bash
npx jest --verbose
```

Expected: all existing tests still pass (bpParser, bloodPressure, reportHtml, readingRepository, validation).

- [ ] **Step 3: Build and end-to-end test on device**

```bash
npx expo run:ios --device "iphone de vinicius"
```

Manual verification:
1. Open Capture tab → pick sample Omron photo from library
2. Form should pre-fill with systolic=120, diastolic=69, heartRate=59
3. Save the reading
4. Switch to Readings tab → verify it appears with green indicator (120/69 = Normal)
5. Metro console should show `[OCR] Trying 7-segment reader...` and `[OCR] 7-segment result: ...`

- [ ] **Step 4: Test with live camera capture**

Take a live photo of the BP monitor and verify the pipeline works with a real capture (not just library).

- [ ] **Step 5: Commit**

```bash
git add modules/expo-seven-segment-reader/test-fixtures/ src/
git commit -m "feat: add test fixture and verify 7-segment reader integration"
```

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md to reflect the new OCR architecture**

Add the 7-segment reader to the OCR subsystem section:

```markdown
### OCR Subsystem

The OCR layer uses a two-stage approach:
1. **Primary: 7-segment reader** — a local Expo native module (`modules/expo-seven-segment-reader`) using OpenCV to detect the LCD display, perspective-correct it, and classify each 7-segment digit. Tuned for Omron BP monitors.
2. **Fallback: text OCR** — `expo-text-extractor` (Apple Vision on iOS) with a JS-side parser for label-based extraction. Used if the 7-segment reader fails.

Both implement the `OCRService` interface (`src/services/ocr/types.ts`). The capture screen tries `recognizeReading` (7-segment) first, then falls back to `recognizeText` + `parseBPFromText`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with 7-segment reader architecture"
```
