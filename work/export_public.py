"""Build the public repository tree (github.com/SychPL/traps-n-treasures-port) from git HEAD using an allow-list -
no original game data. Usage from the project root: python -I work/export_public.py ../pirat-public

The destination is reconciled with the allow-list: files that are no longer allowed are deleted, except the public
repo's own files (KEEP) and its .git. Small scrubs for publication are applied in SCRUB."""
import os, re, stat, subprocess, sys

dest = os.path.abspath(sys.argv[1])
names = subprocess.run(['git', 'ls-tree', '-r', '-z', '--name-only', 'HEAD'], capture_output=True, check=True).stdout
names = [n for n in names.decode('utf-8').split('\0') if n]

ALLOW = [r'game/[^/]+\.js', r'game/index\.html', r'game/lang/[^/]+\.json', r'game/assets-demo/(?:[^/]+/)*[^/]+',
         r'game/lib/chiptune3/(?:LICENSE|chiptune3\.js|chiptune3\.worklet\.js|libopenmpt\.worklet\.js)',
         r'work/[^/]+\.(?:py|js)', r'work/sweep_path_lvl1\.json', r'work/upscale/[^/]+\.(?:py|md|patch)',
         r'RESEARCH\.md', r'EXTRACTOR\.md', r'extractor/[^/]+\.(?:html|js|mjs|json)', r'play\.html', r'start-server\.bat',
         r'start\.bat', r'start\.sh', r'serve\.ps1', r'serve\.mjs']
DENY = {'work/_game.js', 'work/levels_block.js', 'work/gen_levels.py'}   # game texts / old remake levels
DATA = re.compile(r'\.(?:adf|ipf|zip|bin|hunk|mmd0|txt)$', re.I)       # never, whatever the allow-list says (except
DEMO = 'game/assets-demo/'                                               # the demo pack: our own, made by make_demo_assets.py)
KEEP = {'README.md', 'LICENSE', '.gitignore'}                            # files that exist only in the public repo
SCRUB = {
    'RESEARCH.md': [(r'http://192\.168\.\d+\.\d+:8435/', 'http://<adres-w-LAN>:8435/')],
    'start-server.bat': [(r'/remake/index\.html', '/game/'), (r'Tresc    : http://127\.0\.0\.1:8435/content\.html',
                                                               'Ekstraktor: http://127.0.0.1:8435/extractor/')],
}
allow = re.compile('^(?:' + '|'.join(ALLOW) + ')$')
root = os.path.realpath(dest)


def safe(n):
    """no backslashes or dot segments, and no link or junction anywhere on the way (the real path is the plain one)"""
    if '\\' in n or any(part in ('', '.', '..') for part in n.split('/')):
        return False
    return os.path.normcase(os.path.realpath(os.path.join(dest, n))) == os.path.normcase(os.path.join(root, *n.split('/')))


def link(p):
    """symlink or junction (reparse point; os.path.isjunction exists only from Python 3.12)"""
    st = os.lstat(p)
    return stat.S_ISLNK(st.st_mode) or bool(getattr(st, 'st_file_attributes', 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT)


files = {}
for n in names:
    if n in DENY or DATA.search(n) and not n.startswith(DEMO) or not allow.match(n) or not safe(n):
        continue
    data = subprocess.run(['git', 'show', 'HEAD:' + n], capture_output=True, check=True).stdout
    for a, b in SCRUB.get(n, []):
        data = re.sub(a.encode(), b.encode(), data)
    files[n] = data

removed = []
for top, dirs, fs in os.walk(dest):
    dirs[:] = [d for d in dirs if d.lower() != '.git' and not link(os.path.join(top, d))]   # never into .git or a junction
    for f in fs:
        p = os.path.join(top, f)
        rel = os.path.relpath(p, dest).replace(os.sep, '/')
        if f.lower() == '.git' or link(p) or rel in files or rel in KEEP:
            continue
        os.remove(p); removed.append(rel)
changed = []
for n, data in files.items():
    p = os.path.join(dest, n)
    if os.path.lexists(p):
        if not link(p) and os.path.isfile(p) and open(p, 'rb').read() == data:
            continue
        os.remove(p)                                   # a new file, never through a link or into a hard link's target
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'xb').write(data); changed.append(n)
print(len(files), 'files,', len(changed), 'written,', len(removed), 'removed')
for n in changed: print('  +', n)
for n in removed: print('  -', n)
