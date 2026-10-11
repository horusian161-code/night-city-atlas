#!/usr/bin/env python3
"""Build an installable Foundry directory ZIP and a self-contained local preview."""
import base64
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def js_json(value):
    return json.dumps(value, ensure_ascii=False).replace("</", "<\\/")

def build():
    manifest = json.loads((ROOT / "module.json").read_text())
    data = json.loads((ROOT / "data/atlas.json").read_text())
    assets = {}
    for path in sorted((ROOT / "assets").rglob("*.svg")):
        assets[path.relative_to(ROOT).as_posix()] = "data:image/svg+xml;base64," + base64.b64encode(path.read_bytes()).decode()
    ui = (ROOT / "scripts/atlas-ui.js").read_text().replace("export class AtlasUI", "class AtlasUI")
    ui = re.sub(r"^export\s*\{[^}]*\};?\s*$", "", ui, flags=re.MULTILINE).replace("</script", "<\\/script")
    css = (ROOT / "styles/atlas.css").read_text()
    html = '''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RED CITY // 2045 — Preview</title><style>html,body{height:100%;margin:0;background:#0b1016}body{padding:20px;box-sizing:border-box}#preview{height:100%;border:1px solid #344450;border-radius:8px;overflow:hidden}@media(max-width:700px){body{padding:0}#preview{border:0;border-radius:0}}</style><style>''' + css + '''</style></head><body><div id="preview" class="nca-app"></div><script>''' + ui + '\n' + f'const atlasData = {js_json(data)};\nconst embeddedAssets = {js_json(assets)};\nwindow.atlas = new AtlasUI(document.getElementById("preview"), atlasData, {{basePath:".", assetMap:embeddedAssets}});' + '''</script></body></html>'''
    (ROOT / "preview-offline.html").write_text(html, encoding="utf-8")
    example = {"schemaVersion":1,"locations":[{"id":"custom-example-clinic","name":"Клиника вашей кампании","nameEn":"Campaign Clinic","districtId":data["districts"][0]["id"],"category":"medical","x":data["districts"][0]["label"][0],"y":data["districts"][0]["label"][1],"summary":"Пример пользовательской точки; замените названием и описанием из своей игры.","source":"Метка кампании","precision":"approximate","hidden":False}],"overrides":[],"disabled":[]}
    (ROOT / "docs/import-example.json").write_text(json.dumps(example,ensure_ascii=False,indent=2)+"\n")
    outfile = ROOT.parent / f'red-city-night-city-atlas-v{manifest["version"]}.zip'
    exclude = {"__pycache__", "node_modules", ".git", ".github", "dist"}
    # Internal reference-import/art-generation intermediates depend on research inputs.
    exclude_files = {"contract.md", "finalize_data.py", "generate_art.py"}
    with zipfile.ZipFile(outfile,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for path in sorted(ROOT.rglob("*")):
            if path.is_file() and not any(part in exclude for part in path.relative_to(ROOT).parts) and path.name not in exclude_files:
                archive.write(path, arcname=(Path(manifest["id"]) / path.relative_to(ROOT)).as_posix())
    print(json.dumps({"archive":str(outfile),"sizeBytes":outfile.stat().st_size,"districts":len(data["districts"]),"locations":len(data["locations"]),"offlinePreview":str(ROOT/"preview-offline.html")},ensure_ascii=False))

if __name__ == "__main__":
    build()
