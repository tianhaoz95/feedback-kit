require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# The FeedbackKit pod (the Swift SDK) isn't on trunk; the app's Podfile adds it:
#   pod 'FeedbackKit', :git => 'https://github.com/tianhaoz95/feedback-kit.git', :tag => 'v<version>'
# (the example app uses `:path` to this repo instead).
Pod::Spec.new do |s|
  s.name         = "FeedbackKitReactNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/tianhaoz95/feedback-kit.git", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.private_header_files = "ios/**/*.h"
  s.swift_version = "5.9"
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }

  s.dependency "FeedbackKit"

  install_modules_dependencies(s)
end
