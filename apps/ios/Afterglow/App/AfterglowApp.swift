import SwiftUI

@main
@MainActor
struct AfterglowApp: App {
    private let service: any ForecastService
    private let deviceLocation = DeviceLocationService()
    @StateObject private var session: ForecastSession

    init() {
        var service: any ForecastService = AfterglowAPI()
        var store = LocalForecastStore()
        #if DEBUG
        if let testEnvironment = UITestForecastService.launchEnvironment() {
            service = testEnvironment.service
            store = testEnvironment.store
        }
        #endif
        self.service = service
        let session = ForecastSession(service: service, store: store)
        _session = StateObject(wrappedValue: session)
    }

    var body: some Scene {
        WindowGroup {
            AfterglowRootView(session: session, service: service, deviceLocation: deviceLocation)
        }
    }
}
