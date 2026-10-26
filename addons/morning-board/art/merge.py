"""Merges land.json and sea.json (land/build.py, sea/gen.py) into the app's assets/animals.json.

The local Malaysian names (the "malay" field the captions show) are not in the drawings: they are kept from the
animals.json already there, by id. A new animal without one shows its Latin name until it is given one.

Usage: python3 merge.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ASSET = os.path.join(HERE, '..', 'app', 'src', 'main', 'assets', 'animals.json')


def main():
    old = {}
    if os.path.exists(ASSET):
        old = {a['id']: a for a in json.load(open(ASSET, encoding='utf-8'))['animals']}
    animals = []
    for name in ('land.json', 'sea.json'):
        for a in json.load(open(os.path.join(HERE, name), encoding='utf-8'))['animals']:
            malay = old.get(a['id'], {}).get('malay')
            if malay:
                a['malay'] = malay
            animals.append(a)
    with open(ASSET, 'w', encoding='utf-8') as f:
        json.dump({'animals': animals}, f, separators=(',', ':'))
    print('merged', len(animals), 'animals into', os.path.relpath(ASSET, HERE))


if __name__ == '__main__':
    main()
