#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
from pathlib import Path


def slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or "guide"


def build_template(title: str, environment: str) -> str:
    return f"""# {title}

## Ziel

Kurze Beschreibung des Ergebnisses.

## Voraussetzungen

- Getestete Umgebung: {environment}

## Schritt-für-Schritt-Anleitung

1. Ersetzen Sie diesen Platzhalter durch den ersten echten Schritt.

## Prüfergebnis

Beschreiben Sie kurz, woran der Erfolg erkennbar ist.
"""


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create deterministic folders for a repo-local usage guide."
    )
    parser.add_argument("title", help="Guide title or working title")
    parser.add_argument(
        "--repo-root",
        default=".",
        help="Repository root that contains docs/ and output/",
    )
    parser.add_argument(
        "--slug",
        help="Override the generated slug",
    )
    parser.add_argument(
        "--environment",
        default="lokal/dev",
        help="Tested environment label written into the starter guide",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite the starter index.md if it already exists",
    )
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    slug = args.slug or slugify(args.title)

    guide_dir = repo_root / "docs" / "guides" / slug
    images_dir = guide_dir / "images"
    raw_dir = repo_root / "output" / "playwright" / slug
    index_file = guide_dir / "index.md"

    guide_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    if index_file.exists() and not args.force:
        print(f"Guide already exists: {index_file}")
    else:
        index_file.write_text(build_template(args.title, args.environment), encoding="utf-8")
        print(f"Wrote starter guide: {index_file}")

    print(f"Guide slug: {slug}")
    print(f"Guide dir: {guide_dir}")
    print(f"Images dir: {images_dir}")
    print(f"Raw screenshots dir: {raw_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
