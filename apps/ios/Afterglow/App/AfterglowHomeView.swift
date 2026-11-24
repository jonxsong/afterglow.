import SwiftUI

struct AfterglowHomeView: View {
    @ObservedObject var session: ForecastSession
    let showsSky: Bool
    let onViewForecast: () -> Void
    let onChooseLocation: () -> Void
    let onPrivacy: () -> Void

    private var location: ForecastLocation? { session.location }

    private var tonight: ForecastDay? {
        let forecast = session.forecast
        guard let forecast, let day = forecast.tonight,
              ForecastCalendar.isToday(day, in: forecast.location.timeZone, now: .now)
        else { return nil }
        return day
    }

    var body: some View {
        let day = tonight

        GeometryReader { viewport in
            ScrollView {
                VStack(spacing: 0) {
                    welcome

                    Spacer(minLength: 116)

                    VStack(spacing: 14) {
                        if let location {
                            forecastPreview(for: location, day: day)
                        }
                        actions
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 36)
                .padding(.bottom, 12)
                .frame(maxWidth: 488)
                .frame(minHeight: viewport.size.height)
                .frame(maxWidth: .infinity)
            }
        }
        .background { background(palette: day?.palette ?? []) }
        .preferredColorScheme(.dark)
    }

    private func background(palette: [String]) -> some View {
        GeometryReader { viewport in
            ZStack(alignment: .top) {
                SkyTheme.dusk

                if showsSky {
                    HomeSky(palette: palette)
                        .frame(height: viewport.size.height * 0.82)
                }

                LinearGradient(
                    stops: [
                        .init(color: SkyTheme.dusk.opacity(0.60), location: 0),
                        .init(color: SkyTheme.dusk.opacity(0.34), location: 0.26),
                        .init(color: .clear, location: 0.5),
                        .init(color: .clear, location: 0.64),
                        .init(color: SkyTheme.dusk, location: 0.82),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
        .allowsHitTesting(false)
    }

    private var welcome: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Image("BrandMark")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 32, height: 32)
                    .accessibilityHidden(true)

                Text(verbatim: "afterglow.")
                    .font(.system(.title3, design: .serif))
                    .accessibilityLabel("Afterglow")
            }

            Text("View the golden hour")
                .font(.system(.largeTitle, design: .serif).weight(.medium))
                .accessibilityAddTraits(.isHeader)

            if location == nil {
                Text("Pick a place to see tonight’s sunset colors and when to watch.")
                    .font(.body)
                    .foregroundStyle(.white.opacity(0.88))
                    .frame(maxWidth: 300)
            }
        }
        .multilineTextAlignment(.center)
        .foregroundStyle(Color(red: 1, green: 0.97, blue: 0.92))
    }

    private func forecastPreview(for location: ForecastLocation, day: ForecastDay?) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(location.name, systemImage: "location")
                .font(.subheadline.weight(.semibold))
                .accessibilityIdentifier("home.city")

            if let day {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Tonight’s best viewing window")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(day.bestWindowDisplay)
                        .font(.system(.title2, design: .serif))
                        .accessibilityIdentifier("home.viewingWindow")
                }

                if session.isShowingSavedForecast || session.forecast?.freshness?.source == .cache {
                    Text("Saved forecast")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                ForecastSourceCredit(source: session.forecast?.weatherSource)
                    .tint(SkyTheme.peach)
            } else if session.isLoading {
                ProgressView("Reading the evening sky…")
                    .font(.subheadline)
            } else {
                Text("Forecast preview unavailable")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SkyTheme.dusk.opacity(0.84), in: .rect(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .strokeBorder(.white.opacity(0.18), lineWidth: 1)
                .allowsHitTesting(false)
        }
    }

    private var actions: some View {
        let hasLocation = location != nil
        let primaryTitle: LocalizedStringKey = hasLocation ? "View forecast" : "Choose a location"

        return VStack(spacing: 4) {
            Button(action: hasLocation ? onViewForecast : onChooseLocation) {
                Text(primaryTitle)
                    .font(.headline)
                    .foregroundStyle(SkyTheme.dusk)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .tint(SkyTheme.peach)
            .accessibilityIdentifier(hasLocation ? "home.forecast" : "home.location")

            HStack(spacing: 24) {
                if hasLocation {
                    Button(action: onChooseLocation) {
                        Text("Change location")
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .accessibilityIdentifier("home.location")
                }

                Button(action: onPrivacy) {
                    Text("Privacy")
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .accessibilityIdentifier("home.privacy")
            }
            .buttonStyle(.plain)
            .font(.footnote)
            .foregroundStyle(.white.opacity(0.84))
        }
    }
}

struct ForecastSourceCredit: View {
    let source: String?

    private var credit: LocalizedStringKey {
        switch source {
        case "open-meteo":
            "Weather data from [Open-Meteo](https://open-meteo.com/) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)), adapted by Afterglow."
        case "7timer":
            "Weather data from [7Timer (NOAA GFS)](https://www.7timer.info/), adapted by Afterglow."
        default:
            "Afterglow adapts weather data from [Open-Meteo](https://open-meteo.com/) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) or [7Timer (NOAA GFS)](https://www.7timer.info/)."
        }
    }

    var body: some View {
        Text(credit)
            .font(.footnote)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}
