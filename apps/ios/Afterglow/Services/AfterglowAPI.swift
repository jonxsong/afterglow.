import Foundation

protocol ForecastService: Sendable {
    func weeklyForecast(for location: ForecastLocation) async throws -> WeeklyForecast
    func searchCities(_ query: String, language: String) async throws -> [ForecastLocation]
}

enum AfterglowServiceError: LocalizedError, Sendable {
    case invalidLocation
    case offline
    case unavailable
    case invalidResponse
    case expiredForecast

    var errorDescription: String? {
        switch self {
        case .invalidLocation: "Choose a city with a valid location and time zone."
        case .offline: "Connect to the internet and try again."
        case .unavailable: "Afterglow is temporarily unavailable. Try again in a moment."
        case .invalidResponse: "Afterglow couldn’t read the latest data. Try again in a moment."
        case .expiredForecast: "Tonight’s forecast isn’t available for this city yet."
        }
    }
}

struct AfterglowAPI: ForecastService {
    static let productionURL = URL(string: "https://afterglow.jonzhang.dev")!

    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL = AfterglowAPI.productionURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func weeklyForecast(for location: ForecastLocation) async throws -> WeeklyForecast {
        guard (-90.0...90.0).contains(location.latitude),
              (-180.0...180.0).contains(location.longitude),
              TimeZone(identifier: location.timezone) != nil else {
            throw AfterglowServiceError.invalidLocation
        }

        var query = [
            URLQueryItem(name: "latitude", value: String(location.latitude)),
            URLQueryItem(name: "longitude", value: String(location.longitude)),
            URLQueryItem(name: "name", value: location.name),
            URLQueryItem(name: "timezone", value: location.timezone),
            URLQueryItem(name: "country", value: location.country),
        ]
        if let region = location.region {
            query.append(URLQueryItem(name: "region", value: region))
        }

        let forecast: WeeklyForecast = try await get("/api/v1/forecast/weekly", query: query, timeout: 14)
        let now = Date.now
        guard forecast.tonight?.date == location.localDate(at: now) else {
            throw AfterglowServiceError.expiredForecast
        }
        if let freshness = forecast.freshness, freshness.source == .cache {
            let age = now.timeIntervalSince(freshness.fetchedAt)
            guard (-60..<(12 * 60 * 60)).contains(age),
                  location.localDate(at: freshness.fetchedAt) == location.localDate(at: now) else {
                throw AfterglowServiceError.expiredForecast
            }
        }
        return forecast
    }

    func searchCities(_ query: String, language: String = "en") async throws -> [ForecastLocation] {
        let name = String(query.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
        guard name.count >= 2 else { return [] }

        let response: GeocodingResponse = try await get("/api/weather/geocoding", query: [
            URLQueryItem(name: "name", value: name),
            URLQueryItem(name: "count", value: "8"),
            URLQueryItem(name: "language", value: language),
            URLQueryItem(name: "format", value: "json"),
        ], timeout: 10)

        var seen = Set<String>()
        return (response.results ?? []).compactMap { place in
            guard let location = place.forecastLocation, seen.insert(location.id).inserted else { return nil }
            return location
        }
    }

    private func get<Model: Decodable>(
        _ path: String,
        query: [URLQueryItem],
        timeout: TimeInterval
    ) async throws -> Model {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw AfterglowServiceError.invalidResponse
        }
        components.path = path
        components.queryItems = query
        // The Worker treats unescaped plus signs as spaces in query parameters.
        components.percentEncodedQuery = components.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        guard let url = components.url else { throw AfterglowServiceError.invalidResponse }

        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError {
            if error.code == .cancelled || Task.isCancelled { throw CancellationError() }
            if error.code == .notConnectedToInternet || error.code == .networkConnectionLost {
                throw AfterglowServiceError.offline
            }
            throw AfterglowServiceError.unavailable
        }
        try Task.checkCancellation()
        guard let response = response as? HTTPURLResponse else { throw AfterglowServiceError.invalidResponse }
        guard (200..<300).contains(response.statusCode) else { throw AfterglowServiceError.unavailable }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let timestamp = try container.decode(String.self)
            if let date = try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(timestamp) { return date }
            if let date = try? Date.ISO8601FormatStyle().parse(timestamp) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Expected an ISO-8601 timestamp")
        }
        do { return try decoder.decode(Model.self, from: data) }
        catch { throw AfterglowServiceError.invalidResponse }
    }

    private struct GeocodingResponse: Decodable {
        let results: [Place]?
    }

    private struct Place: Decodable {
        let name: String?
        let admin1: String?
        let country: String?
        let latitude: Double?
        let longitude: Double?
        let timezone: String?

        var forecastLocation: ForecastLocation? {
            guard let name, !name.isEmpty, let latitude, let longitude, let timezone,
                  (-90.0...90.0).contains(latitude), (-180.0...180.0).contains(longitude),
                  TimeZone(identifier: timezone) != nil else { return nil }
            return ForecastLocation(name: name, region: admin1, country: country ?? "",
                                    latitude: latitude, longitude: longitude, timezone: timezone)
        }
    }
}
