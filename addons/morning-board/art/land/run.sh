#!/bin/sh
# build + validate + render contact sheet. usage: run.sh [only-ids]
cd "$(dirname "$0")"
venv/bin/python build.py && venv/bin/python validate.py ../land.json || exit 1
if [ -n "$1" ]; then
  venv/bin/python render.py ../land.json ../preview.png --only "$1" --cell ${CELL:-600} --cols ${COLS:-2}
else
  venv/bin/python render.py ../land.json ../contact-sheet.png
fi
