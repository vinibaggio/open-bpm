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
        // Digits are tall and narrow: aspect ratio roughly 1.0 to 4.0
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
        if (digit < 0) return -1;
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

    // Horizontal margins to avoid labels (SYS, DIA, PULSE text)
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
