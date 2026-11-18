import SwiftUI

enum SkyTheme {
    static let dusk = Color(red: 0.20, green: 0.14, blue: 0.23)
    static let rose = Color(red: 0.63, green: 0.33, blue: 0.48)
    static let peach = Color(red: 1, green: 0.82, blue: 0.68)

    static func color(_ hex: String) -> Color? {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard cleaned.count == 6, let value = UInt32(cleaned, radix: 16) else { return nil }
        return Color(
            red: Double((value >> 16) & 255) / 255,
            green: Double((value >> 8) & 255) / 255,
            blue: Double(value & 255) / 255
        )
    }

    static func background(for scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.10, green: 0.08, blue: 0.12) : Color(red: 0.99, green: 0.97, blue: 0.94)
    }
}

struct ForecastPaletteStrip: View {
    let palette: [String]

    var body: some View {
        let colors = palette.compactMap(SkyTheme.color)
        HStack(spacing: 0) {
            ForEach(colors.indices, id: \.self) { index in
                Rectangle().fill(colors[index])
            }
        }
        .frame(height: 10)
        .clipShape(.capsule)
        .accessibilityLabel("Predicted sunset palette")
    }
}
