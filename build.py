#!/usr/bin/env python3
"""
BitQuai Controller-View build script.
Usage:
  python3 build.py              # Run all build steps
  python3 build.py --css        # Minify CSS only
  python3 build.py --validate   # Validate HTML only
  python3 build.py --links      # Check internal links only
  python3 build.py --dist       # Copy to dist/ directory only

Requires: Python 3.8+ (stdlib only)
"""

import argparse
import glob
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

CSS_FILES = [
    "css/styles.css",
    "css/brand.css",
    "controller_styles.css",
]

HTML_FILES = [f for f in glob.glob("*.html") + glob.glob("*/index.html") if not f.startswith("dist/")]

# ─── CSS Minifier ───────────────────────────────────────────────────
def minify_css(text: str) -> str:
    """Strip comments, normalize whitespace, remove unnecessary chars."""
    # Remove CSS comments /* ... */
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    # Remove leading/trailing whitespace from lines
    text = '\n'.join(line.strip() for line in text.split('\n'))
    # Remove newlines around braces, colons, semicolons
    text = re.sub(r'\s*\{\s*', '{', text)
    text = re.sub(r'\s*\}\s*', '}', text)
    text = re.sub(r'\s*;\s*', ';', text)
    text = re.sub(r'\s*:\s*', ':', text)
    text = re.sub(r'\s*,\s*', ',', text)
    # Collapse multiple spaces
    text = re.sub(r'[^\S\n]+', ' ', text)
    # Remove remaining newlines
    text = text.replace('\n', '')
    # Remove space before semicolons and closing braces
    text = re.sub(r'\s*;{1}', ';', text)
    text = re.sub(r'\s*}', '}', text)
    # Remove space after opening brace
    text = re.sub(r'{\s*', '{', text)
    # Remove empty rules
    text = re.sub(r'[^{]*\{\s*\}', '', text)
    return text.strip()


def build_css() -> list:
    """Minify all CSS files. Returns list of (original, minified) tuples."""
    results = []
    for rel_path in CSS_FILES:
        src = ROOT / rel_path
        if not src.exists():
            print(f"  ⚠ CSS not found: {rel_path}")
            continue

        rel = Path(rel_path)
        min_rel_path = rel.with_name(f"{rel.stem}.min{rel.suffix}")
        min_path = ROOT / min_rel_path
        original = src.read_text(encoding="utf-8")
        minified = minify_css(original)
        min_path.write_text(minified, encoding="utf-8")

        orig_kb = len(original.encode("utf-8")) / 1024
        mini_kb = len(minified.encode("utf-8")) / 1024
        reduction = (1 - mini_kb / orig_kb) * 100 if orig_kb > 0 else 0

        print(f"  ✓ {rel_path}: {orig_kb:.1f}KB → {mini_kb:.1f}KB ({reduction:.0f}% smaller)")
        results.append((original, minified))
    return results


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
    """Copy project to dist/ with minified CSS referenced."""
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

    # Also copy minified CSS files (.min.css keeps a valid text/css MIME type)
    for css_file in CSS_FILES:
        rel = Path(css_file)
        min_rel = rel.with_name(f"{rel.stem}.min{rel.suffix}")
        min_src = ROOT / min_rel
        if min_src.exists():
            dest = DIST / min_rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(min_src, dest)

    # Report
    total = sum(f.stat().st_size for f in DIST.rglob('*') if f.is_file()) / 1024
    file_count = sum(1 for f in DIST.rglob('*') if f.is_file())
    print(f"  ✓ dist/ built: {file_count} files, {total:.1f}KB total")

    return str(DIST)


# ─── Main ────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="BitQuai Controller-View build tool")
    parser.add_argument("--css", action="store_true", help="Minify CSS files")
    parser.add_argument("--validate", action="store_true", help="Validate HTML files")
    parser.add_argument("--links", action="store_true", help="Check internal links")
    parser.add_argument("--dist", action="store_true", help="Build dist/ directory")
    args = parser.parse_args()

    # If no flags, run all
    run_all = not any([args.css, args.validate, args.links, args.dist])

    print("=" * 50)
    print("BitQuai Controller-View Build")
    print("=" * 50)

    total_errors = 0

    if run_all or args.css:
        print("\n📦 Minifying CSS...")
        build_css()

    if run_all or args.validate:
        print("\n🔍 Validating HTML...")
        results = validate_html()
        total_errors = sum(len(e) for _, e, _ in results)

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
