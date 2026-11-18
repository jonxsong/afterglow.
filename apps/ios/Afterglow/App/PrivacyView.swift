import SwiftUI

struct PrivacyView: View {
    var body: some View {
        List {
            Section("Location") {
                Text("Search for a city or choose Use current location. Afterglow asks for location access only if you tap that option. It rounds the coordinates before looking up a city and requesting a forecast.")
                Text("City searches and forecast coordinates are sent to the Afterglow forecast service. Your most recent selection and forecast are saved on this device.")
            }
            Section("Sunset photos") {
                Text("Choose one photo using the system picker. Afterglow analyzes it on this device, and discards the comparison when you leave it. The photo is never uploaded to Afterglow.")
            }
            Section("Accounts and tracking") {
                Text("Afterglow works without an account and includes no advertising or tracking SDKs.")
            }
        }
        .navigationTitle("Privacy")
        .navigationBarTitleDisplayMode(.inline)
    }
}
