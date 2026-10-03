#import "FeedbackKitModule.h"

#if __has_include(<FeedbackKitReactNative/FeedbackKitReactNative-Swift.h>)
#import <FeedbackKitReactNative/FeedbackKitReactNative-Swift.h>
#else
#import "FeedbackKitReactNative-Swift.h"
#endif

/// The TurboModule. Every method forwards to `FeedbackKitRNBridge` (Swift),
/// which calls the FeedbackKit SDK.
@implementation FeedbackKitModule

- (instancetype)init
{
  if (self = [super init]) {
    __weak FeedbackKitModule *weakSelf = self;
    // Submissions started natively (floating button, shake) reach JS too.
    FeedbackKitRNBridge.onSubmissionResult = ^(NSDictionary *result) {
      [weakSelf emitOnSubmissionResult:result];
    };
  }
  return self;
}

- (void)configure:(NSDictionary *)configuration
{
  [FeedbackKitRNBridge configure:configuration];
}

- (NSNumber *)isConfigured
{
  return @(FeedbackKitRNBridge.isConfigured);
}

- (void)setCurrentScreen:(NSString *)name
{
  [FeedbackKitRNBridge setCurrentScreen:name];
}

- (void)setTheme:(NSDictionary *)theme
{
  [FeedbackKitRNBridge setTheme:theme];
}

- (void)setUser:(NSDictionary *)user
{
  [FeedbackKitRNBridge setUser:user];
}

- (void)setDefaultProductKey:(NSString *)key
{
  [FeedbackKitRNBridge setDefaultProductKey:key];
}

- (NSString *)getReporterId
{
  return FeedbackKitRNBridge.reporterID;
}

- (void)present:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [FeedbackKitRNBridge present:^(NSDictionary *report) { resolve(report ?: (id)[NSNull null]); }];
}

- (void)presentAndSubmit:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [FeedbackKitRNBridge presentAndSubmit:^(NSDictionary *result) { resolve(result ?: (id)[NSNull null]); }];
}

- (void)presentAndSubmitIfConfigured:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [FeedbackKitRNBridge presentAndSubmitIfConfigured:^(NSDictionary *result) { resolve(result ?: (id)[NSNull null]); }];
}

- (void)showFloatingTriggerButton { [FeedbackKitRNBridge showFloatingTriggerButton]; }
- (void)hideFloatingTriggerButton { [FeedbackKitRNBridge hideFloatingTriggerButton]; }
- (void)enableShakeToReport { [FeedbackKitRNBridge enableShakeToReport]; }
- (void)disableShakeToReport { [FeedbackKitRNBridge disableShakeToReport]; }
- (void)enableFixVerification { [FeedbackKitRNBridge enableFixVerification]; }
- (void)disableFixVerification { [FeedbackKitRNBridge disableFixVerification]; }
- (void)presentFixUpdatesIfNeeded { [FeedbackKitRNBridge presentFixUpdatesIfNeeded]; }

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeFeedbackKitSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"FeedbackKit";
}

@end
