#!/usr/bin/env python3
"""Extract Amiga hunk executables from raw sectors and parse their structure."""
import struct, sys, os

HUNKS = {
    0x3E7: 'UNIT', 0x3E8: 'NAME', 0x3E9: 'HUNK_NAME', 0x3EA: 'HUNK_CODE',
        0x3EB: 'HUNK_DATA', 0x3EC: 'HUNK_BSS', 0x3ED: 'HUNK_RELOC32',
    0x3EE: 'HUNK_RELOC16', 0x3EF: 'HUNK_RELOC8', 0x3F0: 'HUNK_EXT',
    0x3F1: 'HUNK_SYMBOL', 0x3F2: 'HUNK_END', 0x3F3: 'HUNK_HEADER',
    0x3F5: 'HUNK_OVERLAY', 0x3F6: 'HUNK_BREAK', 0x3F7: 'HUNK_DREL32',
    0x3F8: 'HUNK_DREL16', 0x3F9: 'HUNK_DREL8', 0x3FA: 'HUNK_LIB',
    0x3FB: 'HUNK_INDEX', 0x3FC: 'HUNK_RELOC32SHORT', 0x3FD: 'HUNK_RELRELOC32',
}

def parse_hunk(data, base_off, verbose=True):
    """Parse hunk executable starting at base_off. Returns list of segments [(name, bytes_or_size, hunk_type)] and consumed length."""
    off = base_off
    magic = struct.unpack_from('>I', data, off)[0]
    assert magic == 0x3F3, f"not HUNK_HEADER at {off:#x}: {magic:#x}"
    off += 4
    # resident library names (null-terminated length-prefixed)
    while True:
        n = struct.unpack_from('>I', data, off)[0]
        if n == 0:
            off += 4
            break
        ln = (n & 0xFFFFFF) * 4
        off += 4 + ln
        if verbose: print(f"  resident lib: {data[off-ln:off-ln+ (n & 0xFFFFFF)*4].decode('ascii', 'replace')}")
    table_size, first, last = struct.unpack_from('>3I', data, off)
    off += 12
    n_hunks = last - first + 1
    if verbose: print(f"  hunks: {n_hunks} (table_size={table_size}, first={first}, last={last})")
    off += 4 * table_size  # memory flags per hunk entry
    segs = []
    end_off = None
    while off < len(data) - 4:
        magic = struct.unpack_from('>I', data, off)[0]
        off += 4
        t = magic & 0x7FFFFFFF
        name = HUNKS.get(t, hex(t))
        if t == 0x3E9:  # HUNK_NAME
            n = struct.unpack_from('>I', data, off)[0]; off += 4
            ln = (n & 0xFFFFFF) * 4
            segname = data[off:off+ln].split(b'\0')[0].decode('ascii', 'replace')
            if verbose: print(f"  seg name: {segname}")
            off += ln
        elif t in (0x3EA, 0x3EB):  # CODE / DATA
            n = struct.unpack_from('>I', data, off)[0]; off += 4
            ln = (n & 0xFFFFFF) * 4
            segs.append((t, data[off:off+ln]))
            if verbose: print(f"  {name}: {ln} bytes at file+{off:#x}")
            off += ln
        elif t == 0x3EC:  # BSS
            n = struct.unpack_from('>I', data, off)[0]; off += 4
            ln = (n & 0xFFFFFF) * 4
            segs.append((t, ln))
            if verbose: print(f"  {name}: {ln} bytes")
        elif t in (0x3ED, 0x3EE, 0x3EF):  # RELOC32/16/8
            while True:
                count = struct.unpack_from('>I', data, off)[0]; off += 4
                if count == 0: break
                hunk_ref = struct.unpack_from('>I', data, off)[0]; off += 4
                if t == 0x3ED: off += 4 * count
                elif t == 0x3EE: off += 2 * count
                else: off += count
        elif t == 0x3F2:  # END
            end_off = off
            if verbose: print(f"  {name} at file+{off:#x}")
            break
        elif t == 0x3F6:  # BREAK (overlay)
            if verbose: print(f"  {name}")
            # overlay: subsequent hunks are separate overlay modules; stop here
            end_off = off
            break
        else:
            if verbose: print(f"  {name} (0x{t:x}) unhandled; stopping")
            end_off = off
            break
    return segs, end_off

def extract(path, outdir):
    with open(path, 'rb') as f:
        data = f.read()
    tag = os.path.basename(path)
    # find HUNK_HEADERs at sector boundaries
    found = []
    for sec in range(len(data)//512):
        if struct.unpack_from('>I', data, sec*512)[0] == 0x3F3:
            found.append(sec)
    print(f"{tag}: HUNK_HEADER at sectors {found}")
    for i, sec in enumerate(found):
        print(f"\n--- hunk file #{i} at sector {sec} ---")
        segs, end_off = parse_hunk(data, sec*512)
        raw = data[sec*512:end_off] if end_off else data[sec*512:sec*512+8192]
        fn = os.path.join(outdir, f"{os.path.splitext(tag)[0][:20]}_hunk{i}_sec{sec}.bin")
        with open(fn, 'wb') as f:
            f.write(raw)
        print(f"  raw saved: {fn} ({len(raw)} bytes, end_off sector {end_off//512 if end_off else '?'})")

extract(sys.argv[1], sys.argv[2])
