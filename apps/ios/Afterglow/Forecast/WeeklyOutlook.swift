import SwiftUI

struct WeeklyOutlook: View {
    let forecast: WeeklyForecast
    let selectedID: ForecastDay.ID?
    let selectDay: (ForecastDay) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            Text("The week ahead")
                .font(.system(.title2, design: .serif))
                .accessibilityAddTraits(.isHeader)

            ForEach(forecast.days) { day in
                Button {
                    selectDay(day)
                } label: {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(ForecastTime.calendarDay(day.sunsetAt, in: forecast.location.timeZone))
                                .font(.subheadline.weight(.medium))
                            Text(day.sunsetDisplay)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        ForecastPaletteStrip(palette: day.palette)
                            .frame(maxWidth: 85)
                            .accessibilityHidden(true)
                        Image(systemName: selectedID == day.id ? "checkmark.circle.fill" : "chevron.right")
                            .font(.caption.weight(.semibold))
                            .frame(width: 18)
                            .foregroundStyle(.secondary)
                            .accessibilityHidden(true)
                    }
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selectedID == day.id ? .isSelected : [])
                Divider()
            }
        }
    }
}
