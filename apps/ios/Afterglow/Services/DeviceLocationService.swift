import CoreLocation
import Foundation

enum DeviceLocationError: LocalizedError, Sendable {
    case permissionDenied
    case unavailable
    case alreadyInProgress

    var errorDescription: String? {
        switch self {
        case .permissionDenied: "Location access is off. You can enable it in Settings or search for a city."
        case .unavailable: "Your location couldn’t be determined. Try again or search for a city."
        case .alreadyInProgress: "Afterglow is already finding your location."
        }
    }
}

@MainActor
final class DeviceLocationService: NSObject, CLLocationManagerDelegate {
    private struct PendingLocation {
        let id: UUID
        let continuation: CheckedContinuation<ForecastLocation, Error>
    }

    private struct ApproximatePoint: Sendable {
        let latitude: Double
        let longitude: Double

        init(_ coordinate: CLLocationCoordinate2D) {
            latitude = (coordinate.latitude * 100).rounded() / 100
            longitude = (coordinate.longitude * 100).rounded() / 100
        }

        func place(named name: String = "Current location", region: String? = nil,
                   country: String = "", timezone: String) -> ForecastLocation {
            ForecastLocation(name: name, region: region, country: country, latitude: latitude,
                             longitude: longitude, timezone: timezone)
        }
    }

    private var pending: PendingLocation?
    private var manager: CLLocationManager?
    private var geocoder: CLGeocoder?
    private var timedTask: Task<Void, Never>?
    private var requestedPermission = false
    private var requestedFix = false

    /// Call after the person taps the current-location button. No request runs in the background.
    func currentLocation() async throws -> ForecastLocation {
        let id = UUID()
        let location: ForecastLocation = try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                if Task.isCancelled {
                    continuation.resume(throwing: CancellationError())
                    return
                }
                guard pending == nil else {
                    continuation.resume(throwing: DeviceLocationError.alreadyInProgress)
                    return
                }

                pending = PendingLocation(id: id, continuation: continuation)
                let manager = CLLocationManager()
                manager.desiredAccuracy = kCLLocationAccuracyKilometer
                self.manager = manager
                manager.delegate = self
                advanceAuthorization()
            }
        } onCancel: {
            Task { @MainActor [weak self] in
                self?.finish(id: id, with: .failure(CancellationError()))
            }
        }
        try Task.checkCancellation()
        return location
    }

    private func advanceAuthorization() {
        guard let request = pending, let manager else { return }
        switch manager.authorizationStatus {
        case .notDetermined:
            guard !requestedPermission else { return }
            requestedPermission = true
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            guard !requestedFix else { return }
            requestedFix = true
            startTimeout(seconds: 12, id: request.id, result: .failure(DeviceLocationError.unavailable))
            manager.requestLocation()
        case .denied, .restricted:
            finish(id: request.id, with: .failure(DeviceLocationError.permissionDenied))
        @unknown default:
            finish(id: request.id, with: .failure(DeviceLocationError.unavailable))
        }
    }

    private func resolveCity(near point: ApproximatePoint, id: UUID) {
        stopLocationManager()
        let geocoder = CLGeocoder()
        self.geocoder = geocoder

        // Resolve the selected coordinates' own time zone. Use the device zone if the lookup fails.
        let timeZone = TimeZone.autoupdatingCurrent.identifier
        let fallback = point.place(timezone: timeZone)
        startTimeout(seconds: 4, id: id, result: .success(fallback))
        let approximateLocation = CLLocation(latitude: point.latitude, longitude: point.longitude)
        geocoder.reverseGeocodeLocation(approximateLocation) { [weak self] placemarks, _ in
            let resolved = placemarks?.first.map { place in
                point.place(named: place.locality ?? place.subAdministrativeArea ?? "Current location",
                            region: place.administrativeArea, country: place.country ?? "",
                            timezone: place.timeZone?.identifier ?? timeZone)
            }
            Task { @MainActor [weak self] in
                self?.finish(id: id, with: .success(resolved ?? fallback))
            }
        }
    }

    private func startTimeout(seconds: Int, id: UUID, result: Result<ForecastLocation, Error>) {
        timedTask?.cancel()
        timedTask = Task { @MainActor [weak self] in
            do { try await Task.sleep(for: .seconds(seconds)) }
            catch { return }
            self?.finish(id: id, with: result)
        }
    }

    private func stopLocationManager() {
        manager?.delegate = nil
        manager?.stopUpdatingLocation()
        manager = nil
    }

    private func finish(id: UUID, with result: Result<ForecastLocation, Error>) {
        guard let request = pending, request.id == id else { return }
        pending = nil
        timedTask?.cancel()
        timedTask = nil
        stopLocationManager()
        geocoder?.cancelGeocode()
        geocoder = nil
        requestedPermission = false
        requestedFix = false
        request.continuation.resume(with: result)
    }

    private func ownsManager(_ identity: ObjectIdentifier) -> Bool {
        guard let manager else { return false }
        return ObjectIdentifier(manager) == identity
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let identity = ObjectIdentifier(manager)
        Task { @MainActor [weak self] in
            guard let self, self.ownsManager(identity) else { return }
            self.advanceAuthorization()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let identity = ObjectIdentifier(manager)
        let point = locations.last(where: { location in
            location.horizontalAccuracy >= 0 && abs(location.timestamp.timeIntervalSinceNow) < 120
                && CLLocationCoordinate2DIsValid(location.coordinate)
        }).map { ApproximatePoint($0.coordinate) }

        Task { @MainActor [weak self] in
            guard let self, let request = self.pending, self.ownsManager(identity) else { return }
            guard let point else {
                self.finish(id: request.id, with: .failure(DeviceLocationError.unavailable))
                return
            }
            self.resolveCity(near: point, id: request.id)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let identity = ObjectIdentifier(manager)
        let failure: DeviceLocationError = (error as? CLError)?.code == .denied ? .permissionDenied : .unavailable
        Task { @MainActor [weak self] in
            guard let self, let request = self.pending, self.ownsManager(identity) else { return }
            self.finish(id: request.id, with: .failure(failure))
        }
    }
}
