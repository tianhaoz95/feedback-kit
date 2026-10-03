# Desktop demo UI

The Home / Cart / Settings sample, written once in plain TypeScript and shared
by the Tauri (`desktop/tauri-demo`) and Electron (`desktop/electron-demo`) demo
apps. It's the same sample as the iOS, Android, Flutter and React Native
demos. Each app imports it from source and passes a small `DemoHost` that
configures FeedbackKit through its own package (`feedbackkit-tauri` or
`feedbackkit-electron`).
