from __future__ import annotations

import json
import mimetypes
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA_FILES = [ROOT / "data" / "articles.json", *sorted((ROOT / "data" / "articles").glob("*.json"))]
IMAGE_DIR = ROOT / "images" / "editorial"
IMAGE_DIR.mkdir(parents=True, exist_ok=True)


def download(url: str) -> str:
    parsed = urlparse(url)
    name = Path(parsed.path).name
    if not name:
        name = "image"
    target = IMAGE_DIR / name

    if not target.exists():
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; NeuralCriticMigration/1.0)",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            },
        )
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read()
            if not target.suffix:
                content_type = response.headers.get_content_type()
                ext = mimetypes.guess_extension(content_type) or ".img"
                target = target.with_suffix(ext)
            target.write_bytes(data)
            print(f"Downloaded {url} -> {target.relative_to(ROOT)} ({len(data)} bytes)")

    return target.relative_to(ROOT).as_posix()


def localize(value):
    if isinstance(value, dict):
        for key, item in list(value.items()):
            if key == "imageLocal" and isinstance(item, str) and item.startswith(("http://", "https://")):
                try:
                    value[key] = download(item)
                except Exception as exc:
                    print(f"WARNING: could not download {item}: {exc}")
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


if __name__ == "__main__":
    main()
