#!/bin/sh
# live.sh: bakes every animal whose show passes check.js right now, rebuilds Today and installs it on the TV.
# Files still being written are skipped. TV: ADB_SERIAL (default the paired Chromecast).
cd "$(dirname "$0")"
ADB=${ADB:-$(command -v adb || echo "$HOME/Library/Android/sdk/platform-tools/adb")}
SERIAL=${ADB_SERIAL:-$($ADB devices | awk '/:[0-9]+\tdevice/{print $1; exit}')}
ok=""
for f in motions/*.js; do
  name=$(basename "$f" .js); [ "$name" = lib ] && continue
  ids=$(node -e "
    const fs=require('fs'),vm=require('vm');const c={console,Math,Float32Array,Object,Array,JSON,Number,String,Set,Map};vm.createContext(c);
    for (const x of ['engine.js','motions/lib.js']) vm.runInContext(fs.readFileSync(x,'utf8'),c);
    try { vm.runInContext(fs.readFileSync('$f','utf8'),c); } catch(e) { process.exit(0); }
    console.log(Object.keys(c.Ink.MOTIONS).join(' '));" 2>/dev/null)
  for id in $ids; do
    if node check.js "$name" "$id" >/dev/null 2>&1; then ok="$ok,$id"; else echo "not yet: $id"; fi
  done
done
ok=${ok#,}
[ -z "$ok" ] && { echo "nothing passes yet"; exit 1; }
IDS="$ok" node bake.js ../app/src/main/assets/moves.bin | head -1
cd .. && ./gradlew --no-daemon -q assembleRelease 2>&1 | grep -i error
$ADB -s "$SERIAL" install -r app/build/outputs/apk/release/app-release.apk | tail -1
echo "live on the TV: $(echo "$ok" | tr ',' ' ')"
