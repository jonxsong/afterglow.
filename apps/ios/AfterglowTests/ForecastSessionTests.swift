import XCTest
@testable import Afterglow

final class ForecastSessionTests: XCTestCase {
    private let city = ForecastLocation(
        name: "San Francisco", region: "California", country: "United States",
        latitude: 37.77, longitude: -122.42, timezone: "America/Los_Angeles"
    )

    @MainActor
    func testSavedForecastRestoresAndRemainsVisibleOnOfflineFailure() async throws {
        let (store, defaults, suite) = makeStore()
        defer { defaults.removePersistentDomain(forName: suite) }
        let sunset = try timestamp("2026-11-19T00:55:00Z")
        let forecast = makeForecast(for: city, sunset: sunset)
        let session = ForecastSession(service: StubForecastService(forecast: forecast), store: store, now: { sunset })

        XCTAssertNil(session.location)
        XCTAssertFalse(session.hasSeenOpening)
        session.select(city)
        session.finishOpening()
        await session.refresh()
        XCTAssertEqual(session.forecast?.tonight?.id, "forecast")
        XCTAssertFalse(session.isShowingSavedForecast)

        let restored = ForecastSession(service: StubForecastService(forecast: nil), store: store, now: { sunset })
        XCTAssertEqual(restored.location, city)
        XCTAssertTrue(restored.hasSeenOpening)
        XCTAssertTrue(restored.isShowingSavedForecast)
        await restored.refresh()

        XCTAssertEqual(restored.forecast?.tonight?.palette, forecast.tonight?.palette)
        XCTAssertTrue(restored.isShowingSavedForecast)
        XCTAssertNotNil(restored.error)
    }

    @MainActor
    func testSnapshotBelongsToTheCityAndItsLocalCalendarDay() throws {
        let (store, defaults, suite) = makeStore()
        defer { defaults.removePersistentDomain(forName: suite) }
        let sunset = try timestamp("2026-11-19T00:55:00Z")
        let forecast = makeForecast(for: city, sunset: sunset)
        store.save(forecast, for: city)

        let anotherCity = ForecastLocation(name: "Tokyo", latitude: 35.69, longitude: 139.69, timezone: "Asia/Tokyo")
        XCTAssertNotNil(store.forecast(for: city, now: try timestamp("2026-11-18T19:00:00Z")))
        XCTAssertNil(store.forecast(for: anotherCity, now: sunset))
        XCTAssertNil(store.forecast(for: city, now: try timestamp("2026-11-19T08:15:00Z")))
    }

    @MainActor
    private func makeStore() -> (LocalForecastStore, UserDefaults, String) {
        let suite = "afterglow.tests." + UUID().uuidString
        let defaults = UserDefaults(suiteName: suite)!
        return (LocalForecastStore(defaults: defaults), defaults, suite)
    }

    private func timestamp(_ value: String) throws -> Date {
        try XCTUnwrap(ISO8601DateFormatter().date(from: value))
    }

    private func makeForecast(for city: ForecastLocation, sunset: Date) -> WeeklyForecast {
        let day = ForecastDay(
            predictionID: "forecast", modelKind: "heuristic", location: city, date: city.localDate(at: sunset),
            sunsetAt: sunset, sunsetDisplay: "4:55 PM",
            bestWindowStart: sunset.addingTimeInterval(-1_200), bestWindowEnd: sunset.addingTimeInterval(900),
            bestWindowDisplay: "4:35–5:10 PM", palette: ["#F2B28D", "#D58CA6"], dominantColors: ["#F2B28D"],
            vibrancy: 65, confidence: 75, summary: "There may be a band of warm color near the horizon.",
            interpretationLabel: "Forecast illustration",
            atmosphere: ForecastAtmosphere(cloudCover: 44, lowClouds: 12, midClouds: 20, highClouds: 40,
                                           humidity: 54, visibilityKm: 16, precipitationProbability: 0),
            forecastHorizonHours: 5
        )
        return WeeklyForecast(location: city, bestPredictionID: day.id, days: [day], weatherSource: "open-meteo",
                              freshness: ForecastFreshness(source: .live, fetchedAt: sunset.addingTimeInterval(-3_600)))
    }
}

private struct StubForecastService: ForecastService {
    let forecast: WeeklyForecast?

    func weeklyForecast(for location: ForecastLocation) async throws -> WeeklyForecast {
        guard let forecast else { throw AfterglowServiceError.offline }
        return forecast
    }

    func searchCities(_ query: String, language: String) async throws -> [ForecastLocation] { [] }
}
