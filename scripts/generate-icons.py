import os
import re
import io
import struct
import base64
from PIL import Image, ImageDraw

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    svg_path = os.path.join(root_dir, 'load-lab-svg.svg')
    
    with open(svg_path, 'r', encoding='utf-8') as f:
        svg_content = f.read()
    
    # Extract embedded PNG
    match = re.search(r'xlink:href=[\'"]data:image/png;base64,([^\'"]+)[\'"]', svg_content)
    if not match:
        raise ValueError('No embedded base64 PNG found in load-lab-svg.svg')
    
    raw_bytes = base64.b64decode(match.group(1))
    src_img = Image.open(io.BytesIO(raw_bytes)).convert('RGBA')
    
    # SVG has viewBox 0 0 64 64 and rx="5".
    # Corner radius ratio is 5 / 64 = 0.078125
    MASTER_SIZE = 1024
    master_img = src_img.resize((MASTER_SIZE, MASTER_SIZE), Image.Resampling.LANCZOS)
    
    # Create supersampled mask (4x) for perfectly smooth anti-aliased rounded corners
    SUPER_SCALE = 4
    super_size = MASTER_SIZE * SUPER_SCALE
    super_radius = int(round(super_size * (5.0 / 64.0)))
    
    mask_large = Image.new('L', (super_size, super_size), 0)
    draw = ImageDraw.Draw(mask_large)
    draw.rounded_rectangle([(0, 0), (super_size - 1, super_size - 1)], radius=super_radius, fill=255)
    
    mask = mask_large.resize((MASTER_SIZE, MASTER_SIZE), Image.Resampling.LANCZOS)
    master_img.putalpha(mask)
    
    # Target directories
    build_dir = os.path.join(root_dir, 'build')
    build_icons_win = os.path.join(build_dir, 'icons', 'win')
    build_icons_mac = os.path.join(build_dir, 'icons', 'mac')
    build_icons_png = os.path.join(build_dir, 'icons', 'png')
    resources_dir = os.path.join(root_dir, 'resources')
    renderer_public_dir = os.path.join(root_dir, 'src', 'renderer', 'public')
    
    for d in [build_icons_win, build_icons_mac, build_icons_png, resources_dir, renderer_public_dir]:
        os.makedirs(d, exist_ok=True)
        
    # 1. Save master PNG in root (./icon.png), resources/icon.png, and build/icon.png
    master_img.save(os.path.join(root_dir, 'icon.png'), format='PNG')
    master_img.save(os.path.join(resources_dir, 'icon.png'), format='PNG')
    master_img.save(os.path.join(build_dir, 'icon.png'), format='PNG')
    
    # 2. Save individual PNG sizes under build/icons/png/
    sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
    png_images = {}
    for s in sizes:
        resized = master_img.resize((s, s), Image.Resampling.LANCZOS)
        png_images[s] = resized
        out_png = os.path.join(build_icons_png, f'{s}x{s}.png')
        resized.save(out_png, format='PNG')
    print(f'Saved PNG sizes in {build_icons_png}')
    
    # 3. Create Windows multi-size .ico
    # Multi-size ICO: 16, 24, 32, 48, 64, 128, 256
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico_path_win = os.path.join(build_icons_win, 'icon.ico')
    ico_path_build = os.path.join(build_dir, 'icon.ico')
    ico_path_resources = os.path.join(resources_dir, 'icon.ico')
    
    master_img.save(ico_path_win, format='ICO', sizes=ico_sizes)
    master_img.save(ico_path_build, format='ICO', sizes=ico_sizes)
    master_img.save(ico_path_resources, format='ICO', sizes=ico_sizes)
    print(f'Saved Windows ICO to {ico_path_win}, {ico_path_build}, {ico_path_resources}')
    
    # 4. Create macOS .icns file
    # Standard ICNS chunks with PNG data
    icns_entries = [
        (b'ic04', 16),   # 16x16
        (b'ic11', 32),   # 16x16@2x
        (b'ic05', 32),   # 32x32
        (b'ic12', 64),   # 32x32@2x
        (b'ic07', 128),  # 128x128
        (b'ic13', 256),  # 128x128@2x
        (b'ic08', 256),  # 256x256
        (b'ic14', 512),  # 256x256@2x
        (b'ic09', 512),  # 512x512
        (b'ic10', 1024), # 512x512@2x / 1024x1024
    ]
    
    icns_body = bytearray()
    for ostype, s in icns_entries:
        bio = io.BytesIO()
        png_images[s].save(bio, format='PNG')
        png_data = bio.getvalue()
        entry_length = 8 + len(png_data)
        icns_body += ostype
        icns_body += struct.pack('>I', entry_length)
        icns_body += png_data
        
    total_icns_length = 8 + len(icns_body)
    icns_data = b'icns' + struct.pack('>I', total_icns_length) + icns_body
    
    icns_path_mac = os.path.join(build_icons_mac, 'icon.icns')
    icns_path_build = os.path.join(build_dir, 'icon.icns')
    icns_path_resources = os.path.join(resources_dir, 'icon.icns')
    
    with open(icns_path_mac, 'wb') as f:
        f.write(icns_data)
    with open(icns_path_build, 'wb') as f:
        f.write(icns_data)
    with open(icns_path_resources, 'wb') as f:
        f.write(icns_data)
    print(f'Saved macOS ICNS to {icns_path_mac}')
    
    # 5. Also copy SVG to renderer public and resources for web/favicon/asset use
    with open(os.path.join(renderer_public_dir, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(svg_content)
    with open(os.path.join(resources_dir, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(svg_content)
    # Also save 32x32 and 192x192 favicon in renderer public
    png_images[32].save(os.path.join(renderer_public_dir, 'favicon.png'), format='PNG')
    
    print('All icons generated successfully!')

if __name__ == '__main__':
    main()
