import Foundation

struct PhotoPaletteMatch: Equatable, Sendable {
    let predictedPalette: [String]
    let observedPalette: [String]
    let meanDeltaE: Double
    let similarity: Double
}

enum PhotoPaletteComparison {
    private struct RGB {
        let red: Int
        let green: Int
        let blue: Int

        init(red: Int, green: Int, blue: Int) {
            self.red = red
            self.green = green
            self.blue = blue
        }

        init?(hex: String) {
            guard hex.first == "#" else { return nil }
            let digits = hex.dropFirst()
            guard digits.utf8.count == 6, digits.utf8.allSatisfy({ byte in
                (48...57).contains(byte) || (65...70).contains(byte) || (97...102).contains(byte)
            }), let value = Int(digits, radix: 16) else { return nil }
            self.init(red: (value >> 16) & 255, green: (value >> 8) & 255, blue: value & 255)
        }

        var hex: String {
            String(format: "#%02X%02X%02X", red, green, blue)
        }

        var lab: Lab {
            func linearize(_ value: Int) -> Double {
                let channel = Double(value) / 255
                return channel <= 0.04045 ? channel / 12.92 : pow((channel + 0.055) / 1.055, 2.4)
            }

            func transform(_ component: Double) -> Double {
                component > 0.008856 ? pow(component, 1.0 / 3.0) : 7.787 * component + 16.0 / 116.0
            }

            let r = linearize(red)
            let g = linearize(green)
            let b = linearize(blue)
            let x = transform((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047)
            let y = transform(r * 0.2126 + g * 0.7152 + b * 0.0722)
            let z = transform((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883)
            return Lab(lightness: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z))
        }
    }

    private struct Lab {
        let lightness: Double
        let a: Double
        let b: Double

        func distance(to other: Self) -> Double {
            let lDifference = lightness - other.lightness
            let aDifference = a - other.a
            let bDifference = b - other.b
            return sqrt(lDifference * lDifference + aDifference * aDifference + bDifference * bDifference)
        }
    }

    private struct ColorBucket {
        var count = 0
        var red = 0
        var green = 0
        var blue = 0

        mutating func add(_ color: RGB) {
            count += 1
            red += color.red
            green += color.green
            blue += color.blue
        }

        var average: RGB {
            RGB(red: (red + count / 2) / count, green: (green + count / 2) / count, blue: (blue + count / 2) / count)
        }
    }

    /// Samples the upper 80% of a top-to-bottom, straight-alpha RGBA bitmap.
    static func extractPalette(width: Int, height: Int, rgba: [UInt8], foreground: [Bool]? = nil) -> [String] {
        let (pixelCount, overflow) = width.multipliedReportingOverflow(by: height)
        guard width > 0, height > 0, !overflow, pixelCount <= Int.max / 256, rgba.count == pixelCount * 4 else {
            return []
        }
        let skyPixelCount = width * max(1, height * 4 / 5)
        let mask = foreground?.count == pixelCount ? foreground : nil

        var all = [Int: ColorBucket]()
        var background = [Int: ColorBucket]()
        var visibleCount = 0
        var backgroundCount = 0

        for pixel in 0..<skyPixelCount {
            let offset = pixel * 4
            guard rgba[offset + 3] >= 128 else { continue }
            let color = RGB(red: Int(rgba[offset]), green: Int(rgba[offset + 1]), blue: Int(rgba[offset + 2]))
            let key = (color.red >> 5) << 6 | (color.green >> 5) << 3 | (color.blue >> 5)
            all[key, default: ColorBucket()].add(color)
            visibleCount += 1
            if let mask, !mask[pixel] {
                background[key, default: ColorBucket()].add(color)
                backgroundCount += 1
            }
        }

        // The mask detects foreground subjects rather than the sky itself. Retain the
        // upper-image crop when the mask leaves too little evidence to be useful.
        let buckets = backgroundCount > 0 && backgroundCount * 3 >= visibleCount ? background : all
        return buckets.sorted { left, right in
            if left.value.count == right.value.count { return left.key < right.key }
            return left.value.count > right.value.count
        }.prefix(5).map { $0.value.average.hex }
    }

    /// Matches the repository's nearest-palette CIE76 measure and score mapping.
    static func compare(predictedPalette: [String], observedPalette: [String]) -> PhotoPaletteMatch? {
        let expected = predictedPalette.compactMap(RGB.init(hex:))
        let actual = observedPalette.compactMap(RGB.init(hex:))
        guard !expected.isEmpty, !actual.isEmpty, expected.count == predictedPalette.count, actual.count == observedPalette.count else {
            return nil
        }

        let observedLab = actual.map(\.lab)
        let totalDeltaE = expected.map(\.lab).reduce(0.0) { total, color in
            total + (observedLab.map { color.distance(to: $0) }.min() ?? 0)
        }
        let mean = totalDeltaE / Double(expected.count)
        return PhotoPaletteMatch(
            predictedPalette: expected.map(\.hex),
            observedPalette: actual.map(\.hex),
            meanDeltaE: (mean * 100).rounded() / 100,
            similarity: (max(0, min(100, 100 - mean * 2.2)) * 10).rounded() / 10
        )
    }
}
