#!/bin/sh
# film.sh <animal id> <pass|outing> <out.gif|out.mp4> [fps 15] [width 640] [night 1|0]
# Renders one show with the same engine the TV's moves are baked from (film.html in headless Chrome), then cuts the
# frames apart with ffmpeg. Needs Node, ffmpeg and Google Chrome. Example: ./film.sh titan-triggerfish pass titane.gif
set -e
cd "$(dirname "$0")"
id=$1 mode=$2 out=$3 fps=${4:-15} w=${5:-640} night=${6:-1}
[ -n "$out" ] || { sed -n 2,4p "$0"; exit 1; }
case "$out" in /*) ;; *) out="$OLDPWD/$out" ;; esac
cols=8 h=$((w * 9 / 16))
n=$(node -e "
  const fs=require('fs'),vm=require('vm');const c={console,Math,Float32Array,Object,Array,JSON,Number,String,Set,Map};vm.createContext(c);
  for (const f of ['engine.js','motions/lib.js',...fs.readdirSync('motions').filter(f=>f!=='lib.js').map(f=>'motions/'+f)])
    try { vm.runInContext(fs.readFileSync(f,'utf8'),c); } catch (e) {}
  c.Ink.loadAnimals(JSON.parse(fs.readFileSync('../app/src/main/assets/animals.json')));
  console.log(Math.floor(c.Ink.duration('$id','$mode')*$fps)+1);")
rows=$(( (n + cols - 1) / cols ))
tmp=$(mktemp -d)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --user-data-dir="$tmp/profile" --allow-file-access-from-files \
  --virtual-time-budget=20000 --window-size=$((cols * w)),$((rows * h)) --screenshot="$tmp/grid.png" \
  "file://$PWD/film.html?id=$id&mode=$mode&fps=$fps&w=$w&cols=$cols&night=$night" >/dev/null 2>&1
cut="untile=${cols}x${rows},setpts=N/($fps*TB)"
case "$out" in
  *.gif) ffmpeg -v error -y -i "$tmp/grid.png" -vf "$cut,split[a][b];[a]palettegen=max_colors=16[p];[b][p]paletteuse=dither=none" -frames:v $n -r $fps "$out" ;;
  *) ffmpeg -v error -y -i "$tmp/grid.png" -vf "$cut,format=yuv420p" -frames:v $n -r $fps -c:v libx264 -crf 22 "$out" ;;
esac
rm -rf "$tmp"
echo "$out: $n frames at $fps fps"
