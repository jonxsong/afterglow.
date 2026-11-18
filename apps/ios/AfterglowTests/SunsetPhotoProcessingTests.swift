import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers
import XCTest
@testable import Afterglow

final class SunsetPhotoProcessingTests: XCTestCase {
    func testDownsamplesAnImageAndReadsItsColorsLocally() throws {
        let space = try XCTUnwrap(CGColorSpace(name: CGColorSpace.sRGB))
        let context = try XCTUnwrap(CGContext(
            data: nil, width: 1_280, height: 640, bitsPerComponent: 8,
            bytesPerRow: 0, space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        ))
        context.setFillColor(red: 242.0 / 255, green: 178.0 / 255, blue: 141.0 / 255, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: 1_280, height: 640))

        let bytes = NSMutableData()
        let png = try XCTUnwrap(CGImageDestinationCreateWithData(bytes as CFMutableData, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(png, try XCTUnwrap(context.makeImage()), nil)
        XCTAssertTrue(CGImageDestinationFinalize(png))

        let thumbnail = try SunsetPhotoProcessing.thumbnail(from: bytes as Data)
        XCTAssertEqual(thumbnail.width, 1_024)
        XCTAssertEqual(thumbnail.height, 512)

        let result = try SunsetPhotoProcessing.process(SunsetPhotoSelection(thumbnail: thumbnail))
        let match = try XCTUnwrap(PhotoPaletteComparison.compare(
            predictedPalette: ["#F2B28D"], observedPalette: result.observedPalette
        ))
        XCTAssertGreaterThan(match.similarity, 98)
    }

    func testRejectsUnreadablePhotoData() {
        XCTAssertThrowsError(try SunsetPhotoProcessing.thumbnail(from: Data([0, 1, 2])))
    }
}
