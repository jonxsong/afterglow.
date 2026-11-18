import Foundation

@MainActor
struct LocalForecastStore {
    private enum Key {
        static let location = "afterglow.selected-location"
        static let openingSeen = "afterglow.opening-seen"
        static let forecast = "afterglow.saved-forecast"
    }

    private struct Snapshot: Codable {
        let locationID: String
        let forecast: WeeklyForecast
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var selectedLocation: ForecastLocation? {
        get { decode(ForecastLocation.self, key: Key.location) }
        nonmutating set { write(newValue, key: Key.location) }
    }

    var hasSeenOpening: Bool {
        get { defaults.bool(forKey: Key.openingSeen) }
        nonmutating set { defaults.set(newValue, forKey: Key.openingSeen) }
    }

    func forecast(for location: ForecastLocation, now: Date) -> WeeklyForecast? {
        guard let snapshot = decode(Snapshot.self, key: Key.forecast),
              snapshot.locationID == location.id,
              let day = snapshot.forecast.tonight,
              ForecastCalendar.isToday(day, in: snapshot.forecast.location.timeZone, now: now)
        else { return nil }
        return snapshot.forecast
    }

    func save(_ forecast: WeeklyForecast, for location: ForecastLocation) {
        write(Snapshot(locationID: location.id, forecast: forecast), key: Key.forecast)
    }

    private func decode<Value: Decodable>(_ type: Value.Type, key: String) -> Value? {
        guard let bytes = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: bytes)
    }

    private func write<Value: Encodable>(_ value: Value?, key: String) {
        defaults.set(value.flatMap { try? JSONEncoder().encode($0) }, forKey: key)
    }
}

enum ForecastCalendar {
    static func isToday(_ weather: ForecastDay, in timeZone: TimeZone, now: Date) -> Bool {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar.isDate(weather.sunsetAt, inSameDayAs: now)
    }
}
