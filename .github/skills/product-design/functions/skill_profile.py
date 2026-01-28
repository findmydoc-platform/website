#!/usr/bin/env python3
"""Repo-specific configuration loader for the product-design skill.

This keeps the skill generic while allowing a repo to define:
- Where to write ephemeral artifacts
- Where components/stories/tests live
- Tailwind integration model (Tailwind v4 CSS-first in this repo)

The default profile for this repo is `profiles/findmydoc.json`.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional


def default_profile_path() -> str:
    functions_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(functions_dir, "..", "profiles", "findmydoc.json"))


def load_profile(profile_path: Optional[str]) -> Dict[str, Any]:
    resolved = profile_path or default_profile_path()

    # If user passes a relative path, resolve relative to cwd.
    if not os.path.isabs(resolved):
        resolved = os.path.normpath(os.path.join(os.getcwd(), resolved))

    if not os.path.exists(resolved):
        raise FileNotFoundError(f"Profile not found: {resolved}")

    with open(resolved, "r") as f:
        data = json.load(f)

    if not isinstance(data, dict):
        raise ValueError("Profile JSON must be an object")

    return data


def get_profile_path(profile: Dict[str, Any], *keys: str, default: Optional[str] = None) -> Optional[str]:
    current: Any = profile
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            return default
        current = current[key]

    if current is None:
        return default

    if not isinstance(current, str):
        raise ValueError(f"Profile path {'.'.join(keys)} must be a string")

    return current


def get_artifacts_dir(profile: Dict[str, Any], project_root: str) -> str:
    configured = get_profile_path(profile, "artifacts", "defaultDir", default="tmp/product-design")
    # Interpret as a repo-relative path.
    return os.path.normpath(os.path.join(project_root, configured))
