#!/bin/sh
# shot.sh <out.png> <query> [width] [height]  - screenshot strip.html?<query> in headless Chrome
cd "$(dirname "$0")"
profile=$(mktemp -d)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --user-data-dir="$profile" --allow-file-access-from-files --virtual-time-budget=10000 --window-size=${3:-1600},${4:-1000} \
  --screenshot="$1" "file://$PWD/strip.html?$2" 2>/dev/null >/dev/null
rm -rf "$profile"
