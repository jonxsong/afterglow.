import XCTest
@testable import Afterglow

final class PhotoPaletteTests: XCTestCase {
    func testExactPaletteHasPerfectColorSimilarity() throws {
        let match = try XCTUnwrap(PhotoPaletteComparison.compare(
            predictedPalette: ["#f2b28d", "#D58CA6"],
            observedPalette: ["#D58CA6", "#F2B28D"]
        ))

        XCTAssertEqual(match.meanDeltaE, 0)
        XCTAssertEqual(match.similarity, 100)
    }

    func testDistantColorsHaveLowSimilarityAndInvalidInputsAreRejected() throws {
        let match = try XCTUnwrap(PhotoPaletteComparison.compare(
            predictedPalette: ["#FFFFFF"], observedPalette: ["#000000"]
        ))

        XCTAssertEqual(match.meanDeltaE, 100, accuracy: 0.01)
        XCTAssertEqual(match.similarity, 0)
        XCTAssertNil(PhotoPaletteComparison.compare(predictedPalette: ["invalid"], observedPalette: ["#000000"]))
    }

    func testPaletteUsesTheSkyCropAndFallsBackWithAnEmptyMask() {
        let peach: [UInt8] = [242, 178, 141, 255]
        let pixels: [UInt8] = Array(repeating: peach, count: 4).flatMap { $0 } + [0, 0, 0, 255]

        XCTAssertEqual(PhotoPaletteComparison.extractPalette(width: 1, height: 5, rgba: pixels), ["#F2B28D"])
        XCTAssertEqual(PhotoPaletteComparison.extractPalette(
            width: 1, height: 5, rgba: pixels, foreground: Array(repeating: true, count: 5)
        ), ["#F2B28D"])
        XCTAssertEqual(PhotoPaletteComparison.extractPalette(width: 1, height: 1, rgba: [0, 0, 0, 0]), [])
    }

    func testUsableForegroundMaskExcludesTheMaskedColor() {
        let pixels: [UInt8] = [225, 34, 20, 255, 242, 178, 141, 255]

        XCTAssertEqual(PhotoPaletteComparison.extractPalette(
            width: 2, height: 1, rgba: pixels, foreground: [true, false]
        ), ["#F2B28D"])
    }
}
