#!/usr/bin/env python3
"""Extract all readable game text (NUL-terminated runs) from both disks."""
import re, os, json, struct

OUT = r"I:\Projekty\pirat\remake\assets"
os.makedirs(OUT, exist_ok=True)

def strings(data, minlen=6):
    """Runs of printable ASCII (with spaces) separated by NUL/control."""
    out = []
    for m in re.finditer(rb'[\x20-\x7e]{%d,}' % minlen, data):
        s = m.group()
        # require it to look like prose: has a space or is a known token
        if b' ' not in s and len(s) < 10:
            continue
        # reject obvious binary noise: too many odd symbols
        printableish = sum(1 for b in s if 32 <= b <= 126)
        if printableish != len(s):
            continue
        out.append((m.start(), s.decode('ascii')))
    return out

DISKS = {
 'd1': r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 1 of 2).adf",
 'd2': r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 2 of 2).adf",
 'd1a': r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 1 of 2)[a].adf",
}

all_text = {}
for tag, path in DISKS.items():
    d = open(path, 'rb').read()
    ss = strings(d)
    # drop duplicates & short noise
    seen = set()
    uniq = []
    for off, s in ss:
        key = s.strip()
        if key in seen: continue
        seen.add(key)
        uniq.append((off, s))
    all_text[tag] = uniq
    print(f"\n=== {tag}: {len(ss)} strings, {len(uniq)} unique ===")
    # print prose-like ones (>=2 words)
    prose = [(o, s) for o, s in uniq if s.count(' ') >= 2 and len(s) >= 12]
    for o, s in prose[:120]:
        print(f"  {o:#07x}: {s[:100]}")

json.dump({k: [dict(off=f"0x{o:06x}", text=s) for o, s in v] for k, v in all_text.items()},
          open(os.path.join(OUT, 'game_text.json'), 'w'), indent=1)
print("\nsaved assets/game_text.json")
