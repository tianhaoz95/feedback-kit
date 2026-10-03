// The Android module's Gradle namespace is the SDK's own (com.feedbackkit,
// since the SDK's sources compile into it), so autolinking can't infer where
// the ReactPackage lives — spell it out.
module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.feedbackkit.reactnative.FeedbackKitPackage;',
        packageInstance: 'new FeedbackKitPackage()',
      },
    },
  },
};
