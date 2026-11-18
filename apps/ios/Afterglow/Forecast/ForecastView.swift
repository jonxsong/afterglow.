import SwiftUI

struct ForecastView: View {
    @ObservedObject var session: ForecastSession
    let onChangeCity: () -> Void
    let onPrivacy: () -> Void
    @Environment(\.colorScheme) private var scheme
    @State private var selectedID: ForecastDay.ID?
    @State private var comparingDay: ForecastDay?

    private var forecastDay: ForecastDay? {
        session.forecast?.days.first { $0.id == selectedID } ?? session.forecast?.tonight ?? session.forecast?.days.first
    }

    var body: some View {
        ScrollViewReader { scroll in
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    masthead
                    if let forecast = session.forecast, let day = forecastDay {
                        reading(day, forecast: forecast)
                            .id("current-reading")
                        if forecast.days.count > 1 {
                            WeeklyOutlook(forecast: forecast, selectedID: day.id) { chosen in
                                selectedID = chosen.id
                                scroll.scrollTo("current-reading", anchor: .top)
                            }
                        }
                    } else {
                        unavailable
                    }
                }
                .padding(.horizontal, 22)
                .padding(.vertical, 18)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
            .refreshable { await session.refresh() }
        }
        .background(SkyTheme.background(for: scheme).ignoresSafeArea())
        .sheet(item: $comparingDay) { day in
            NavigationStack {
                ScrollView {
                    PhotoComparisonView(predictedPalette: day.palette)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                }
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { comparingDay = nil }
                    }
                }
            }
        }
        .onChange(of: session.location?.id) { _, _ in selectedID = nil }
    }

    private var masthead: some View {
        HStack(alignment: .center, spacing: 10) {
            Image("BrandMark")
                .resizable()
                .scaledToFit()
                .frame(width: 27, height: 27)
                .accessibilityHidden(true)
            Text("afterglow.")
                .font(.system(.title2, design: .serif))
                .accessibilityLabel("Afterglow")
            Spacer()
            Menu {
                Button("Change location", systemImage: "location") { onChangeCity() }
                Button("Privacy", systemImage: "hand.raised") { onPrivacy() }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title2)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Afterglow options")
        }
    }

    private func reading(_ day: ForecastDay, forecast: WeeklyForecast) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Button(action: onChangeCity) {
                    Label(session.location?.name ?? forecast.location.name, systemImage: "location")
                        .font(.subheadline.weight(.medium))
                        .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .accessibilityHint("Change location")

                Text(day.id == forecast.tonight?.id ? "Tonight’s sky" : ForecastTime.weekday(day.sunsetAt, in: forecast.location.timeZone) + "’s sky")
                    .font(.system(.largeTitle, design: .serif))
                    .accessibilityAddTraits(.isHeader)
            }

            SunsetTimeline(day: day, timeZone: forecast.location.timeZone)
                .id(day.id)

            VStack(alignment: .leading, spacing: 7) {
                Text("Best viewing window")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(day.bestWindowDisplay)
                    .font(.system(.title2, design: .serif))
                ForecastPaletteStrip(palette: day.palette)
                    .accessibilityValue(Text(day.dominantColors.joined(separator: ", ")))
                if !day.summary.isEmpty {
                    Text(day.summary)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .padding(.top, 3)
                }
                if let label = freshnessLabel(forecast) {
                    Label(label, systemImage: "clock")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Button {
                comparingDay = day
            } label: {
                Label("Compare a sunset photo", systemImage: "photo")
                    .frame(maxWidth: .infinity, minHeight: 36)
            }
            .buttonStyle(.borderedProminent)
            .tint(SkyTheme.rose)
            .accessibilityIdentifier("forecast.compare")
        }
    }

    private func freshnessLabel(_ forecast: WeeklyForecast) -> String? {
        let isSaved = session.isShowingSavedForecast || forecast.freshness?.source == .cache
        guard let updated = forecast.freshness?.fetchedAt else { return isSaved ? "Saved forecast" : nil }
        let time = ForecastTime.clock(updated, in: forecast.location.timeZone)
        return isSaved ? "Saved forecast from \(time)" : "Updated at \(time)"
    }

    @ViewBuilder
    private var unavailable: some View {
        if session.error == nil {
            ProgressView("Reading the evening sky…")
                .frame(maxWidth: .infinity, minHeight: 230)
        } else {
            ContentUnavailableView {
                Label("The sky is out of reach", systemImage: "cloud")
            } description: {
                Text(session.error ?? "The forecast couldn’t load. Please try again.")
            } actions: {
                Button("Try again") { Task { await session.refresh() } }
                    .buttonStyle(.borderedProminent)
                    .tint(SkyTheme.rose)
                Button("Change location", action: onChangeCity)
                    .buttonStyle(.borderless)
            }
        }
    }
}
