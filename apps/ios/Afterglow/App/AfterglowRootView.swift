import SwiftUI

@MainActor
struct AfterglowRootView: View {
    private enum Sheet: String, Identifiable {
        case location
        case privacy

        var id: Self { self }
    }

    @ObservedObject var session: ForecastSession
    let service: any ForecastService
    let deviceLocation: DeviceLocationService
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var sheet: Sheet?
    @State private var isShowingOpening = true
    @State private var isShowingForecast = false

    var body: some View {
        Group {
            if isShowingForecast {
                ForecastView(
                    session: session,
                    onHome: { showForecast(false) },
                    onChangeCity: { sheet = .location },
                    onPrivacy: { sheet = .privacy }
                )
                .transition(.opacity)
            } else {
                AfterglowHomeView(
                    session: session,
                    showsSky: !isShowingOpening,
                    onViewForecast: { showForecast(true) },
                    onChooseLocation: { sheet = .location },
                    onPrivacy: { sheet = .privacy }
                )
                .transition(.opacity)
            }
        }
        .allowsHitTesting(!isShowingOpening)
        .accessibilityHidden(isShowingOpening)
        .overlay {
            if isShowingOpening {
                OpeningSequenceView {
                    withAnimation(transitionAnimation) {
                        isShowingOpening = false
                    }
                }
                .transition(.opacity)
            }
        }
        .tint(SkyTheme.rose)
        .task(id: session.location?.id) { await session.refreshIfNeeded() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await session.refreshIfNeeded() } }
        }
        .sheet(item: $sheet) { presentation in
            NavigationStack {
                Group {
                    switch presentation {
                    case .location: cityPicker
                    case .privacy: PrivacyView()
                    }
                }
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { sheet = nil }
                    }
                }
            }
            #if os(macOS)
            .frame(minWidth: 480, idealWidth: 540, minHeight: 360, idealHeight: 480)
            #endif
        }
    }

    private var transitionAnimation: Animation? {
        reduceMotion ? nil : .easeInOut(duration: 0.20)
    }

    private func showForecast(_ visible: Bool) {
        withAnimation(transitionAnimation) {
            isShowingForecast = visible
        }
    }

    private var cityPicker: some View {
        LocationOnboardingView(
            purpose: session.location == nil ? .onboarding : .changeCity,
            search: { query in
                try await service.searchCities(query, language: Locale.current.language.languageCode?.identifier ?? "en")
            },
            resolveCurrentLocation: { try await deviceLocation.currentLocation() },
            title: { $0.name },
            subtitle: { $0.subtitle },
            onSelected: { location in
                session.select(location)
                sheet = nil
                showForecast(true)
            }
        )
    }
}
