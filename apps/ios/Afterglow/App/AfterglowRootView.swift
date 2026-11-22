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
    @State private var isShowingHome = false

    var body: some View {
        Group {
            if session.location == nil || isShowingHome {
                cityPicker(asSheet: false)
                    .safeAreaInset(edge: .bottom, spacing: 0) {
                        HStack(spacing: 20) {
                            if session.location != nil {
                                Button("Back to forecast") { showHome(false) }
                                    .accessibilityIdentifier("home.forecast")
                            }
                            Button("Privacy") { sheet = .privacy }
                        }
                        .font(.footnote)
                        .padding(.vertical, 10)
                    }
                    .transition(.opacity)
            } else {
                ForecastView(
                    session: session,
                    onHome: { showHome(true) },
                    onChangeCity: { sheet = .location },
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
                    case .location: cityPicker(asSheet: true)
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

    private func showHome(_ visible: Bool) {
        withAnimation(transitionAnimation) {
            isShowingHome = visible
        }
    }

    private func cityPicker(asSheet: Bool) -> some View {
        LocationOnboardingView(
            purpose: asSheet ? .changeCity : .onboarding,
            search: { query in
                try await service.searchCities(query, language: Locale.current.language.languageCode?.identifier ?? "en")
            },
            resolveCurrentLocation: { try await deviceLocation.currentLocation() },
            title: { $0.name },
            subtitle: { $0.subtitle },
            onSelected: { location in
                session.select(location)
                if asSheet {
                    sheet = nil
                } else {
                    showHome(false)
                }
            }
        )
    }
}
