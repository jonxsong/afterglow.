# Afterglow for iPhone App Store release

## Listing draft

| Field | Draft |
| --- | --- |
| Name | Afterglow: Sunset Forecast |
| Subtitle | Find your best golden hour |
| Primary category | Weather |
| Bundle identifier | `dev.jonzhang.afterglow` |
| SKU | `afterglow-ios` |
| Primary language | English (U.S.) |
| Keywords | sunset,golden hour,sky,twilight,forecast,palette,photography,weather |
| Marketing URL | [Afterglow](https://afterglow.jonzhang.dev/) |
| Support URL | [Afterglow support](./SUPPORT.md) |
| Privacy policy URL | [Afterglow for iPhone privacy policy](./PRIVACY.md) |

### Description

Find the best time to catch the evening sky. Pick a city or use your current location to see tonight’s predicted colors and viewing window. Drag the sunset timeline to see how the light changes, or look ahead to another evening.

After sunset, select one photo and compare its colors with the forecast. The comparison runs on your iPhone. No sign-in is needed.

### App Review notes

On first launch, search for San Francisco and choose the result. The opening animation leads to the forecast. Drag **Time around sunset** to see the sky change, choose another date under **The week ahead**, or use **Compare a sunset photo** to select an image from Photos. Manual city search works without location permission and there are no reviewer credentials.

## Prepare and submit

1. Confirm the Apple Developer team, register the bundle identifier, and create the iOS record if it does not already exist. Confirm the name and SKU before creating the record. [Create an app record](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)
2. Generate the project, choose the team under **Signing & Capabilities**, and build an archive in Xcode 26 or later. Use Organizer to validate and upload the archive to App Store Connect. Keep signing material outside Git. [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
3. Distribute the build internally in TestFlight and exercise typed city search, location allow and deny, returning launch, Reduce Motion, and photo comparison in airplane mode with a saved forecast and a local photo. Verify on a physical iPhone. [App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow/)
4. Upload screenshots taken from the native build. Capture the timeline, week ahead, and photo comparison using a locally owned photo. Use a compatible iPhone with Dynamic Island. [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
5. Add the public support and privacy page URLs. Confirm App Privacy answers with the production traffic and logging configuration. The app declares approximate location for app functionality, with no link to identity or tracking. Photos are processed locally. [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
6. Complete age rating and export compliance, add the reviewer contact information and notes, select the signed build, and submit it to App Review. [Prepare for review](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/)
