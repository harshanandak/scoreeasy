"""Local concept assembler. No runtime dependencies, no app files changed."""
from pathlib import Path

root = Path(__file__).parent
css = (root / 'shipped-css.txt').read_text(encoding='utf-8')
layout = (root / 'layout.css').read_text(encoding='utf-8')
fonts = (root / 'fonts.js').read_text(encoding='utf-8')
engine = (root / 'sets-engine.js').read_text(encoding='utf-8')
app = (root / 'concept.js').read_text(encoding='utf-8')
for page, mode in [('prototype.html','prototype'),('scoring-system.html','system'),('compare.html','compare')]:
    html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Score Easy scoring concepts</title>
<style>
{css}
</style>
<style>
{layout}
</style>
<script>{fonts}</script></head><body data-mode="{mode}"><main id="app"></main><script>{engine}</script><script>{app}</script></body></html>'''
    (root / page).write_text(html,encoding='utf-8')
print('Built 3 local concept pages')
