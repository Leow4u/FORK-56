#!/usr/bin/env python3
"""Generate the Windows NSIS wizard bitmaps from the Work4You brand mark.

electron-builder's assisted installer uses MUI2:
  - welcome/finish sidebar: 164 x 314, 24-bit BMP
  - inner-page header (right): 150 x 57, 24-bit BMP

The default fallback is NSIS's stock nsis3-metro.bmp (blue laptop +
download arrow). This script keeps that installer composition — a drawn
computer as the hero, the Work4You mark discreet in the upper-right —
on the desktop sage wash instead of metro blue.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIDEBAR = (164, 314)
HEADER = (150, 57)

# Desktop light chrome, tinted toward the mark's sage — not Windows-setup blue.
BG_TOP = (244, 247, 244)
BG_BOTTOM = (226, 234, 226)
ACCENT = (27, 67, 50)
INK = (23, 23, 26)
MUTED = (90, 103, 90)

ROOT = Path(__file__).resolve().parents[1]
ICON_PATH = ROOT / "assets" / "icon.png"
OUT_DIR = ROOT / "assets" / "nsis"
# Liberation is Arial-metric — closer to the Segoe UI the wizard actually uses.
FONT_REGULAR = Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf")
FONT_BOLD = Path("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf")

WIN_W = 498
WIN_H = 393
TITLEBAR_H = 32
HEADER_H = 57
FOOTER_H = 45
BODY_TOP = TITLEBAR_H + HEADER_H
BODY_BOTTOM = WIN_H - FOOTER_H


def _font(path: Path, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if path.is_file():
        return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def _vertical_wash(size: tuple[int, int]) -> Image.Image:
    width, height = size
    img = Image.new("RGB", size, BG_TOP)
    pixels = img.load()
    for y in range(height):
        t = y / max(height - 1, 1)
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        for x in range(width):
            pixels[x, y] = (r, g, b)
    return img


def _load_mark(width: int) -> Image.Image:
    mark = Image.open(ICON_PATH).convert("RGBA")
    # The shipped icon includes a soft drop shadow. Trim transparent padding
    # so the glyph fills the panel instead of floating in empty alpha.
    bbox = mark.getbbox()
    if bbox:
        mark = mark.crop(bbox)
    ratio = width / mark.width
    height = max(1, int(mark.height * ratio))
    return mark.resize((width, height), Image.Resampling.LANCZOS)


def _draw_laptop(size: tuple[int, int]) -> Image.Image:
    """Metro-like laptop: lid, inset screen, hinge, tapered base.

    Drawn at 4x on a transparent layer so the downscale anti-aliases the
    strokes. Coordinates are in the final 164x314 space.
    """
    scale = 4
    layer = Image.new("RGBA", (size[0] * scale, size[1] * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    stroke = (*ACCENT, 255)
    screen = (232, 238, 232, 255)
    inner = (*MUTED, 230)

    def box(x0: float, y0: float, x1: float, y1: float) -> list[float]:
        return [x0 * scale, y0 * scale, x1 * scale, y1 * scale]

    def poly(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
        return [(x * scale, y * scale) for x, y in points]

    sw = max(3, int(2.1 * scale))

    # Lid + screen. Parked in the lower half, same mass as nsis3-metro.
    draw.rounded_rectangle(box(24, 126, 140, 236), radius=5 * scale, outline=stroke, width=sw)
    draw.rounded_rectangle(box(30, 134, 134, 224), radius=3 * scale, fill=screen, outline=inner, width=max(2, scale))
    # Camera
    cx, cy, r = 82 * scale, 130 * scale, 1.3 * scale
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=stroke)
    # Hinge + deck
    draw.rounded_rectangle(box(20, 236, 144, 242), radius=2 * scale, fill=stroke)
    draw.polygon(poly([(8, 242), (156, 242), (162, 256), (2, 256)]), fill=stroke)
    # Front-edge catch-light so the base reads as a slab, not a bar.
    draw.line(poly([(16, 250), (148, 250)]), fill=(*BG_TOP, 200), width=max(2, scale))
    return layer.resize(size, Image.Resampling.LANCZOS)


def build_sidebar() -> Image.Image:
    img = _vertical_wash(SIDEBAR)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, 3, SIDEBAR[1] - 1), fill=ACCENT)

    laptop = _draw_laptop(SIDEBAR)
    img.paste(laptop, (0, 0), laptop)

    # Discreet mark — metro puts a small glyph top-right, not a hero icon.
    mark = _load_mark(22)
    img.paste(mark, (SIDEBAR[0] - mark.width - 12, 14), mark)
    return img


def build_header() -> Image.Image:
    # MUI_HEADERIMAGE_RIGHT is a 150x57 patch on an otherwise white strip.
    # Keep the fill near chrome white so it does not read as a colored sticker.
    img = Image.new("RGB", HEADER, BG_TOP)
    mark = _load_mark(36)
    x = HEADER[0] - mark.width - 8
    y = (HEADER[1] - mark.height) // 2
    img.paste(mark, (x, y), mark)
    return img


def save_bmp_and_png(img: Image.Image, stem: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rgb = img.convert("RGB")
    rgb.save(OUT_DIR / f"{stem}.bmp", format="BMP")
    # PNG sibling is for humans / PR review; NSIS only reads the BMP.
    rgb.save(OUT_DIR / f"{stem}.png", format="PNG")


def generate_assets() -> list[Path]:
    sidebar = build_sidebar()
    header = build_header()
    save_bmp_and_png(sidebar, "installer-sidebar")
    save_bmp_and_png(sidebar, "uninstaller-sidebar")
    save_bmp_and_png(header, "installer-header")
    return sorted(OUT_DIR.glob("*"))


def _window_chrome(title: str) -> Image.Image:
    """Approximate Win11 MUI wizard chrome for review mockups only."""
    canvas = Image.new("RGB", (WIN_W, WIN_H), (255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, WIN_W - 1, WIN_H - 1), outline=(200, 200, 200))
    draw.rectangle((0, 0, WIN_W - 1, TITLEBAR_H), fill=(255, 255, 255))
    draw.line((0, TITLEBAR_H, WIN_W, TITLEBAR_H), fill=(220, 220, 220))
    icon = _load_mark(16)
    canvas.paste(icon, (10, 8), icon)
    draw.text((32, 8), title, font=_font(FONT_REGULAR, 11), fill=INK)
    return canvas


def _footer(canvas: Image.Image, *, back: str | None, next_label: str, back_enabled: bool = False) -> None:
    draw = ImageDraw.Draw(canvas)
    body_f = _font(FONT_REGULAR, 11)
    draw.rectangle((0, BODY_BOTTOM, WIN_W - 1, WIN_H - 1), fill=(240, 240, 240), outline=(220, 220, 220))
    if back is not None:
        draw.rounded_rectangle(
            (300, BODY_BOTTOM + 10, 390, BODY_BOTTOM + 34),
            3,
            fill=(240, 240, 240),
            outline=(180, 180, 180),
        )
        box = draw.textbbox((0, 0), back, font=body_f)
        label_w = box[2] - box[0]
        draw.text(
            (300 + (90 - label_w) / 2, BODY_BOTTOM + 14),
            back,
            font=body_f,
            fill=INK if back_enabled else (160, 160, 160),
        )
    if next_label:
        draw.rounded_rectangle(
            (398, BODY_BOTTOM + 10, 486, BODY_BOTTOM + 34),
            3,
            fill=(240, 240, 240),
            outline=(120, 120, 120),
        )
        box = draw.textbbox((0, 0), next_label, font=body_f)
        label_w = box[2] - box[0]
        draw.text((398 + (88 - label_w) / 2, BODY_BOTTOM + 14), next_label, font=body_f, fill=INK)


def _inner_header(canvas: Image.Image, header: Image.Image, title: str, subtitle: str) -> None:
    """Inner MUI pages (scope, directory, instfiles) get header text + right bitmap.

    PAGE_INSTALL_MODE is nsDialogs + MUI_HEADER_TEXT — it cannot take the 164x314
    welcome/finish sidebar. Mocking a sidebar onto page 1 would overpromise.
    """
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, TITLEBAR_H, WIN_W - 1, TITLEBAR_H + HEADER_H), fill=(255, 255, 255))
    canvas.paste(header.convert("RGB"), (WIN_W - HEADER[0], TITLEBAR_H))
    draw.line((0, TITLEBAR_H + HEADER_H, WIN_W, TITLEBAR_H + HEADER_H), fill=(210, 210, 210))
    draw.text((20, TITLEBAR_H + 10), title, font=_font(FONT_BOLD, 13), fill=INK)
    draw.text((20, TITLEBAR_H + 32), subtitle, font=_font(FONT_REGULAR, 10), fill=MUTED)


def _side_by_side(left: Image.Image, right: Image.Image, left_caption: str, right_caption: str) -> Image.Image:
    gap = 24
    caption_h = 28
    width = left.width + right.width + gap + 32
    height = max(left.height, right.height) + caption_h + 28
    canvas = Image.new("RGB", (width, height), (247, 247, 247))
    draw = ImageDraw.Draw(canvas)
    caption = _font(FONT_BOLD, 13)
    x0 = 16
    y0 = 12
    draw.text((x0, y0), left_caption, font=caption, fill=MUTED)
    canvas.paste(left, (x0, y0 + caption_h))
    x1 = x0 + left.width + gap
    draw.text((x1, y0), right_caption, font=caption, fill=INK)
    canvas.paste(right, (x1, y0 + caption_h))
    return canvas


def _page_scope(header: Image.Image) -> Image.Image:
    page = _window_chrome("Instalação do Work4You")
    _inner_header(
        page,
        header,
        "Escolha uma opção de instalação",
        "Para quem esta aplicação deverá ser instalada?",
    )
    draw = ImageDraw.Draw(page)
    body_f = _font(FONT_REGULAR, 11)
    draw.text(
        (20, BODY_TOP + 16),
        "Selecione se deseja instalar o aplicativo para si ou para todos.",
        font=body_f,
        fill=INK,
    )
    draw.ellipse((28, BODY_TOP + 56, 42, BODY_TOP + 70), outline=(90, 90, 90), width=2)
    draw.text((52, BODY_TOP + 54), "Para todos que usam esta máquina", font=body_f, fill=INK)
    draw.ellipse((28, BODY_TOP + 88, 42, BODY_TOP + 102), outline=ACCENT, width=2)
    draw.ellipse((32, BODY_TOP + 92, 38, BODY_TOP + 98), fill=ACCENT)
    draw.text((52, BODY_TOP + 86), "Apenas para mim (leona)", font=body_f, fill=INK)
    _footer(page, back="Voltar", next_label="Próximo")
    return page


def _page_folder(header: Image.Image) -> Image.Image:
    page = _window_chrome("Instalação do Work4You")
    _inner_header(
        page,
        header,
        "Escolha o local da instalação",
        "Escolha a pasta na qual instalar o Work4You.",
    )
    draw = ImageDraw.Draw(page)
    body_f = _font(FONT_REGULAR, 11)
    draw.text((20, BODY_TOP + 24), "Pasta de Destino", font=body_f, fill=INK)
    draw.rounded_rectangle((20, BODY_TOP + 48, 380, BODY_TOP + 74), 3, fill=(255, 255, 255), outline=(180, 180, 180))
    draw.text(
        (28, BODY_TOP + 54),
        r"C:\Users\leona\AppData\Local\Programs\Work4You",
        font=_font(FONT_REGULAR, 9),
        fill=INK,
    )
    draw.rounded_rectangle((388, BODY_TOP + 48, 478, BODY_TOP + 74), 3, fill=(240, 240, 240), outline=(160, 160, 160))
    draw.text((406, BODY_TOP + 54), "Procurar", font=body_f, fill=INK)
    _footer(page, back="Voltar", next_label="Instalar", back_enabled=True)
    return page


def _page_progress(header: Image.Image) -> Image.Image:
    page = _window_chrome("Instalação do Work4You")
    _inner_header(
        page,
        header,
        "Instalando",
        "Por favor, aguarde enquanto o Work4You é instalado.",
    )
    draw = ImageDraw.Draw(page)
    draw.rounded_rectangle((20, BODY_TOP + 70, 478, BODY_TOP + 86), 8, fill=(230, 230, 230))
    draw.rounded_rectangle((20, BODY_TOP + 70, 220, BODY_TOP + 86), 8, fill=ACCENT)
    _footer(page, back=None, next_label="")
    return page


def _page_finish(sidebar: Image.Image) -> Image.Image:
    page = _window_chrome("Instalação do Work4You")
    page.paste(sidebar.convert("RGB"), (0, TITLEBAR_H))
    body = Image.new("RGB", (WIN_W - SIDEBAR[0], SIDEBAR[1]), (255, 255, 255))
    page.paste(body, (SIDEBAR[0], TITLEBAR_H))
    draw = ImageDraw.Draw(page)
    title_f = _font(FONT_BOLD, 18)
    body_f = _font(FONT_REGULAR, 11)
    draw.text((SIDEBAR[0] + 20, TITLEBAR_H + 24), "Concluindo a instalação", font=title_f, fill=INK)
    draw.text((SIDEBAR[0] + 20, TITLEBAR_H + 52), "do Work4You", font=title_f, fill=INK)
    draw.text((SIDEBAR[0] + 20, TITLEBAR_H + 100), "O Work4You foi instalado no seu computador.", font=body_f, fill=INK)
    draw.rectangle((SIDEBAR[0] + 20, TITLEBAR_H + 160, SIDEBAR[0] + 34, TITLEBAR_H + 174), outline=ACCENT, width=2)
    draw.rectangle((SIDEBAR[0] + 23, TITLEBAR_H + 163, SIDEBAR[0] + 31, TITLEBAR_H + 171), fill=ACCENT)
    draw.text((SIDEBAR[0] + 44, TITLEBAR_H + 158), "Executar o Work4You", font=body_f, fill=INK)
    _footer(page, back=None, next_label="Concluir")
    return page


def render_previews(dest: Path, *, stock_sidebar: Path | None = None) -> list[Path]:
    dest.mkdir(parents=True, exist_ok=True)
    sidebar = build_sidebar()
    header = build_header()
    written: list[Path] = []

    def write(name: str, img: Image.Image) -> None:
        path = dest / name
        img.save(path, format="PNG")
        written.append(path)

    write("nsis-sidebar.png", sidebar)
    write("nsis-header.png", header)

    after_scope = _page_scope(header)
    after_folder = _page_folder(header)
    after_progress = _page_progress(header)
    after_finish = _page_finish(sidebar)
    write("after-page-scope.png", after_scope)
    write("after-page-folder.png", after_folder)
    write("after-page-progress.png", after_progress)
    write("after-page-finish.png", after_finish)

    if stock_sidebar and stock_sidebar.is_file():
        before_sidebar = Image.open(stock_sidebar).convert("RGB").resize(SIDEBAR, Image.Resampling.LANCZOS)
        # Inner pages currently ship with no installerHeader, so the right
        # patch is blank chrome — not nsis3-metro-right.bmp.
        blank_header = Image.new("RGB", HEADER, (255, 255, 255))
        before_scope = _page_scope(blank_header)
        before_folder = _page_folder(blank_header)
        before_progress = _page_progress(blank_header)
        before_finish = _page_finish(before_sidebar)
        write("before-page-scope.png", before_scope)
        write("before-page-folder.png", before_folder)
        write("before-page-progress.png", before_progress)
        write("before-page-finish.png", before_finish)
        write("compare-sidebar.png", _side_by_side(before_sidebar, sidebar, "Antes — NSIS metro", "Depois — Work4You"))
        write("compare-header.png", _side_by_side(blank_header, header, "Antes — sem header", "Depois — marca Work4You"))
        write("compare-page-scope.png", _side_by_side(before_scope, after_scope, "Antes — tela 1", "Depois — tela 1"))
        write("compare-page-folder.png", _side_by_side(before_folder, after_folder, "Antes — tela 2", "Depois — tela 2"))
        write("compare-page-progress.png", _side_by_side(before_progress, after_progress, "Antes — tela 3", "Depois — tela 3"))
        write("compare-page-finish.png", _side_by_side(before_finish, after_finish, "Antes — tela 4", "Depois — tela 4"))

    return written


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview-dir", type=Path, help="also write wizard page mockups")
    parser.add_argument("--stock-sidebar", type=Path, help="optional nsis3-metro.bmp for before/after previews")
    args = parser.parse_args()
    paths = generate_assets()
    for path in paths:
        print(path)
    if args.preview_dir:
        for path in render_previews(args.preview_dir, stock_sidebar=args.stock_sidebar):
            print(path)


if __name__ == "__main__":
    main()
