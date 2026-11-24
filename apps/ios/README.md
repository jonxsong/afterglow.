# Afterglow for iPhone and Mac

Afterglow uses SwiftUI and the same forecast API as [afterglow.jonzhang.dev](https://afterglow.jonzhang.dev). Each fresh launch opens with a sunrise-to-sunset animation that resolves into the Afterglow logo. Home carries the launch artwork into a full-screen sunset and shows tonight’s viewing window for the saved city. When a forecast is available, its predicted palette colors the sky. With Reduce Motion enabled, Home shows the settled sky. Choose a location or open the detailed forecast, then tap the Afterglow logo to return to Home. The app works without sign-in.

`project.yml` defines both native apps and their XCTest targets. Generate the Xcode project before opening it.

## Run on a Mac

Install [Xcode 26 or newer](https://developer.apple.com/xcode/) with an iOS Simulator runtime and [XcodeGen](https://yonaskolb.github.io/XcodeGen/) 2.42 or newer. The apps target iOS 17 and macOS 14 or later.

```sh
brew install xcodegen
cd apps/ios
xcodegen generate
open Afterglow.xcodeproj
```

Select **Afterglow** and an iPhone simulator, or **AfterglowMac** and **My Mac**. Choose a city to try a live forecast. The Mac app uses a resizable window with the week ahead alongside the sunset forecast on wider windows. Press **⌘R** to refresh.

## Run the tests

In Xcode, use **Product → Test**. To run from the command line, copy an iPhone simulator ID from `xcrun simctl list devices available`, then run this from `apps/ios`.

```sh
xcodebuild -project Afterglow.xcodeproj -scheme Afterglow \
  -destination 'platform=iOS Simulator,id=YOUR_SIMULATOR_ID' \
  CODE_SIGNING_ALLOWED=NO test
```

Run the shared tests on Mac with `xcodebuild -project Afterglow.xcodeproj -scheme AfterglowMac -destination 'platform=macOS' CODE_SIGNING_ALLOWED=NO test`. The [Apple Apps CI workflow](../../.github/workflows/ios.yml) runs both suites and builds both Release configurations.

## Data and permissions

- Forecasts come from `/api/v1/forecast/weekly`. City search uses `/api/weather/geocoding`.
- Location access is requested when you choose to find a nearby forecast. You can also choose a city manually.
- Photo comparison runs locally using a photo from the iPhone Photos picker or Mac Finder. Apple Vision helps mask foreground subjects, and CIE76 compares the observed and forecast palettes. The repository’s offline training pipeline is a separate weather-vibrancy experiment.

See the [App Store release checklist](./APP-STORE.md), [privacy policy](./PRIVACY.md), and [support page](./SUPPORT.md).
