# For apps that build iOS plugins with CocoaPods instead of Swift Package
# Manager. The FeedbackKit pod isn't on trunk: add it to your ios/Podfile —
#   pod 'FeedbackKit', :git => 'https://github.com/tianhaoz95/feedback-kit.git', :tag => 'v1.0.62'
Pod::Spec.new do |s|
  s.name             = 'feedbackkit_flutter'
  s.version          = '1.0.62'
  s.summary          = 'In-app feedback for Flutter, running the native FeedbackKit SDK.'
  s.homepage         = 'https://github.com/tianhaoz95/feedback-kit'
  s.license          = { :file => '../LICENSE' }
  s.author           = { 'FeedbackKit' => 'https://github.com/tianhaoz95/feedback-kit' }
  s.source           = { :path => '.' }
  s.source_files     = 'feedbackkit_flutter/Sources/feedbackkit_flutter/**/*.swift'
  s.dependency 'Flutter'
  s.dependency 'FeedbackKit'
  s.platform = :ios, '15.0'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386' }
  s.swift_version = '5.9'
end
