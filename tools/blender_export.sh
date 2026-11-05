#!/usr/bin/env bash
# Re-export the Blender models (needs Blender 4.x/5.x on PATH, or `pip install bpy` in a Python 3.11+/3.13 venv).
#   ./tools/blender_export.sh            # uses `blender -b --python`
#   PYBPY=python3 ./tools/blender_export.sh   # uses the bpy module instead
set -e
cd "$(dirname "$0")/../blender"
for m in gacha omikuji snowdome; do
  if [ -n "$PYBPY" ]; then "$PYBPY" "$m.py" -- "$m.glb"; else blender -b --python "$m.py" -- "$m.glb"; fi
done
cd .. && python3 tools/embed_assets.py && python3 build.py
