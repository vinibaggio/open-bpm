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
