import SwiftUI

@MainActor
final class ForecastSession: ObservableObject {
    @Published private(set) var location: ForecastLocation?
    @Published private(set) var forecast: WeeklyForecast?
    @Published private(set) var isLoading = false
    @Published private(set) var error: String?
    @Published private(set) var isShowingSavedForecast = false
    @Published private(set) var hasSeenOpening: Bool

    private let service: any ForecastService
    private let store: LocalForecastStore
    private let now: () -> Date
    private var requestID = UUID()
    private var lastSuccessfulRefresh: Date?

    init(service: any ForecastService, store: LocalForecastStore, now: @escaping () -> Date = Date.init) {
        self.service = service
        self.store = store
        self.now = now
        hasSeenOpening = store.hasSeenOpening
        location = store.selectedLocation
        if let location, let saved = store.forecast(for: location, now: now()) {
            forecast = saved
            isShowingSavedForecast = true
        }
    }

    func finishOpening() {
        store.hasSeenOpening = true
        hasSeenOpening = true
    }

    func select(_ city: ForecastLocation) {
        guard location?.id != city.id else { return }
        requestID = UUID()
        store.selectedLocation = city
        forecast = store.forecast(for: city, now: now())
        isShowingSavedForecast = forecast != nil
        error = nil
        isLoading = false
        lastSuccessfulRefresh = nil
        location = city
    }

    func refreshIfNeeded() async {
        let hasToday = forecast?.tonight.map { day in
            ForecastCalendar.isToday(day, in: forecast?.location.timeZone ?? .current, now: now())
        } ?? false
        if hasToday, let lastSuccessfulRefresh, now().timeIntervalSince(lastSuccessfulRefresh) < 900 {
            return
        }
        await refresh()
    }

    func refresh() async {
        guard let city = location, !isLoading else { return }
        let id = UUID()
        requestID = id
        error = nil
        if let forecast, let day = forecast.tonight,
           !ForecastCalendar.isToday(day, in: forecast.location.timeZone, now: now()) {
            self.forecast = nil
            isShowingSavedForecast = false
        }
        isLoading = true
        defer { if requestID == id { isLoading = false } }

        do {
            let updated = try await service.weeklyForecast(for: city)
            try Task.checkCancellation()
            guard requestID == id else { return }
            forecast = updated
            isShowingSavedForecast = false
            lastSuccessfulRefresh = now()
            store.save(updated, for: city)
        } catch is CancellationError {
            return
        } catch {
            guard requestID == id, !Task.isCancelled else { return }
            forecast = store.forecast(for: city, now: now())
            isShowingSavedForecast = forecast != nil
            self.error = error.localizedDescription
        }
    }
}
