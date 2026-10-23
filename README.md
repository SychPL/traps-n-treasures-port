# Traps 'n Treasures - browser port

A faithful re-implementation of the Amiga platformer **Traps 'n Treasures** (Starbyte, 1993) in plain
JavaScript for the browser. The engine is written from scratch from reverse engineering of the original
68000 code: player physics, enemies, items, doors, ropes, ladders, water, the shop, the island map and the
treasure run. It is checked frame by frame against recordings from an Amiga emulator (vAmiga) with random
joystick input.

**This repository contains no original game data.** Graphics, level maps, music, sound effects, texts of
the original program and the program itself remain the property of their rights holders and are not
included. The repository ships a small **demo pack** instead: our own graphics and test stages drawn by a
script, so the engine runs out of the box. To play the real game you need your own copy (two ADF disk
images) and the assets produced from it (see below). This project is not affiliated with Starbyte or the
original authors.

## Status

- Engine: all four stages, shop, map, treasure run, ending, Hall of Fame, Android touch controls.
- Fidelity: player movement and animation match the emulator pixel for pixel and frame for frame in
  hundreds of thousands of recorded frames; remaining known differences are listed in `RESEARCH.md`.
- Demo pack (`game/assets-demo/`): a pirate, items, tiles, HUD, fonts and four short test stages with water,
  ladders, a rope, spikes, crates, ice and an exit door. No enemies and no music yet.
- Disk extractor (`extractor/`, plan and disk layout in [`EXTRACTOR.md`](EXTRACTOR.md)): one page that builds
  the assets in the browser from your own ADF files. Done: disk identification, music, and the four stages (tile
  banks, maps, level tables and level objects, rebuilt from the relocated main program and the stages' data files),
  all equal to the assets exported from the running game), the player and the weapons. With them the original
  stages play with the demo pack's HUD. Still to do: enemies, fonts, HUD, screens and sound effects.

## Running

The game is static files. Serve the repository root over HTTP (for example `start-server.bat`, which runs
`python work/oracle_server.py 8435`) and open `http://127.0.0.1:8435/game/`.

The engine looks for `game/assets/` first and falls back to the demo pack in `game/assets-demo/` when it is
missing (`?assets=demo` forces the demo pack). `?level=1..4` starts a stage directly.

## Using the original assets

`game/assets/` is ignored by git. Put the files produced from your own disks there, with the same names as in
the demo pack, and the engine uses them instead of the demo:

- `work/export_*.py` - exporters that write `game/assets/*` (PNG banks, JSON tables, level maps, MED music).
  Most of them read memory dumps of the running game made with the emulator page `play.html` (vAmigaWeb with
  the AROS Kickstart; it expects your own ADF files in `Traps-n-Treasures_Amiga_EN/`, file names in
  `play.html`) and `work/oracle.js`; `export_music.py`, `export_shop.py` and `export_map.py` read the ADF files
  directly.
- `extractor/` - the browser extractor: open `http://127.0.0.1:8435/extractor/` and pick both ADF files.
  It identifies the disks by a hash of the game-data range, unpacks the files (PowerPacker port in
  `extractor/ppdepack.js`) and stores the results in the browser's Cache Storage; `game/sw.js` (a service worker)
  serves them to the game in place of the demo pack. Nothing is uploaded. "Remove extracted files" on the same
  page goes back to the demo pack. Self-checks: `node extractor/ppdepack.test.mjs`, and with your own exported
  `game/assets/`, `node extractor/extract.test.mjs`.

## Making your own assets

`work/make_demo_assets.py` (Python 3 + Pillow) draws the demo pack: `python work/make_demo_assets.py`. It is
also the reference for the formats - every file the engine reads, with the frame tables, anchor points,
collision boxes, tile attributes and level fields. Change the drawing functions or the level builder there,
or replace single files by hand: a file keeps working as long as it has the same name, size and layout.

## Repository layout

- `game/` - the engine (`main.js` player, levels, screens; `actors.js` enemies running the original actor
  script format; `input.js`, `touch.js` controls; `hd.js` optional 2x renderer; `lang/` texts in English and
  Polish; `lib/chiptune3/` MED/MOD player, third-party; `assets-demo/` the demo pack).
- `work/` - reverse-engineering and verification tools: exporters, disassembly helpers, PowerPacker depacker,
  emulator test harnesses (`cmp_rnd.js`, `cmp_at.js`, `cmp_trace.js`) that replay random input in the
  emulator and in the port and compare position and animation frame by frame. The recordings themselves
  (`work/dumps/`) are not included.
- `extractor/` - the disk extractor (`adf.js` disks and files, `seg2.js` the game's own executable format,
  `music.js`, `tiles.js`, `levels.js` maps, `tables.js` level tables, `objects.js` level objects, `player.js`,
  `weapons.js`, `png.js` PNG encoder); `EXTRACTOR.md` - its design and the disk layout.
- `RESEARCH.md` - research notes (in Polish): every rule of the original that the port implements, with the
  68000 addresses it comes from and the recording that confirmed it.

## License

The code, the documentation and the demo pack are released under the MIT license (see `LICENSE`). The license
does not cover the original game or any data extracted from it.

---

## Po polsku

Wierna przegladarkowa wersja amigowej gry Traps 'n Treasures (Starbyte, 1993), napisana od nowa w JavaScripcie
na podstawie analizy kodu 68000 i sprawdzana klatka po klatce z emulatorem. Repozytorium nie zawiera danych
oryginalnej gry (grafiki, map, muzyki, tekstow programu). Zamiast nich jest pakiet demo z wlasna grafika i
czterema krotkimi etapami testowymi (`game/assets-demo/`, generator `work/make_demo_assets.py`) - gra rusza od
razu. Do prawdziwej gry potrzebna jest wlasna kopia (dwie dyskietki ADF): pliki z niej zrobione wklada sie do
`game/assets/` (te same nazwy co w demo) i silnik bierze je zamiast demo. Ekstraktor w przegladarce
(`extractor/`) czyta wlasne pliki ADF i daje juz muzyke, cztery etapy (kafle, mapy, tabele, przedmioty), gracza
i bronie; grafika wrogow i ekranow w drodze. Notatki z badan (`RESEARCH.md`) sa po polsku. Licencja kodu i pakietu demo: MIT.
