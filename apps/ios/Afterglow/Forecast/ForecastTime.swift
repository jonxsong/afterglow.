import Foundation

enum ForecastTime {
    static func clock(_ date: Date, in zone: TimeZone) -> String {
        format(date, using: .dateTime.hour().minute(), in: zone)
    }

    static func weekday(_ date: Date, in zone: TimeZone) -> String {
        format(date, using: .dateTime.weekday(.wide), in: zone)
    }

    static func calendarDay(_ date: Date, in zone: TimeZone) -> String {
        format(date, using: .dateTime.weekday(.wide).month(.abbreviated).day(), in: zone)
    }

    private static func format(_ date: Date, using style: Date.FormatStyle, in zone: TimeZone) -> String {
        var localStyle = style
        localStyle.timeZone = zone
        return date.formatted(localStyle)
    }
}
