import SwiftUI

@main
@MainActor
struct AfterglowApp: App {
    private let service: AfterglowAPI
    private let deviceLocation = DeviceLocationService()
    @StateObject private var session: ForecastSession

    init() {
        let service = AfterglowAPI()
        self.service = service
        _session = StateObject(wrappedValue: ForecastSession(service: service, store: LocalForecastStore()))
    }

    var body: some Scene {
        WindowGroup {
            AfterglowRootView(session: session, service: service, deviceLocation: deviceLocation)
        }
    }
}
