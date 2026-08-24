from __future__ import annotations

import os
import urllib.parse

DEFAULT_SITE_URL = "https://rouane12.github.io/NeuralCritic/"


def _normalized_site_url(value: str) -> str:
    raw = str(value or "").strip() or DEFAULT_SITE_URL
    parsed = urllib.parse.urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeError("NEURAL_CRITIC_SITE_URL must be an absolute http(s) URL.")
    path = parsed.path or "/"
    if not path.endswith("/"):
        path += "/"
    return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))


SITE_URL = _normalized_site_url(os.environ.get("NEURAL_CRITIC_SITE_URL", DEFAULT_SITE_URL))
_parsed = urllib.parse.urlparse(SITE_URL)
BASE_PATH = _parsed.path or "/"
if not BASE_PATH.startswith("/"):
    BASE_PATH = "/" + BASE_PATH
if not BASE_PATH.endswith("/"):
    BASE_PATH += "/"


def public_url(relative: str = "") -> str:
    return urllib.parse.urljoin(SITE_URL, relative)


def public_path(relative: str = "") -> str:
    return urllib.parse.urljoin(BASE_PATH, relative)
