#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from typing import Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "store-assets"
SCREENSHOTS_DIR = OUT_DIR / "screenshots"
PROMO_DIR = OUT_DIR / "promotional"
ICON_PATH = ROOT / "icons" / "icon-128.png"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def vertical_gradient(size: Tuple[int, int], top: Tuple[int, int, int], bottom: Tuple[int, int, int]) -> Image.Image:
    width, height = size
    img = Image.new("RGBA", size)
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / max(height - 1, 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))
    return img


def rounded_rect_mask(size: Tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def shadowed_card(
    canvas: Image.Image,
    bounds: Tuple[int, int, int, int],
    radius: int,
    fill: Tuple[int, int, int, int],
    shadow_alpha: int = 90,
    shadow_blur: int = 18,
) -> None:
    x1, y1, x2, y2 = bounds
    w = x2 - x1
    h = y2 - y1

    shadow = Image.new("RGBA", (w + shadow_blur * 2, h + shadow_blur * 2), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle((shadow_blur, shadow_blur, shadow_blur + w, shadow_blur + h), radius=radius, fill=(0, 0, 0, shadow_alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=shadow_blur // 2))
    canvas.alpha_composite(shadow, (x1 - shadow_blur, y1 - shadow_blur + 6))

    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(card)
    cdraw.rounded_rectangle((0, 0, w, h), radius=radius, fill=fill)
    canvas.alpha_composite(card, (x1, y1))


def draw_header(draw: ImageDraw.ImageDraw, width: int, title: str, subtitle: str) -> None:
    draw.text((44, 32), title, fill=(244, 248, 255, 255), font=font(44, bold=True))
    draw.text((46, 88), subtitle, fill=(204, 222, 245, 255), font=font(24))
    draw.rounded_rectangle((width - 330, 28, width - 42, 90), radius=20, fill=(18, 69, 145, 200))
    draw.text((width - 312, 49), "PII Prompt Shield", fill=(230, 240, 255, 255), font=font(24, bold=True))


def draw_browser_frame(canvas: Image.Image, draw: ImageDraw.ImageDraw, bounds: Tuple[int, int, int, int]) -> None:
    shadowed_card(canvas, bounds, radius=24, fill=(246, 249, 255, 255), shadow_alpha=70, shadow_blur=16)
    x1, y1, x2, y2 = bounds
    draw.rounded_rectangle((x1, y1, x2, y1 + 58), radius=24, fill=(233, 239, 250, 255))
    draw.rectangle((x1, y1 + 30, x2, y1 + 58), fill=(233, 239, 250, 255))
    draw.ellipse((x1 + 20, y1 + 19, x1 + 32, y1 + 31), fill=(236, 98, 88, 255))
    draw.ellipse((x1 + 40, y1 + 19, x1 + 52, y1 + 31), fill=(243, 188, 64, 255))
    draw.ellipse((x1 + 60, y1 + 19, x1 + 72, y1 + 31), fill=(91, 201, 116, 255))
    draw.rounded_rectangle((x1 + 120, y1 + 14, x2 - 32, y1 + 44), radius=12, fill=(255, 255, 255, 240), outline=(206, 216, 234, 255))
    draw.text((x1 + 138, y1 + 20), "https://chatgpt.com", fill=(111, 128, 154, 255), font=font(16))


def draw_chat_ui(draw: ImageDraw.ImageDraw, bounds: Tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = bounds
    body_top = y1 + 72
    draw.rounded_rectangle((x1 + 30, body_top + 30, x1 + 560, body_top + 110), radius=16, fill=(234, 241, 255, 255))
    draw.text((x1 + 54, body_top + 54), "Can you summarize this customer ticket?", fill=(46, 66, 99, 255), font=font(20))

    draw.rounded_rectangle((x2 - 610, body_top + 140, x2 - 30, body_top + 256), radius=16, fill=(220, 240, 229, 255))
    draw.text((x2 - 588, body_top + 164), "Sure. Share the text and I will help.", fill=(28, 74, 48, 255), font=font(20))

    draw.rounded_rectangle((x1 + 30, y2 - 118, x2 - 30, y2 - 30), radius=16, fill=(255, 255, 255, 255), outline=(206, 216, 235, 255))
    draw.text((x1 + 52, y2 - 90), "My name is Max Mustermann, email max@example.com", fill=(65, 80, 106, 255), font=font(19))


def draw_modal_block(canvas: Image.Image, draw: ImageDraw.ImageDraw, bounds: Tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = bounds
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle((x1, y1 + 58, x2, y2), fill=(7, 15, 28, 138))
    canvas.alpha_composite(overlay)

    modal = (x1 + 192, y1 + 144, x2 - 192, y2 - 110)
    shadowed_card(canvas, modal, radius=18, fill=(15, 23, 37, 250), shadow_alpha=140, shadow_blur=24)
    mx1, my1, mx2, my2 = modal
    draw.text((mx1 + 28, my1 + 24), "Potential private information detected", fill=(242, 247, 255, 255), font=font(28, bold=True))
    draw.text((mx1 + 28, my1 + 74), "Review before sending", fill=(169, 190, 219, 255), font=font(20))
    draw.rounded_rectangle((mx1 + 28, my1 + 108, mx2 - 28, my1 + 218), radius=12, fill=(20, 31, 49, 255), outline=(60, 82, 112, 255))
    draw.text((mx1 + 44, my1 + 132), "Name: Max Mustermann", fill=(214, 227, 245, 255), font=font(20))
    draw.text((mx1 + 44, my1 + 164), "Email: max@example.com", fill=(214, 227, 245, 255), font=font(20))
    draw.text((mx1 + 44, my1 + 196), "Score 5 (threshold 3)", fill=(122, 210, 166, 255), font=font(18, bold=True))

    buttons = [
        ("Cancel", (mx1 + 24, my2 - 78, mx1 + 134, my2 - 26), (36, 52, 76, 255)),
        ("Redact Selected", (mx1 + 144, my2 - 78, mx1 + 314, my2 - 26), (40, 65, 102, 255)),
        ("Trust This Site", (mx1 + 324, my2 - 78, mx1 + 484, my2 - 26), (40, 65, 102, 255)),
        ("Send Anyway Once", (mx1 + 494, my2 - 78, mx2 - 24, my2 - 26), (103, 39, 39, 255)),
    ]
    for label, b, color in buttons:
        draw.rounded_rectangle(b, radius=10, fill=color, outline=(114, 136, 168, 255))
        text_box = draw.textbbox((0, 0), label, font=font(16, bold=True))
        text_width = text_box[2] - text_box[0]
        text_height = text_box[3] - text_box[1]
        tx = b[0] + ((b[2] - b[0]) - text_width) // 2
        ty = b[1] + ((b[3] - b[1]) - text_height) // 2 - 1
        draw.text((tx, ty), label, fill=(238, 246, 255, 255), font=font(16, bold=True))


def screenshot_block_review(path: Path) -> None:
    canvas = vertical_gradient((1280, 800), (12, 44, 96), (12, 98, 140))
    draw = ImageDraw.Draw(canvas)
    draw_header(draw, 1280, "Protect prompts before they leave your browser", "Block + review catches PII before submit.")
    frame = (92, 136, 1188, 748)
    draw_browser_frame(canvas, draw, frame)
    draw_chat_ui(draw, frame)
    draw_modal_block(canvas, draw, frame)
    canvas.save(path)


def screenshot_redaction(path: Path) -> None:
    canvas = vertical_gradient((1280, 800), (15, 53, 103), (14, 112, 151))
    draw = ImageDraw.Draw(canvas)
    draw_header(draw, 1280, "One-click redaction", "Replace sensitive fields before sending.")
    frame = (92, 136, 1188, 748)
    draw_browser_frame(canvas, draw, frame)
    draw_chat_ui(draw, frame)

    x1, y1, x2, y2 = frame
    draw.rounded_rectangle((x1 + 30, y2 - 118, x2 - 30, y2 - 30), radius=16, fill=(255, 255, 255, 255), outline=(177, 220, 193, 255), width=3)
    draw.text((x1 + 52, y2 - 90), "My name is [REDACTED_NAME], email [REDACTED_EMAIL]", fill=(36, 76, 56, 255), font=font(19))
    draw.rounded_rectangle((x2 - 320, y2 - 168, x2 - 40, y2 - 126), radius=10, fill=(34, 122, 76, 255))
    draw.text((x2 - 302, y2 - 157), "Prompt redacted successfully", fill=(236, 248, 241, 255), font=font(16, bold=True))
    canvas.save(path)


def screenshot_settings(path: Path) -> None:
    canvas = vertical_gradient((1280, 800), (15, 56, 101), (15, 104, 142))
    draw = ImageDraw.Draw(canvas)
    draw_header(draw, 1280, "Tune privacy behavior per workflow", "Set sensitivity, mode, and trusted sites.")
    frame = (92, 136, 1188, 748)
    draw_browser_frame(canvas, draw, frame)
    draw_chat_ui(draw, frame)

    panel = (840, 176, 1160, 690)
    shadowed_card(canvas, panel, radius=16, fill=(245, 249, 255, 255), shadow_alpha=80, shadow_blur=14)
    px1, py1, px2, py2 = panel
    draw.text((px1 + 22, py1 + 20), "PII Prompt Shield", fill=(24, 47, 88, 255), font=font(24, bold=True))
    draw.text((px1 + 22, py1 + 62), "Enabled", fill=(56, 76, 112, 255), font=font(18, bold=True))
    draw.rounded_rectangle((px2 - 90, py1 + 54, px2 - 24, py1 + 84), radius=14, fill=(31, 127, 89, 255))
    draw.ellipse((px2 - 60, py1 + 58, px2 - 30, py1 + 82), fill=(241, 249, 255, 255))

    rows = [
        ("Behavior", "Block + Review"),
        ("Detection", "Balanced"),
    ]
    y = py1 + 112
    for label, value in rows:
        draw.text((px1 + 22, y), label, fill=(53, 72, 107, 255), font=font(17, bold=True))
        draw.rounded_rectangle((px1 + 22, y + 24, px2 - 22, y + 62), radius=8, fill=(255, 255, 255, 255), outline=(197, 210, 232, 255))
        draw.text((px1 + 34, y + 34), value, fill=(62, 83, 119, 255), font=font(16))
        y += 84

    draw.text((px1 + 22, y + 8), "Trusted Sites", fill=(53, 72, 107, 255), font=font(17, bold=True))
    draw.rounded_rectangle((px1 + 22, y + 34, px2 - 22, y + 144), radius=8, fill=(255, 255, 255, 255), outline=(197, 210, 232, 255))
    draw.text((px1 + 34, y + 54), "chatgpt.com", fill=(62, 83, 119, 255), font=font(16))
    draw.text((px1 + 34, y + 84), "claude.ai", fill=(62, 83, 119, 255), font=font(16))
    draw.rounded_rectangle((px1 + 22, py2 - 58, px2 - 22, py2 - 22), radius=8, fill=(218, 232, 255, 255), outline=(136, 164, 209, 255))
    draw.text((px1 + 52, py2 - 47), "Trust Current Site", fill=(29, 66, 132, 255), font=font(16, bold=True))
    canvas.save(path)


def draw_brand_badge(canvas: Image.Image, draw: ImageDraw.ImageDraw, x: int, y: int, size: int) -> None:
    if ICON_PATH.exists():
        icon = Image.open(ICON_PATH).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
        canvas.alpha_composite(icon, (x, y))
        return
    draw.rounded_rectangle((x, y, x + size, y + size), radius=size // 5, fill=(30, 95, 164, 255))


def promo_small_tile(path: Path) -> None:
    canvas = vertical_gradient((440, 280), (15, 53, 108), (14, 111, 151))
    draw = ImageDraw.Draw(canvas)
    draw_brand_badge(canvas, draw, 28, 30, 74)
    draw.text((118, 34), "PII Prompt Shield", fill=(238, 245, 255, 255), font=font(34, bold=True))
    draw.text((32, 132), "Catch personal data before", fill=(219, 232, 251, 255), font=font(26))
    draw.text((32, 166), "it reaches AI assistants.", fill=(219, 232, 251, 255), font=font(26))
    draw.rounded_rectangle((30, 220, 262, 258), radius=12, fill=(35, 125, 84, 255))
    draw.text((46, 229), "Local, on-device checks", fill=(232, 248, 239, 255), font=font(17, bold=True))
    canvas.save(path)


def promo_large_tile(path: Path) -> None:
    canvas = vertical_gradient((920, 680), (12, 47, 101), (14, 104, 149))
    draw = ImageDraw.Draw(canvas)
    draw_brand_badge(canvas, draw, 50, 52, 96)
    draw.text((164, 64), "PII Prompt Shield", fill=(240, 247, 255, 255), font=font(56, bold=True))
    draw.text((54, 156), "Prevent accidental PII leaks in AI prompts.", fill=(213, 229, 249, 255), font=font(34))
    card = (52, 230, 868, 610)
    shadowed_card(canvas, card, radius=24, fill=(245, 249, 255, 255), shadow_alpha=75, shadow_blur=16)
    x1, y1, x2, _ = card
    draw.rounded_rectangle((x1, y1, x2, y1 + 54), radius=24, fill=(232, 239, 249, 255))
    draw.rectangle((x1, y1 + 28, x2, y1 + 54), fill=(232, 239, 249, 255))
    draw.text((x1 + 26, y1 + 18), "Block + Review", fill=(30, 57, 103, 255), font=font(23, bold=True))
    features = [
        "Detects names, IDs, emails, cards, and API keys",
        "English and German privacy pattern support",
        "One-click redaction before submit",
        "Trusted-site allowlist and sensitivity controls",
    ]
    y = y1 + 86
    for item in features:
        draw.ellipse((x1 + 28, y + 9, x1 + 40, y + 21), fill=(34, 126, 84, 255))
        draw.text((x1 + 52, y), item, fill=(44, 67, 104, 255), font=font(24))
        y += 62
    canvas.save(path)


def promo_marquee(path: Path) -> None:
    canvas = vertical_gradient((1400, 560), (11, 44, 94), (14, 111, 154))
    draw = ImageDraw.Draw(canvas)
    draw_brand_badge(canvas, draw, 66, 56, 116)
    draw.text((202, 70), "PII Prompt Shield", fill=(242, 248, 255, 255), font=font(68, bold=True))
    draw.text((72, 182), "Guardrails for safe AI prompting", fill=(219, 232, 250, 255), font=font(44))
    draw.text((72, 244), "Detect, review, and redact sensitive data before send.", fill=(208, 225, 247, 255), font=font(35))

    panel = (800, 92, 1332, 470)
    shadowed_card(canvas, panel, radius=22, fill=(248, 251, 255, 255), shadow_alpha=85, shadow_blur=16)
    px1, py1, px2, _ = panel
    draw.rounded_rectangle((px1, py1, px2, py1 + 52), radius=22, fill=(234, 240, 250, 255))
    draw.rectangle((px1, py1 + 28, px2, py1 + 52), fill=(234, 240, 250, 255))
    draw.text((px1 + 20, py1 + 16), "Potential private information detected", fill=(34, 58, 100, 255), font=font(24, bold=True))
    draw.rounded_rectangle((px1 + 18, py1 + 72, px2 - 18, py1 + 230), radius=12, fill=(22, 33, 51, 255))
    draw.text((px1 + 36, py1 + 98), "Name: Max Mustermann", fill=(214, 227, 247, 255), font=font(22))
    draw.text((px1 + 36, py1 + 132), "Steuer-ID: 12345678901", fill=(214, 227, 247, 255), font=font(22))
    draw.text((px1 + 36, py1 + 166), "IBAN: DE89 3704 0044 ...", fill=(214, 227, 247, 255), font=font(22))
    draw.rounded_rectangle((px1 + 18, py1 + 258, px1 + 194, py1 + 314), radius=10, fill=(38, 58, 86, 255))
    draw.rounded_rectangle((px1 + 210, py1 + 258, px1 + 434, py1 + 314), radius=10, fill=(34, 126, 84, 255))
    draw.text((px1 + 58, py1 + 276), "Cancel", fill=(233, 243, 255, 255), font=font(20, bold=True))
    draw.text((px1 + 238, py1 + 276), "Redact Selected", fill=(231, 247, 239, 255), font=font(20, bold=True))
    canvas.save(path)


def write_notes(path: Path) -> None:
    path.write_text(
        "\n".join(
            [
                "Generated store assets for Chrome Web Store listing.",
                "",
                "Screenshots (1280x800):",
                "- screenshots/01-block-review-1280x800.png",
                "- screenshots/02-redaction-1280x800.png",
                "- screenshots/03-settings-1280x800.png",
                "",
                "Promotional assets:",
                "- promotional/small-tile-440x280.png",
                "- promotional/large-tile-920x680.png",
                "- promotional/marquee-1400x560.png",
                "",
                "These are polished mockups for store listing use.",
            ]
        ),
        encoding="utf-8",
    )


def main() -> None:
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    PROMO_DIR.mkdir(parents=True, exist_ok=True)

    screenshot_block_review(SCREENSHOTS_DIR / "01-block-review-1280x800.png")
    screenshot_redaction(SCREENSHOTS_DIR / "02-redaction-1280x800.png")
    screenshot_settings(SCREENSHOTS_DIR / "03-settings-1280x800.png")

    promo_small_tile(PROMO_DIR / "small-tile-440x280.png")
    promo_large_tile(PROMO_DIR / "large-tile-920x680.png")
    promo_marquee(PROMO_DIR / "marquee-1400x560.png")

    write_notes(OUT_DIR / "README.txt")
    print(f"Generated store assets in {OUT_DIR}")


if __name__ == "__main__":
    main()
