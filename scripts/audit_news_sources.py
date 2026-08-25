#!/usr/bin/env python3
"""Regression checks for Neural Critic newsroom sources and source documents."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []


def text(path: str) -> str:
    target = ROOT / path
    if not target.exists():
        ERRORS.append(f"Missing required file: {path}")
        return ""
    return target.read_text(encoding="utf-8", errors="replace")


def require(path: str, markers: tuple[str, ...]) -> None:
    content = text(path)
    for marker in markers:
        if marker not in content:
            ERRORS.append(f"{path} missing newsroom source marker: {marker}")


def main() -> int:
    require("article.html", (
        "assets/article-news.css?v=20260825-sources1",
        "assets/article-news.js?v=20260825-sources1",
    ))
    require("studio.html", (
        "assets/studio-media.js?v=20260825-sources1",
        "assets/studio-news.js?v=20260825-sources1",
        "assets/studio-news.css?v=20260825-sources1",
    ))
    require("assets/studio-media.js", (
        "window.NeuralCriticStudioMedia",
        "uploadAsset",
        "pathPrefix",
    ))
    require("assets/studio-news.js", (
        "DOCUMENT_TYPES",
        "application/pdf",
        "currentDocuments",
        "news-update-source-name",
        "news-update-source-url",
        "news-document-upload",
        "documents: currentDocuments.map",
        "sourceName: String(item.sourceName",
        "sourceUrl: String(item.sourceUrl",
    ))
    require("assets/article-news.js", (
        "nc-news-update-source",
        "nc-news-source-library",
        "nc-news-pdf-viewer",
        "DOWNLOAD ${isPdf ? 'PDF' : 'FILE'}",
        "source_document_count",
    ))
    require("assets/article-news.css", (
        ".nc-news-update-source",
        ".nc-news-source-library",
        ".nc-news-pdf-viewer",
        ".nc-news-source-document",
    ))
    require("supabase/migrations/20260825_allow_editorial_source_documents.sql", (
        "application/pdf",
        "text/plain",
        "text/csv",
        "application/json",
        "20971520",
    ))

    if ERRORS:
        print("News source audit failed:")
        for error in ERRORS:
            print(f"- {error}")
        return 1

    print("News source audit passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
