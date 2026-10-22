# Traps 'n Treasures - browser port

A faithful re-implementation of the Amiga platformer **Traps 'n Treasures** (Starbyte, 1993) in plain
JavaScript for the browser. The engine is written from scratch from reverse engineering of the original
68000 code: player physics, enemies, items, doors, ropes, ladders, water, the shop, the island map and the
treasure run. It is checked frame by frame against recordings from an Amiga emulator (vAmiga) with random
joystick input.

**This repository contains no original game data.** Graphics, level maps, music, sound effects, texts of
the original program and the program itself remain the property of their rights holders and are not
included. To play, you need your own copy of the game (two ADF disk images) and the assets produced from
it (see below). This project is not affiliated with Starbyte or the original authors.

## Status

- Engine: all four stages, shop, map, treasure run, ending, Hall of Fame, Android touch controls.
- Fidelity: player movement and animation match the emulator pixel for pixel and frame for frame in
  hundreds of thousands of recorded frames; remaining known differences are listed in `RESEARCH.md`.
- Assets: **not included yet in a playable form.** Planned next:
  1. a demo pack with our own graphics and a test level, inspired by the original, so the engine runs out of
     the box;
  2. a full disk extractor that builds every asset in the browser from your own ADF files
     (plan and disk layout in [`EXTRACTOR.md`](EXTRACTOR.md); a working prototype is in `extractor/`).

## Running

The game is static files. Serve the repository root over HTTP (for example `start-server.bat`, which runs
`python work/oracle_server.py 8435`) and open `http://127.0.0.1:8435/game/`.

The engine loads everything from `game/assets/` (and texts from `game/lang/`). That folder is ignored by git.
Until the demo pack and the extractor are ready, `game/assets/` has to be produced with the developer tools
in `work/`:

- `work/export_*.py` - exporters that write `game/assets/*` (PNG banks, JSON tables, level maps, MED music).
  Most of them read memory dumps of the running game made with the emulator page `play.html` (vAmigaWeb with
  the AROS Kickstart; it expects your own ADF files in `Traps-n-Treasures_Amiga_EN/`, file names in
  `play.html`) and `work/oracle.js`; `export_music.py`, `export_shop.py` and `export_map.py`
  read the ADF files directly.
- `extractor/` - the browser extractor prototype: identifies your disks by a hash of the game-data range,
  unpacks PowerPacker files (`extractor/ppdepack.js`) and renders the level 1 tile bank. Open
  `http://127.0.0.1:8435/extractor/`. Self-check: `node extractor/ppdepack.test.mjs`.

Replacing assets: any file in `game/assets/` can be swapped for your own as long as it keeps the same name,
size and layout (sprite banks are described by the matching `*.json` files: frame rectangles, anchor points
and collision boxes).

## Repository layout

- `game/` - the engine (`main.js` player, levels, screens; `actors.js` enemies running the original actor
  script format; `input.js`, `touch.js` controls; `hd.js` optional 2x renderer; `lang/` texts in English and
  Polish; `lib/chiptune3/` MED/MOD player, third-party).
- `work/` - reverse-engineering and verification tools: exporters, disassembly helpers, PowerPacker depacker,
  emulator test harnesses (`cmp_rnd.js`, `cmp_at.js`, `cmp_trace.js`) that replay random input in the
  emulator and in the port and compare position and animation frame by frame. The recordings themselves
  (`work/dumps/`) are not included.
- `extractor/` - disk extractor prototype; `EXTRACTOR.md` - its design.
- `RESEARCH.md` - research notes (in Polish): every rule of the original that the port implements, with the
  68000 addresses it comes from and the recording that confirmed it.

## License

The code and documentation are released under the MIT license (see `LICENSE`). The license does not cover
the original game or any data extracted from it.

---

## Po polsku

Wierna przegladarkowa wersja amigowej gry Traps 'n Treasures (Starbyte, 1993), napisana od nowa w JavaScripcie
na podstawie analizy kodu 68000 i sprawdzana klatka po klatce z emulatorem. Repozytorium nie zawiera danych
oryginalnej gry (grafiki, map, muzyki, tekstow programu) - do gry potrzebna jest wlasna kopia (dwie dyskietki
ADF) i assety z niej zrobione. W planie: pakiet demo z wlasna grafika i poziomem testowym oraz pelny ekstraktor
dzialajacy w przegladarce. Notatki z badan (`RESEARCH.md`) sa po polsku. Licencja kodu: MIT.
