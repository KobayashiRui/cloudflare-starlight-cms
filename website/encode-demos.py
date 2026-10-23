"""Encode browser-rendered annotation frames (optional asset-authoring tool).

Requires Pillow; not used by website builds or generated CMS projects.
Usage: python3 website/encode-demos.py /path/to/rendered-jpeg-frames
"""
import json
import sys
from pathlib import Path
from shutil import copyfile
from PIL import Image

root = Path(__file__).resolve().parent
frames_root = Path(sys.argv[1])
manifest = json.loads((root / 'dist/assets/demo-frames/manifest.json').read_text())
for entry in manifest:
    paths = [frames_root / Path(name).with_suffix('.jpg') for name in entry['frames']]
    frames = []
    for path in paths:
        with Image.open(path) as image:
            if image.size != (1100, 800):
                raise ValueError(f'Expected 1100 x 800 browser capture: {path}')
            frames.append(image.convert('RGB').quantize(colors=256))
    target = root / 'assets' / f"{entry['name']}.gif"
    frames[0].save(target, save_all=True, append_images=frames[1:],
                   duration=entry['duration'], loop=0, disposal=2, optimize=True)
    copyfile(paths[0], root / 'assets' / f"{entry['name']}-poster.jpg")
    print(f'{target.name}: {len(frames)} annotated frames, {target.stat().st_size:,} bytes')
