#!/usr/bin/env python3
"""Wyciąga blok LEVELS z remake/index.html do work/levels_block.js."""
s = open('remake/index.html', encoding='utf-8').read()
start = s.index("const LEVELS=[")
i = start + len("const LEVELS=")
depth = 0
in_str = False
q = ''
while i < len(s):
    c = s[i]
    if in_str:
        if c == '\\':
            i += 2
            continue
        if c == q:
            in_str = False
    elif c == '"' or c == "'":
        in_str = True
        q = c
    elif c == '[':
        depth += 1
    elif c == ']':
        depth -= 1
        if depth == 0:
            i += 1
            break
    i += 1
block = s[start:i]
open('work/levels_block.js', 'w', encoding='utf-8').write(block)
print("extracted", len(block), "chars")
