import Foundation
import SwiftUI
#if os(macOS)
import UniformTypeIdentifiers
#else
import PhotosUI
#endif

struct PhotoComparisonView: View {
    let predictedPalette: [String]

    #if os(macOS)
    private struct Selection: Equatable, Sendable {
        let url: URL
        let id = UUID()
    }
    @State private var showingFilePicker = false
    #else
    private typealias Selection = PhotosPickerItem
    #endif

    @Environment(\.colorScheme) private var colorScheme
    @ScaledMetric(relativeTo: .body) private var swatchHeight = 20
    @State private var selection: Selection?
    @State private var photo: ProcessedSunsetPhoto?
    @State private var activeRequest: UUID?
    @State private var selectionError: SunsetPhotoError?

    private var accent: Color {
        colorScheme == .dark ? Color(red: 0.96, green: 0.65, blue: 0.64) : Color(red: 0.57, green: 0.22, blue: 0.31)
    }

    var body: some View {
        let item = selection
        ScrollView {
            comparisonCard
                .frame(maxWidth: 540)
                .padding(16)
                .frame(maxWidth: .infinity)
        }
        #if os(macOS)
        .frame(minWidth: 470, idealWidth: 590, minHeight: 380, idealHeight: 570)
        .fileImporter(isPresented: $showingFilePicker, allowedContentTypes: [.image]) { result in
            switch result {
            case let .success(url):
                selection = Selection(url: url)
            case .failure:
                selectionError = .unavailable
            }
        }
        #endif
        .task(id: item) {
            if let item { await load(item) }
        }
    }

    private var comparisonCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Compare a sunset photo")
                .font(.system(.title2, design: .serif).weight(.semibold))
                .accessibilityAddTraits(.isHeader)

            if let photo, let match = PhotoPaletteComparison.compare(
                predictedPalette: predictedPalette, observedPalette: photo.observedPalette
            ) {
                comparison(for: photo, match: match)
            } else {
                Text(predictedPalette.isEmpty
                     ? "A forecast is needed before you can compare a sunset photo."
                     : "See how the colors you captured compare with the forecast.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            photoPicker
                .buttonStyle(.borderedProminent)
                .tint(accent)
                .disabled(predictedPalette.isEmpty)
                .accessibilityIdentifier("photo.choose")

            if activeRequest != nil {
                ProgressView("Reading colors…")
                    .font(.subheadline)
                    .accessibilityIdentifier("photo.loading")
            }

            if let selectionError {
                Label(selectionError.localizedDescription, systemImage: "exclamationmark.circle")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("photo.error")
            }

            if photo != nil || activeRequest != nil {
                Button("Clear photo", role: .destructive) {
                    selection = nil
                    activeRequest = nil
                    selectionError = nil
                    photo = nil
                }
                .font(.subheadline)
                .frame(minHeight: 44)
                .accessibilityIdentifier("photo.clear")
            }

            Label("Afterglow compares photos on this device without uploading them.", systemImage: "lock")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(20)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 24))
    }

    private var photoPicker: some View {
        #if os(macOS)
        Button {
            showingFilePicker = true
        } label: {
            pickerLabel
        }
        #else
        PhotosPicker(selection: $selection, matching: .images, preferredItemEncoding: .current) {
            pickerLabel
        }
        #endif
    }

    private var pickerLabel: some View {
        Label(photo == nil ? "Choose a sunset photo" : "Choose a different photo", systemImage: "photo")
            .frame(minHeight: 44)
            .frame(maxWidth: .infinity)
    }

    private func comparison(for photo: ProcessedSunsetPhoto, match: PhotoPaletteMatch) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(decorative: photo.thumbnail, scale: 1)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity, maxHeight: 220)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .accessibilityHidden(true)

            paletteRow("Forecast", colors: match.predictedPalette)
            paletteRow("In your photo", colors: match.observedPalette)

            let percent = (match.similarity / 100).formatted(.percent.precision(.fractionLength(0...1)))
            Text("\(percent) palette similarity")
                .font(.headline)
                .foregroundStyle(accent)
                .accessibilityIdentifier("photo.similarity")
            Text("Lighting, exposure, and edits can affect how closely the colors match.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private func paletteRow(_ label: String, colors: [String]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.subheadline.weight(.semibold))
            HStack(spacing: 3) {
                ForEach(colors.indices, id: \.self) { index in
                    swatchColor(colors[index])
                        .frame(maxWidth: .infinity)
                }
            }
            .frame(height: swatchHeight)
            .clipShape(RoundedRectangle(cornerRadius: 5))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(colors.joined(separator: ", "))
    }

    private func swatchColor(_ hex: String) -> Color {
        guard let rgb = Int(hex.dropFirst(), radix: 16) else { return .secondary }
        return Color(
            red: Double((rgb >> 16) & 255) / 255,
            green: Double((rgb >> 8) & 255) / 255,
            blue: Double(rgb & 255) / 255
        )
    }

    @MainActor
    private func load(_ item: Selection) async {
        guard item == selection, !Task.isCancelled else { return }
        let request = UUID()
        activeRequest = request
        selectionError = nil
        defer {
            if activeRequest == request { activeRequest = nil }
        }

        do {
            #if os(macOS)
            let work = Task.detached(priority: .userInitiated) {
                let url = item.url
                let hasAccess = url.startAccessingSecurityScopedResource()
                defer { if hasAccess { url.stopAccessingSecurityScopedResource() } }
                let thumbnail = try SunsetPhotoProcessing.thumbnail(from: url)
                return try SunsetPhotoProcessing.process(SunsetPhotoSelection(thumbnail: thumbnail))
            }
            #else
            guard let imported = try await item.loadTransferable(type: SunsetPhotoSelection.self) else {
                throw SunsetPhotoError.unavailable
            }
            try Task.checkCancellation()

            let work = Task.detached(priority: .userInitiated) {
                try SunsetPhotoProcessing.process(imported)
            }
            #endif
            let processed = try await withTaskCancellationHandler {
                try await work.value
            } onCancel: {
                work.cancel()
            }
            try Task.checkCancellation()
            guard item == selection, activeRequest == request else { return }
            photo = processed
        } catch {
            guard !Task.isCancelled, item == selection, activeRequest == request else { return }
            selectionError = error as? SunsetPhotoError ?? .unavailable
        }
    }
}
