#!/usr/bin/env python3
"""Extract still frames from a video for design / reference review.

Examples:
  python tools/extract_frames.py path/to/clip.mp4
  python tools/extract_frames.py clip.mp4 --every 2 --out ./frames --max 12
  python tools/extract_frames.py clip.mp4 --fps 0.5
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def extract(
    video: Path,
    out_dir: Path,
    *,
    every: float | None,
    fps: float | None,
    max_frames: int | None,
    width: int | None,
) -> list[Path]:
    import imageio.v3 as iio
    from PIL import Image

    out_dir.mkdir(parents=True, exist_ok=True)

    # Prefer ffmpeg plugin bundled via imageio-ffmpeg
    reader_meta = iio.immeta(video, plugin="FFMPEG")
    source_fps = float(reader_meta.get("fps") or 30)
    duration = float(reader_meta.get("duration") or 0)

    if fps and fps > 0:
        interval = 1.0 / fps
    elif every and every > 0:
        interval = float(every)
    else:
        # Default: about 8 frames across the clip, min 1s apart
        target = 8 if not max_frames else max_frames
        interval = max(1.0, duration / max(target, 1)) if duration > 0 else 2.0

    written: list[Path] = []
    next_t = 0.0
    index = 0

    for i, frame in enumerate(iio.imiter(video, plugin="FFMPEG")):
        t = i / source_fps
        if t + 1e-6 < next_t:
            continue

        img = Image.fromarray(frame)
        if width and img.width > width:
            ratio = width / img.width
            img = img.resize((width, max(1, int(img.height * ratio))), Image.Resampling.LANCZOS)

        path = out_dir / f"frame-{index:03d}.jpg"
        img.convert("RGB").save(path, "JPEG", quality=90, optimize=True)
        written.append(path)
        index += 1
        next_t += interval

        if max_frames and index >= max_frames:
            break

    return written


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract JPEG frames from a video.")
    parser.add_argument("video", type=Path, help="Input video path (.mp4, .webm, …)")
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output directory (default: <video-stem>-frames beside the file)",
    )
    parser.add_argument("--every", type=float, default=None, help="Seconds between frames")
    parser.add_argument("--fps", type=float, default=None, help="Sample rate in frames/sec")
    parser.add_argument("--max", dest="max_frames", type=int, default=12, help="Max frames")
    parser.add_argument("--width", type=int, default=1280, help="Max frame width (0 = native)")
    args = parser.parse_args()

    video = args.video.expanduser().resolve()
    if not video.is_file():
        print(f"Video not found: {video}", file=sys.stderr)
        return 1

    out_dir = (
        args.out.expanduser().resolve()
        if args.out
        else video.with_name(f"{video.stem}-frames")
    )
    width = None if not args.width or args.width <= 0 else args.width

    try:
        paths = extract(
            video,
            out_dir,
            every=args.every,
            fps=args.fps,
            max_frames=args.max_frames,
            width=width,
        )
    except Exception as exc:  # noqa: BLE001 — CLI surface
        print(f"Extraction failed: {exc}", file=sys.stderr)
        return 1

    print(f"Wrote {len(paths)} frame(s) -> {out_dir}")
    for p in paths:
        print(f"  {p.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
