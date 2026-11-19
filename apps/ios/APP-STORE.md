# Afterglow for iPhone and Mac App Store release

## Listing draft

| Field | Draft |
| --- | --- |
| Name | Afterglow: Sunset Forecast |
| Subtitle | View your Golden Hour |
| Primary category | Weather |
| Bundle identifier | `dev.jonzhang.afterglow` |
| SKU | `afterglow` |
| Primary language | English (U.S.) |
| Keywords | sunset,golden hour,sky,twilight,forecast,palette,photography,weather |
| Marketing URL | [Afterglow](https://afterglow.jonzhang.dev/) |
| Support URL | [Afterglow support](./SUPPORT.md) |
| Privacy policy URL | [Afterglow for iPhone and Mac privacy policy](./PRIVACY.md) |

Both platforms share the [Afterglow App Store Connect record](https://appstoreconnect.apple.com/apps/6836620328/distribution) and bundle identifier. Each platform has its own signed build, screenshots, description, and review submission. [Add platforms](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-platforms)

### iPhone description

Find the best time to catch the evening sky. Pick a city or use your current location to see tonight’s predicted colors and viewing window. Drag the sunset timeline to see how the light changes, or look ahead to another evening.

After sunset, select one photo and compare its colors with the forecast. The comparison runs on your iPhone. No sign-in is needed.

### Mac description

Find the best time to catch the evening sky. Pick a city or use your current location to see tonight’s predicted colors and viewing window. Drag the sunset timeline to see how the light changes and compare evenings in the seven-day outlook.

After sunset, choose a photo from Finder and compare its colors with the forecast. The comparison runs on your Mac. No sign-in is needed.

### App Review notes

On first launch, search for San Francisco and choose the result. The opening animation leads to the forecast. Drag **Time around sunset** to see the sky change, choose another date under **The week ahead**, or use **Compare a sunset photo** to select an image from Photos on iPhone or Finder on Mac. Manual city search works without location permission and there are no reviewer credentials.

## Prepare and submit

1. Confirm the Apple Developer team and shared bundle identifier, then use the iOS and macOS versions under the same App Store Connect record. [Create an app record](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)
2. Upload signed Release archives from the `Afterglow` and `AfterglowMac` schemes with Xcode 26 or later. Use Organizer with an authenticated developer account or the manual upload workflow below. [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
3. Test the builds internally through TestFlight. On an iPhone and a Mac, check city search, location allow and deny, returning launch, Reduce Motion, and photo comparison with a saved forecast and a local photo while offline. [App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow/)
4. Upload native screenshots for each platform. Use an accepted large-display iPhone size and capture the timeline, week ahead, and photo comparison using a locally owned photo. [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
5. Add the public support and privacy page URLs. Confirm App Privacy answers with the production traffic and logging configuration. The app declares coarse location and city searches for app functionality without an identity link or tracking. Photos are processed locally. [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
6. Complete age rating and export compliance, add the reviewer contact information and notes, select the signed builds, and submit each platform to App Review. [Prepare for review](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/)

## Upload from GitHub Actions

The [TestFlight upload workflow](../../.github/workflows/apple-distribution.yml) signs and uploads either platform or both from `main`. An Account Holder first enables App Store Connect API access. Automatic provisioning requires a Team key authorized for cloud signing. Team keys apply across the developer account. [App Store Connect API access](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/) · [Cloud-managed signing](https://developer.apple.com/help/account/certificates/cloud-managed-certificates/)

In the repository’s `apple-distribution` environment, restrict deployments to `main` and configure these values.

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `APPLE_TEAM_ID` | Apple Developer Team ID |
| Secret | `ASC_KEY_ID` | App Store Connect Team Key ID |
| Secret | `ASC_ISSUER_ID` | App Store Connect issuer ID |
| Secret | `ASC_PRIVATE_KEY` | Contents of the downloaded `.p8` file |

Run **Upload signed Apple builds to TestFlight** from GitHub Actions. Check each build’s processing status in App Store Connect before assigning it to internal testers.

## Enable the website download links

After confirming a public listing opens in the App Store, set `NEXT_PUBLIC_IPHONE_APP_STORE_LIVE=1` for iPhone or `NEXT_PUBLIC_MAC_APP_STORE_LIVE=1` for Mac when building and deploying the website. Each flag replaces its platform’s **Coming soon** label with the official download badge and store link.
