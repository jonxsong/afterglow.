import SwiftUI

struct SunsetTimeline: View {
    let day: ForecastDay
    let timeZone: TimeZone
    @State private var offset = 0.0

    private var localTime: String {
        let date = day.sunsetAt.addingTimeInterval(offset * 60)
        return ForecastTime.clock(date, in: timeZone)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SunsetScene(palette: day.palette, minutesFromSunset: offset)
            HStack(alignment: .firstTextBaseline) {
                Text("Explore the evening")
                    .font(.subheadline.weight(.medium))
                Spacer()
                Text(localTime)
                    .font(.title3.monospacedDigit())
            }
            Slider(value: $offset, in: -55...50, step: 5) {
                Text("Time around sunset")
            }
            .tint(SkyTheme.rose)
            .accessibilityValue(Text(localTime))
            HStack {
                Text("Golden hour")
                Spacer()
                Button("Sunset") { offset = 0 }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Reset to sunset")
                Spacer()
                Text("Twilight")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }
}
