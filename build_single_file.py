#!/usr/bin/env python3
"""Bundle the playtest app into one self-contained HTML file.
Run after any change to index.html / engine.js / ui.js / cards.js / rules.js:
    python3 build_single_file.py
Output: mortalis_playtest.html — send it to anyone; it runs offline in any browser.
"""
import re
from pathlib import Path

HERE = Path(__file__).parent
html = (HERE / "index.html").read_text(encoding="utf-8")

def inline(m):
    src = m.group(1)
    js = (HERE / src).read_text(encoding="utf-8")
    js = js.replace("</script>", "<\\/script>")
    return "<script>\n" + js + "\n</script>"

html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
out = HERE / "mortalis_playtest.html"
out.write_text(html, encoding="utf-8")
print(f"Wrote {out.name} ({out.stat().st_size // 1024} KB)")
