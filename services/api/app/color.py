import io
import math

from PIL import Image, ImageOps


def extract_palette(content: bytes, count: int = 5) -> list[str]:
    with Image.open(io.BytesIO(content)) as source:
        source.verify()
    with Image.open(io.BytesIO(content)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        width, height = image.size
        # Favor the upper 80%; foreground silhouettes should not dominate sky color.
        image = image.crop((0, 0, width, max(1, int(height * 0.8))))
        image.thumbnail((420, 420))
        quantized = image.quantize(colors=count, method=Image.Quantize.MEDIANCUT)
        color_counts = sorted(quantized.getcolors() or [], reverse=True)
        raw_palette = quantized.getpalette() or []
        colors = []
        for _, palette_index in color_counts[:count]:
            offset = palette_index * 3
            rgb = tuple(raw_palette[offset : offset + 3])
            colors.append("#" + "".join(f"{channel:02X}" for channel in rgb))
        if len(colors) < count:
            colors.extend([colors[-1] if colors else "#888888"] * (count - len(colors)))
        return colors


def _hex_to_lab(value: str) -> tuple[float, float, float]:
    rgb = [int(value[index : index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in rgb]
    x = (linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047
    y = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    z = (linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883

    def transform(component: float) -> float:
        return component ** (1 / 3) if component > 0.008856 else 7.787 * component + 16 / 116

    fx, fy, fz = transform(x), transform(y), transform(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def compare_palettes(forecast: list[str], observed: list[str]) -> tuple[float, float]:
    observed_lab = [_hex_to_lab(color) for color in observed]
    differences = []
    for expected in forecast:
        expected_lab = _hex_to_lab(expected)
        nearest = min(math.dist(expected_lab, actual) for actual in observed_lab)
        differences.append(nearest)
    mean_delta_e = sum(differences) / len(differences)
    accuracy = max(0.0, min(100.0, 100 - mean_delta_e * 2.2))
    return round(mean_delta_e, 2), round(accuracy, 1)
