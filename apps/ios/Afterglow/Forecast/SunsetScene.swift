import SwiftUI

struct SunsetScene: View {
    let palette: [String]
    let minutesFromSunset: Double
    private let height: CGFloat

    private let fallback = ["#F2B28D", "#DE918D", "#C47898", "#9475A5", "#625681"]

    init(palette: [String], minutesFromSunset: Double, height: CGFloat? = nil) {
        self.palette = palette
        self.minutesFromSunset = minutesFromSunset
        #if os(macOS)
        self.height = height ?? 280
        #else
        self.height = height ?? 205
        #endif
    }

    var body: some View {
        let colors = palette.compactMap(SkyTheme.color)
        let sky = colors.isEmpty ? fallback.compactMap(SkyTheme.color) : colors
        let progress = min(1, max(0, (minutesFromSunset + 55) / 105))
        let twilight = min(1, max(0, minutesFromSunset / 45))
        let daylight = min(1, max(0, -minutesFromSunset / 55))

        GeometryReader { geometry in
            let size = geometry.size
            let sunX = size.width * CGFloat(0.27 + 0.29 * progress)
            // A sunset-relative path keeps the disc on the horizon at local sunset.
            let sunY = size.height * CGFloat(0.68 + minutesFromSunset * 0.009)
            let glow = sky.first ?? SkyTheme.peach

            ZStack {
                LinearGradient(colors: Array(sky.reversed()) + [glow], startPoint: .top, endPoint: .bottom)
                LinearGradient(
                    colors: [Color(red: 0.38, green: 0.59, blue: 0.77).opacity(daylight * 0.62), SkyTheme.peach.opacity(daylight * 0.2)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                LinearGradient(
                    colors: [SkyTheme.dusk.opacity(twilight * 0.90), SkyTheme.dusk.opacity(twilight * 0.35)],
                    startPoint: .top,
                    endPoint: .bottom
                )

                Circle()
                    .fill(RadialGradient(colors: [glow.opacity(0.88), glow.opacity(0)], center: .center, startRadius: 7, endRadius: 62))
                    .frame(width: 124, height: 124)
                    .position(x: sunX, y: sunY)
                    .opacity(1 - twilight * 0.55)

                Circle()
                    .fill(Color(red: 1, green: 0.92, blue: 0.72))
                    .frame(width: 28, height: 28)
                    .position(x: sunX, y: sunY)
                    .opacity(1 - twilight)

                Ridge(start: 0.78, middle: 0.68, end: 0.71)
                    .fill(Color(red: 0.45, green: 0.31, blue: 0.39))
                Ridge(start: 0.86, middle: 0.75, end: 0.83)
                    .fill(SkyTheme.dusk)
            }
        }
        .frame(height: height)
        .clipShape(.rect(cornerRadius: 24))
        .accessibilityHidden(true)
    }
}

private struct Ridge: Shape {
    let start: CGFloat
    let middle: CGFloat
    let end: CGFloat

    func path(in rect: CGRect) -> Path {
        let width = rect.width
        let height = rect.height
        var path = Path()
        path.move(to: CGPoint(x: 0, y: height * start))
        path.addQuadCurve(
            to: CGPoint(x: width * 0.54, y: height * middle),
            control: CGPoint(x: width * 0.23, y: height * (middle - 0.05))
        )
        path.addQuadCurve(
            to: CGPoint(x: width, y: height * end),
            control: CGPoint(x: width * 0.85, y: height * (end + 0.04))
        )
        path.addLine(to: CGPoint(x: width, y: height))
        path.addLine(to: CGPoint(x: 0, y: height))
        path.closeSubpath()
        return path
    }
}
