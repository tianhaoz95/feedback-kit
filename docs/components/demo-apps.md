# Demo Applications (`DemoApp/`)

The repository includes complete sample applications demonstrating the FeedbackKit SDK across iOS, macOS, and watchOS.

---

## Architecture: Generated via XcodeGen

To eliminate merge conflicts from `.xcodeproj` pbxproj files, the Xcode project is generated deterministically from `DemoApp/project.yml`:

```
DemoApp/
├── project.yml                    # Single source of truth for Xcode project
├── DemoApp/                       # iOS target source files
│   ├── Views/                     # SwiftUI HomeView & UIKit CartViewController
│   └── Support/CartStore.swift    # Shared store used by iOS and macOS
├── DemoMacApp/                    # macOS target source files (MacContentView)
└── DemoWatchApp/                  # watchOS standalone target source files
```

::: tip Rule for Contributors
Never edit `.xcodeproj` files directly. Edit `DemoApp/project.yml` and run `xcodegen generate` (or the `./scripts/run-*.sh` scripts).
:::

---

## Running the Demo Apps

Helper scripts handle generation, compilation, and launching:

```bash
# iOS: Generates project, boots simulator, installs, and launches
./scripts/run-ios.sh

# macOS: Generates project, builds, and launches natively
./scripts/run-macos.sh

# watchOS: Generates project, launches standalone watch simulator
./scripts/run-watchos.sh
```

You can target a specific simulator using the `SIMULATOR_NAME` environment variable:

```bash
SIMULATOR_NAME="iPhone 16 Pro" ./scripts/run-ios.sh
SIMULATOR_NAME="Apple Watch Series 10 (46mm)" ./scripts/run-watchos.sh
```

---

## Shared State: `CartStore.swift`

Both the iOS demo (which includes a SwiftUI Home tab and a UIKit Cart tab) and the macOS demo share a single `CartStore.swift` singleton.

Adding or removing items on any screen updates this shared store, validating that FeedbackKit functions seamlessly across diverse UI paradigms.
