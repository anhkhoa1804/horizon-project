#!/usr/bin/env python3
"""Turn a build (out/) into the Slides artifact's files (publish/project/...), resolving {{img:NAME}} to uploaded asset URLs.
Usage: python3 publish_prep.py out publish   (blob_map.json maps local asset names to the artifact's /_blob/ urls)"""
import json, os, re, sys, shutil
src, dst = sys.argv[1], sys.argv[2]
m = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "blob_map.json")))
shutil.rmtree(dst, ignore_errors=True); os.makedirs(dst + "/project/slides")
deck = json.load(open(src + "/deck.json"))
for k in deck["order"]:
    h = open(f"{src}/slides/{k}.html").read()
    h = re.sub(r"\{\{img:([^}]+)\}\}", lambda x: m[x.group(1)], h)
    assert "{{" not in h
    open(f"{dst}/project/slides/{k}.html", "w").write(h)
json.dump(deck, open(dst + "/project/deck.json", "w"), ensure_ascii=False, indent=1)
print(len(deck["order"]), "slides ->", dst)
