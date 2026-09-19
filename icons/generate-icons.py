#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw

def create_icon(size, output_path):
    # Monkeytype theme colors: background #2e3439, accent #e2b714
    bg_color = (46, 52, 57, 255)
    accent_color = (226, 183, 20, 255)
    
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Rounded rect background
    pad = max(1, size // 16)
    radius = max(2, size // 4)
    draw.rounded_rectangle(
        [pad, pad, size - pad - 1, size - pad - 1],
        radius=radius,
        fill=bg_color
    )
    
    # Draw stylized keyboard glyph / keycaps
    inner_pad = max(2, size // 5)
    
    if size >= 48:
        bar_h = max(2, size // 10)
        stem_w = max(2, size // 8)
        cx = size // 2
        # T-bar
        draw.rectangle([inner_pad, inner_pad + bar_h, size - inner_pad, inner_pad + 2 * bar_h], fill=accent_color)
        # vertical stem
        draw.rectangle([cx - stem_w // 2, inner_pad + bar_h, cx + stem_w // 2, size - inner_pad - bar_h], fill=accent_color)
        # base
        draw.rectangle([inner_pad + stem_w, size - inner_pad - 2 * bar_h, size - inner_pad - stem_w, size - inner_pad - bar_h], fill=accent_color)
    else:
        # For 16px, crisp high-contrast icon
        draw.rectangle([size // 4, size // 4, 3 * size // 4, size // 4 + 2], fill=accent_color)
        draw.rectangle([size // 2 - 1, size // 4, size // 2 + 1, 3 * size // 4], fill=accent_color)
        
    img.save(output_path, "PNG")
    print(f"Generated {output_path} ({size}x{size})")

if __name__ == "__main__":
    icon_dir = os.path.dirname(os.path.abspath(__file__))
    for size in [16, 48, 128]:
        create_icon(size, os.path.join(icon_dir, f"icon-{size}.png"))
