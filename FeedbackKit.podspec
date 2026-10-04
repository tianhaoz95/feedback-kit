# CocoaPods spec for the Swift SDK, alongside Package.swift (SPM stays the
# primary way to consume it). Exists so the React Native module
# (react-native/) and the Flutter plugin (flutter/) can depend on the real
# native SDK on iOS: both toolchains link native iOS code through CocoaPods.
Pod::Spec.new do |s|
  s.name         = "FeedbackKit"
  s.version      = "1.0.62"
  s.summary      = "Capture a screenshot, annotate it, describe the problem, get a structured FeedbackReport."
  s.homepage     = "https://github.com/tianhaoz95/feedback-kit"
  s.license      = { :type => "MIT", :file => "LICENSE" }
  s.author       = { "FeedbackKit" => "https://github.com/tianhaoz95/feedback-kit" }
  s.source       = { :git => "https://github.com/tianhaoz95/feedback-kit.git", :tag => "v#{s.version}" }

  s.swift_versions = ["5.9"]
  s.ios.deployment_target = "15.0"
  s.osx.deployment_target = "12.0"
  s.watchos.deployment_target = "8.0"

  s.source_files = "Sources/FeedbackKit/**/*.swift"
end
