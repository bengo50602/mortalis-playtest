#!/usr/bin/env python3
"""Bundle the playtest app into one self-contained HTML file, and stamp a fresh
version onto every script tag so browsers can never serve a stale build.

Run after any change to index.html / pvp.html / engine.js / ui.js / cards.js / rules.js:
    python3 build_single_file.py
Output: mortalis_playtest.html — send it to anyone; it runs offline in any browser.
"""
import re
import time
from pathlib import Path

HERE = Path(__file__).parent
VERSION = time.strftime("%Y%m%d%H%M%S")

LOCAL_SRC = re.compile(r'(<script src=")([^":?]+\.js)(?:\?v=\d+)?(")')


def stamp(path: Path) -> int:
    """Append ?v=<build time> to local script tags so caches always miss."""
    if not path.exists():
        return 0
    text = path.read_text(encoding="utf-8")
    stamped, n = LOCAL_SRC.subn(rf'\1\2?v={VERSION}\3', text)
    if n:
        path.write_text(stamped, encoding="utf-8")
    return n


STAMP_RE = re.compile(r'<span id="buildstamp"[^>]*>[^<]*</span>')


def build_stamp(path: Path) -> bool:
    """Show the build id in the top bar so it's obvious which build is live."""
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8")
    tag = f'<span id="buildstamp" style="font-size:10px;color:#5e6673;letter-spacing:.3px">build {VERSION}</span>'
    if STAMP_RE.search(text):
        text = STAMP_RE.sub(tag, text)
    elif '<div class="spacer"></div>' in text:
        text = text.replace('<div class="spacer"></div>', tag + '\n  <div class="spacer"></div>', 1)
    else:
        return False
    path.write_text(text, encoding="utf-8")
    return True


for page in ("index.html", "pvp.html", "tutorial.html"):
    n = stamp(HERE / page)
    if n:
        print(f"Stamped {n} script tags in {page} (v={VERSION})")
    if build_stamp(HERE / page):
        print(f"Build stamp in {page}: {VERSION}")

# --- single-file bundle (query strings stripped when inlining) ---
html = (HERE / "index.html").read_text(encoding="utf-8")


def inline(m):
    src = m.group(1).split("?")[0]
    js = (HERE / src).read_text(encoding="utf-8")
    js = js.replace("</script>", "<\\/script>")
    return "<script>\n" + js + "\n</script>"


html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
out = HERE / "mortalis_playtest.html"
out.write_text(html, encoding="utf-8")
print(f"Wrote {out.name} ({out.stat().st_size // 1024} KB)")
