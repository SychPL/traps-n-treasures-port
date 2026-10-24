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
images): the game builds every asset from them in your browser (see the quick start). This project is not
affiliated with Starbyte or the original authors.

## Quick start

1. Download this repository (**Code -> Download ZIP**) and unpack it.
2. **Windows:** double-click `start.bat` (nothing to install - a small PowerShell web server, `serve.ps1`).
   **macOS / Linux:** run `./start.sh` (uses `node` or `python3`). The browser opens the game with its demo pack.
3. To play the original game, click **Load ADF disks** in the bar at the top of the game page (or drop the files on
   the page) and pick both disk images of your own copy (the PSG release). The game files are built in your browser
   (up to a minute), then the page reloads with the original game. Nothing is uploaded; the files stay in the
   browser's storage until you remove them on the extractor page.

Command line instead: `node extractor/extract.mjs <folder with the two ADF files>` (Node 20+) writes the 107 files to
`game/assets/`, which the game reads before the demo pack.

## Status

- Engine: all four stages, shop, map, treasure run, ending, Hall of Fame, Android touch controls.
- Fidelity: player movement and animation match the emulator pixel for pixel and frame for frame in
  hundreds of thousands of recorded frames; remaining known differences are listed in `RESEARCH.md`.
- Demo pack (`game/assets-demo/`): a pirate, items, tiles, HUD, fonts and four short test stages with water,
  ladders, a rope, spikes, crates, ice and an exit door. No enemies and no music yet.
- Disk extractor (`extractor/`, design and disk layout in [`EXTRACTOR.md`](EXTRACTOR.md)): one page that builds
  all the assets the engine needs (107 files) in the browser from your own ADF files - the four stages with their
  enemies, the player, weapons, music, sound effects, fonts, HUD, shop, island map, treasure run, title, intro,
  story, menu, Hall of Fame, GAME OVER and the ending - from the game's own files and the tables of its relocated
  main program. Every file was checked against the assets exported from the running game in the emulator; where
  those exports were cut from screenshots, the extractor gives the clean original (exact palettes, no capture
  artefacts). Two files are stand-ins: the wide title for wide screens (the title on black) and the first intro
  screen (the game's own "Starbyte presents" text screen).

## Running

The game is static files served over HTTP (not `file://`): `start.bat` / `start.sh` above, `node serve.mjs`, or any
static web server in the repository root; then open `http://127.0.0.1:8435/game/`. `start-server.bat` runs the
development server `work/oracle_server.py` (Python) that the emulator tools need.

The engine looks for `game/assets/` first and falls back to the demo pack in `game/assets-demo/` when it is
missing (`?assets=demo` forces the demo pack). `?level=1..4` starts a stage directly.

## Playing the original game

Load the disks on the game page (quick start above) or on `http://127.0.0.1:8435/extractor/`. The disks are
identified by a hash of their game-data range, the files are unpacked (PowerPacker port in `extractor/ppdepack.js`)
and the results are stored in the browser's Cache Storage; `game/sw.js` (a service worker) serves them to the game in
place of the demo pack, and without a service worker (private windows, some embedded browsers) the engine reads
them from Cache Storage itself. "Remove extracted files" on the extractor page goes back to the demo pack.
`crypto.subtle` needs https or `http://localhost` / `127.0.0.1`.

Other ways and tools:

- `game/assets/` (ignored by git): files placed there with the same names as in the demo pack are used as well.
- `work/export_*.py` - exporters that write `game/assets/*` (PNG banks, JSON tables, level maps, MED music).
  Most of them read memory dumps of the running game made with the emulator page `play.html` (vAmigaWeb with
  the AROS Kickstart; it expects your own ADF files in `Traps-n-Treasures_Amiga_EN/`, file names in
  `play.html`) and `work/oracle.js`; `export_music.py`, `export_shop.py` and `export_map.py` read the ADF files
  directly.
- Self-checks of the extractor: `node extractor/ppdepack.test.mjs`, and with the exported `game/assets/` of your
  own copy, `node extractor/extract.test.mjs` (every extracted file against the export).

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
  `music.js`, `tiles.js`, `levels.js` maps, `tables.js` level tables, `objects.js` level objects, `actors.js` enemies,
  `player.js`, `weapons.js`, `hud.js` fonts and small HUD graphics, `sfx.js`, `shop.js`, `screens.js`, `map.js`, `menu.js`, `intro.js`, `png.js`
  PNG encoder); `EXTRACTOR.md` - its design and the disk layout.
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
razu.

Szybki start: pobierz repozytorium (Code -> Download ZIP), rozpakuj i uruchom `start.bat` (Windows, nic nie trzeba
instalowac) albo `./start.sh` (macOS / Linux, node albo python3). Przegladarka otworzy gre z pakietem demo. Zeby
zagrac w oryginal, kliknij u gory strony gry **Wczytaj dyskietki ADF** (albo upusc pliki na strone) i wybierz obie
dyskietki ze swojej kopii (wersja PSG) - pliki gry skladaja sie w przegladarce (do minuty), strona sie przeladuje z
oryginalna gra. Nic nie jest wysylane. Z linii polecen: `node extractor/extract.mjs <folder z dyskietkami>` zapisuje
pliki do `game/assets/`. Notatki z badan (`RESEARCH.md`) sa po polsku. Licencja kodu i pakietu demo: MIT.
