#!/usr/bin/env python3
"""
Kataribe panel build script.
Usage:
  python3 build.py              # Run all build steps
  python3 build.py --stamp      # Version the assets (?v=<hash>) and the service worker
  python3 build.py --validate   # Validate HTML only
  python3 build.py --links      # Check internal links only
  python3 build.py --dist       # Copy to dist/ directory only
  python3 build.py --check      # Fail if --stamp would change anything (nothing is written)

The site has one hand-written stylesheet (css/panel.css) served as it is, so there
is no minify step. Cloudflare keeps css/js for hours: every css/js address carries
?v=<hash of the whole static shell>, and --stamp rewrites it everywhere at once
(HTML, ES-module imports and the service worker list). Run it before each commit
that touches a page, a stylesheet or a script.

Requires: Python 3.8+ (stdlib only)
"""

import argparse
import glob
import hashlib
import html.parser
import json
import os
import re
import shutil
import sys
from pathlib import Path

# ─── Paths ───────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
os.chdir(ROOT)  # every path below is relative to the site root

HTML_FILES = sorted(f for f in glob.glob("*.html") + glob.glob("*/index.html") if not f.startswith("dist/"))

# ─── Asset versions (?v=<hash>) and service worker list ─────────────
SW_FILE = "sw.js"
SW_START = "/* build:assets:start"
SW_END = "/* build:assets:end */"

# Extra files the service worker keeps for offline use (besides pages, css and js).
SHELL_EXTRA = [
    "site.webmanifest",
    "fonts/jetbrains-mono-kataribe-em1200.woff2",
    "brand/favicon.svg",
    "brand/favicon-32.png",
    "brand/icon-180.png",
    "brand/icon-192.png",
    "brand/icon-512.png",
]

# Pages kept offline (the redirect stubs are not needed there).
SHELL_PAGES = ["index.html", "mining.html", "controller_view.html", "404.html"]

VERSION_RE = re.compile(r'(\.(?:css|js))\?v=[0-9a-z]+')
# href="x.css" / src="x.js" in HTML (local addresses only)
HTML_REF_RE = re.compile(r'''((?:href|src)=["'])(?!https?:|//|data:)([^"'?#]+\.(?:css|js))(?:\?v=[0-9a-z]+)?(["'])''')
# import ... from './x.js'   and   import('./x.js')
JS_IMPORT_RE = re.compile(r'''((?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'])(\.{1,2}/[^"'?#]+\.js)(?:\?v=[0-9a-z]+)?(["'])''')


def script_files() -> list:
    """Every script of the site, as paths relative to the root."""
    files = set(glob.glob("js/**/*.js", recursive=True)) | {"main.js", "vendor/decimal.min.js"}
    return sorted(f.replace(os.sep, "/") for f in files if (ROOT / f).exists())


def style_files() -> list:
    return sorted(f.replace(os.sep, "/") for f in glob.glob("css/*.css"))


def strip_versions(text: str) -> str:
    return VERSION_RE.sub(r"\1", text)


def shell_hash() -> str:
    """One short hash for the whole static shell (the same whatever ?v= it carries now)."""
    digest = hashlib.sha256()
    for rel in sorted(set(HTML_FILES + style_files() + script_files() + SHELL_EXTRA)):
        path = ROOT / rel
        if not path.exists():
            continue
        data = path.read_bytes()
        if rel.endswith((".html", ".css", ".js")):
            data = strip_versions(data.decode("utf-8")).encode("utf-8")
        digest.update(rel.encode("utf-8") + b"\0" + data + b"\0")
    return digest.hexdigest()[:10]


def sw_block(version: str) -> str:
    urls = ["/"] + ["/" + p for p in SHELL_PAGES if (ROOT / p).exists()]
    urls += [f"/{f}?v={version}" for f in style_files() + script_files()]
    urls += ["/" + f for f in SHELL_EXTRA if (ROOT / f).exists()]
    lines = [SW_START + " — written by `python3 build.py --stamp`; do not edit by hand */",
             f"const CACHE = 'panel-ascii-{version}';",
             "const ASSETS = ["]
    lines += [f"  '{u}'," for u in urls]
    lines += ["];", SW_END]
    return "\n".join(lines)


def stamp_assets(write: bool = True) -> list:
    """Put ?v=<hash> on every css/js address. Returns the files that changed (or would)."""
    version = shell_hash()
    changed = []

    def apply(rel: str, new_text: str, old_text: str):
        if new_text != old_text:
            changed.append(rel)
            if write:
                (ROOT / rel).write_text(new_text, encoding="utf-8", newline="\n")

    for rel in HTML_FILES:
        old = (ROOT / rel).read_text(encoding="utf-8")
        apply(rel, HTML_REF_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={version}{m.group(3)}", old), old)

    for rel in script_files():
        if rel.startswith("vendor/"):
            continue
        old = (ROOT / rel).read_text(encoding="utf-8")
        apply(rel, JS_IMPORT_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={version}{m.group(3)}", old), old)

    sw_path = ROOT / SW_FILE
    if sw_path.exists():
        old = sw_path.read_text(encoding="utf-8")
        start, end = old.find(SW_START), old.find(SW_END)
        if start == -1 or end == -1:
            print(f"  ✗ {SW_FILE}: build markers not found")
            changed.append(SW_FILE + " (markers missing)")
        else:
            apply(SW_FILE, old[:start] + sw_block(version) + old[end + len(SW_END):], old)

    verb = "updated" if write else "would change"
    if changed:
        for rel in changed:
            print(f"  {'✓' if write else '✗'} {verb}: {rel}")
    print(f"  {'✓' if write or not changed else '✗'} asset version: {version}" + ("" if write or not changed else "  (run: python3 build.py --stamp)"))
    return changed


# ─── HTML Validator ─────────────────────────────────────────────────
class HTMLValidator(html.parser.HTMLParser):
    """Basic HTML5 validator checks."""

    VOID_ELEMENTS = {
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr',
    }

    def __init__(self, filename: str):
        super().__init__()
        self.filename = filename
        self.errors = []
        self.warnings = []
        self.stack = []
        self.has_doctype = False
        self.has_html = False
        self.has_head = False
        self.has_body = False
        self.in_head = False
        self.in_body = False
        self.lang_set = False
        self.title_set = False
        self.viewport_set = False
        self.meta_count = 0
        self.link_count = 0
        self.img_without_alt = []
        self.nested_interactive = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attrs_dict = dict(attrs)

        # Check doctype
        if tag == 'html':
            if not self.has_doctype:
                self.warnings.append("Missing <!DOCTYPE html>")
            self.has_html = True

        # Check lang attribute
        if tag == 'html' and 'lang' not in attrs_dict:
            self.errors.append("Missing lang attribute on <html>")
        elif tag == 'html':
            self.lang_set = True

        # Check title
        if tag == 'title':
            self.title_set = True

        # Check viewport meta
        if tag == 'meta' and (attrs_dict.get('name') or '').lower() == 'viewport':
            self.viewport_set = True

        # Check img alt
        if tag == 'img' and 'alt' not in attrs_dict:
            self.img_without_alt.append(f"<img without alt attribute>")

        # Check img width/height for CLS
        if tag == 'img' and not self.in_head:
            if 'width' not in attrs_dict or 'height' not in attrs_dict:
                alt_val = attrs_dict.get('alt', 'no-alt')
                self.warnings.append(f"<img alt='{alt_val}' missing width or height (CLS risk)")

        # Check a href
        if tag == 'a' and 'href' not in attrs_dict:
            self.errors.append("<a> without href attribute")

        # Track head/body
        if tag == 'head':
            self.in_head = True
            self.has_head = True
        if tag == 'body':
            self.in_body = True
            self.has_body = True

        # Track nesting
        if tag not in self.VOID_ELEMENTS:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == 'head':
            self.in_head = False
        if tag == 'body':
            self.in_body = False
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()

    def handle_decl(self, decl):
        if decl.upper().startswith('DOCTYPE'):
            self.has_doctype = True

    def get_report(self) -> tuple:
        """Returns (errors, warnings)."""
        errors = list(self.errors)
        warnings = list(self.warnings)

        if not self.has_html:
            errors.append("Missing <html> element")
        if not self.has_head:
            errors.append("Missing <head> element")
        if not self.has_body:
            errors.append("Missing <body> element")
        if not self.title_set:
            errors.append("Missing <title> element")
        if not self.viewport_set:
            warnings.append("Missing viewport meta tag")
        if self.img_without_alt:
            for img in self.img_without_alt:
                errors.append(img)

        return errors, warnings


def validate_html() -> list:
    """Validate all HTML files. Returns list of (file, errors, warnings) tuples."""
    results = []
    for rel_path in HTML_FILES:
        file = ROOT / rel_path
        if not file.exists():
            continue

        content = file.read_text(encoding="utf-8")
        validator = HTMLValidator(rel_path)
        validator.feed(content)
        errors, warnings = validator.get_report()

        status = "✓" if not errors else "✗"
        msg = f"  {status} {rel_path}"
        if errors:
            msg += f" ({len(errors)} errors)"
        if warnings:
            msg += f" ({len(warnings)} warnings)"
        print(msg)

        if errors:
            for e in errors:
                print(f"    ERROR: {e}")
        if warnings:
            for w in warnings:
                print(f"    WARN: {w}")

        results.append((rel_path, errors, warnings))
    return results


# ─── Link Checker ────────────────────────────────────────────────────
def check_links() -> list:
    """Check internal links in HTML files. Returns list of broken links."""
    broken = []
    existing_files = set()

    # Build set of existing files (relative to root)
    for dirpath, dirnames, filenames in os.walk(ROOT):
        # Skip dist/, .git/, node_modules/
        rel_dir = os.path.relpath(dirpath, ROOT)
        if rel_dir == '.' or (not rel_dir.startswith('dist') and not rel_dir.startswith('.git') and not rel_dir.startswith('node_modules')):
            for f in filenames:
                existing_files.add(os.path.join(rel_dir, f) if rel_dir != '.' else f)

    for rel_path in HTML_FILES:
        file = ROOT / rel_path
        if not file.exists():
            continue

        content = file.read_text(encoding="utf-8")
        # Find all href and src attributes (relative paths only)
        href_pattern = r'''(?:href|src)=["']([^"']*?)["']'''
        matches = re.findall(href_pattern, content)

        for link in matches:
            # Skip external, protocol-relative, data:, mailto:, tel:, #anchors, javascript:, root
            if (link.startswith(('http://', 'https://', '//', 'data:', 'mailto:', 'tel:', '#', 'javascript:'))):
                continue
            # Root link is always valid
            if link == '/':
                continue
            # Strip query strings and fragments
            clean = link.split('?')[0].split('#')[0]
            if not clean:
                continue

            # Normalize path
            clean = clean.lstrip('./')
            if clean not in existing_files and (clean + '/index.html') not in existing_files and (clean + '.html') not in existing_files:
                # Check if it's a directory with index.html
                broken.append((rel_path, link))
                print(f"  ✗ {rel_path}: broken link → {link}")

    if not broken:
        print("  ✓ All internal links valid")

    return broken


# ─── Build Dist ──────────────────────────────────────────────────────
def build_dist() -> str:
    """Copy the site to dist/ (what gets served: no build tooling)."""
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    # Copy everything except .git, node_modules, dist, docs, build artifacts
    skip_dirs = {'.git', 'node_modules', 'dist', 'docs', '__pycache__', '.hermes'}
    skip_files = {'.gitignore', 'build.py', 'package.json'}

    for item in ROOT.iterdir():
        if item.name in skip_dirs or item.name in skip_files:
            continue
        if item.is_dir():
            if item.name in skip_dirs:
                continue
            shutil.copytree(item, DIST / item.name, dirs_exist_ok=True,
                          ignore=lambda d, files: [f for f in files if f.endswith('.min') or f.endswith('.pyc')])
        elif item.is_file():
            # Skip .min files from source copy
            if not item.name.endswith('.min'):
                shutil.copy2(item, DIST / item.name)

    # Report
    total = sum(f.stat().st_size for f in DIST.rglob('*') if f.is_file()) / 1024
    file_count = sum(1 for f in DIST.rglob('*') if f.is_file())
    print(f"  ✓ dist/ built: {file_count} files, {total:.1f}KB total")

    return str(DIST)


# ─── Main ────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Kataribe panel build tool")
    parser.add_argument("--stamp", action="store_true", help="Version css/js addresses and the service worker list")
    parser.add_argument("--check", action="store_true", help="Fail if --stamp would change anything")
    parser.add_argument("--validate", action="store_true", help="Validate HTML files")
    parser.add_argument("--links", action="store_true", help="Check internal links")
    parser.add_argument("--dist", action="store_true", help="Build dist/ directory")
    args = parser.parse_args()

    # If no flags, run all
    run_all = not any([args.stamp, args.check, args.validate, args.links, args.dist])

    print("=" * 50)
    print("Kataribe panel build")
    print("=" * 50)

    total_errors = 0

    if (run_all or args.stamp) and not args.check:
        print("\n📦 Versioning assets...")
        stamp_assets(write=True)

    if args.check:
        print("\n📦 Checking asset versions...")
        total_errors += len(stamp_assets(write=False))

    if run_all or args.validate:
        print("\n🔍 Validating HTML...")
        results = validate_html()
        total_errors += sum(len(e) for _, e, _ in results)

    if run_all or args.links:
        print("\n🔗 Checking internal links...")
        broken = check_links()
        if broken:
            total_errors += len(broken)

    if run_all or args.dist:
        print("\n📁 Building dist/...")
        build_dist()

    print("\n" + "=" * 50)
    if total_errors == 0:
        print("✅ Build complete — all checks passed")
    else:
        print(f"⚠️  Build complete — {total_errors} issue(s) found")
    print("=" * 50)

    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
