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

    var body: some View {
        Group {
            if isShowingOpening {
                OpeningSequenceView {
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.20)) {
                        isShowingOpening = false
                    }
                }
                .transition(.opacity)
            } else if session.location == nil {
                cityPicker(asSheet: false)
                    .safeAreaInset(edge: .bottom, spacing: 0) {
                        Button("Privacy") { sheet = .privacy }
                            .font(.footnote)
                            .padding(.vertical, 10)
                    }
                    .transition(.opacity)
            } else {
                ForecastView(
                    session: session,
                    onChangeCity: { sheet = .location },
                    onPrivacy: { sheet = .privacy }
                )
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
                if asSheet { sheet = nil }
            }
        )
    }
}
