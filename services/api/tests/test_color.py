import io

from PIL import Image

from services.api.app.color import compare_palettes, extract_palette


def test_extract_palette_from_valid_image() -> None:
    image = Image.new("RGB", (100, 100), "#F2B28D")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    palette = extract_palette(buffer.getvalue())
    assert len(palette) == 5
    assert palette[0].upper() == "#F2B28D"


def test_identical_palettes_have_full_accuracy() -> None:
    palette = ["#F2B28D", "#D58CA6", "#8D83BA"]
    difference, accuracy = compare_palettes(palette, palette)
    assert difference == 0
    assert accuracy == 100

