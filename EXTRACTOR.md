# EXTRACTOR - shipping the engine without copyrighted data

Feasibility audit and plan (2026-10-19). Goal: publish `game/` without any original data. The player picks
their own ADF disks in a form and every asset is extracted in the browser.

## Status (2026-10-23)

Done in `extractor/`, each checked against your own exported `game/assets/` by `node extractor/extract.test.mjs`:

- disk identification (`adf.js`);
- music: 11 MED modules, byte-exact (`music.js`);
- tile banks: `CHR!` with the water palette rule, 8 atlases, pixel-exact (`tiles.js`);
- level maps: `LEV!`, map size from its header (screens of 20 x 12 tiles); the engine lays the crate, bomb wall and
  brittle stone tiles from the level JSON lists, in the game's order (`levels.js`);
- level tables `level{n}.json`, all 28 fields equal (`tables.js`): the main program relocated by `seg2.js`, the stage's
  area hunk (disk 2 `$21AA4`, `$3C314`, `$56DB0`, `$72500`: one HUNK_DATA read unrelocated, start x/y and start area at
  +0/+2/+4) at its layout-A chip address (`$9014` for stage 1, `$52024` for 2-4), the level table from the per-stage
  list at `$30B70E` (8 bytes a stage: island x, y, table). The tile under a crate, bomb wall or stone is taken from the
  map while laying them (crates, then bomb walls, then stones). Sky: the level table +`$54` points to one colour per
  4 lines, drawn `[k, previous, k, k]`; the window of lines the engine uses, the water line, the 2 mirror colours and
  the water background (`$003`) are measured constants in `RECIPE`.
- level objects `level{n}_objects.json` and their BOB atlases (`objects.js`): the record lists in the main program,
  the item bank (disk 2 `$16E68`, raw, at chip `$1EDA4`), descriptors, animations, texts and drip emitters as
  `export_objects.py` reads them; JSON equal in all 4 stages, atlases pixel-exact except `level4_objects_water.png`
  (see open points). Underwater palette by rule: `CHR!` tinted, colour 1 = water background, colours 2 and 3 untinted
  (the copper tints them only on the 2 mirror lines under the water line).
- the player `player.json`, `player_surface.png`, `player_water.png` (`player.js`): the data hunk on disk 2 at
  `$940C` is the sprite bank (`$131A4` in the game), colours 16-31 of the level 1 `CHR!` palette, tinted under water.
- weapons and the sword (`weapons.js`): the frame table `$308EA2` and the sprite data in seg2 of the main program.
- actors `level{n}_actors.json` and their atlases (`actors.js`): the enemy BOB banks (disk 2 PP `$34660`, `$4DBB0`,
  `$6B90C`, `$88924` at chip `$65484` / `$64694` / `$67494` / `$68BA4`), actors, triggers and the script memory windows.
  Equal to the export except the run-time state the dumps carried (128-428 bytes of the ~59 KB windows, `p3` of 10
  level 3 actors); the emulator recording regressions give the same result with either file.
- the font, the message box and its font, tool icons, shots, the compass needle (`hud.js`): HUD palette from the main
  program (`$30B6CE`, the copper line 20 colours); sound effects (`sfx.js`), built from the stage music modules;
  the shop (`shop.js`) with the fade-in target palette `$30B9BA` (the export used a palette fitted to a screenshot taken
  mid-fade, now fixed); the treasure run, GAME OVER and the title picture (`screens.js`; the title palette is in the
  boot module, disk 1 `$646E`).
- the HUD panels (`hud.js`, disk 2 `$A0824` + life fields, vitamin source and map box drawn as the game draws them) and
  the island map (`map.js`, palette = the fade-in target `$2F3B70`; the export's screenshot-fitted palette was taken
  mid-fade, now fixed).
- the ending (`screens.js`: picture disk 2 `$C21E4` with the copper palettes and sky gradient its segment writes, text
  and the 3 missing glyphs from the segment's own font; the export's screenshot cuts are replaced by this render) and
  the Polish letters `font_ext` (`hud.js`, our patterns from `work/make_font_ext.py` on the game font).
- the menu and the Hall of Fame logo (`menu.js`: BOB banks disk 2 PP `$9C6BC` and `$96AA8`, palette `$30C4B2`, positions
  fitted pixel for pixel to the screenshots; the screenshot cuts are replaced by this composition).
- the intro screens, the story scroll with its bars and our Polish story (`intro.js`: the boot module's letter bank
  disk 1 `$1BA58`, its text records and layout code); the wide title is a stand-in (the title on black).

The page stores everything the engine needs (107 files, in groups that only work together) in Cache Storage;
`game/sw.js` serves them to the game in place of the demo pack (tested: the public repository with the extracted
files makes no request to the demo pack, and the random-input crash test gives the same numbers as with the
exported assets). Stand-ins: `title_wide.png` (the title on black; the export is a hand-painted widening) and
`intro_starbyte.png` (the boot module's 'Starbyte presents' text screen; the export shows a painted logo whose file
is not among the game files).

## Verdict

**Feasible. Recommended route: B (direct ADF unpack plus a fixed-layout loader), no emulator at runtime.**

The decisive finding: the memory layout that the dumps show ("layout A") can be rebuilt byte for byte from
the disks, without running the game.

- The main program is the uncompressed SEG2 file on disk 1 at `$21118`. Relocate it with seg1 -> fast
  `$2DC97C` (= `CODE`), seg2 -> chip `$9A4C`, BSS -> chip `$100FC`. The result then equals the dumps
  `lvl1_h`, `lvl2_a`, `lvl4_a` and `treasure`, except for 727-753 of 197,860 bytes (runtime variables) in
  seg1. In seg2, the 1.6-2.1k differing bytes are pointer and state words.
- The `mem` windows in `level*_actors.json` (the "game code bytes", about 59 KB per level) are 98.9% identical
  to that relocated image. The remainder is runtime state (pointers and player variables at chip
  `$9B8A..$9F03`, about 140 bytes of a runtime buffer at `$2FFD3A..$2FFF06` in level 3), plus the 588-byte
  window `$9800..$9A4C` that lies below seg2.
- Every chip-RAM bank that the exporters read comes from a known file on disk 2: player sprites, item BOBs,
  message font, tool icons, enemy banks, level area data, the HUD and the diamonds. So do the fast-RAM tile
  banks and maps (`CHR!`, `LEV!`).
- Level palettes are stored in `CHR!`, and the HUD palette is a table in seg1. Only the underwater tint and
  the sky dithering are computed at runtime. Both are simple rules.

Proof in the browser: the prototype in `extractor/` reads the user's disk 2, unpacks the level 1 `CHR!` with a
JavaScript PowerPacker port, and draws the tile bank with the palette stored in the file. All 50,963 opaque
pixels equal the committed `game/assets/level1_surface.png`. On 7 files, the JavaScript depacker gives exactly
the same bytes as the Python one (`node extractor/ppdepack.test.mjs`).

Effort estimate: about 10-15 working days for full route B (breakdown below). Route A would be about the same
amount of work, with a much worse result.

## 1. Disk layout (PSG crack)

Files have no file system. Each one is `[length.L or $80000000|packed.L][data]`, long aligned and back to back.
The game finds them through descriptors `d0 = $01XXYYYY` (offset = `XX*6144 + YYYY - 5628`, minus another
12288 from `XX >= $58`). The extractor only needs the fixed offsets below, guarded by a hash.

### Disk 1

| ADF offset | form | size | content | where it lives in layout A |
|---|---|---|---|---|
| `$0000`, `$6E000..$746D8` | raw | - | boot block, PSG cracktro (variant `[a]`: Skol trainer) | not needed |
| `$3214` | SEG2 | `$4BD4` | boot module: intro code, intro texts ("The previous history" at ADF `$66B8`), title palette (boot data +`$325A`), title copper template (+`$2334`) | chip `$2000` |
| `$7DF4` | PP | `$C8EC` | title music MMD0 (`title.med`) | chip |
| `$CC20` | PP | `$12B10` | title picture: 6 planes x 44 x 290 B (352x290 EHB) | chip `$17344` (intro dump) |
| `$1BA58` | PP | `$9A6A` | unknown, a candidate for the intro font or logos | - |
| `$21118` | SEG2 | `$3C5BE` | **main program**: seg1 `$304E4` (code + data), seg2 `$66A8`, BSS `$3084` | fast `$2DC97C` / chip `$9A4C` / chip `$100FC` |

The PSG disk 1 and its `[a]` variant differ only in the boot block and the crack sectors (`$6EA02..$746D7`).
Their game data range `$3200..$5D6D8` is identical.

### Disk 2

| ADF offset | form | size | content | layout A |
|---|---|---|---|---|
| `$7DF4` | raw MMD0 | `$1612` | small module, role unknown | chip ~`$29D00` |
| `$940C` | hunk | `$BC18` | shared chip graphics: player sprite bank (`player.*`) | CODE -> chip `$131A4` |
| `$15028` | raw | `$1E3A` | message font BOB bank (93 glyphs + arrow) | chip `$71B4` (`$30CD5C`) |
| `$16E68` | raw | `$86CE` | item/object BOB bank; message frame at +`$2218`; heart = BOB 0 | chip `$1EDA4` (`$30CD58`) |
| `$1F53C` | raw | `$2562` | tool icon bank | chip `$2747C` |
| `$21AA4`, `$3C314`, `$56DB0`, `$72500` | hunk | `$100`, `$B34`, `$3368`, `$3B20` | level 1-4 area/door data (used **without** relocation) | chip `$9014` (L1), `$52024` (L2-4) = `$30CD98` |
| `$21BA8`, `$3CE4C`, `$5A11C`, `$76024` | PP | | level 1-4 music | chip `$52004`.. |
| `$2D5A4`, `$46A1C`, `$64284`, `$80ED0` | PP | `$A0E6`/`$A046` | `CHR!` L1-4: "CHR!", planes.W, 0.W, 32 colours, 16x16 tiles from +`$46` (160 B) | fast (bank = file + `$46`) |
| `$34660`, `$4DBB0`, `$6B90C`, `$88924` | PP | | enemy BOB banks L1-4 | chip `$65484` / `$64694` / `$67494` / `$68BA4` (`$30CD70`) |
| `$39C70`, `$532B8`, `$6ED2C`, `$911EC` | PP | | `LEV!` L1-4: 18 B header, then map bytes | fast (map = file + 18) |
| `$9506C` | raw MMD0 | | `hof_new.med` | |
| `$96AA8` | raw | `$460` | password icons (6 x 16x16) | |
| `$96F0C`, `$97EFC` | raw | `$FEC`, `$3200` | BOB bank (first 72x36) and a 320x64x5 image: probably the menu medallion and ribbon (unverified) | |
| `$9B100` | raw MMD0 | | `extra4.med` | |
| `$9C6BC` | PP | `$6CD4` | BOB bank, first BOB 205x57 = size of the Hall of Fame logo (unverified) | |
| `$A0824` | raw | `$2968` | **HUD**: 5 planes x `$848` (320x53 = top bar + bottom panel) | chip `$10620` |
| `$A3190` | raw | `$20EE` | island map BOBs (ship, flags, marker) | |
| `$A5284` | PP | `$9538` | island map picture 320x191x5 | |
| `$ABC8C`, `$ACD5C` | raw MMD0 | | `map.med`, `extra3.med` | |
| `$B13B0` | raw | `$D3C` | diamond BOB bank (treasure run, file `$17901AC`) | `$30CD80` |
| `$B20F0` | PP | | `extra1.med` (shop) | |
| `$B503C` | PP | `$7D00` | shop background 320x160x5 | |
| `$B89C0` | PP | `$698E` | shop BOB bank | |
| `$BC098` | SEG2 | `$6148` | ending: code, text, own font, palette | |
| `$C21E4` | PP | `$C800` | ending picture (5 planes) | |
| `$C5C34` | PP | | `extra2.med` (ending) | |

Game data range of disk 2: `$3200..$CA3E0`.

## 2. Inventory: game/assets

Legend for "route B":
- **ADF now** - the exporter already reads the ADF.
- **direct** - the same bytes are on the ADF (verified), only plumbing is missing.
- **rule** - needs a small runtime rule reimplemented and checked against today's output.
- **RE** - the source is located or likely, but the screen composition or palette still needs work.
- **unknown** - the source has not been found yet.
- **derived** - a hand-made derivative of original art. It cannot be shipped, so it has to be generated from
  the extracted data.

Every asset in this table is copyrighted content (graphics, maps, music, texts or game tables), except the
rows marked "engine".

| asset | exporter | input today | original source (route B) | route B |
|---|---|---|---|---|
| `level{1-4}.bin` | `export_level.py` | dumps `lvl1_f`, `lvl2_a`, `lvl3_a`, `lvl4_a` (fast map) | `LEV!` + 18, then overlay the brittle/crate/bomb-wall tiles from seg1 tables | rule (verified: 43/44, 61/61, 127/131, 49/49 changed tiles explained; the other 5 are game state in the dump) |
| `level{n}_surface.png` | `export_level.py` | fast tile bank + copper palette | `CHR!` tiles + `CHR!` palette (colour 1 = sky, transparent) | direct (L1 pixel-exact in the prototype) |
| `level{n}_water.png` | `export_level.py` | copper palette at the water line | `CHR!` palette + per-level tint: L1 R-2 G-2 B+2, L4 R-5 G+1 B+3, clamped; colours 0-3 special | rule |
| `level{n}.json` | `export_level.py` | dumps + hand constants in `LEVELS` + sky dumps | seg1 level tables (areas via level hunk, shops, actions incl. sign texts, chests, currents, quest...), tile attributes in seg2 (`$FAF4`/`$F8F4`/`$FCF4`/`$FEF4`), sky tables in seg1 (L1 +`$2F59A` every 4th line, L4 +`$2F936`) or seg2 (L2 +`$1AC`) with the `[k, k-1, k, k]` dither | direct + rule (sky); keep the measured constants (start, water line, dy, surface colours) as a recipe |
| `level{n}_objects.json/png` | `export_objects.py` | dump object lists, item bank, copper palette | seg1 lists + item bank (d2 `$16E68`) + `CHR!` palettes; prisoner/book texts in seg1 | direct |
| `level{n}_actors.json/png` | `export_actors.py` | dump: lists, enemy/item banks, `mem` windows | enemy bank (PP) + item bank + relocated main program for `mem` | direct (`mem` 98.9% equal; the rest is runtime state, see 5) |
| `player.json`, `player_*.png` | `export_player.py` | chip `$131A4` (`lvl1_g`) | d2 hunk `$940C` + `CHR!` palettes | direct |
| `sword_*.png` | `export_sword.py` | dumps `stab`/`stabL` (SPR4/5 at `$C298`/`$C2C0`) | main seg2 | direct |
| `shots.png` | `export_shots.py` | chip `$F7F2`/`$F870` in 4 level dumps | main seg2 + `CHR!` palettes | direct |
| `font.png`, `font.json` | `export_font.py` | fast `$30AC49` (`lvl1_h`) | main seg1 | direct |
| `font_ext.png/json` | `make_font_ext.py` | `font.png` + hand-drawn accents | run the same script at runtime | derived |
| `msgbox.png`, `msgfont.png/json` | `export_msgbox.py` | chip banks in `lvl1_h` | d2 `$16E68` + `$2218`, d2 `$15028`, L1 palette | direct |
| `tool_icons.png` | `export_tools.py` | chip bank + fast records + copper line 20 | d2 `$1F53C` + seg1 records + HUD palette (seg1 +`$2ED52`) | direct |
| `treasure.png/json` | `export_treasure.py` | dumps `treasure_*` + `lvl1_h` palette | d2 `$B13B0`, item bank, seg1 sky tables `$30BF68..` | direct |
| `hud_top.png`, `hud_bottom.png` | `export_hud.py` | emulator screenshot `lvl1_g` | d2 `$A0824` (HUD planes) + HUD palette seg1 +`$2ED52` | RE (small: clear value boxes as today) |
| `hud_digits.png` | `export_hud.py` | screenshot `digits` (game drew poked values) | digit glyphs not located yet | RE |
| `hud_top_vit.png`, `hud_life_empty.png` | none (hand-cut screenshots) | screenshots | HUD file + fruit graphics | RE |
| `shop_bg.png`, `shop_items.png/json` | `export_shop.py` | **ADF** (`$B503C`, `$B89C0`) + `SHOP_PAL` fitted to a screenshot | ADF; first 16 colours of `SHOP_PAL` are in seg1 +`$2F03E`, rest to locate | ADF now (palette to source) |
| `shop_keeper.json` | `export_shop.py` | `lvl1_h` fast | seg1 | direct |
| `map_marker.png`, `map_actors.png/json` | `export_screens.py`, `export_map.py` | **ADF** `$A3190` + `MAP_PAL` (fitted) + `lvl1_h` scripts | ADF + seg1; `MAP_PAL` is not a plain table in the program (copper or fade code) | ADF now (palette to source) |
| `island_clean.png` | `export_map.py` | **ADF** `$A5284` + rows 0-16 from `island.png` | ADF + top rows (sea colour) | ADF now, rows 0-16 RE |
| `island.png` | `export_screens.py` | screenshot `to2_1` | island_clean + map actors | RE (or drop if the engine can compose it) |
| `title.png` | `export_screens.py` | `title_from_ram.png` (render of `intro2_chip`) | d1 PP `$CC20` + palette in the boot module, EHB render (`dump_view.py` has it) | direct |
| `title_wide.png` | none (hand-widened 626x289) | - | - | derived: generate (edge extension) or drop |
| `intro_starbyte.png`, `intro_nightingale.png` | `export_story.py` | screenshots | not located (candidates: d1 `$1BA58`, boot module) | unknown |
| `story_text.png`, `story_bg.png` | `export_story.py` | 115 frame grabs `st_NNN` | text in boot module (ADF `$66B8`), font not located, bar colours in boot module | RE (medium) |
| `story_text_pl.png` | `export_story_pl.py` | glyphs cut from `story_text.png` + Polish text | run at runtime after `story_text.png` | derived |
| `hof_logo.png` | `export_hof.py` | screenshot `hof` | likely d2 PP `$9C6BC` | RE (small) |
| `menu.png`, `menu_icons.png` | `export_menu.py` | screenshots `hofm_up`, `menu_dn`, `pwicon_*`, `menu_pw_r` | likely d2 `$9C6BC`, `$96F0C`, `$97EFC` + menu code seg1 `$309DF0..` | RE (medium: screen composition) |
| `pass_icons.png` | `export_menu.py` | screenshot `clr1_7` | d2 `$96AA8` | direct |
| `menu.json` | `export_menu.py` | password table fast `$30C438` + measured layout | seg1 | direct |
| `ending_bg/dark/sky.png` | `export_ending.py` | screenshot `endlate_5` | d2 PP `$C21E4` + palette in ending SEG2 | RE (small) |
| `ending.json` | `export_ending.py` | **ADF** text; 3 glyphs from screenshot `endseq_23` | ending SEG2 (text + font) | ADF now, glyphs RE |
| `music/*.med` (11) | `export_music.py` | **ADF** | same | ADF now (JS depacker verified) |
| `sfx/level{n}.med`, `sfx.json` | `export_sfx.py` | `music/level{n}.med` + hand tables `SOUNDS`/`DUR` | port `build()`; tables are engine facts | direct |

Counts: 82 of 102 files (76% of the 3.9 MB) are direct or ADF now: all level data, sprites, banks, music,
sfx, shop, map, treasure and fonts. The other 20 files are screen images that today come from screenshots or
are hand-made derivatives.

## 3. Inventory: game/lang and the engine code

- `lang/en.json` is hand-written by the sessions. 137 of its 171 strings of 4+ characters are **verbatim on
  the ADFs**: level names, end-of-stage texts, ratings, all 61 shop lines, all 37 intro lines, 8 of 10
  messages and the credits headings. The remaining strings belong to the port (controls, options, pause,
  photo mode). Plan: ship `en.json` with port-only strings plus a key -> (disk, offset) table, and fill the
  original strings from the ADF.
- `lang/pl.json` is the user's translation of the original texts (a derivative work). Whether to publish it
  is a legal call for the owner, not a technical one.
- `lang/languages.json`: engine.
- `game/main.js` contains original data:
  - 4 message strings (lines 264-265, 345: magnifier and door messages, the same as `en.json` `msg`).
  - Credit names (`CREDITS`, line 1074) and the Hall of Fame letter set.
  - Small behaviour tables measured from or copied out of the game: `POT_TABLE` (`$2E84A2`), `SHAKE`,
    `DEATH_HOP` (`$2F1E52`), `CHEER`/`TAP`/`YAWN`, `HELP_DY`, `FRUIT_PTS`, `TR_PTS`, `DARK_EYES`.
  - About 18 absolute script and path addresses.
- `game/actors.js`: `GHOST_V` (copy of chip `$BCAC`, seg2) and about 65 absolute addresses into the `mem`
  windows.
- These are short functional facts. They do **not** carry content by themselves. The addresses only work if
  the extracted memory image keeps layout A. Optional purist step: read `GHOST_V`, `POT_TABLE` and
  `DEATH_HOP` from the extracted image instead of literals, and take the 4 messages from `en.json`.

## 4. Dumps vs ADF: what really exists only at runtime

| runtime-only item | how to recreate it without an emulator |
|---|---|
| copper palettes | the copper list `$CDC0` is a static skeleton in seg2; colours are filled in from `CHR!` (+6) and the HUD table (seg1 +`$2ED52`) |
| underwater palette | per-level RGB delta on the `CHR!` palette (L1 -2/-2/+2, L4 -5/+1/+3); locate the deltas in seg1 or keep 2 x 3 constants; check against the dumps |
| sky gradient (colour 1) | tables in the program + `[k, k-1, k, k]` dither (the treasure skies already work this way) |
| level map in RAM | `LEV!` + overlays from the brittle/crate/bomb-wall tables (verified) |
| relocated pointers in seg1/seg2 | SEG2 relocator with fixed bases (verified) |
| level area hunks | raw CODE hunk bytes, no relocation (100% match) |
| bank and level pointers (`$30CD14`, `$30CD70`, `$30CD98`, `$30CBA2`...) | per-level constants of layout A, recorded once from the dumps (they are the keys the JSON already uses) |
| runtime state inside `mem` windows | not needed by the engine as far as known; emit the pristine bytes and replay each level (L3 `$2FFD3A` buffer, `$9800..$9A4C` window) |
| chip graphics "unpacked at runtime" | none found: every bank used by the exporters is a raw or PowerPacker file (table above) |
| screens (title, HUD, menu, HOF, ending, intro) | composed by game code from files on the disks; needs rendering code per screen (section 6, B3) |

## 5. Routes

### Route A: headless vAmigaWeb + AROS in the browser

- Ship vAmigaWeb (GPLv3, self-hosted instead of `vamigaweb.github.io`) plus the AROS ROM. That is several MB of
  WASM and ROM.
- Drive the game to every state needed: cracktro click, intro, disk swap, menu, levels 1-4 via pokes, shop,
  treasure run, ending, Hall of Fame. Dump and screenshot at each state. `play.html` and `work/oracle.js`
  already have the primitives.
- Run the exporters on the result (JS port, or Pyodide; note that `capstone` used by `export_actors.py` is not
  in Pyodide).
- Cons:
  - minutes of emulation per extraction, even at 8x;
  - fragile timing and state;
  - the dumps carry game state (seen above: wrong tiles, player variables);
  - only works for disks the crack-specific automation knows;
  - a GPL component in the distribution;
  - the exporter port is still needed.
- Estimate: 9-13 days, and a worse result than B.

### Route B: direct ADF unpack + fixed-layout loader (recommended)

Build a **synthetic layout-A memory image** (chip 2 MB + fast) from the disks:
- relocated main SEG2;
- level hunks;
- raw and PP files at their layout-A addresses;
- per-level pointer constants.

Then run the existing exporter logic on that image. The exporters keep reading "memory", so most of their code
stays as it is. Palette lookups switch from copper simulation to `CHR!` plus the rules above.

| phase | work | estimate |
|---|---|---|
| B0 | ADF identify + PowerPacker in JS (done: `extractor/`) | done |
| B1 | Python: `work/synth_dump.py` (SEG2 relocator, hunk loader, file table, per-level constants) -> synthetic `*_chip.bin`/`*_fast.bin`; exporters get a palette function from `CHR!`; diff harness vs `game/assets` (JSON deep-equal, PNG decoded pixels, bins exact) | 1.5-2 d |
| B2 | runtime rules: water tint, sky dither, map overlays; review each remaining diff (dump artefacts vs real data) | 1 d |
| B3 | screens from disk files instead of screenshots: title (0.25 d), HUD + digits + vitamins/life (0.5-1 d), HOF logo + menu (1-1.5 d), ending picture/palette/glyphs (0.5 d), island top rows (0.25 d), intro logos + story scroller (1-2 d) | 3.5-5.5 d |
| B4 | port exporters to JS (about 1,500 lines; replace `capstone` with byte-pattern decoding of the 3 instruction forms `export_actors.init_routine` needs); node harness comparing JS output with Python output | 3-4 d |
| B5 | integration: extractor page writes files to Cache Storage (`tnt-assets-v1`, separate from the game's `localStorage`); a service worker serves `assets/*` and `lang/*` from it, so `main.js` (which loads everything through `img()`, `json()` and `fetch('assets/...')`) needs no change beyond registering the worker and redirecting to the extractor when the cache is empty. Android WebView: same, or a 3-line hook in `img`/`json` to read from IndexedDB | 1-2 d |
| B6 | publishing hygiene (section 7) | 0.5 d |

Total: about **10-15 working days**.

A mix (B for data, A for screens) only pays off if B3 stalls on a specific screen. Building the route-A
infrastructure for a handful of images costs more than the B3 reverse engineering. Keep the emulator as
the developer's oracle for verification, as today.

### Disk support

- Identification: hash the game-data range, not the whole file. Disk 1 `$3200..$5D6D8` =
  `21ea697fc7aea748ef15f341203e47733934f0a0`. Disk 2 `$3200..$CA3E0` =
  `dd75f5794c5592e7dd2608e0448b69224a7db78d`. That accepts the PSG disk 1 and its `[a]` variant (whole-file
  SHA-1 `460a2999...` and `ea06141b...`, disk 2 `b0d16dbf...`), and any other crack that left the game data
  intact.
- Other releases (the original with copy protection, which usually needs IPF; other cracks; compilations)
  will have other offsets or layouts. Supporting them means another recipe, after someone provides a dump.
- `crypto.subtle` needs a secure context. Use https or `http://localhost`, not a LAN IP over http.

## 6. Prototype (`extractor/`, not committed)

- `extractor/ppdepack.js` - PowerPacker port (same algorithm as `work/ppdepack.py`).
- `extractor/ppdepack.test.mjs` - self-check. Run from the project root: `node extractor/ppdepack.test.mjs`.
  It unpacks 7 music files from the ADFs and compares them with `game/assets/music/*.med`. All 7 match.
- `extractor/index.html` - a file input for one or more ADFs. It identifies each disk by the range hash and,
  for disk 2, unpacks the level 1 `CHR!` (`$2D5A4`, 41,190 B in about 1.5 ms) and draws its 257 tiles with
  the palette stored in the file. Open `http://127.0.0.1:8435/extractor/` (the preview server from
  `start-server.bat`).
- `extractor/package.json` - only `{"type": "module"}`, so node treats the folder as ES modules (the root
  `package.json` is untouched).

## 7. Publishing checklist (things that would leak original data)

- Git history: `game/assets/` and `game/lang/` are tracked, and so are:
  - `extracted/` (boot module, cracktro, hunk files from the disks);
  - `remake/assets/` (`game_content.json` with the full game text, `music_menu.mmd0`, palettes);
  - `work/d1_text_full.txt`, `work/text_dump.txt`, `work/stage2_disas.txt`, `work/_game.js`;
  - `work/upscale/hd/*.png` and `work/upscale/img/*.png` (derivatives).

  Removing them in a new commit is not enough. Publish from a fresh repository (or an orphan branch built from
  an allow-list) and add `game/assets/` and `extracted/` to `.gitignore` there.
- The Android build (`android/`, Capacitor) copies `game/` into the APK. A public APK must be built without
  assets and must use the extractor as well.
- `RESEARCH.md` quotes short game strings. That is probably acceptable as research notes, but review it before
  publishing.
- The final legal assessment is the owner's. This plan only removes the data from the distribution.

## 8. Open points and follow-ups

- `export_actors.py` and `export_objects.py` take the underwater palette at copper line `water + 50`. In the level 4
  dump (`lvl4_a`) the copper list sets colours 16-31 to `000` from line 191 (2 lines under the water line 189) and
  colours 2-3 to `000` from line 207, so `level4_actors_water.png` and `level4_objects_water.png` are drawn black there.
  The player uses colours 16-31 too, so this is probably a copper list caught while being rebuilt, not the look of the
  game. The extractor uses the level 1 rule instead (`extract.test.mjs` lists the file as a known difference). Verify
  in the emulator under water in level 4, then fix the exporter or the rule.
- The tile water atlases (`level{1,4}_water.png`) were taken at the water line itself, where the copper also tints
  colours 2 and 3; 2 lines lower it sets them back. Deep water tiles with colours 2-3 are therefore slightly off in
  both the export and the extractor (the engine has one water atlas). Small; fix together with the mirror lines.
- Sources still unknown: intro logos and story font (candidates: d1 `$1BA58` and the boot module), HUD digit
  glyphs, the rest of `SHOP_PAL`, `MAP_PAL`.
- `title_wide.png` is a hand-made derivative. It needs a generator or has to go.
- The level 3 runtime buffer at `$2FFD3A..$2FFF06` (about 140 bytes inside the `mem` window) is not on the
  disk. Check whether the engine reads it.
