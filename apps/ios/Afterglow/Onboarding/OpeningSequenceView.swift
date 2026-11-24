import Foundation
import SwiftUI

/// The sunrise-to-sunset animation shown before the app’s main content.
struct OpeningSequenceView: View {
    var onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var startedAt = Date()
    @State private var isHoldingLogo = false
    @State private var finished = false

    private let animationDuration = 2.6
    private let logoHoldDuration = 0.6

    var body: some View {
        ZStack(alignment: .topTrailing) {
            GeometryReader { proxy in
                let isStatic = reduceMotion || isHoldingLogo
                TimelineView(.animation(minimumInterval: 1.0 / 60, paused: isStatic || finished)) { timeline in
                    let elapsed = timeline.date.timeIntervalSince(startedAt)
                    let progress = isStatic ? 1 : min(1, max(0, elapsed / animationDuration))
                    scene(size: proxy.size, progress: progress)
                }
            }
            .ignoresSafeArea()
            .accessibilityHidden(true)

            Button("Skip", action: finish)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.primary)
                .padding(.horizontal, 16)
                .frame(minHeight: 44)
                .background(.regularMaterial, in: Capsule())
                .padding(.trailing, 20)
                .padding(.top, 8)
                .accessibilityHint("Continues to Afterglow")
                .accessibilityIdentifier("opening.skip")
        }
        .task {
            startedAt = Date()
            do {
                if reduceMotion {
                    try await Task.sleep(for: .seconds(0.2))
                } else {
                    try await Task.sleep(for: .seconds(animationDuration))
                    isHoldingLogo = true
                    try await Task.sleep(for: .seconds(logoHoldDuration))
                }
                #if DEBUG
                // Keep Skip available while XCTest waits for the launch window.
                if ProcessInfo.processInfo.arguments.contains("--ui-test-hold-opening") {
                    return
                }
                #endif
                finish()
            } catch is CancellationError {
                // The user already skipped, or this view left the hierarchy.
            } catch {
                finish()
            }
        }
    }

    private func scene(size: CGSize, progress: Double) -> some View {
        let resolve = introEase(progress, from: 0.63, to: 0.90)
        let markOpacity = introEase(progress, from: 0.82, to: 0.94)
        let wordmarkOpacity = introEase(progress, from: 0.77, to: 0.95)
        let markSize = min(size.width * 0.24, 108)
        let markCenter = CGPoint(x: size.width / 2, y: size.height * 0.44)

        return ZStack {
            Rectangle()
                .fill(colorScheme == .dark
                    ? IntroColor(0x211C27).color
                    : IntroColor(0xF8F6F2).color)

            OpeningSky(dayProgress: min(1, progress / 0.69), resolve: resolve)
                .frame(
                    width: introMix(size.width, markSize, resolve),
                    height: introMix(size.height, markSize, resolve)
                )
                .clipShape(RoundedRectangle(cornerRadius: markSize * 0.28 * resolve, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: markSize * 0.28 * resolve, style: .continuous)
                        .strokeBorder(IntroColor(0x302B2D).color.opacity(resolve), lineWidth: 2)
                }
                .opacity(1 - markOpacity)
                .position(
                    x: markCenter.x,
                    y: introMix(size.height / 2, markCenter.y, resolve)
                )

            Image("BrandMark")
                .resizable()
                .scaledToFit()
                .frame(width: markSize, height: markSize)
                .opacity(markOpacity)
                .position(markCenter)

            HStack(alignment: .firstTextBaseline, spacing: 0) {
                Text(verbatim: "afterglow")
                Text(verbatim: ".")
                    .foregroundStyle(IntroColor(0xB87079).color)
            }
            .font(.system(.largeTitle, design: .serif).weight(.semibold))
            .opacity(wordmarkOpacity)
            .position(x: markCenter.x, y: markCenter.y + markSize / 2 + 35)
        }
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        onFinish()
    }
}

struct HomeSky: View {
    let palette: [String]

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var startedAt: Date?
    @State private var isSettled = false

    private let duration = 1.3

    var body: some View {
        // The forecast stores its warmest colors first, nearest the horizon.
        let skyColors = Array(palette.compactMap(IntroColor.init(hex:)).reversed())
        let isStatic = reduceMotion || isSettled

        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: isStatic)) { timeline in
            let elapsed = startedAt.map { timeline.date.timeIntervalSince($0) } ?? 0
            let progress = isStatic ? 1 : introMix(0.90, 1, introEase(elapsed, from: 0, to: duration))
            OpeningSky(dayProgress: progress, resolve: 0, sunsetPalette: skyColors)
        }
        .accessibilityHidden(true)
        .allowsHitTesting(false)
        .task {
            isSettled = reduceMotion
            guard !isSettled else { return }

            startedAt = .now
            do {
                try await Task.sleep(for: .seconds(duration))
                isSettled = true
            } catch is CancellationError {
                // The artwork is no longer visible.
            } catch {
                isSettled = true
            }
        }
    }
}

private struct OpeningSky: View {
    let dayProgress: Double
    let resolve: Double
    var sunsetPalette: [IntroColor] = []

    private let dawn = IntroSky(zenith: 0x8E92BC, middle: 0xD9ACC0, horizon: 0xFFD2A0)
    private let daylight = IntroSky(zenith: 0x7CAACF, middle: 0xBED9E7, horizon: 0xFBE4C2)
    private let sunset = IntroSky(zenith: 0x766FA7, middle: 0xD58CA6, horizon: 0xF2B28D)

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let skyColors = dayProgress < 0.5
                ? dawn.mixed(with: daylight, amount: dayProgress * 2).colors
                : sunsetColors(amount: (dayProgress - 0.5) * 2)
            let sunX = introMix(0.18 + 0.61 * dayProgress, 0.5, resolve)
            let sunY = introMix(0.73 - sin(dayProgress * .pi) * 0.51, 0.62, resolve)
            let sunDiameter = min(size.width, size.height) * introMix(0.21, 0.30, resolve)

            ZStack {
                LinearGradient(colors: skyColors, startPoint: .top, endPoint: .bottom)

                Circle()
                    .fill(IntroColor(0xFCE1B9).color)
                    .frame(width: sunDiameter, height: sunDiameter)
                    .shadow(color: IntroColor(0xFFD293).color.opacity(0.55 * (1 - resolve)), radius: sunDiameter * 0.46)
                    .position(x: size.width * sunX, y: size.height * sunY)

                Path { path in
                    path.move(to: CGPoint(x: 0, y: size.height * 0.79))
                    path.addCurve(
                        to: CGPoint(x: size.width, y: size.height * 0.71),
                        control1: CGPoint(x: size.width * 0.34, y: size.height * 0.65),
                        control2: CGPoint(x: size.width * 0.62, y: size.height * 0.89)
                    )
                    path.addLine(to: CGPoint(x: size.width, y: size.height))
                    path.addLine(to: CGPoint(x: 0, y: size.height))
                    path.closeSubpath()
                }
                .fill(IntroColor(0x302B2D).color)

                Path { path in
                    path.move(to: CGPoint(x: size.width * 0.08, y: size.height * 0.75))
                    path.addCurve(
                        to: CGPoint(x: size.width * 0.92, y: size.height * 0.73),
                        control1: CGPoint(x: size.width * 0.41, y: size.height * 0.66),
                        control2: CGPoint(x: size.width * 0.63, y: size.height * 0.82)
                    )
                }
                .stroke(IntroColor(0xFFF8F0).color.opacity(0.65 * resolve), style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
            }
        }
    }

    private func sunsetColors(amount: Double) -> [Color] {
        guard sunsetPalette.count >= 3 else {
            return daylight.mixed(with: sunset, amount: amount).colors
        }

        return sunsetPalette.enumerated().map { index, color in
            let position = Double(index) / Double(sunsetPalette.count - 1)
            return daylight.color(at: position).mixed(with: color, amount: amount).color
        }
    }
}

private struct IntroSky {
    let zenith: IntroColor
    let middle: IntroColor
    let horizon: IntroColor

    init(zenith: UInt32, middle: UInt32, horizon: UInt32) {
        self.init(zenith: IntroColor(zenith), middle: IntroColor(middle), horizon: IntroColor(horizon))
    }

    private init(zenith: IntroColor, middle: IntroColor, horizon: IntroColor) {
        self.zenith = zenith
        self.middle = middle
        self.horizon = horizon
    }

    var colors: [Color] { [zenith.color, middle.color, horizon.color] }

    func color(at position: Double) -> IntroColor {
        position < 0.5
            ? zenith.mixed(with: middle, amount: position * 2)
            : middle.mixed(with: horizon, amount: (position - 0.5) * 2)
    }

    func mixed(with other: IntroSky, amount: Double) -> IntroSky {
        IntroSky(
            zenith: zenith.mixed(with: other.zenith, amount: amount),
            middle: middle.mixed(with: other.middle, amount: amount),
            horizon: horizon.mixed(with: other.horizon, amount: amount)
        )
    }
}

private struct IntroColor {
    let red: Double
    let green: Double
    let blue: Double

    init(_ hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 255) / 255,
            green: Double((hex >> 8) & 255) / 255,
            blue: Double(hex & 255) / 255
        )
    }

    init?(hex: String) {
        let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard digits.count == 6, digits.allSatisfy(\.isHexDigit),
              let value = UInt32(digits, radix: 16) else { return nil }
        self.init(value)
    }

    private init(red: Double, green: Double, blue: Double) {
        self.red = red
        self.green = green
        self.blue = blue
    }

    var color: Color { Color(red: red, green: green, blue: blue) }

    func mixed(with other: IntroColor, amount: Double) -> IntroColor {
        IntroColor(
            red: introMix(red, other.red, amount),
            green: introMix(green, other.green, amount),
            blue: introMix(blue, other.blue, amount)
        )
    }
}

private func introMix(_ start: Double, _ end: Double, _ amount: Double) -> Double {
    start + (end - start) * amount
}

private func introEase(_ value: Double, from lower: Double, to upper: Double) -> Double {
    let t = min(1, max(0, (value - lower) / (upper - lower)))
    return t * t * (3 - 2 * t)
}
