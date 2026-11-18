import CoreLocation
import Foundation
import SwiftUI

/// Lets a person choose a forecast city without asking for location access on launch.
struct LocationOnboardingView<City: Identifiable>: View {
    enum Purpose: Equatable {
        case onboarding
        case changeCity
    }

    private let purpose: Purpose
    private let search: @MainActor (String) async throws -> [City]
    private let resolveCurrentLocation: @MainActor () async throws -> City
    private let title: (City) -> String
    private let subtitle: (City) -> String?
    private let onSelected: @MainActor (City) -> Void

    @Environment(\.colorScheme) private var colorScheme
    @FocusState private var cityFieldFocused: Bool
    @State private var cityQuery = ""
    @State private var searchRevision = 0
    @State private var displayedQuery = ""
    @State private var searchState = SearchState.loading
    @State private var locationRequest: UUID?
    @State private var locationError: String?

    private struct SearchRequest: Equatable {
        let query: String
        let revision: Int
    }

    private enum SearchState {
        case loading
        case matches([City])
        case failed
    }

    init(
        purpose: Purpose = .onboarding,
        search: @escaping @MainActor (String) async throws -> [City],
        resolveCurrentLocation: @escaping @MainActor () async throws -> City,
        title: @escaping (City) -> String,
        subtitle: @escaping (City) -> String?,
        onSelected: @escaping @MainActor (City) -> Void
    ) {
        self.purpose = purpose
        self.search = search
        self.resolveCurrentLocation = resolveCurrentLocation
        self.title = title
        self.subtitle = subtitle
        self.onSelected = onSelected
    }

    var body: some View {
        let request = searchRequest
        let activeLocationRequest = locationRequest

        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                introduction

                VStack(alignment: .leading, spacing: 12) {
                    searchField
                    searchResults(for: request.query)
                }

                currentLocation
            }
            .frame(maxWidth: 440)
            .padding(.horizontal, 24)
            .padding(.top, purpose == .onboarding ? 48 : 20)
            .padding(.bottom, 32)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background {
            LinearGradient(colors: backgroundColors, startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()
        }
        .task(id: request) {
            await loadCities(for: request)
        }
        .task(id: activeLocationRequest) {
            if let activeLocationRequest {
                await locateCity(for: activeLocationRequest)
            }
        }
    }

    private var introduction: some View {
        let heading: LocalizedStringKey = purpose == .onboarding ? "Where will you watch?" : "Choose a city"

        return VStack(alignment: .leading, spacing: 12) {
            if purpose == .onboarding {
                HStack(spacing: 8) {
                    Image("BrandMark")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 24, height: 24)
                        .accessibilityHidden(true)

                    Text(verbatim: "Afterglow")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(accent)
                }
            }

            Text(heading)
                .font(.system(.largeTitle, design: .serif).weight(.semibold))
                .accessibilityAddTraits(.isHeader)

            if purpose == .onboarding {
                Text("Pick a city to see when the sky might be at its most colorful.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var searchField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Search by city")
                .font(.subheadline.weight(.semibold))
                .accessibilityHidden(true)

            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)

                TextField("e.g. San Francisco", text: $cityQuery)
                    .textContentType(.addressCity)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .focused($cityFieldFocused)
                    .accessibilityLabel("Search by city")

                if !cityQuery.isEmpty {
                    Button {
                        cityQuery = ""
                        cityFieldFocused = true
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear city search")
                }
            }
            .padding(.leading, 16)
            .padding(.trailing, 6)
            .frame(minHeight: 56)
            .background(panel, in: RoundedRectangle(cornerRadius: 16))
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(cityFieldFocused ? accent : border, lineWidth: 1)
            }
        }
    }

    @ViewBuilder
    private func searchResults(for query: String) -> some View {
        if query.count >= 2 {
            let state = displayedQuery == query ? searchState : .loading

            switch state {
            case .loading:
                ProgressView("Finding cities…")
                    .font(.subheadline)
                    .padding(.horizontal, 4)
            case .matches(let cities) where cities.isEmpty:
                Text("No cities found. Try another spelling or add a country.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            case .matches(let cities):
                VStack(spacing: 0) {
                    ForEach(cities) { city in
                        if city.id != cities.first?.id {
                            Divider()
                                .padding(.horizontal, 14)
                        }

                        Button {
                            select(city)
                        } label: {
                            cityRow(city)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .background(panel, in: RoundedRectangle(cornerRadius: 16))
                .overlay {
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(border, lineWidth: 1)
                }
            case .failed:
                VStack(alignment: .leading, spacing: 2) {
                    Text("City search is unavailable right now.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    Button("Try again") { searchRevision += 1 }
                        .font(.subheadline.weight(.semibold))
                        .frame(minHeight: 44, alignment: .leading)
                        .tint(accent)
                }
            }
        }
    }

    private func cityRow(_ city: City) -> some View {
        HStack(spacing: 14) {
            Image(systemName: "mappin.circle")
                .foregroundStyle(accent)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                Text(verbatim: title(city))
                    .font(.body.weight(.semibold))

                if let region = subtitle(city), !region.isEmpty {
                    Text(verbatim: region)
                        .foregroundStyle(.secondary)
                        .font(.footnote)
                }
            }

            Spacer(minLength: 6)

            Image(systemName: "chevron.forward")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
        }
        .foregroundStyle(.primary)
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .frame(minHeight: 54)
        .contentShape(Rectangle())
    }

    private var currentLocation: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                cityFieldFocused = false
                locationError = nil
                locationRequest = UUID()
            } label: {
                HStack(spacing: 10) {
                    if locationRequest != nil {
                        ProgressView()
                            .tint(accent)
                            .accessibilityHidden(true)
                    } else {
                        Image(systemName: "location")
                            .accessibilityHidden(true)
                    }

                    if locationRequest != nil {
                        Text("Finding your location…")
                    } else {
                        Text("Use my current location")
                    }
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .frame(minHeight: 48)
                .background(accent.opacity(0.09), in: RoundedRectangle(cornerRadius: 14))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(locationRequest != nil)
            .accessibilityHint("Uses your location to find a nearby forecast")

            if let locationError {
                Text(verbatim: locationError)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var searchRequest: SearchRequest {
        SearchRequest(
            query: cityQuery.trimmingCharacters(in: .whitespacesAndNewlines),
            revision: searchRevision
        )
    }

    private func loadCities(for request: SearchRequest) async {
        guard request == searchRequest else { return }
        displayedQuery = request.query
        searchState = .loading
        guard request.query.count >= 2 else { return }

        do {
            try await Task.sleep(for: .milliseconds(280))
            let cities = try await search(request.query)
            try Task.checkCancellation()
            guard request == searchRequest else { return }
            searchState = .matches(cities)
        } catch {
            guard !Task.isCancelled, request == searchRequest else { return }
            searchState = .failed
        }
    }

    private func locateCity(for request: UUID) async {
        guard locationRequest == request else { return }
        defer {
            if locationRequest == request { locationRequest = nil }
        }

        do {
            let city = try await resolveCurrentLocation()
            try Task.checkCancellation()
            guard locationRequest == request else { return }
            select(city)
        } catch {
            guard !Task.isCancelled, locationRequest == request else { return }

            if (error as? CLError)?.code == .denied {
                locationError = String(localized: "Location access is off. You can still search by city.")
            } else if let description = (error as? LocalizedError)?.errorDescription {
                locationError = description
            } else {
                locationError = String(localized: "Your location is unavailable. Search by city or try again.")
            }
        }
    }

    private func select(_ city: City) {
        cityFieldFocused = false
        locationRequest = nil
        onSelected(city)
    }

    private var backgroundColors: [Color] {
        if colorScheme == .dark {
            return [Color(red: 0.16, green: 0.13, blue: 0.19), Color(red: 0.10, green: 0.09, blue: 0.12)]
        }

        return [Color(red: 0.98, green: 0.94, blue: 0.92), Color(red: 0.97, green: 0.96, blue: 0.95)]
    }

    private var accent: Color {
        colorScheme == .dark
            ? Color(red: 0.88, green: 0.73, blue: 0.90)
            : Color(red: 0.38, green: 0.27, blue: 0.48)
    }

    private var panel: Color {
        colorScheme == .dark ? Color.white.opacity(0.06) : Color.white.opacity(0.82)
    }

    private var border: Color {
        Color.primary.opacity(0.12)
    }
}
