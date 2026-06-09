#!/usr/bin/env python3
"""Collect local text evidence for product clarity reviews.

The script prefers ripgrep when available and falls back to a small Python
walker. It prints Markdown so agents can paste useful findings into a brief.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
from pathlib import Path


DEFAULT_IGNORES = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    "dist",
    "build",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Search local evidence sources.")
    parser.add_argument("--root", action="append", default=[], help="Directory or file to search. Repeatable.")
    parser.add_argument("--terms", required=True, help="Comma-separated search terms or regex fragments.")
    parser.add_argument("--context", type=int, default=2, help="Context lines for ripgrep.")
    parser.add_argument("--limit", type=int, default=120, help="Maximum matches to print.")
    return parser.parse_args()


def build_pattern(terms: str) -> str:
    parts = [t.strip() for t in terms.split(",") if t.strip()]
    if not parts:
        raise SystemExit("--terms must contain at least one term")
    return "|".join(f"(?:{p})" for p in parts)


def rg_search(roots: list[str], pattern: str, context: int, limit: int) -> int:
    cmd = [
        "rg",
        "--line-number",
        "--ignore-case",
        "--context",
        str(context),
        "--glob",
        "!**/.git/**",
        "--glob",
        "!**/node_modules/**",
        "--glob",
        "!**/.venv/**",
        pattern,
        *roots,
    ]
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    all_lines = proc.stdout.splitlines()
    if limit:
        # Limit by match count, not total lines; context lines must not consume the budget.
        # With --line-number, match lines are "path:N:content"; context lines are "path-N-content".
        kept: list[str] = []
        match_count = 0
        for line in all_lines:
            kept.append(line)
            if line != "--" and re.match(r".+:\d+:", line):
                match_count += 1
                if match_count >= limit:
                    break
        lines = kept
    else:
        lines = all_lines
    print("# Evidence Search Results\n")
    print(f"Pattern: `{pattern}`\n")
    print("```text")
    print("\n".join(lines))
    print("```")
    if proc.stderr.strip():
        print("\n## Search warnings\n")
        print("```text")
        print(proc.stderr.strip())
        print("```")
    return 0 if proc.returncode in (0, 1) else proc.returncode


def iter_text_files(root: Path):
    if root.is_file():
        yield root
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in DEFAULT_IGNORES]
        for filename in filenames:
            path = Path(dirpath) / filename
            if path.suffix.lower() in {
                ".png",
                ".jpg",
                ".jpeg",
                ".gif",
                ".pdf",
                ".zip",
                ".tar",
                ".gz",
                ".woff",
                ".ttf",
            }:
                continue
            yield path


def python_search(roots: list[str], pattern: str, limit: int) -> int:
    regex = re.compile(pattern, re.IGNORECASE)
    count = 0
    print("# Evidence Search Results\n")
    print(f"Pattern: `{pattern}`\n")
    for root in roots:
        path = Path(root).expanduser()
        if not path.exists():
            print(f"- Missing root: `{path}`")
            continue
        for file_path in iter_text_files(path):
            try:
                lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
            except OSError:
                continue
            for idx, line in enumerate(lines, start=1):
                if regex.search(line):
                    print(f"- `{file_path}:{idx}` {line.strip()[:500]}")
                    count += 1
                    if limit and count >= limit:
                        return 0
    return 0


def main() -> int:
    args = parse_args()
    roots = [os.path.expanduser(r) for r in (args.root or ["."])]
    pattern = build_pattern(args.terms)
    if shutil.which("rg"):
        return rg_search(roots, pattern, args.context, args.limit)
    return python_search(roots, pattern, args.limit)


if __name__ == "__main__":
    raise SystemExit(main())
