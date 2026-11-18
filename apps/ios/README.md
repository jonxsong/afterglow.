# Afterglow for iPhone

Afterglow uses SwiftUI and the same forecast API as [afterglow.jonzhang.dev](https://afterglow.jonzhang.dev). Choose a city, watch the first-opening sunrise turn into a sunset, then see the local viewing window and explore the changing sky. The app works without sign-in.

`project.yml` defines the application and its XCTest target. Generate the Xcode project before opening it.

## Run on a Mac

Install [Xcode 26 or newer](https://developer.apple.com/xcode/) with an iOS Simulator runtime and [XcodeGen](https://yonaskolb.github.io/XcodeGen/) 2.42 or newer. The app targets iOS 17 and later.

```sh
brew install xcodegen
cd apps/ios
xcodegen generate
open Afterglow.xcodeproj
```

Select the **Afterglow** scheme and an iPhone simulator, then run the app. Choose a city to try a live forecast or use simulated location data to test the location permission flow.

## Run the tests

In Xcode, use **Product → Test**. To run from the command line, copy an iPhone simulator ID from `xcrun simctl list devices available`, then run this from `apps/ios`.

```sh
xcodebuild -project Afterglow.xcodeproj -scheme Afterglow \
  -destination 'platform=iOS Simulator,id=YOUR_SIMULATOR_ID' \
  CODE_SIGNING_ALLOWED=NO test
```

The [iOS Simulator workflow](../../.github/workflows/ios.yml) generates the project and runs XCTest in the simulator. It can also run manually from GitHub Actions.

## Data and permissions

- Forecasts come from `/api/v1/forecast/weekly`. City search uses `/api/weather/geocoding`.
- Location access is requested when you choose to find a nearby forecast. You can also choose a city manually.
- Photo comparison runs locally using the photo you select through the system picker. Apple Vision helps mask foreground subjects, and CIE76 compares the observed and forecast palettes. The repository’s offline training pipeline is a separate weather-vibrancy experiment.

See the [App Store release checklist](./APP-STORE.md), [privacy policy](./PRIVACY.md), and [support page](./SUPPORT.md).
