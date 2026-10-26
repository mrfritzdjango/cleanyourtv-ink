"""Build land.json from defs/*.py (each defines build() -> geom.Animal)."""
import importlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ORDER = ["tapir", "tiger", "orangutan", "sunbear", "rhinohornbill", "proboscis", "pangolin",
         "mousedeer", "elephant", "loris", "flyingfox", "gaur", "cloudedleopard", "monitor",
         "gibbon", "otter", "binturong", "colugo", "crocodile", "fishowl", "kingfisher",
         "birdwing", "piedhornbill", "peacockpheasant"]

def main():
    out = []
    only = sys.argv[1:] or None
    for name in ORDER:
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "defs", name + ".py")
        if not os.path.exists(p):
            continue
        mod = importlib.import_module("defs." + name)
        out.append(mod.build().json())
    dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "land.json")
    with open(dst, "w") as f:
        f.write('{"animals":[\n')
        f.write(",\n".join(json.dumps(a, separators=(",", ":")) for a in out))
        f.write("\n]}\n")
    print("built", len(out), "animals")

if __name__ == "__main__":
    main()
