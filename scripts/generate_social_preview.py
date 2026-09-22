#!/usr/bin/env python3
"""Generates the official GitHub Social Preview images (1280x640) for FeedbackKit,
closely matching the design language, layout, typography, and components of the landing page.

Key Landing Page elements reflected:
- Background: Aurora glowing blobs (blue-400, violet-400, amber-300) + 44px radial-masked grid
- Header: Logomark + "FeedbackKit" + "Open source · MIT licensed" pill
- Hero Copy: "In-app feedback for iOS, turned into prompts your coding agent can act on."
- Description: Direct from landing page hero copy
- CTA Buttons: "Get started · Swift Package" & "View on GitHub"
- Feature Pills: Matching landing page feature pillars
- Phone Mockup: Exact hardware buttons, Dynamic Island, and neutral-900 bezel from PhoneMockup.tsx
- Dashboard Prompt Card: Window title bar, "Generated prompt", "Copy for coding agent" pill, and structured monospace prompt from DashboardMockup.tsx
- Agent Skills Card: Terminal box with "npx skills add feedback-kit-skills"

Outputs:
- branding/social-preview.png (default dark)
- branding/social-preview-dark.png
- branding/social-preview-light.png
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BRANDING_DIR = ROOT / "branding"
LOGO_PATH = BRANDING_DIR / "feedbackkit-logo.png"
SCREENSHOT_PATH = ROOT / "web/src/assets/demo-feedback-screen.png"

WIDTH = 1280
HEIGHT = 640

# Fonts
FONT_HELVETICA = "/System/Library/Fonts/HelveticaNeue.ttc"
FONT_MENLO = "/System/Library/Fonts/Menlo.ttc"

FONT_REGULAR = lambda size: ImageFont.truetype(FONT_HELVETICA, size, index=0)
FONT_BOLD = lambda size: ImageFont.truetype(FONT_HELVETICA, size, index=1)
FONT_MEDIUM = lambda size: ImageFont.truetype(FONT_HELVETICA, size, index=10)

FONT_MONO = lambda size: ImageFont.truetype(FONT_MENLO, size, index=0)
FONT_MONO_BOLD = lambda size: ImageFont.truetype(FONT_MENLO, size, index=1)


def create_aurora_blob(width: int, height: int, cx: int, cy: int, rx: int, ry: int, color: tuple) -> Image.Image:
    """Creates a smooth elliptical blurred aurora blob like the landing page."""
    blob = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(blob)
    r, g, b, max_a = color
    steps = 45
    for i in range(steps, 0, -1):
        frac = i / steps
        cur_rx = int(rx * frac)
        cur_ry = int(ry * frac)
        alpha = int(max_a * ((1.0 - frac) ** 1.8))
        if alpha <= 0:
            continue
        bbox = [cx - cur_rx, cy - cur_ry, cx + cur_rx, cy + cur_ry]
        draw.ellipse(bbox, fill=(r, g, b, alpha))
    return blob.filter(ImageFilter.GaussianBlur(radius=rx // 4))


def create_masked_grid(width: int, height: int, grid_size: int, line_color: tuple, is_light: bool) -> Image.Image:
    """Creates the 44px grid with radial elliptical mask matching LandingPage.tsx."""
    grid_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    grid_draw = ImageDraw.Draw(grid_img)
    for x in range(0, width, grid_size):
        grid_draw.line([(x, 0), (x, height)], fill=line_color, width=1)
    for y in range(0, height, grid_size):
        grid_draw.line([(0, y), (width, y)], fill=line_color, width=1)

    # Radial mask: ellipse centered at top center, fading out to edges
    mask = Image.new("L", (width, height), 0)
    mask_draw = ImageDraw.Draw(mask)
    mcx, mcy = width // 2, 0
    mrx, mry = int(width * 0.75), int(height * 0.95)
    steps = 50
    for i in range(steps, 0, -1):
        frac = i / steps
        cur_rx = int(mrx * frac)
        cur_ry = int(mry * frac)
        alpha = int(255 * ((1.0 - frac) ** 1.3))
        mask_draw.ellipse([mcx - cur_rx, mcy - cur_ry, mcx + cur_rx, mcy + cur_ry], fill=alpha)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=40))

    # Apply mask to grid alpha
    r, g, b, a = grid_img.split()
    # combine a and mask
    combined_a = Image.new("L", (width, height), 0)
    for x in range(0, width, 100):  # fast compositing via mask
        pass
    # PIL putalpha with mask
    mask_blurred = mask
    # multiply alpha
    final_grid = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    final_grid.paste(grid_img, (0, 0), mask_blurred)
    return final_grid


def rounded_mask(size: tuple, radius: int) -> Image.Image:
    w, h = size
    scale = 4
    mask = Image.new("L", (w * scale, h * scale), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, w * scale - 1, h * scale - 1], radius=radius * scale, fill=255)
    return mask.resize(size, Image.LANCZOS)


def draw_pill(
    draw: ImageDraw.Draw,
    xy: tuple,
    text: str,
    font,
    bg_color,
    border_color,
    text_color,
    dot_color=None,
    pad_x=12,
    pad_y=6
):
    x, y = xy
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]

    dot_spacing = 0
    dot_r = 3.5
    if dot_color:
        dot_spacing = int(dot_r * 2 + 7)

    w = tw + pad_x * 2 + dot_spacing
    h = max(th + pad_y * 2, 28)
    rect = [x, y, x + w, y + h]
    radius = h // 2
    draw.rounded_rectangle(rect, radius=radius, fill=bg_color, outline=border_color, width=1)

    cur_x = x + pad_x
    if dot_color:
        dot_cy = y + h / 2
        draw.ellipse([cur_x, dot_cy - dot_r, cur_x + dot_r * 2, dot_cy + dot_r], fill=dot_color)
        cur_x += int(dot_r * 2 + 7)

    ty = y + (h - th) // 2 - bbox[1]
    draw.text((cur_x, ty), text, font=font, fill=text_color)
    return w, h


def draw_button(
    draw: ImageDraw.Draw,
    xy: tuple,
    text: str,
    font,
    bg_color,
    border_color,
    text_color,
    pad_x=16,
    pad_y=8,
    radius=6
):
    x, y = xy
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    w = tw + pad_x * 2
    h = th + pad_y * 2
    rect = [x, y, x + w, y + h]
    draw.rounded_rectangle(rect, radius=radius, fill=bg_color, outline=border_color, width=1)
    tx = x + pad_x
    ty = y + (h - th) // 2 - bbox[1]
    draw.text((tx, ty), text, font=font, fill=text_color)
    return w, h


THEMES = {
    "light": {
        "canvas_bg": (255, 255, 255, 255),  # Pure white matching LandingPage
        "auroras": [
            # blue-400/25 blob at top center/left
            {"cx": 340, "cy": 60, "rx": 340, "ry": 240, "color": (96, 165, 250, 48)},
            # violet-400/20 blob at top right behind phone
            {"cx": 1040, "cy": 160, "rx": 360, "ry": 280, "color": (167, 139, 250, 42)},
            # amber-300/15 blob at bottom left
            {"cx": 180, "cy": 540, "rx": 260, "ry": 200, "color": (252, 211, 77, 30)},
        ],
        "grid_color": (23, 23, 23, 16),  # rgba(23,23,23,0.05)
        # Brand header
        "brand_text": (23, 23, 23, 255),  # neutral-900
        "badge_bg": (255, 255, 255, 200),
        "badge_border": (229, 229, 229, 255),  # neutral-200
        "badge_text": (82, 82, 82, 255),  # neutral-600
        # Hero text
        "hero_title": (23, 23, 23, 255),  # neutral-900
        "hero_desc": (82, 82, 82, 255),  # neutral-600
        "subnote_text": (163, 163, 163, 255),  # neutral-400
        # Buttons
        "btn_primary_bg": (23, 23, 23, 255),  # neutral-900
        "btn_primary_text": (255, 255, 255, 255),
        "btn_primary_border": (23, 23, 23, 255),
        "btn_sec_bg": (255, 255, 255, 230),
        "btn_sec_text": (23, 23, 23, 255),
        "btn_sec_border": (212, 212, 216, 255),  # neutral-300
        # Feature pills
        "pill_bg": (255, 255, 255, 220),
        "pill_border": (229, 229, 229, 255),
        "pill_text": (38, 38, 38, 255),  # neutral-800
        # Phone
        "phone_bezel": (23, 23, 23, 255),  # neutral-900
        "phone_btn": (38, 38, 38, 255),  # neutral-800
        "phone_shadow": (0, 0, 0, 65),
        "phone_shadow_blur": 32,
        # Dashboard Card
        "card_bg": (255, 255, 255, 250),
        "card_border": (229, 229, 229, 255),  # neutral-200
        "card_shadow": (0, 0, 0, 35),
        "card_bar_bg": (250, 250, 250, 255),  # neutral-50
        "card_bar_border": (229, 229, 229, 255),
        "card_dot": (212, 212, 216, 255),  # neutral-300
        "card_bar_text": (163, 163, 163, 255),  # neutral-400
        "prompt_label": (115, 115, 115, 255),  # neutral-500
        "copy_btn_bg": (23, 23, 23, 255),  # neutral-900
        "copy_btn_text": (255, 255, 255, 255),
        "prompt_box_bg": (250, 250, 250, 255),  # neutral-50
        "prompt_box_border": (245, 245, 245, 255),
        "prompt_key_color": (163, 163, 163, 255),  # neutral-400
        "prompt_val_color": (82, 82, 82, 255),  # neutral-600
        # Skills card
        "skills_card_bg": (255, 255, 255, 250),
        "skills_card_border": (229, 229, 229, 255),
        "terminal_bg": (23, 23, 23, 255),  # neutral-900
        "terminal_border": (38, 38, 38, 255),
        "terminal_prompt": (34, 197, 94, 255),  # green-500
        "terminal_text": (245, 245, 245, 255),
        "frame_border": (229, 229, 229, 255),
    },
    "dark": {
        "canvas_bg": (10, 14, 23, 255),  # Deep slate matching developer tools
        "auroras": [
            # blue aurora
            {"cx": 340, "cy": 60, "rx": 360, "ry": 260, "color": (59, 130, 246, 60)},
            # violet aurora
            {"cx": 1040, "cy": 160, "rx": 380, "ry": 300, "color": (139, 92, 246, 55)},
            # amber/cyan warmth
            {"cx": 200, "cy": 540, "rx": 280, "ry": 220, "color": (14, 165, 233, 40)},
        ],
        "grid_color": (255, 255, 255, 12),
        # Brand header
        "brand_text": (255, 255, 255, 255),
        "badge_bg": (30, 41, 59, 180),
        "badge_border": (51, 65, 85, 200),
        "badge_text": (203, 213, 225, 255),
        # Hero text
        "hero_title": (255, 255, 255, 255),
        "hero_desc": (203, 213, 225, 255),
        "subnote_text": (148, 163, 184, 255),
        # Buttons
        "btn_primary_bg": (255, 255, 255, 255),  # white primary CTA in dark mode
        "btn_primary_text": (15, 23, 42, 255),
        "btn_primary_border": (255, 255, 255, 255),
        "btn_sec_bg": (30, 41, 59, 180),
        "btn_sec_text": (241, 245, 249, 255),
        "btn_sec_border": (71, 85, 105, 200),
        # Feature pills
        "pill_bg": (30, 41, 59, 190),
        "pill_border": (51, 65, 85, 220),
        "pill_text": (241, 245, 249, 255),
        # Phone
        "phone_bezel": (23, 23, 23, 255),  # Space Black neutral-900
        "phone_btn": (38, 38, 38, 255),
        "phone_shadow": (0, 0, 0, 190),
        "phone_shadow_blur": 32,
        # Dashboard Card
        "card_bg": (15, 23, 42, 248),
        "card_border": (51, 65, 85, 180),
        "card_shadow": (0, 0, 0, 180),
        "card_bar_bg": (11, 15, 25, 255),
        "card_bar_border": (51, 65, 85, 180),
        "card_dot": (71, 85, 105, 255),
        "card_bar_text": (148, 163, 184, 255),
        "prompt_label": (148, 163, 184, 255),
        "copy_btn_bg": (255, 255, 255, 255),
        "copy_btn_text": (15, 23, 42, 255),
        "prompt_box_bg": (11, 15, 25, 240),
        "prompt_box_border": (30, 41, 59, 255),
        "prompt_key_color": (100, 116, 139, 255),
        "prompt_val_color": (226, 232, 240, 255),
        # Skills card
        "skills_card_bg": (15, 23, 42, 248),
        "skills_card_border": (51, 65, 85, 180),
        "terminal_bg": (3, 7, 18, 240),
        "terminal_border": (30, 41, 59, 255),
        "terminal_prompt": (34, 197, 94, 255),
        "terminal_text": (248, 250, 252, 255),
        "frame_border": (255, 255, 255, 20),
    }
}


def render_preview(theme_name: str) -> Image.Image:
    cfg = THEMES[theme_name]
    is_light = (theme_name == "light")

    # 1. Base Canvas
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), cfg["canvas_bg"])

    # 2. Aurora Blobs
    for a in cfg["auroras"]:
        blob = create_aurora_blob(WIDTH, HEIGHT, a["cx"], a["cy"], a["rx"], a["ry"], a["color"])
        canvas = Image.alpha_composite(canvas, blob)

    # 3. 44px Faint Masked Grid
    grid = create_masked_grid(WIDTH, HEIGHT, grid_size=44, line_color=cfg["grid_color"], is_light=is_light)
    canvas = Image.alpha_composite(canvas, grid)

    # 4. Phone Mockup (matching PhoneMockup.tsx hardware buttons & bezel)
    phone_h = 510
    phone_w = int(phone_h * (660 / 1375))  # ~245 px
    bezel_pad = 7
    frame_w = phone_w + bezel_pad * 2  # ~259 px
    frame_h = phone_h + bezel_pad * 2  # ~524 px
    phone_x = 960
    phone_y = (HEIGHT - frame_h) // 2  # ~58 px

    # Phone drop shadow
    shadow_pad = 60
    shadow_layer = Image.new("RGBA", (frame_w + shadow_pad * 2, frame_h + shadow_pad * 2), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_layer)
    s_draw.rounded_rectangle(
        [shadow_pad, shadow_pad + 12, shadow_pad + frame_w, shadow_pad + frame_h + 12],
        radius=36,
        fill=cfg["phone_shadow"]
    )
    shadow_blurred = shadow_layer.filter(ImageFilter.GaussianBlur(radius=cfg["phone_shadow_blur"]))
    canvas.paste(shadow_blurred, (phone_x - shadow_pad, phone_y - shadow_pad), shadow_blurred)

    # Hardware Buttons (exact proportions from PhoneMockup.tsx)
    btn_w = 3
    # Left mute: top 12%, h=22
    mute_y = phone_y + int(frame_h * 0.12)
    mute_h = 22
    # Left vol up: top 18%, h=38
    vup_y = phone_y + int(frame_h * 0.18)
    vup_h = 38
    # Left vol down: top 24%, h=38
    vdn_y = phone_y + int(frame_h * 0.24)
    vdn_h = 38
    # Right power: top 16%, h=52
    pwr_y = phone_y + int(frame_h * 0.16)
    pwr_h = 52

    btn_layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(btn_layer)
    # left buttons
    b_draw.rounded_rectangle([phone_x - btn_w, mute_y, phone_x, mute_y + mute_h], radius=1, fill=cfg["phone_btn"])
    b_draw.rounded_rectangle([phone_x - btn_w, vup_y, phone_x, vup_y + vup_h], radius=1, fill=cfg["phone_btn"])
    b_draw.rounded_rectangle([phone_x - btn_w, vdn_y, phone_x, vdn_y + vdn_h], radius=1, fill=cfg["phone_btn"])
    # right button
    b_draw.rounded_rectangle([phone_x + frame_w, pwr_y, phone_x + frame_w + btn_w, pwr_y + pwr_h], radius=1, fill=cfg["phone_btn"])
    canvas = Image.alpha_composite(canvas, btn_layer)

    # Outer Frame Bezel (rounded-[2.4rem] in PhoneMockup.tsx -> radius=34)
    frame_img = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    f_draw = ImageDraw.Draw(frame_img)
    f_draw.rounded_rectangle([0, 0, frame_w - 1, frame_h - 1], radius=34, fill=cfg["phone_bezel"])
    canvas.paste(frame_img, (phone_x, phone_y), frame_img)

    # Screenshot inside bezel (rounded-[1.9rem] -> radius=27)
    screenshot = Image.open(SCREENSHOT_PATH).convert("RGBA")
    screenshot_scaled = screenshot.resize((phone_w, phone_h), Image.LANCZOS)
    screen_mask = rounded_mask((phone_w, phone_h), radius=27)
    screenshot_scaled.putalpha(screen_mask)
    canvas.paste(screenshot_scaled, (phone_x + bezel_pad, phone_y + bezel_pad), screenshot_scaled)

    # Dynamic Island (from PhoneMockup.tsx line 28: h-[11px] w-10 bg-black)
    di_w, di_h = 42, 11
    di_x = phone_x + bezel_pad + (phone_w - di_w) // 2
    di_y = phone_y + bezel_pad + 4
    di_img = Image.new("RGBA", (di_w, di_h), (0, 0, 0, 0))
    di_draw = ImageDraw.Draw(di_img)
    di_draw.rounded_rectangle([0, 0, di_w - 1, di_h - 1], radius=di_h // 2, fill=(0, 0, 0, 255))
    canvas.paste(di_img, (di_x, di_y), di_img)

    # 5. Floating Dashboard Prompt Card (exact DashboardMockup.tsx replica)
    dash_w = 340
    dash_h = 188
    dash_x = 650
    dash_y = 75

    # Card shadow
    dash_shadow = Image.new("RGBA", (dash_w + 40, dash_h + 40), (0, 0, 0, 0))
    ds_draw = ImageDraw.Draw(dash_shadow)
    ds_draw.rounded_rectangle([20, 22, 20 + dash_w, 22 + dash_h], radius=16, fill=cfg["card_shadow"])
    dash_shadow = dash_shadow.filter(ImageFilter.GaussianBlur(radius=16))
    canvas.paste(dash_shadow, (dash_x - 20, dash_y - 20), dash_shadow)

    card_img = Image.new("RGBA", (dash_w, dash_h), (0, 0, 0, 0))
    c_draw = ImageDraw.Draw(card_img)
    # Main card container
    c_draw.rounded_rectangle([0, 0, dash_w - 1, dash_h - 1], radius=14, fill=cfg["card_bg"], outline=cfg["card_border"], width=1)

    # Window title bar (DashboardMockup.tsx line 17)
    bar_h = 30
    c_draw.rounded_rectangle([0, 0, dash_w - 1, bar_h], radius=14, fill=cfg["card_bar_bg"])
    c_draw.rectangle([0, bar_h - 4, dash_w - 1, bar_h], fill=cfg["card_bar_bg"])
    c_draw.line([(0, bar_h), (dash_w - 1, bar_h)], fill=cfg["card_bar_border"], width=1)

    # 3 window dots
    dot_y = 11
    c_draw.ellipse([14, dot_y, 22, dot_y + 8], fill=cfg["card_dot"])
    c_draw.ellipse([26, dot_y, 34, dot_y + 8], fill=cfg["card_dot"])
    c_draw.ellipse([38, dot_y, 46, dot_y + 8], fill=cfg["card_dot"])

    # URL path in bar
    c_draw.text((56, 9), "feedback-kit.app/projects/checkout-app", font=FONT_REGULAR(10), fill=cfg["card_bar_text"])

    # Prompt Header row
    c_draw.text((16, 42), "Generated prompt", font=FONT_MEDIUM(11), fill=cfg["prompt_label"])
    # "Copy for coding agent" button pill
    draw_button(
        c_draw,
        (dash_w - 138, 38),
        "Copy for coding agent",
        font=FONT_MEDIUM(9),
        bg_color=cfg["copy_btn_bg"],
        border_color=cfg["copy_btn_bg"],
        text_color=cfg["copy_btn_text"],
        pad_x=8,
        pad_y=4,
        radius=5
    )

    # Monospace Prompt Box (DashboardMockup.tsx line 51)
    pbox = [14, 68, dash_w - 14, dash_h - 14]
    c_draw.rounded_rectangle(pbox, radius=8, fill=cfg["prompt_box_bg"], outline=cfg["prompt_box_border"], width=1)

    lines = [
        ("screen:", " Checkout"),
        ("device:", " iPhone 16 Pro, iOS 18.2"),
        ("report:", " \"Subtotal doesn't match cart total\""),
        ("prompt:", " Fix the bug shown in screenshot..."),
    ]
    py = 76
    for k, v in lines:
        c_draw.text((24, py), k, font=FONT_MONO(10), fill=cfg["prompt_key_color"])
        kw = FONT_MONO(10).getbbox(k)[2] - FONT_MONO(10).getbbox(k)[0]
        c_draw.text((24 + kw, py), v, font=FONT_MONO(10), fill=cfg["prompt_val_color"])
        py += 17

    canvas.paste(card_img, (dash_x, dash_y), card_img)

    # 6. Floating Agent Skills Terminal Card
    skill_w = 320
    skill_h = 76
    skill_x = 675
    skill_y = 475

    skill_shadow = Image.new("RGBA", (skill_w + 40, skill_h + 40), (0, 0, 0, 0))
    ss_draw = ImageDraw.Draw(skill_shadow)
    ss_draw.rounded_rectangle([20, 22, 20 + skill_w, 22 + skill_h], radius=14, fill=cfg["card_shadow"])
    skill_shadow = skill_shadow.filter(ImageFilter.GaussianBlur(radius=14))
    canvas.paste(skill_shadow, (skill_x - 20, skill_y - 20), skill_shadow)

    skill_img = Image.new("RGBA", (skill_w, skill_h), (0, 0, 0, 0))
    sk_draw = ImageDraw.Draw(skill_img)
    sk_draw.rounded_rectangle([0, 0, skill_w - 1, skill_h - 1], radius=12, fill=cfg["skills_card_bg"], outline=cfg["skills_card_border"], width=1)

    # Title with purple dot
    sk_draw.ellipse([14, 14, 21, 21], fill=(168, 85, 247, 255))
    sk_draw.text((28, 11), "AGENT SKILLS CATALOG", font=FONT_MONO_BOLD(10), fill=(168, 85, 247, 255))

    # Terminal box
    term_box = [12, 32, skill_w - 12, skill_h - 12]
    sk_draw.rounded_rectangle(term_box, radius=6, fill=cfg["terminal_bg"], outline=cfg["terminal_border"], width=1)
    sk_draw.text((20, 39), "$", font=FONT_MONO_BOLD(10), fill=cfg["terminal_prompt"])
    sk_draw.text((32, 39), "npx skills add feedback-kit-skills", font=FONT_MONO(10), fill=cfg["terminal_text"])

    canvas.paste(skill_img, (skill_x, skill_y), skill_img)

    # 7. Left Column Typography & Actions
    draw = ImageDraw.Draw(canvas)

    left_x = 75
    curr_y = 52

    # Brand Row: Logo Icon + "FeedbackKit" + "Open source · MIT licensed" pill
    icon_size = 32
    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo_scaled = logo.resize((icon_size, icon_size), Image.LANCZOS)
    logo_mask = rounded_mask((icon_size, icon_size), radius=7)
    logo_scaled.putalpha(logo_mask)

    canvas.paste(logo_scaled, (left_x, curr_y), logo_scaled)
    # Brand title
    draw.text((left_x + icon_size + 10, curr_y + 4), "FeedbackKit", font=FONT_BOLD(20), fill=cfg["brand_text"])

    # Open Source badge pill (LandingPage.tsx line 148)
    badge_x = left_x + icon_size + 150
    draw_pill(
        draw,
        (badge_x, curr_y + 2),
        "Open source · MIT licensed",
        font=FONT_MEDIUM(11),
        bg_color=cfg["badge_bg"],
        border_color=cfg["badge_border"],
        text_color=cfg["badge_text"],
        dot_color=(34, 197, 94, 255),
        pad_x=10,
        pad_y=5
    )

    curr_y += 56

    # Hero Headline (LandingPage.tsx line 151)
    hero_line1 = "In-app feedback for iOS,"
    hero_line2 = "turned into prompts your"
    hero_line3 = "coding agent can act on."
    draw.text((left_x, curr_y), hero_line1, font=FONT_BOLD(37), fill=cfg["hero_title"])
    curr_y += 45
    draw.text((left_x, curr_y), hero_line2, font=FONT_BOLD(37), fill=cfg["hero_title"])
    curr_y += 45
    draw.text((left_x, curr_y), hero_line3, font=FONT_BOLD(37), fill=cfg["hero_title"])
    curr_y += 56

    # Hero Description (LandingPage.tsx line 154)
    desc1 = "Drop the SDK into any UIKit or SwiftUI app. Users shake,"
    desc2 = "mark up the screen, and describe the problem. You get a"
    desc3 = "structured report & prompts ready for Claude Code, Cursor, AGY."
    draw.text((left_x, curr_y), desc1, font=FONT_REGULAR(15), fill=cfg["hero_desc"])
    curr_y += 22
    draw.text((left_x, curr_y), desc2, font=FONT_REGULAR(15), fill=cfg["hero_desc"])
    curr_y += 22
    draw.text((left_x, curr_y), desc3, font=FONT_REGULAR(15), fill=cfg["hero_desc"])
    curr_y += 38

    # CTA Buttons (LandingPage.tsx line 161)
    btn1_w, btn1_h = draw_button(
        draw,
        (left_x, curr_y),
        "Get started · Swift Package",
        font=FONT_BOLD(13),
        bg_color=cfg["btn_primary_bg"],
        border_color=cfg["btn_primary_border"],
        text_color=cfg["btn_primary_text"],
        pad_x=18,
        pad_y=10,
        radius=6
    )
    btn2_w, btn2_h = draw_button(
        draw,
        (left_x + btn1_w + 12, curr_y),
        "View on GitHub",
        font=FONT_MEDIUM(13),
        bg_color=cfg["btn_sec_bg"],
        border_color=cfg["btn_sec_border"],
        text_color=cfg["btn_sec_text"],
        pad_x=16,
        pad_y=10,
        radius=6
    )
    curr_y += btn1_h + 24

    # Feature Badges (Pills Row 1)
    pills_row1 = [
        ("UIKit & SwiftUI", (14, 165, 233, 255)),
        ("4 Annotation Tools", (245, 158, 11, 255)),
        ("Structured Reports", (244, 63, 94, 255)),
    ]
    px = left_x
    for text, dot in pills_row1:
        pw, ph = draw_pill(
            draw,
            (px, curr_y),
            text,
            font=FONT_MEDIUM(12),
            bg_color=cfg["pill_bg"],
            border_color=cfg["pill_border"],
            text_color=cfg["pill_text"],
            dot_color=dot,
            pad_x=10,
            pad_y=5
        )
        px += pw + 8

    curr_y += 34

    # Feature Badges (Pills Row 2)
    pills_row2 = [
        ("MCP Server & CLI", (59, 130, 246, 255)),
        ("Agent Skills Catalog", (168, 85, 247, 255)),
        ("Multi-Tenant RLS", (16, 185, 129, 255)),
    ]
    px = left_x
    for text, dot in pills_row2:
        pw, ph = draw_pill(
            draw,
            (px, curr_y),
            text,
            font=FONT_MEDIUM(12),
            bg_color=cfg["pill_bg"],
            border_color=cfg["pill_border"],
            text_color=cfg["pill_text"],
            dot_color=dot,
            pad_x=10,
            pad_y=5
        )
        px += pw + 8

    curr_y += 42

    # Bottom Note (LandingPage.tsx line 177)
    subnote = "Swift Package · No dashboard required · Bring your own backend, or use ours"
    draw.text((left_x, curr_y), subnote, font=FONT_REGULAR(12), fill=cfg["subnote_text"])

    # Outer Frame Border
    border_overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    bo_draw = ImageDraw.Draw(border_overlay)
    bo_draw.rectangle([0, 0, WIDTH - 1, HEIGHT - 1], outline=cfg["frame_border"], width=1)
    canvas = Image.alpha_composite(canvas, border_overlay)

    return canvas.convert("RGB")


def main():
    parser = argparse.ArgumentParser(description="Generate GitHub Social Preview images for FeedbackKit.")
    parser.add_argument("--theme", choices=["dark", "light", "all"], default="all", help="Theme to generate (default: all)")
    args = parser.parse_args()

    BRANDING_DIR.mkdir(parents=True, exist_ok=True)

    if args.theme in ("dark", "all"):
        print("==> Generating Dark Theme Social Preview (Landing Page Style)...")
        dark_img = render_preview("dark")
        p1 = BRANDING_DIR / "social-preview.png"
        p2 = BRANDING_DIR / "social-preview-dark.png"
        dark_img.save(p1, "PNG", quality=95, optimize=True)
        dark_img.save(p2, "PNG", quality=95, optimize=True)
        print(f"✔ Dark preview generated at: {p1} and {p2}")

    if args.theme in ("light", "all"):
        print("==> Generating Light Theme Social Preview (Landing Page Style)...")
        light_img = render_preview("light")
        p_light = BRANDING_DIR / "social-preview-light.png"
        light_img.save(p_light, "PNG", quality=95, optimize=True)
        print(f"✔ Light preview generated at: {p_light}")

    print("✔ All requested social previews generated successfully (1280x640px)!")


if __name__ == "__main__":
    main()
