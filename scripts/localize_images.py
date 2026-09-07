from __future__ import annotations

import hashlib
import io
import json
import mimetypes
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
DATA_FILES = [ROOT / "data" / "articles.json", *sorted((ROOT / "data" / "articles").glob("*.json"))]
IMAGE_DIR = ROOT / "images" / "editorial"
MANIFEST_PATH = ROOT / "data" / "editorial-image-map.json"

MAX_DIMENSION = 1920
MIN_OPTIMIZE_BYTES = 350_000
JPEG_QUALITY = 85
WEBP_QUALITY = 85

RASTER_OPTIMIZE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
PASSTHROUGH_EXTENSIONS = {".gif", ".svg", ".avif", ".ico"}

IMAGE_DIR.mkdir(parents=True, exist_ok=True)


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {"version": 1, "images": {}}

    payload = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{MANIFEST_PATH} must contain a JSON object")
    payload.setdefault("version", 1)
    payload.setdefault("images", {})
    return payload


MANIFEST = load_manifest()


def write_manifest() -> None:
    MANIFEST_PATH.write_text(
        json.dumps(MANIFEST, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def root_relative(path: Path) -> str:
    return "/" + path.relative_to(ROOT).as_posix()


def allocated_local_paths() -> dict[str, str]:
    result: dict[str, str] = {}
    for source_url, info in MANIFEST.get("images", {}).items():
        if isinstance(info, dict):
            local = str(info.get("local") or "")
            if local:
                result[local] = source_url
    return result


def safe_basename(url: str, content_type: str | None = None) -> str:
    parsed = urlparse(url)
    name = Path(parsed.path).name or "image"
    path = Path(name)

    if not path.suffix and content_type:
        ext = mimetypes.guess_extension(content_type) or ".img"
        name += ext

    return name


def choose_target(url: str, basename: str) -> Path:
    candidate = IMAGE_DIR / basename
    local = root_relative(candidate)
    allocated = allocated_local_paths()

    owner = allocated.get(local)
    if owner and owner != url:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:8]
        stem = candidate.stem or "image"
        candidate = candidate.with_name(f"{stem}-{digest}{candidate.suffix}")

    return candidate


def fetch_bytes(url: str) -> tuple[bytes, str | None]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; NeuralCriticImageOptimizer/1.0)",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
        return data, response.headers.get_content_type()


def resize_image(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image)
    if max(image.size) <= MAX_DIMENSION:
        return image.copy()

    resized = image.copy()
    resized.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
    return resized


def encode_candidate(data: bytes, suffix: str) -> tuple[bytes | None, str | None]:
    """Return optimized bytes and output suffix, or (None, None) when no safe win exists."""
    suffix = suffix.lower()

    if suffix in PASSTHROUGH_EXTENSIONS or len(data) < MIN_OPTIMIZE_BYTES:
        return None, None
    if suffix not in RASTER_OPTIMIZE_EXTENSIONS:
        return None, None

    try:
        with Image.open(io.BytesIO(data)) as source:
            frame = resize_image(source)

            if suffix in {".jpg", ".jpeg"}:
                if frame.mode not in {"RGB", "L"}:
                    frame = frame.convert("RGB")
                output = io.BytesIO()
                frame.save(
                    output,
                    format="JPEG",
                    quality=JPEG_QUALITY,
                    optimize=True,
                    progressive=True,
                )
                return output.getvalue(), ".jpg"

            # WebP preserves transparency and is a strong default for large PNG/BMP/TIFF assets.
            if frame.mode not in {"RGB", "RGBA", "L", "LA"}:
                frame = frame.convert("RGBA" if "transparency" in source.info else "RGB")
            output = io.BytesIO()
            frame.save(
                output,
                format="WEBP",
                quality=WEBP_QUALITY,
                method=6,
            )
            return output.getvalue(), ".webp"
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        print(f"WARNING: could not optimize image bytes: {exc}")
        return None, None


def materialize(url: str) -> tuple[Path, int, int]:
    existing = MANIFEST.get("images", {}).get(url)
    if isinstance(existing, dict):
        local = str(existing.get("local") or "")
        if local:
            local_path = ROOT / local.lstrip("/")
            if local_path.exists():
                source_bytes = int(existing.get("source_bytes") or local_path.stat().st_size)
                return local_path, source_bytes, local_path.stat().st_size

    parsed_name = safe_basename(url)
    guessed_target = choose_target(url, parsed_name)

    # Reuse previously localized bytes when they already exist under the source basename.
    # This avoids another Supabase download during the migration.
    content_type = None
    if guessed_target.exists():
        source_data = guessed_target.read_bytes()
        source_target = guessed_target
        print(f"Reusing {source_target.relative_to(ROOT)} as source for {url}")
    else:
        source_data, content_type = fetch_bytes(url)
        basename = safe_basename(url, content_type)
        source_target = choose_target(url, basename)
        print(f"Fetched {url} ({len(source_data)} bytes)")

    source_size = len(source_data)
    optimized, optimized_suffix = encode_candidate(source_data, source_target.suffix)

    final_target = source_target
    final_data = source_data

    if optimized is not None and len(optimized) < len(source_data):
        if optimized_suffix and optimized_suffix != source_target.suffix.lower():
            final_target = choose_target(url, f"{source_target.stem}{optimized_suffix}")
        final_data = optimized

    final_target.parent.mkdir(parents=True, exist_ok=True)
    if not final_target.exists() or final_target.read_bytes() != final_data:
        final_target.write_bytes(final_data)

    local_path = root_relative(final_target)
    final_size = len(final_data)
    saved = source_size - final_size
    if saved > 0:
        print(
            f"Optimized {url} -> {local_path}: "
            f"{source_size} -> {final_size} bytes ({saved / source_size:.1%} smaller)"
        )
    else:
        print(f"Localized {url} -> {local_path}: {final_size} bytes")

    MANIFEST.setdefault("images", {})[url] = {
        "local": local_path,
        "source_bytes": source_size,
        "local_bytes": final_size,
    }
    return final_target, source_size, final_size


def localize(value):
    if isinstance(value, dict):
        for key, item in list(value.items()):
            if key == "imageLocal" and isinstance(item, str):
                if item.startswith(("http://", "https://")):
                    try:
                        target, _, _ = materialize(item)
                        value[key] = root_relative(target)
                    except Exception as exc:
                        print(f"WARNING: could not localize {item}: {exc}")
                elif item.startswith("images/editorial/"):
                    value[key] = "/" + item
            else:
                value[key] = localize(item)
        return value
    if isinstance(value, list):
        return [localize(item) for item in value]
    return value


def main() -> None:
    for path in DATA_FILES:
        payload = json.loads(path.read_text(encoding="utf-8"))
        localized = localize(payload)
        path.write_text(json.dumps(localized, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Updated {path.relative_to(ROOT)}")

    write_manifest()

    manifest_before = sum(
        int(info.get("source_bytes") or 0)
        for info in MANIFEST.get("images", {}).values()
        if isinstance(info, dict)
    )
    manifest_after = sum(
        int(info.get("local_bytes") or 0)
        for info in MANIFEST.get("images", {}).values()
        if isinstance(info, dict)
    )
    count = len(MANIFEST.get("images", {}))
    saved = max(manifest_before - manifest_after, 0)
    print(
        f"Editorial image map: {count} source URLs, "
        f"{manifest_before / 1024 / 1024:.2f} MiB source -> "
        f"{manifest_after / 1024 / 1024:.2f} MiB local "
        f"({saved / 1024 / 1024:.2f} MiB saved)."
    )


if __name__ == "__main__":
    main()
