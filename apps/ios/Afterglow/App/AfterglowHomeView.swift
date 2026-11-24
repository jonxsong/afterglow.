import SwiftUI

struct AfterglowHomeView: View {
    let location: ForecastLocation?
    let forecast: WeeklyForecast?
    let onViewForecast: () -> Void
    let onChooseLocation: () -> Void
    let onPrivacy: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                welcome

                if let location {
                    forecastPreview(for: location)
                }

                actions
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 28)
            .frame(maxWidth: 488)
            .frame(maxWidth: .infinity)
        }
        .background {
            ZStack {
                SkyTheme.background(for: colorScheme)
                RadialGradient(
                    colors: [
                        colorScheme == .dark ? SkyTheme.rose.opacity(0.18) : SkyTheme.peach.opacity(0.44),
                        .clear,
                    ],
                    center: .top,
                    startRadius: 0,
                    endRadius: 400
                )
            }
            .ignoresSafeArea()
        }
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
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: 300)
            }
        }
        .multilineTextAlignment(.center)
    }

    private func forecastPreview(for location: ForecastLocation) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(location.name, systemImage: "location")
                .font(.subheadline.weight(.semibold))
                .accessibilityIdentifier("home.city")

            if let forecast, let day = forecast.tonight,
               ForecastCalendar.isToday(day, in: forecast.location.timeZone, now: .now) {
                SunsetScene(palette: day.palette, minutesFromSunset: 0, height: 152)

                VStack(alignment: .leading, spacing: 3) {
                    Text("Tonight’s best viewing window")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(day.bestWindowDisplay)
                        .font(.system(.title2, design: .serif))
                        .accessibilityIdentifier("home.viewingWindow")
                }

                ForecastSourceCredit(source: forecast.weatherSource)
            } else {
                Text("Tonight’s preview isn’t available yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: .rect(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .strokeBorder(SkyTheme.rose.opacity(0.18), lineWidth: 1)
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
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .tint(SkyTheme.rose)
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
            .foregroundStyle(.secondary)
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
