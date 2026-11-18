import Foundation

struct ForecastLocation: Codable, Hashable, Identifiable, Sendable {
    let name: String
    let region: String?
    let country: String
    let latitude: Double
    let longitude: Double
    let timezone: String

    init(
        name: String,
        region: String? = nil,
        country: String = "",
        latitude: Double,
        longitude: Double,
        timezone: String
    ) {
        self.name = name
        self.region = region
        self.country = country
        self.latitude = latitude
        self.longitude = longitude
        self.timezone = timezone
    }

    var id: String { "\(latitude),\(longitude)@\(timezone)" }

    var subtitle: String? {
        var displayed = [name]
        let components = [region, country].compactMap { component -> String? in
            guard let trimmed = component?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !trimmed.isEmpty,
                  !displayed.contains(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) else {
                return nil
            }
            displayed.append(trimmed)
            return trimmed
        }
        return components.isEmpty ? nil : components.joined(separator: ", ")
    }

    var timeZone: TimeZone { TimeZone(identifier: timezone) ?? .autoupdatingCurrent }

    func localDate(at time: Date = .now) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let day = calendar.dateComponents([.year, .month, .day], from: time)
        return String(format: "%04d-%02d-%02d", day.year ?? 0, day.month ?? 0, day.day ?? 0)
    }
}

struct ForecastAtmosphere: Codable, Sendable {
    let cloudCover: Double
    let lowClouds: Double?
    let midClouds: Double?
    let highClouds: Double?
    let humidity: Double?
    let visibilityKm: Double?
    let precipitationProbability: Double?

    private enum CodingKeys: String, CodingKey {
        case cloudCover = "cloud_cover"
        case lowClouds = "low_clouds"
        case midClouds = "mid_clouds"
        case highClouds = "high_clouds"
        case humidity
        case visibilityKm = "visibility_km"
        case precipitationProbability = "precipitation_probability"
    }
}

struct ForecastDay: Codable, Identifiable, Sendable {
    let predictionID: String
    let modelKind: String
    let location: ForecastLocation
    let date: String
    let sunsetAt: Date
    let sunsetDisplay: String
    let bestWindowStart: Date
    let bestWindowEnd: Date
    let bestWindowDisplay: String
    let palette: [String]
    let dominantColors: [String]
    let vibrancy: Int
    let confidence: Int
    let summary: String
    let interpretationLabel: String
    let atmosphere: ForecastAtmosphere
    let forecastHorizonHours: Double

    var id: String { predictionID }

    private enum CodingKeys: String, CodingKey {
        case predictionID = "prediction_id"
        case modelKind = "model_kind"
        case location, date
        case sunsetAt = "sunset_at"
        case sunsetDisplay = "sunset_display"
        case bestWindowStart = "best_window_start"
        case bestWindowEnd = "best_window_end"
        case bestWindowDisplay = "best_window_display"
        case palette
        case dominantColors = "dominant_colors"
        case vibrancy, confidence, summary
        case interpretationLabel = "interpretation_label"
        case atmosphere
        case forecastHorizonHours = "forecast_horizon_hours"
    }
}

struct ForecastFreshness: Codable, Sendable {
    enum Source: String, Codable, Sendable { case live, cache }

    let source: Source
    let fetchedAt: Date

    private enum CodingKeys: String, CodingKey {
        case source
        case fetchedAt = "fetched_at"
    }
}

struct WeeklyForecast: Codable, Sendable {
    let location: ForecastLocation
    let bestPredictionID: String
    let days: [ForecastDay]
    let weatherSource: String?
    let freshness: ForecastFreshness?

    var tonight: ForecastDay? { days.first }

    private enum CodingKeys: String, CodingKey {
        case location, days, freshness
        case bestPredictionID = "best_prediction_id"
        case weatherSource = "weather_source"
    }
}
