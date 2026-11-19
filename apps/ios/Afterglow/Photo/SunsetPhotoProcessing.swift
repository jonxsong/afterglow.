import CoreGraphics
import CoreTransferable
import CoreVideo
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

enum SunsetPhotoError: LocalizedError {
    case unavailable
    case unsupported
    case tooLarge
    case missingColors

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "Afterglow couldn’t open that image. Try choosing another photo."
        case .unsupported:
            return "That image format couldn’t be read. Try another sunset photo."
        case .tooLarge:
            return "This photo is too large to compare. Try a smaller image."
        case .missingColors:
            return "There weren’t enough visible colors to compare. Try a clearer view of the sky."
        }
    }
}

struct SunsetPhotoSelection: Transferable, Sendable {
    let thumbnail: CGImage

    static var transferRepresentation: some TransferRepresentation {
        // Decode while the Photos-provided file access is valid. We don't copy it
        // into our app, and the value taken forward is only a bounded thumbnail.
        FileRepresentation(importedContentType: .image, shouldAttemptToOpenInPlace: true) { received in
            let file = received.file
            return try await Task.detached(priority: .userInitiated) {
                SunsetPhotoSelection(thumbnail: try SunsetPhotoProcessing.thumbnail(from: file))
            }.value
        }
        DataRepresentation(importedContentType: .image) { data in
            try await Task.detached(priority: .userInitiated) {
                SunsetPhotoSelection(thumbnail: try SunsetPhotoProcessing.thumbnail(from: data))
            }.value
        }
    }
}

struct ProcessedSunsetPhoto: Sendable {
    let thumbnail: CGImage
    let observedPalette: [String]
}

enum SunsetPhotoProcessing {
    private static let maximumInputBytes = 64 * 1024 * 1024
    private static let maximumInputPixels = 150_000_000
    private static let thumbnailSide = 1024
    private static let sampleSide = 384

    static func thumbnail(from file: URL) throws -> CGImage {
        if let size = try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize, size > maximumInputBytes {
            throw SunsetPhotoError.tooLarge
        }
        let options = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithURL(file as CFURL, options) else {
            throw SunsetPhotoError.unsupported
        }
        return try makeThumbnail(from: source)
    }

    static func thumbnail(from data: Data) throws -> CGImage {
        guard data.count <= maximumInputBytes else { throw SunsetPhotoError.tooLarge }
        let options = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithData(data as CFData, options) else {
            throw SunsetPhotoError.unsupported
        }
        return try makeThumbnail(from: source)
    }

    private static func makeThumbnail(from source: CGImageSource) throws -> CGImage {
        try Task.checkCancellation()
        let imageIndex = CGImageSourceGetPrimaryImageIndex(source)
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, imageIndex, nil) as NSDictionary?,
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int,
              width > 0, height > 0 else { throw SunsetPhotoError.unsupported }
        guard width <= maximumInputPixels / height else { throw SunsetPhotoError.tooLarge }

        // ImageIO uses the orientation tag for the transform. No metadata is retained
        // alongside the resulting pixels, including any EXIF GPS location.
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: thumbnailSide
        ]
        guard let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, imageIndex, options as CFDictionary) else {
            throw SunsetPhotoError.unsupported
        }
        return thumbnail
    }

    static func process(_ selection: SunsetPhotoSelection) throws -> ProcessedSunsetPhoto {
        try Task.checkCancellation()
        let source = selection.thumbnail
        let ratio = min(1, Double(sampleSide) / Double(max(source.width, source.height)))
        let width = max(1, Int((Double(source.width) * ratio).rounded()))
        let height = max(1, Int((Double(source.height) * ratio).rounded()))
        let bytesPerRow = width * 4
        let bitmapOptions = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue

        guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(
                data: nil, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: bytesPerRow, space: colorSpace, bitmapInfo: bitmapOptions
              ), let contextData = context.data else { throw SunsetPhotoError.unsupported }
        context.interpolationQuality = .high
        context.setBlendMode(.copy)
        context.draw(source, in: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))

        let pixels = contextData.bindMemory(to: UInt8.self, capacity: bytesPerRow * height)
        var rgba = Array(UnsafeBufferPointer(start: pixels, count: bytesPerRow * height))
        for offset in stride(from: 0, to: rgba.count, by: 4) {
            let alpha = Int(rgba[offset + 3])
            guard alpha > 0, alpha < 255 else { continue }
            for channel in offset...(offset + 2) {
                rgba[channel] = UInt8(min(255, (Int(rgba[channel]) * 255 + alpha / 2) / alpha))
            }
        }

        try Task.checkCancellation()
        // A missing or unusable model result is expected for open skies and some
        // devices. The shared palette extractor still compares the upper image.
        let foreground = context.makeImage().flatMap { try? foregroundMask(for: $0) }
        try Task.checkCancellation()
        let observedPalette = PhotoPaletteComparison.extractPalette(width: width, height: height, rgba: rgba, foreground: foreground)
        guard !observedPalette.isEmpty else { throw SunsetPhotoError.missingColors }
        return ProcessedSunsetPhoto(thumbnail: source, observedPalette: observedPalette)
    }

    private static func foregroundMask(for image: CGImage) throws -> [Bool]? {
        let request = VNGenerateForegroundInstanceMaskRequest()
        let handler = VNImageRequestHandler(cgImage: image, orientation: .up)
        try handler.perform([request])
        guard let result = request.results?.first, !result.allInstances.isEmpty else { return nil }
        let mask = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)

        let width = CVPixelBufferGetWidth(mask)
        let height = CVPixelBufferGetHeight(mask)
        guard width == image.width, height == image.height, !CVPixelBufferIsPlanar(mask),
              CVPixelBufferLockBaseAddress(mask, .readOnly) == kCVReturnSuccess else { return nil }
        defer { CVPixelBufferUnlockBaseAddress(mask, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(mask) else { return nil }
        let rowStride = CVPixelBufferGetBytesPerRow(mask)
        var foreground = [Bool](repeating: false, count: width * height)

        switch CVPixelBufferGetPixelFormatType(mask) {
        case kCVPixelFormatType_OneComponent32Float:
            guard rowStride >= width * MemoryLayout<Float>.stride else { return nil }
            for y in 0..<height {
                let row = base.advanced(by: y * rowStride).assumingMemoryBound(to: Float.self)
                for x in 0..<width { foreground[y * width + x] = row[x] >= 0.5 }
            }
        case kCVPixelFormatType_OneComponent8:
            guard rowStride >= width else { return nil }
            for y in 0..<height {
                let row = base.advanced(by: y * rowStride).assumingMemoryBound(to: UInt8.self)
                for x in 0..<width { foreground[y * width + x] = row[x] >= 128 }
            }
        default:
            return nil
        }
        return foreground
    }
}
