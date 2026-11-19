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
        #if os(macOS)
        Window("Afterglow", id: "afterglow") {
            AfterglowRootView(session: session, service: service, deviceLocation: deviceLocation)
                .frame(minWidth: 440, minHeight: 460)
        }
        .defaultSize(width: 940, height: 740)
        .windowResizability(.contentMinSize)
        .commands {
            CommandMenu("Forecast") {
                Button("Refresh Forecast") { Task { await session.refresh() } }
                    .keyboardShortcut("r")
                    .disabled(session.location == nil || session.isLoading)
            }
        }
        #else
        WindowGroup {
            AfterglowRootView(session: session, service: service, deviceLocation: deviceLocation)
        }
        #endif
    }
}
