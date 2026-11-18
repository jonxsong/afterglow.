#if DEBUG
import Foundation

struct UITestForecastService: ForecastService {
    private let sampleCity = ForecastLocation(
        name: "San Francisco", region: "California", country: "United States",
        latitude: 37.77, longitude: -122.42, timezone: "America/Los_Angeles"
    )

    @MainActor
    static func launchEnvironment() -> (service: Self, store: LocalForecastStore)? {
        let arguments = ProcessInfo.processInfo.arguments
        let suite = "dev.jonzhang.afterglow.uitest"
        guard arguments.contains("--ui-test-city-flow"), let preferences = UserDefaults(suiteName: suite) else {
            return nil
        }
        if arguments.contains("--ui-test-reset") {
            preferences.removePersistentDomain(forName: suite)
        }
        return (Self(), LocalForecastStore(defaults: preferences))
    }

    func searchCities(_ query: String, language: String) async throws -> [ForecastLocation] {
        sampleCity.name.localizedCaseInsensitiveContains(query) ? [sampleCity] : []
    }

    func weeklyForecast(for location: ForecastLocation) async throws -> WeeklyForecast {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = location.timeZone
        let now = Date()
        let sunset = calendar.date(bySettingHour: 16, minute: 55, second: 0, of: now) ?? now
        let palette = ["#F2B28D", "#E7A28B", "#D58CA6", "#AB7B9A", "#766FA7"]
        let days = (0..<7).map { offset in
            let time = calendar.date(byAdding: .day, value: offset, to: sunset) ?? sunset
            return ForecastDay(
                predictionID: "sample-\(offset)", modelKind: "heuristic", location: location, date: location.localDate(at: time),
                sunsetAt: time, sunsetDisplay: "4:55 PM",
                bestWindowStart: time.addingTimeInterval(-1_380), bestWindowEnd: time.addingTimeInterval(1_380),
                bestWindowDisplay: "4:32–5:18 PM", palette: palette, dominantColors: ["Peach", "Rose", "Violet"],
                vibrancy: 72, confidence: 79, summary: "Thin high clouds may catch the last light.",
                interpretationLabel: "Illustration of the evening sky",
                atmosphere: ForecastAtmosphere(cloudCover: 42, lowClouds: 8, midClouds: 22, highClouds: 47,
                                               humidity: 56, visibilityKm: 20, precipitationProbability: 0),
                forecastHorizonHours: Double(offset * 24 + 4)
            )
        }
        return WeeklyForecast(location: location, bestPredictionID: "sample-0", days: days,
                              weatherSource: "open-meteo", freshness: ForecastFreshness(source: .live, fetchedAt: now))
    }
}
#endif
