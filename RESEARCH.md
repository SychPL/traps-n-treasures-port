# Traps 'n Treasures (1993, Starbyte) — inżynieria wsteczna i odtworzenie na PC

Dokumentacja badań — prowadzona na bieżąco. Start: 2026-10-18.

## Cel
Odtworzenie gry **Traps 'n Treasures** (Amiga, 1993, Starbyte Software / Krisalis,
wersja EN, crack PSG) na współczesne komputery (HTML5/Canvas), w oparciu o RE dyskietek.

## Materiał
- `Disk 1 of 2.adf`, `Disk 1 of 2 [a].adf` (alternatywna wersja cracka), `Disk 2 of 2.adf`
- Wersje cracka: **PSG** (dysk główny) i **Skol's Trainer Menu v3.4** (dysk [a])

## Narzędzia
- MCP REA: `binary_session` → **Ghidra niedostępna** (brak GHIDRA_INSTALL_DIR; Windows P0
  przyjmuje tylko PE x86/x64). Analiza M68k: Capstone 5.0.7 (big-endian).
- Własne skrypty w `work/` (parsing ADF, depacker, walkery formatów).

## Architektura oryginału (ustalona)

### Łańcuch boot (dysk główny, crack PSG)
1. **Bootblock** (sektory 0–1): `CMD_READ` przez `DoIO` — 4 sektory (880–883,
   offset $6E000) → `$60000`; `JMP $60020`. W sectorze 1 string
   „Traps 'n Treasures Disk 1".
2. **Stage 1** ($60020, sektor 880+0x20): pseudo-hunk „load image"
   (`HUNK_HEADER`, 1 hunk, flags $1CD, `HUNK_NAME` dł. $1CD long = kod $734 B).
   - Kod (304 B) + tablica pod `$60148`: `{out=$4454, packed=$602}` + spakowany blob.
   - **Depacker** (cruncher scenowy, pełna semantyka zaimplementowana w
     `work/depack.py`): LZ z bitstreamem czytanym WSTECZ (słowa 16-bit BE pobierane
     od końca, bity od LSB okna d6), inicjaly: `d6=long z końca; d7=16-last_word;
     d6>>=d7; d7=last_word`. Kody: literal=8 bitów; drzewo długości {1,2},{3..6},
     {7..22},{23..278}; len==22 → długi run literalny 14+bits(5|14); offsety:
     {0..31},{32..543},{$220+bits(14)}; kopiowanie `out[w-1]=out[w-1+off]`,
   - rozpakowuje 1538 B → 17492 B pod `$70000`, `JMP $70000`.
3. **Stage 2 = PSG cracktro** ($70000, 17,5 KB): kill system (CacheClearU,
   DMACON), własny font 8×8 ($7062E), copper-listy ($706F2/$708F2), lista BBS-ów
   PRESTIGE, czeka na fire, przywraca system i wraca RTS do ROM.

### Dysk alternatywny [a]
- Sektor 885: **drugi stage1** (0x5CB4 B) → depack → **Skol's Trainer Menu v3.4**
  (0xDB18 B): opcje trainera (F1–F7: nieskończone życia/zdrowie/czas/złoto,
  nietykalność, otwieranie drzwi, klawisze in-game; start level 1–4; (L)(H)(T)(G)(I)(C)
  w grze; F5 = koniecówka; HELP = skip poziomu; 15 narzędzi z kursorami) +
  muzyka Arkanoid (Martin Galway, konwersja Archon, Delta Music 2.2) +
  **osadzony oryginalny plik główny gry z GAME EXEC**.

### GAME EXEC (runtime gry)
- „GAME EXEC Operating System V4.3 (06-May-91)", Copyright 1989–91
  **Christian A. Weber**, Zurych — struktury z magic „CHW\0", wersja $1005.
- Wywołania kernela: `jsr +$NNN(a6)` (funkcje: CopyMem=$214, AllocMem=$284/$1f4,
  FreeMem=$204, AddIntServer=$2b0, LoadSeg=$28c...).
- Ładowanie plików przez urządzenia; procedura dyskowa pod **absolutnym `$2F08`**
  = seg1 modułu boot +$F08 (moduł boot ładuje się pod **$2000**).
- Format plików obiektów: **„SEG2"** = {d2,d3,d4} rozmiary + seg1[d2] +
  3×(„RLOC"+relokacje) + seg2[d3] + 3×(„RLOC"+relokacje); seg3=BSS bez danych.
  Relokacje: delta-stream (word; 0→long), `add.l base,(seg+off)`.

### Struktura danych na dyskach
- Oba dyski identycznie do offsetu **$7DD8** (koniec modułu boot SEG2#0):
  - `0x3200`: nagłówek CHW (ver $1005, flg 1, rozmiar $4BD4)
  - `0x3214`: **SEG2#0** = moduł boot: seg1 (0x20D8 B kodu, load @$2000),
    seg2 (0x27FC B danych: pełny tekst intro!, napisy „Starbyte presents
    Nightingale production"), BSS $94. Koniec: 0x7DE8.
- Za modułem boot: obszar plików z wpisami {long id, long/word size, data}
  (format nie do końca rozstrzygnięty — wpisy 6/8-bajtowe, pliki hunk mają
  prefiks {id, size} potwierdzony dopasowaniem rozmiarów).
- **Dysk 2**: pliki gry rozpoznane:
  - `0x7DF4`: moduł muzyczny **MMD0** (OctaMED, 0x1610 B) → wyciągnięty
  - `0x940C` (len $BC18), `0x3C314` ($B34), `0x56DB0` ($3368), `0x72500` ($3B20):
    pliki hunk (HUNK_HEADER + CODE[chip] + BSS + lista relokacji między zerami +
    HUNK_END) — programy poziomów
  - `0x21AA4`: hunk (mały, extent niepełny)
  - między plikami: dane (poziomy/grafika?), format do rozszyfrowania
- **Dysk 1**: za modułem boot obszar wysokentropijny (0x7DD8..~0x21118,
  6 bloków po $31D8 + reszta) — prawdopodobnie spakowany obraz danych gry
  (cruncher bez nagłówków {out,packed} — oracle-scan negatywny); na $21118
  drugi plik SEG2 (d2=$304E4, d3=$66A8, d4=$3084).
- Kompresja danych gry: TEN SAM cruncher co stage1? Test bez nagłówków —
  negatywny; wymagana dalsza analiza loadera w seg1 modułu boot.

## Pełny tekst gry — ODZYSKANY (dysk 1)

Najważniejszy rezultat: dysk 1 zawiera **nieskompresowany tekst gry** wewnątrz
dużego kontenera SEG2 ($21118, seg1=$304E4). Wyciągnięto **~211 stringów prozy**:
- **credits** (offset ~$4FE00): IDEA — ROMAN WERNER, RUEDI HUGENTOBLER;
  PROGRAMMING — ROMAN WERNER; GRAPHICS — ORLANDO, ROMAN WERNER;
  SOUND — RUEDI HUGENTOBLER; „Starbyte presents / Nightingale production";
  „HALL OF FAME", „JEREMY FLYNN".
- **itemy** (~$2CCD9): Charm of the Three Skulls, Hammer, Powder bag „Aipres",
  Snake-ring, Old file, Old salad-oil — z pełnymi opisami.
- **znaki i lokacje**: „Tunnel of Darkness", „Tunnel of Skulls", „Tunnel of Tears",
  „Tunnel of Truth", „Vault of Decay", „Rock of Ghosts", „water cave",
  „Great Hall", „Chamber of Temptation", „Well of Life", „Labyrinth of the
  Thousand Tunnels", „armoury", „bell-tower", „catacombes", „crocodile pit".
- **dialogi NPC**: więzień z wybrzeża, strażnik klucza, towarzysz O'Briana,
  towarzysz nietoperzy.
- **zagadki**: „The book of the combinations" (3 strony), inskrypcje na trzech
  kamiennych płytach (Tamran, Snake-ring, rytuał czterech bogów: Toga, Monteka,
  Lanu, Kwan), kombinacje dźwigni („Five times right, three times left...").
- **UI**: YOU WON / YOU LOST, TREASURE MAP COMPLETE!, COLLECTED/MISSED DIAMONDS,
  PASSWORD FOR THE NEXT STAGE, YOU'VE MADE IT!!!, - PRESS BUTTON -,
  GET READY, FLYNN, PLEASE INSERT DISK "B" IN DRIVE DF0:,
  oceny: NO COMMENT / NICE ATTEMPT / NOT BAD! / WELL DONE! / VERY GOOD! / EXCELLENT !!!,
  interakcje: „The door cannot be opened from this side.", „Here is nothing
  unusual to be found.", „After having a closer look, this seems to be a nasty
  trap.", „Here is nothing to scrutinize.", „Hello... it's already been used!".
- **broń**: CROOKED SWORD, SPECIAL BALLS, poziomy STRENGTH 1/2/3.
- **struktura przejść**: wybrzeże → zarośla/świątynia → zamek → skały;
  zbierane są **diamenty**, między etapami **hasła**.

Plik: `remake/assets/game_content.json` (kategorie: credits, intro, items,
story_stage1, story_temple, story_castle, ui_and_password).

## Mechaniki gry (z treści + trainera)
- Bohater: Jeremy Flynn, kapitan „Poseidon", rok 1641, Wyspa Diabła,
  kapitan Redbeard (złoczyńca), zdrada w załodze, misja: uwolnić załogę,
  odzyskać majątek; antagonista Philip Shave „the Chopper".
- Zasoby: życia, zdrowie, czas, złoto, **diamenty**; drzwi+klucze;
  narzędzia; poziomy 1–4 + „+34" (warianty/tajne), sekwencja końcowa,
  Hall of Fame, system haseł.
- Komunikaty gry potwierdzają: „MISSED DIAMONDS", oceny procentowe, hasła.

## HUD oryginału (potwierdzony zrzutem ekranu gracza)

Oryginalny interfejs (320×256):
- **górny pasek**: `Life` (liczba istnień) + pasek **Vitamins** (12 segmentów, czerwony→żółty→zielony)
- **dolny panel** (ozdobna ramka purpurowo-złota): `WEAPON` (slot + numer),
  `TOOL` (slot + numer), `CREW` (portret + licznik uratowanych), `SCORE`,
  `GOLD`, rzędy slotów na klucze/przedmioty, `TIME`.
- plansza: kamienne ruiny z fugą, mech/liany, drewniane belki, wodospady,
  czerwone kryształy/rośliny; tło: noc, gwiazdy, księżyc, wieże.

Remake odwzorowuje ten układ HUD i paletę (purpura/złoto/kamień/mch).

## Zablokowane / w toku
- **Grafika**: regiony danych na obu dyskach są skompresowane własnym
  pakowaniem (nagłówek-per-plik: 8 B + stała sygnatura `09 0a 0b 0b b2 b2 22 0c`;
  brak dopasowania do znanych pakowaczy Amigi; oracle-scan crunchera z stage1
  negatywny). Bitplane'y renderowane wprost dają szum → kompresja potwierdzona.
- **Mapy poziomów**: pliki hunk z dysku 2 to programy (silnik obiektów:
  skrypty aktorów, animacja sprite'ów, tablica trygonometryczna pod $71F8C),
  nie same mapy.

## Emulator jako wyrocznia (od 2026-10-19)

Zamiast łamać kompresję statycznie: gra działa w **vAmigaWeb** (`play.html`, Kickstart AROS,
crack PSG bootuje poprawnie: cracktro -> intro -> ekran tytułowy). Pamięć czytana z JS przez
`wasm_peek16` (skrypt wstrzykiwany do iframe przez `postMessage({cmd:'script'})`).
- `play.html` przycisk **Zrzut RAM** -> `work/oracle_server.py` (POST `/dump/<nazwa>`, tylko
  z localhost) -> `work/dumps/<nazwa>_chip.bin` (2 MB chip; gra używa ~$0-$70000).
- `work/dump_view.py <zrzut>` - szuka copper list (MOVE BPL1PTH/PTL), symuluje je linia po
  linii (wskaźniki, modulo, palety, EHB/HAM6) i zapisuje PNG. `--test` = samotest.
- Fetch bitplanów: przy DDFSTOP nie na granicy bloku sprzęt kończy blok
  (DDF $30-$D4 = 22 słowa, nie 21) - inaczej obraz to szum.
- **Ekran tytułowy odtworzony 1:1**: copper @$71B4, 6 planów EHB, 352×289, plany
  rozdzielne co $31D8 od $28E64, paleta w copper liście (zerowana podczas fade).
- Uwaga: attract mode przełącza tytuł <-> intro (copper @$73A8, 5 planów), zrzut łapie
  bieżący stan - robić zrzut zaraz po screenshocie.
- vAmigaWeb śledzi też dostęp do pamięci (`wasm_get_write_owner_ptr` itd.: kto i w której
  ramce pisał - CPU/blitter) - do namierzenia depackera i map poziomów.

### Automat (`work/oracle.js`, ładowany przez `play.html`)
Klatki liczone ręcznie `Module._wasm_execute_one_frame()` (działa przy ukrytej karcie,
~8× szybciej niż Amiga), joystick `emit_joystick_cmd('2PULL_RIGHT')`, zrzut ekranu z
`Module._wasm_pixel_buffer()` (1824×313 RGBA, 4 px na lowres; `work/shot2png.py`),
dysk bez okna: `insert_file(0)` po `postMessage({cmd:'load'})`.

### Przebieg gry (zweryfikowany automatem 2026-10-19)
cracktro (LMB) -> "Starbyte presents" -> intro z logbookiem (fire pomija) -> tytuł ->
"PLEASE INSERT DISK B" -> Hall of Fame / credits (attract) -> fire -> **mapa wyspy** ->
**etap 1 "THE THREADNEEDLE-LAGOON"** (tekst + PRESS BUTTON) -> gra.
Uwaga: etap 1 w remake'u ("Stony Coast") jest wymyślony - prawdziwy to laguna z pływaniem.

### Ekran gry (zrzut `lvl1_e`, copper @$CDC0)
- linia 8: górny HUD, 5 planów od $10620 (co $848), mod 0
- linia 55: plansza, 5 planów, DDF $30-$D0 (21 słów) + mod 10 = **52 B/wiersz (416 px)**,
  plany rozdzielne co $3400 (52×256) od ~$2E000; BPLCON1 = fine scroll
- linia 143-144: 3 plany od $9A54 (linia powierzchni wody)
- od linii 145: pętla copper (WAIT z maską + `COPJMP2` $08A) zmienia wskaźniki BPL3-5
  linia po linii = falowanie pod wodą. `dump_view.py` nie emuluje pętli (TODO, jeśli potrzebne).
- sprite'y: SPR0-3 @$15344.., SPR4/5 @$BF90.., SPR6 @$100FC, SPR7 @$E598
- dolny panel HUD poza oknem copper @$CDC0 (do znalezienia)
Zrzuty: `work/dumps/lvl1_{a..e}_chip.bin` + `*.png` (prawdziwy ekran), `mapa_wyspy_chip.bin`.

### FAST RAM - tu jest gra (konfiguracja AROS vAmigaWeb: 2 MB chip + 2 MB fast @$200000)
Kod gry działa w fast RAM (PC ~$2E9C00-$303xxx). Zrzuty sprzed tego odkrycia mają tylko chip
- od `lvl1_f` `T.dump` zapisuje też `<nazwa>_fast.bin`. Rysowanie przy przewijaniu: CPU pisze
kolumny do obu buforów ekranu (chip $2D000-$4D800), blitter składa obiekty w $9000.

### Poziom 1 - ROZPRACOWANY (zrzut `lvl1_f`, adresy w fast RAM)
- **bank kafli $2A6D32**: kafel 16x16, 5 bitplanów kolejno po 32 B = **160 B/kafel**;
  wartość v z mapy -> kafel `$2A6D32 + v*160`; v=0 = puste (niebo/woda). `work/tiles.py`
- **mapa $2B0DF6**: 1 bajt/kafel, wierszami, **540 x 48** (8640 x 768 px), 256 różnych kafli.
  Wiersze 0-35 = laguna (dno w wierszu 35), 36-47 = osobny obszar (skalne słupy nad chmurami?).
  Przed mapą 8 B nagłówka `0014 000c 001b 0004` (znaczenie TODO; start gracza?).
  (Pierwsza próba $2B0EC6 była przesunięta o 208 B - wykryte po szwie na krawędziach kafli.)
  `work/level_render.py work/dumps/lvl1_f 2b0df6 540 48 2a6d32` -> `level1_full.png`
- **zmienne globalne gry ~$319388**: `0030 021C` = wys/szer mapy, `$2A6D32` = bank kafli,
  `$2B0DF6` = mapa, `$2B7504` = rekord gracza (lista aktorów od $2B733E, za mapą),
  `$3174F8` = font 8x8. Tablicy kolizji/atrybutów kafli jeszcze nie znaleziono (nie ma osobnej
  warstwy 540x48 z małymi wartościami) - następny krok: debugger na procedurze kolizji.
- **atrybuty kafli: chip $FAF4**, 256 słów (wskaźnik w A4+$2C; procedura kolizji czyta
  `move.b (A2),D1; add.w D1,D1; move.w (0,A1,D1.w),D1; btst #0,D1`). Bity: 0 podłoga,
  1 ściana, 2 sufit, 3 drabina, 8 platforma (0x0101 = przechodnia od dołu), 15 śmierć
  (pale 0x8007); 0x0007 pełny blok, 0x0109 szczyt drabiny, 0x0087 skrzynia, 0x0010 wejście,
  0x0020 słup. Skały są tłem (0). `work/dumps/tile_attrs.png` - kafle pogrupowane.
- **gracz - sprite'y sprzętowe**, bank klatek chip **$131A4**: 108 długich słów (przesunięcia,
  0 = brak), klatka = nagłówek 8 słów (szer, wys, kotwica x/y = stopy, ramka dx/dy -5/-26, ?, ?)
  + 4 przesunięcia sprite'ów (2 pary attached = 32 px, 15 kolorów z palety 16-31) + dane.
  93 klatki, oba kierunki osobno. Animacja (z SPR0PT w copper liście co klatkę): postój 0
  (dłużej: 58 przodem), chód w prawo 10-13 (ping-pong, co 4 kl.), w lewo 38-42, skok 4 / 33,
  spadanie 88 / 87, pływanie 49-54 (co 4 kl.). `work/export_player.py`, `work/sprites.py`.
- **rekord gracza** (w tym uruchomieniu $2AAC14, adresy fast RAM zmieniają się między
  uruchomieniami - szukać przez A4+$30): +$0E x, +$10 y (stopy, px świata), +$12/+$14 poprzednie.
  Start poziomu 1: x=53, y=271. Zmienne globalne A4 = $30CA80 (wcześniej $319370), mapa $2A4506.
- **fizyka (zmierzona `T.trace`, 50 Hz)**: chód 1 px/kl. od razu, potem 1,5, potem 2 px/kl.;
  skok (UP, trzeba puścić przed następnym): -4,-4,-4,-4,-3x4,-2x4,-1x4,0x4,+1x4..+4 (40 px);
  zejście z półki: 1 px x7, 2 x3, 3 x3, 4; stopy sięgają +-8 px (z półki do x=79 spada przy 88);
  woda: wpadnięcie -> 1 px/kl., tonie do ~338, wypływa do 326 i się unosi; poziomo 1 px/kl.;
  UP pod wodą 1 px/kl., przy powierzchni wyskok jak skok z lądu.
- **układ ekranu gry** (linie Amigi = wiersze bufora vAmiga): 44-55 górny pasek (Life/Vitamins),
  56-214 plansza (159 linii), 215-254 dolny panel. HUD wycięty z obrazu emulatora
  (`work/export_hud.py`, stan startowy). Kamera: (A4+0, A4+2) + 48; start poziomu 1 (32, 176);
  2 skrajne kolumny mapy nie są pokazywane; gracz na ~60% wysokości planszy.
- **niebo = paralaksa 1/2**: gradient koloru 1 w copper liście zaczyna się w linii 230 - kamera_y/2
  (zrzuty f i g: linia 111 przy y=238, 142 przy y=176); 63 linie od #4499cc do #bb9944.
- **obiekty poziomu**: lista rekordów 26 B {x, y (dół), flagi, procedura.L, 4 param.L}
  (lvl1_g: $2B8E0E, 63 rekordy, 26 typów; procedura = przesunięcie w kodzie, baza kodu
  lvl1_f $2E926C). Dzban = typ $15F1C (4 sztuki). Grafiki obiektów są spakowane w pamięci
  (chip ~$9100: nagłówek jak klatki gracza `0010 0010 0008 0010 fff8 fff0 ...` + dane, nie
  ma ich w RAM jako bitplanów/sprite'ów/chunky) - na razie wycinane z bufora ekranu z maską
  "różne od tła z mapy" (`work/export_objects.py`). Bufor ekranu -> świat: (+16, +kamera_y).
- **grafiki obiektów - ROZPRACOWANE** (2026-10-19, debugger: watch na BLTDPT $DFF054 + `r cpu`,
  `r blitter`): BOB rysuje procedura $27DC blitem cookie-cut (BLTCON0 $xFCA: A maska, B plan,
  C tło), wcześniej tło jest zapisywane/odtwarzane przez bufor $9xxx (procedura $20CC).
  **Bank BOB-ów: chip $1EDA4** (plik, dł. $86D8). BOB = nagłówek 26 B {szer px, wys, kotwica
  x, y, -x, -y, ..., rozmiar planu @+22, ...} + maska + **4 bitplany** (wiersz = szer zaokr. do
  16 px); kolor = 16 + 4 bity (bitplan 4 = maska, paleta sprite'ów). Wcześniejsze szukanie
  "nie ma w RAM" było błędne przez założenie 5 planów.
  **Deskryptor typu** (CODE + typ): {$0000FFB6, przesunięcie BOB w banku.L, $30CD58 (zmienna
  z bazą banku), ...}. Typy lvl1: $15C46 moneta (8), $15CF0 klejnot (3), $15D54/$15E38 worek
  ze złotem (4), $15F1C dzban (4), $15F4E dzban "?" (1), $16666 uwięziony członek załogi (3),
  $16876 książka (1); $160AC/$160BE inny format; typy < $1000 wskazują na kod (wrogowie,
  strefy?) - TODO. Aktor obiektu: +$0A bieżący BOB, +$0E x, +$10 y. Drugi bank BOB-ów
  (ryby, kraby, rekiny, rozdymka, pirat) pod chip ~$657AE-$6C5FC.
- **wszystkie typy obiektów** (lista ma sekcje z 2-bajtowymi przerwami; razem 137 rekordów,
  x 87..8470): deskryptor {flagi.W, $FFB6, przesunięcie BOB.L, zmienna banku.L, ...} leży pod
  CODE+typ (fast) dla typów >= $1000 albo pod **chip $9A4C + typ** dla mniejszych (wrogowie).
  Banki: zmienna $30CD58 -> $1EDA4 (przedmioty), **$30CD70 -> $65484 (wrogowie)**.
  Wrogowie lvl1: $4D4 rekin, $526 czerwona ryba, $72C rozdymka, $7D2/$886 małż, $940 zielona
  ryba, $962 krab, $99C/$A26 muszla stożkowa, $A5E rozgwiazda, $AAC/$AF0 "hełm", $C34 mały
  pirat, $C7A pirat z nożem, $CDE drabinka, $D6A mewa. BOB 1x1 = niewidoczny wyzwalacz.
- **RetroShell**: `debugger`, `watch at $adr` (działa też na rejestrach custom), `r cpu`,
  `r blitter`, `d $adr`; polecenia wykonują się na początku następnej `_wasm_execute_one_frame`
  (przed wznowieniem po pułapce), więc rejestry z `r cpu` są z chwili trafienia.
- **teleport gracza**: zapis x,y do rekordu (+$0E/+$10/+$12/+$14) ORAZ do A4+4/A4+6 działa,
  ale przewijanie nie nadąża (kamera A4+0/2 to cel, prawdziwe przewinięcie goni wolno) -
  do zbierania grafik dalekich obiektów potrzebny inny sposób (TODO: rozpakowanie grafik).
- **nowa wersja**: `work/export_level.py work/dumps/lvl1_f level1` -> `game/assets/level1*`
  (atlasy nad/pod wodą, kolor 1 przezroczysty, gradient nieba z coppera, linia wody y=325);
  `game/index.html` - przeglądarka poziomu (przewijanie, 50 Hz). Zgodność z emulatorem
  sprawdzona na pozycji `lvl1_f` - linia wody y=325 (dopasowanie obrazu z emulatorem: swiat_y = wiersz bufora ekranu + 182; gracz na wodzie y=326).
- znalezione metodą: blok 16x16 z bufora ekranu = kafel z banku (dokładne dopasowanie
  5 planów), potem szukanie wiersza numerów kafli w RAM (`v = idx - 24`, bajty) i szerokości
  z sąsiednich wierszy.
- **lista obiektów ~$301CBE**: rekordy {x, y, flagi, procedura $2Fxxxx, grafika $2A6xxx...}
- **$303126**: prostokąty {x1,y1,x2,y2,dx,dy} w px świata (strefy prądu/kolizji?) - TODO
- **$303272**: rekordy {wskaźnik, id, x, y} - rozmieszczenie przedmiotów? - TODO
- Pod wodą copper zmienia paletę (linia wody) - render używa palety nad wodą (TODO).
- Debugger vAmiga dostępny: `wasm_retro_shell('debugger')`, potem `? cpu`, `d`, `m`,
  `watch at`, `break at`; polecenia wykonują się przy następnej klatce (`_wasm_execute_one_frame`).

### Aktorzy i skrypty GAME EXEC (rozpracowane 2026-10-19, `game/actors.js`, `work/export_actors.py`)
- **interpreter skryptów** w module GAME EXEC (chip): animacja $2188-$223E, ruch po ścieżce
  $2240-$237C, tablica rozkazów (słowa przesunięć) przed **$1CA0**, rozkazy $FFAC-$FFFE.
  Słowo >= 0 = numer klatki (i koniec kroku), `$xxFE`/`$xxFC` = zapis słowa/long do pola aktora +xx.
  Ważniejsze: $FFFA od początku bloku, $FFF8 stop, $FFF6 usuń aktora, $FFD6 opóźnienie animacji,
  $FFD2/$FFD0 pętla (licznik +$6A, $FFFF = bez końca), $FFCA/$FFC8 uśpienie (stałe/losowe),
  $FFC4 losowa klatka, $FFBE przemapowanie klatek, $FFBC ping-pong klatek, $FFB6 baza BOB
  (zmienna banku + przesunięcie), $FFE0 nowy blok animacji, $FFDE ścieżka, $FFE2 liczba bajtów
  listy (dx, dy), $FFEE wywołanie kodu natywnego, $FFF2/$FFF0 flagi globalne. Pełna lista:
  `work/actor_script.py` (dekoder: `python work/actor_script.py work/dumps/lvl1_h a3d0`).
- **aktor**: +$0A baza BOB, +$0E/+$10 x/y, +$26 klatka, +$2C/+$30 blok/przesunięcie animacji,
  +$32/+$33 opóźnienie/licznik, +$36/+$3A ścieżka, +$3C opóźnienie ścieżki, +$42 kroki na takt,
  +$44 bajty listy (dx, dy), +$4C bity 8/9 = lustro ścieżki, +$72 procedura dotknięcia,
  +$78 klasa (bit 15 = rani gracza), +$7A procedura co takt, +$98 rekord obiektu, +$9C "mózg".
- **klatki**: i-ty BOB licząc od bazy; nagłówek BOB 26 B: +16 maska zapisanych planów, +17 plany
  stałe = 1, +18 $0100 = pierwsza klatka zestawu, +22 rozmiar planu, **+24 rozmiar całego BOB-a**
  (maska + zapisane plany). Bank wrogów $65484: 102 klatki do $FFFFFFFF; bank przedmiotów $1EDA4.
- **rekord obiektu**: p1 = procedura startowa (CODE + p1), p2 = dane (CODE + p2: zasięg, dystans,
  prędkość/takt) albo liczba (prędkość skoku małża), bajt +$16 = wytrzymałość, +$17 = obrażenia.
  Skrypt startowy typu: chip $9A4C + typ + 2 (kończy go $FFF8).
- **zachowania** (takt 25 Hz): patrol $2EE86A (x += v, dystans -= |v|, po wyczerpaniu zawrót i blok
  lewo +$1E / prawo +$22), krab $2EE50E (czeka 10 taktów po dotknięciu małża), miecznik $2EC3D4
  (2 kroki, gdy gracz w pasie y +-40), skok/odbicie $2EF6C8 (vy +1 co 4 iteracje do 5, odbicie
  min(vy, limit)-1), rozgwiazda $2EEE52, skoczek $2EDE4A, rakieta-muszla $2EE52E/$2EE5E6
  (gracz w oknie x +-32, y -80..0, start gdy |dx| <= 4), jeżowiec $2EE220 (co 40 taktów kolec
  $A1F8 lecący do gracza, $2EE366), armaty (kula $2E1228/$2E1278), znikanie daleko od gracza $2E3714.
- **trafienie** $2E6BC6: obrażenia += siła broni (miecz 1); <= wytrzymałość -> oszołomienie
  (+$4C bit 12), inaczej śmierć (blok +$3E/+$42, ścieżka $2EB74A/$2EB81E, rekord +4 |= 1).
- **miecz gracza**: sprite SPR4/5 16x8; cios = klatka 1/30 (prawo/lewo), kucnięcie 2/31,
  cios w kucki 3/32; miecz względem stóp (+16,-14)/(-27,-14), w kucki (+13,-9)/(-23,-9).

### Poziomy 2-4 i pliki z dysku 2 (2026-10-19)
- **przejście między poziomami** (z łatki Skol's Trainer, F1-F6 / HELP): numer poziomu (od 0) = słowo
  **A4+$290**, flaga końca etapu = bajt **A4+$284** ($FF). W emulatorze: wpisać numer i flagę w trakcie
  gry -> ekran "WELL DONE!" (czas, owoce, mapy, hasło), mapa wyspy, tekst etapu, nowy poziom.
- zmienne globalne (A4 = $30CA80): +$00/+$02 kamera (świat = +48), +$20/+$22 wysokość/szerokość mapy,
  +$2C tablica atrybutów kafli (chip), +$30 gracz, +$48 bank kafli, +$50 mapa.
- **listy obiektów po relokacji** (typ = bezwzględny adres opisu typu, p1 = procedura, p2 = dane):
  poziom 1 $2F53CE (137), 2 $2F71F6 (282), 3 $2FADD8 (443), 4 $301660 (670) - `work/level_data.py`.
- **dysk 2 = pliki spakowane PowerPacker 2.0** bez nagłówka "PP20" (GAME EXEC $1252 -> $190C):
  wpis {$8000_0000 | dł. spakowana, dł. po rozpakowaniu}, plik = [dł.][tabela offsetów 09 0A 0B 0B]
  [strumień od końca][dł.3 B + bity]. `work/ppdepack.py`. Na każdy poziom: `LEV!` (mapa: 18 B
  nagłówka, szer = ekrany x 20, wys = ekrany x 12), `CHR!` (5 planów, paleta 32, kafle 160 B), bank
  BOB-ów wrogów, muzyka MMD0; dalej obrazy (32000 B, 51200 B) i muzyka mapy/sklepu. Pozycja w ADF:
  ścieżka x $1800 + offset - $1600 (ładowarka $2F08, od ścieżki $52 minus 2).
- mapa w pamięci różni się od `LEV!` 44 kaflami $E9 - gra zakrywa nimi ukryte miejsca na starcie.
- nazwy etapów: THE THREADNEEDLE-LAGOON, THE SKULL-GROTTO, THE TEMPLE, THE FORTRESS (teksty wstępów
  w fast ~$2BA138...).

## Wyekstrahowane zasoby (`remake/assets/`)
- `game_content.json` — **pełna treść gry**: credits, intro, itemy, znaki,
  dialogi, zagadki, komunikaty UI (z dyskietki)
- `intro_text.json` — 100% oryginalny tekst intra (107 stringów)
- `music_menu.mmd0` — oryginalny moduł OctaMED z dysku 2
- `palettes.json` — kandydaci palet Amigi (rampy kolorów) z kodu gry
- `probe_*.png` — renderowane hipotezy dekodowania bitplane (szum = kompresja)
- `extracted/files/` — pliki hunk + MMD0 wykute z dysków
- `extracted/boot_seg1.bin`, `boot_seg2.bin` — moduł boot (kod + dane)
- `extracted/stage2.bin` (cracktro PSG), `stage2a.bin` (trainer+GAME EXEC)

## Status / dalsze kroki
- [x] boot chain, depacker, cracktro, trainer, GAME EXEC, format SEG2
- [x] tekst intro, muzyka MMD0, **pełna treść gry z dysku 1**
- [x] credits, itemy, znaki, dialogi, zagadki, UI, system haseł
- [ ] złamać kompresję danych (odblokuje grafikę i mapy)
- [ ] zdekodować grafiki bitplane po dekompresji
- [ ] pełna logika gry z deasemblacji (silnik obiektów, skrypty aktorów)
- [x] **odtworzenie HTML5** (`remake/index.html`) — credits, intro, 3 etapy
      (Stony Coast / Thicket & Temple / Castle of Redbeard), znaki z autentycznym
      tekstem, itemy z autentycznymi opisami, dialogi NPC, diamenty, drzwi+klucze,
      poziomy broni, ekran ukończenia z oceną i hasłem, Hall of Fame;
      grafika proceduralna (do podmiany po złamaniu kompresji)
- [x] **sterowanie mobilne** — wirtualny pad + przyciski skoku/broni (pointer
      events + setPointerCapture, multi-touch), responsywne skalowanie, tap=Enter
- [x] serwer podglądu w LAN: `http://<adres-w-LAN>:8435/` (python http.server, port 8435)

## Uwagi prawne
Gra jest chroniona prawami autorskimi (Starbyte 1993). Projekt: cel badawczy
(personal use / zachowanie dziedzictwa). Odtworzenie używa własnych,
proceduralnych grafik; oryginalne zasoby (tekst intra, moduł muzyczny)
wyekstrahowano do analizy — przed jakimkolwiek rozpowszechnianiem wymagana
zgoda prawowitych właścicieli.

## Tablica poziomu i mechaniki (2026-10-19)
- **tablica poziomu** L($30CD14): +$08 akcje na kaflach ($2E42EC: kafel = wiersz nad kaflem drzwi, wszystkie
  pasujace wpisy {kafel.W, parametr.L, procedura.L}), +$0C pulapki (lupa $2EA7B2), +$18 skrzynie ($30CBBA,
  kafel + {indeks, kafel pod, flaga}), +$1C sciany do wysadzenia ($30CBBE, bomba $2E4CC8 okno 5x5), +$20 kruche
  kamienie ($30CBC6, $2F4B1A: ladowanie z ciosem w dol, przedmiot $2F24A0), +$68 kafle otwartych drzwi na klucz
  2x2 ($2E9D54), +$76 pokoj premii (start x/y, obszar: +0 generator deszczu, +8..+E kamera), +$58/+$5A czas ucieczki.
- **kombinacje** $2ED696..$2ED91E: wskaznik postepu w chip ($BExx), sekwencja bajtow do 0, nagroda bajt stanu = 1
  albo zestaw kafli A ($2E472A); przelacznik czasowy $2E435C {czas.W, bajt.L}, tykanie $30B8EA, potem stan 2.
- **gracz**: $30CC54 = w powietrzu, FIRE w powietrzu = cios w dol ($30CCAB); A4+4/+6 = polozenie gracza
  (rekord A4+$30 jest kopia - poke tylko A4+4/+6); dzwieki: skok (36,28), miecz (33,12), trafienie (35,12).
- **owoce** z dzbanow ($2E6990, tabela $2E84A2 -> $2E84C6): witaminy $1311C (+3k), pasek $1311E do 62 = +1 Life;
  kawalki mapy $1315A (do 6, $3096E8); koniec etapu: minuty x 300, sekundy x 5, owoce x 100, mapy x 1000.
- **blok '?'** $2E6452 (platforma $2000): uderzenie od dolu -> po 35 taktach pokoj premii $2DEAF4 (wiersze 0-11 <->
  36-47, deszcz przedmiotow $2EFF62 co 6 taktow, licznik 58). **Zasadzki** $2F2578 ($2E701E): dotyk -> aktor z danych.
- **sklep** ($2DD8CE): wlasna grafika i muzyka z dysku (deskryptory $1790EEC/$17B0E38/$17D17BC), paleta gradientu
  $30C110; paleta towarow nieustalona (zrzut ekranu sklepu wymaga dojscia do drzwi w emulatorze).
- **pliki z dysku** (jsr $284(a6), d0 = $01XXYYYY): offset w ADF dysku 2 = XX * 6144 + YYYY - 5628, od XX >= $58
  jeszcze - 12288. Sklep: muzyka $1790EEC = $B20F0, tlo $17B0E38 = $B503C (320x160, 5 planow), bank $17D17BC = $B89C0;
  mapa wyspy ($2F3770): obraz $1710080 = $A5284 (320x191, linia 17), BOB-y $16F0F8C = $A3190, muzyka $1750A88 = $ABC8C;
  znaczniki etapow $30B70E (199,159) (113,120) (208,89) (265,22); ikony hasla $16708A4 = $96AA8 (6 x 16x16).
- **paleta sklepu i mapy**: odczytana przez dopasowanie pliku tla do zrzutu ekranu (work/export_shop.py SHOP_PAL).
- **zdarzenia muzyczne** $2E22BE(d0): pozycja = tablica poziomu +$34 [d0]; premia 4, powrot 22, kombinacja 15.
- **duch** $2EFE58: wskaznik w tablicy predkosci $BCAC..$BCE8 (+2 .. -2) ku stronie gracza, na koncu nowy pomiar.

## Narzedzia z misji, okno komunikatu, pojemniki (2026-10-19)
- **Narzedzia z misji**: rekordy $30992E (14 B, +8 przesuniecie ikony w banku chip 16x15 po 206 B, +$A numer).
  Miejsca uzycia: tablica poziomu +$10 (22 B), procedury $2E4886 (blok kafli), $2F025A (puchar: wypada $300F42),
  $2F02A2 (worek: chmura $301010 lecaca w lewo), $2E48C4 (dzwon: kamienie $308870 co 12 taktow, kafel $DF, wstrzas
  $30B746), $2F030C (bajt $30CAF8 -> tloki $2ECF84). Lina: rzut $2EA718, zaczepy +$24, kafel liny atrybut $20.
- **Ciemne obszary**: obszar +$14 != 0 -> przy wejsciu ekran ciemnosci $2DDDC4; lampa (narzedzie 3) zuzyta raz,
  potem $2DF51E czysci +$14 (obszar zostaje oswietlony). Bez lampy gracz zostaje przed drzwiami.
- **Okno komunikatu** $2E3ED0: ramka BOB $30CD58+$2218 (176x48, kotwica 88,40), czcionka bank $30CD5C (93 glify od
  '!', szerokosc + 1, spacja 5), 4 linie co 10 px, 160 px (ostatnia 150), strzalka $2E5120. Pozycja $2E3E30.
  Poza gracza: klatka 59 ($2F1C00), po uwolnieniu calej zalogi 58 ($2F1AD4) i muzyka 24.
- **Klatki z zaloga**: blok $2F301A (klatki 0 0 1 co 8, sleep_rnd 2-6), dymek HELP $2F3072 (BOB $4B02).
- **Pojemniki** (p1 $2EFA92, trumny poziomu 2): dotyk $2E62D2 -> luk smierci, oblok $2E12F4, aktorzy z listy
  {opis, dx, dy} (nietoperze $2EFA6C: x += slowo +$80 w strone gracza).
- **Ptaszysko** $A7B6 (poziom 1): dotyk $2E65AC -> $A81C, lot jak duch ($2EFE58) z tablica $A884..$A8CE.
- Obiekty z prosta petla klatek (monety $2F26C2: 0 1 2 3 2 1) animowane w work/export_objects.py.
- **Klasy kolizji** +$76: bit 0 = dotyk gracza, bit 1 = trafienie bronia, $2000 = platforma; procedura +$72.
  Dotyk: spiace nietoperze $2E71B4/$2E71D6 -> $2EE086, stalaktyt $2E71F8 (sciezka $ACEC, $2EE8E6, odlamki $AD16/$AD52),
  kruszace sie $2E727E ($2EE9E8), pulapka $2E724C. Platformy: trampolina $2E63D4 ($B52E, wyrzut $2EFC6C),
  start programu ruchu $2E6430 (+$7E = p2 rekordu), wznoszaca sie $2E5FFA/$2EFC02.
- **Straznik wyjscia** $2F2E36 (jeden na poziom): chodzi ($2F2E68, x += d0 $2EFB4A), rani, znika gdy $30CD09 (ucieczka).
- **Czas ucieczki** $30912E: ostatnie 30 s dzwiek (49, 52) co sekunde; 0 -> utrata zycia i czas od nowa.
- **Odradzanie** ($2E35AE): rekord poza oknem kamery (x -50..+466, y -50..+306) ma licznik +$19 zmniejszany co 25 klatek;
  wrogowie z procedura $2E6B12/$2E6B3C po smierci dostaja 20 (ok. 10 s poza widokiem), potem pojawiaja sie znowu.
- **Rzutki** (poziom 3, $2E7BDC): lista {x, y, kierunek, zwloka}; znaczniki $300ED0/$300EF2 -> $300E54/$300E90 (9 px).
- **Krople** ($2EF8A8): lista {dx, dy, okres, licznik}; kropla $2E0FC0 -> $2EF930 (6 px/takt), rozbryzg $2E1012.
- **Ukryte kolce** $2F2F4E: dotyk $2E7222 -> anim $2F2F80 (rani 30 taktow), potem znow uzbrojone ($2E720E).
- **Dziennik** (rekord $30992E, ikona ksiazki): na starcie poziomu strona 1 = $30B410 'Logbook of: Captain Jeremy Flynn'
  ($2DCBD0: $13130 = $13132 = 1); ksiega $2E7636 dopisuje strone do tablicy $12F88 i ja pokazuje; uzycie $2DFA94.
- **Mapa** (id 1, $2E9EDE): zuzywa sztuke, $30CC89 -> $2E384C przeglad poziomu z muzyka (zdarzenie 4), FIRE konczy.
- **Hall of Fame**: fast $D002F (10 x 'JEREMY FLYNN', 100000..10000), autorzy zaraz za tabela; zestaw liter imienia
  'A..Z 0..9 .!$@%/'. Premia za etap $2DF1E8: minuty x300, dziesiatki sekund x50, sekundy x5, tykniecie (42,40).
- **Drzwi**: wejscie FIRE ($2E9D2C, $2EB213 = gracz przy drzwiach) -> $30CC51 -> $2DF3FA; dzwiek przejscia (58,0).
- **Bieg po skarb**: 6. kawalek mapy ($309742: $1315A = 6) -> $30CC3C = 4 -> $2DD69E: licznik diamentow, $2DE65C: czarny
  ekran 'CONGRATULATIONS ! / TREASURE MAP COMPLETE !', muzyka $1760358 (= extra3), bank diamentow $17901AC -> $30CD80,
  zamiana wierszy 0-11 z 36-47; tablica poziomu +$72 {x, y gracza, obszar: lista {x, y, typ} po 6 B, granice kamery};
  kamera 1 px/klatke; przedmiot pojawia sie przy x <= kamera + $15A (y - $240), przepada przy x <= kamera ($2E37D8).
  Typ 0/1/2 diament (100/500/1000 pkt), 3 serce (zycie, nie liczy sie), 4 ostatnie serce. Wynik $2DEF3C: procent
  (zebrane - ostatnie) / (wszystkie - 1); oceny od 100/90/80/50/25 %, zloto 1000/750/500/250. Niebo $30BF68.. (wpis co 4 linie).

### Skrzynie skarbow i kawalki mapy (2026-10-19)
- Tablica poziomu +$14 ($30CBB6): bajty 4/5 = kafel zamkniety/otwarty (L1 9/8, L2 48/47, L3 239/238, L4 75/74),
  od +6 wpisy po 12 B {indeks kafla.W, x.W, y.W, uzyta.W, lista.L}; lista opisow typow do 0, $FFFFFFFF pomijane.
- $2E4990 co klatke: gracz (ramka +$62..+$68) w prostokacie x-24..x+40, y-24..y+16, kafel == zamkniety -> otwarty,
  pod linia wody 3 babelki ($2E14BC/$2E15A2/$2E15FC w x+8,y / x+11,y-8 / x+4,y-4). Tylko jedna skrzynia naraz ($2E5164).
- $2E4ABE: co 5 wywolan przedmiot z listy jako aktor (skrypt opis+2) w (x + rnd(12)+2, y+4), vy -(rnd(3)+3),
  vx +-1 (bit 2 adresu na liscie), tick $2EBEFE = fizyka $2EF5D0 (pole $C = granica odbicia z natywnego $2EFA86 w opisie:
  kawalek mapy i mikstura 4, monety 6; $E/$10 = dzwiek odbicia (62, 30) z $2EFA7A/$2EFA80), vx do pierwszej podlogi,
  od sciany sie odbija. Dzwiek wylotu (48, 28).
- Czesc skrzyn stoi pod skrzyniami do noszenia (kafel skrzyni ma 'under' = zamknieta skrzynia skarbu).
- $2F30EE = druga mikstura (ta sama obsluga $2E75EA), $2F30C6 = lampa (przedmiot questu 3).
- Kawalki mapy na poziom: L1 1 widoczny + 1 pod kamieniem + 3 w skrzyniach + 1 z wspinacza a6f8 (zasadzka $2F2578
  w 8293,207; $2E6F08 po zwyklej smierci $2E6B66, ktora ustawia bit 0 rekordu, zawsze wypuszcza $2F317C);
  L2 1 + 5, L3 7 + 5, L4 5 + 7.
- Podniesienie przedmiotow questu 5, 7, 10, 12, 13, 14 ($2E7896..$2E7AF2) otwiera okno z opisem ($2E3E14, teksty
  $2E852E..$2E866A) z $30CC26 = 4, co w $2E3ED0 daje poze triumfu $2F1AD4 zamiast czytania $2F1C00 (8 = strona dziennika).
- Bezczynnosc gracza ($2F0548): licznik $9DE6 = $960 po ruchu, -1 na klatke 50 Hz, przy 0 -> $7D0. Progi:
  $6A4 i $4B0 wiwat $2F1ADC/$2F1B02 (klatki 58, 105, 106 co 10, dzwiek $2EE17C (57, 53)), $3E8 i $32 przytupywanie
  $2F1B32 (102-104 w petli co 7), $28A i $FA ziewniecie $2F1B3C (107 co 22, dzwiek $2EE18C (27, 28)). Sekwencja bez
  petli zostaje na ostatniej klatce (58). Sprawdzone w emulatorze (pozycja sekwencji $2F184C).
- Dzwieki i zdarzenia muzyczne dopasowane do wywolan $2E216C/$2E22BE: trafiony wrog bez smierci (34, 17) $2E6ACC,
  smierc aktorow z procedura $2E6E2A (21, 48), przedmiot questu i mapa (20, 48), diamenty biegu (48, 48/47/46), serce
  (57, 40); kawalek mapy bez dzwieku, zdarzenie 0 ($3096E8); drzwi zdarzenie 3 ($2DF568), utrata zycia 6 ($2E67E2),
  rozsypany szkielet 7 ($2E7178).
- $30CBD2 (tablica poziomu +$28, dawniej $303126): prady wodne {x1, y1, x2, y2, dx, dy} ($2F14D0, tylko w wodzie $30CC7C);
  L1 17 pradow, L4 4. Ramka gracza w prostokacie -> kursor tablicy predkosci ($9B88, wartosci 1/0/-1 = ulamki px)
  przesuwany o |d|+1 krokow na klatke, na koncu tablicy predkosc = d px/kl. |d| > 2: porwanie ($9DDA), obrot
  $2F1C04/$2F1C12 (klatki 91-96 co 3), dzwiek (25, 29), poprzecznie 1 px/kl. do srodka pradu (y - 6); $9DDE = 20
  co klatke w pradzie, po wyjsciu przy 18 koniec porwania, przy 0 zwykle plywanie ($2EB1BC).
- Babelki ($2E14BC, $2E1548/$2E15A2/$2E15FC; procedura $2F5164): +$98 px/takt w gore (natywne $2EFA98), w pradzie
  ($2ED132) przesuniecie (dx, dy) + znak * $98, nad linia wody sciezka pekniecia $2E152C. Gracz pod woda (y > woda + 2,
  $2F0F5A) co 100-299 klatek ($30B8B0, po wejsciu 70) wypuszcza babelek w (x, y - 10) z dzwiekiem (32, 12); wejscie do
  wody: plusk $2E1468 w (x - 16, woda - 5).
- Audyt procedur $7A i natywnych w skryptach: $2EF7C0 (aktor $A302 z generatorow L1 znika, gdy gora ramki siega linii
  wody), $2DDFC8 (koniec procedury i dotyku, m.in. sciezka pekniecia babelka). Kropelniki $2EF880..$2EF8DE byly juz
  w objects.json (emit), wskazniki stanu $300A9A ($2ED466) jako 'trapdoor'.
- **Muzyka poziomu** (odtwarzacz $2E2Exx, zmienne: blok $2E3364, wiersz $2E3362, pozycja $2E3366): tablica zdarzen
  poziomu (+$34, $2E2348) ma dwa zastosowania. Dzingiel ($2E22BE, zdarzenia 0/2/3/4/6/15/21/22/24): wartosc = numer
  BLOKU, gra raz, potem $2E2FB0 przywraca zapamietany blok/wiersz/pozycje (sprawdzone w emulatorze: zdarzenie 2 ->
  blok 17, potem powrot do bloku 38 w tym samym wierszu). Bloki dzingli (12-31) nie leza na liscie pozycji.
  Melodia ($2E351E): wartosc - 1 = POZYCJA, wyciszenie $312 o 4/takt, skok, narastanie o $18 ($2E3522 = od razu):
  11 poziom (pozycja 0 = blok 0 z B12 -> 18), 14 zanurzenie z powierzchni ($2F0F6E), 23 pokoj premii ($2DEC8A),
  25 L4 na zewnatrz (punkty kontrolne z p1 $2EB970 ustawiaja $30CC9F), wyjscie z wody 11/25 ($2E9560).
  Start poziomu L1 w emulatorze: pozycje 18, 19, 20... (bloki 33, 40, 44, 41, 34).
- Muzyka ekranow: Hall of Fame ($309DF0..$309FFA) - wynik >= najnizszego w tabeli ($30CE5D) modul $1660668 (dysk 2
  $9506C, game/assets/music/hof_new.med), pokaz $16A06FC (extra4); zakonczenie gry: segment SEG2 z $1800694 (dysk 2
  $BC098, tekst 'CONGRATULATIONS... YOU FREED THE WHOLE CREW' i napisy koncowe) laduje muzyke $C5C34 (extra2) i grafike $C21E4.
- **Zakonczenie** (SEG2 $BC098, kod od +$10): muzyka $C5C34 (extra2), obraz $C21E4; statek i morze nieruchome (roznice
  klatek w emulatorze tylko w pasie tekstu). Tekst: ciagi zakonczone zerem (puste = wolny wiersz), wiersz co 10 px od
  x = 16, przewijanie 1 px / 3 klatki od dolu, szosty plan EHB (skladowa 4-bit / 2) tylko na pikselach nieba (wiersze
  0..158 w kolorze wiersza), $01..$02 panel x 8..311 na 5 wierszy z tekstem w pelnej jasnosci, '<' '>' '@' = cudzyslowy
  i (C) z wlasnego fontu segmentu. Wyjscie z petli: FIRE ($BFE001 bit 7). Wyzwolenie w emulatorze: $30CD10 = 4 i
  $30CD04 = $FF (tablica $30B70E wpis 4 = $FFFF -> $2DE564).
- **Menu i hasla** (modul $309DF0..$30AB16, ten sam co Hall of Fame): po wczytaniu dysku B ekran z logo, medalionem
  i wstega START / PASSWORD ($30CE1C wybor, gora/dol); bez ruchu $30C48E = 200 klatek -> tabela wynikow. PASSWORD:
  8 pol z obrazkami 0..5 ($30C47A, bank $16708A4 = dysk 2 $96AA8), kursor co 20 px, gora/dol obrazek, FIRE porownuje
  z $30C438 (8 slow na etap, koniec $FFFF) i ustawia $30CD10 = wiersz + 1, potem powrot do menu. Ekran konca etapu
  ($2DF382): 'PASSWORD FOR THE NEXT STAGE:' w (40, $8D) i 8 aktorow $30CA66 co 23 px od x $70, y $B0, co 6 taktow;
  na ekranie (wspolrzedne tekstu -32/-20, HUD zostaje): wiersze 65/80/95, haslo 120, obrazki od (72, 140).
- **Mapa wyspy** ($2F3770): obraz $A5284 to 5 planow po kolei (320x191) od linii 17; aktorzy ($2F3806..): flagi
  zamku $2F3BF0 (243, 19) i $2F3C1C (278, 18) zawsze, etap 1: statek $2F3C88 z (300, 208) po sciezce $2F3CC8 do
  (232, 185), na koncu $FFC6 szalupa $2F3E8E; dalsze etapy: statek na kotwicy $2F3E58 (232, 185) i znacznik $2F3C48.
  Napisu z nazwa etapu na mapie nie ma (jest na ekranie wstepu). W porcie: osobna instancja interpretera
  (makeActors({absPos: true}), rozkazy $0EFE/$10FE ustawiaja polozenie), work/export_map.py.
- **Smierc gracza** ($2E67B2 po trafieniu z zyciem <= 0; zmierzone w emulatorze w wodzie): obrot x5 po 3 klatki
  (woda $2F1A5A: 96..91, lad $2F19F8: 0, 85, 86, 84, 29, 58), klatka koncowa obrotu, 97..101 po 6 klatek, potem
  kupka 99 z przesunieciem sprite'a $0FF6 000B ($9F1A = 11). W wodzie cialo opada zygzakiem (13 px w bok, ~18 px
  w dol na 68 klatek) na dno; na ladzie podskok z profilu $2F1E52 ($2F48EA, dy w gore na klatke). Gra czeka na FIRE,
  ~50 klatek pozniej powrot w punkcie kontrolnym z pelnym Life i zyciem mniej.
- **Wyjscie z etapu** ($2DF43A..$2DF46A): melodia 9 od razu ($2E351E = 9, $2E3522), sekwencja gracza $2F1ABC
  (machanie: klatki 27/28 co 4), potem $2DE4CA czeka 131 klatek ($82 + 1) ze stojacym swiatem i dopiero ekran konca.
- **Kosci w sklepie** ($2E8932..$2E8A64): dwie kosci $2E1E08 / $2E1E82 w (246, 126) i (261, 118), bank sklepu od $61DC
  (klatki 0..5 toczenie co 5 taktow, faza druga od 3), po 61 taktach klatka 4 na 3 takty i scianka 5..10 (wartosc
  rnd(6) + 5 wpisana w skrypt $2E1E6E / $2E1EDC) przez 50 taktow; wynik po 71 taktach ($2EB206): parzystosc sumy ==
  wybor -> zloto + 2 x stawka (stawka pobrana przy zakupie), napis 'YOU WON' / 'YOU LOST' ($2EB140), zdarzenie 6 / 7.
  Reka $2E1EF0 (bank sklepu od $C88, sciezka $2E1F1E): klatka 1 w (247, 177) przez 6 taktow, klatka 4 w (241, 157) +
  kosci ($2E8988), po 80 taktach klatka 1, po 100 zjazd (245, 177) -> (238, 195), znika; twarz sprzedawcy usunieta
  na czas gry ($2E8932) i odtworzona z tablicy $2E1B40 na koniec ($2DDC52).
- Zamek czterech bogow (L3, $BE8A, sekwencja 2 1 4 3; $2ED7CC): pomylka zeruje postep i wypuszcza dwie kule $3003E4
  w (5487, 95) z predkosciami (-1, 5) / (1, 5) jak $2EF7F4 / $2EF7FE, dzwiek (60, 20). Krata przy zamykaniu
  ($2ED3CC) dzwiek (52, 0); stalaktyt przy rozbiciu drugi dzwiek (31, 40) ($2EE96E); smierc z iskrami ($2E6C82)
  oprocz (18, 2) gra (55, 0).
- Przedmioty z fizyka od startu: init $2EEB66 (klucze: granica 6, 3 kroki, dzwiek odbicia (62, 24)),
  $2EEB92 (sakwy, ksiazka, lina: 7, 3), $2EEBB6 (moneta $2F2626: 10, 2, (62, 30)); procedura $2EF000 = $2EF5D0.
  Spis poziomu podaje polozenie startowe - czesc kluczy w L2 i sakw w L1/L4 wisi nad podloga i spada.
- Pokaz w menu (emulator): menu 200 klatek bez ruchu -> zwiniecie -> tabela wynikow ~300 klatek -> menu -> autorzy
  (logo, '(C) 1993 STARBYTE SOFTWARE' od x 64, opisy x 48, nazwiska x 152, wiersze 99/110/132/154/165/187) -> menu...;
  historia z intra przechodzi do menu (dysk B). Medalion w menu sie nie animuje.
- **Bron miotana** (sklep $2E4F4A..$2E4F62 tylko zmienia bron, $2E4F1A: tej samej nie da sie kupic): bez amunicji.
  Kula zelazna ($2EA2F4): najwyzej 3 w locie ($30CCD6), sila 2, skrypt $2E1840 / $2E17F6 sciezka 15 krokow po 6 px
  w bok, potem oblok $2E176A; sciana ($2EA34A) = oblok. Specjalna ($2EA3EC): 3 w locie, sila 1, fizyka vy -3 / granica
  8 / 2 kroki, 6 px/takt, 3 odbicia, sciana zawraca. Ognista ($2EA166): jedna ($38(A4)), sila 10, vy -4, 2 px/takt,
  do 75 taktow, przy podlodze ogien $2E0B60 (sila 8). Dzwiek rzutu (37, 12).

### Drabina (emulator + kod $2E9B3E, 2026-10-19)
- Stan gracza 2 ($30B8AE), chwyt tylko z ziemi: UP gdy kafel na wysokosci ciala ma bit 3, DOWN gdy szczyt drabiny
  (0x0109) pod stopami; na szczycie UP = skok, na dole DOWN = kucniecie. x = (x & ~15) + 7 ($2E9B80).
- A4+$12 (dy gracza w px/kl.) = -2 / +2 ($2E999A / $2E9BA6): 2 px/kl. w obie strony.
- Animacja: blok $2F1B6C (6 klatek, co 4): w gore 72..77, w dol 77..72, od poczatku przy ruszeniu; zawis 79 (prawo) /
  78 (lewo), LEFT/RIGHT tylko obraca (bez zejscia w bok); FIRE = cios z drabiny 81 / 80 ($2F1B7A / $2F1B88).
- Koniec drabiny: gracz staje na szczycie (y = gora kafla - 1) albo na podlodze pod drabina.
- Lina (stan 6, $2E9664 / $2E9BEA): tez 2 px/kl. i x na srodek kafla; animacja co 6 klatek: w gore 61 62 63 62 ($2F1B9A),
  w dol 63 62 61 62 ($2F1BA4); zawis 64 (lewo) / 65 (prawo), cios 66 / 67 ($2F1BAE).
- Start etapu ($2DCFFC..$2DD098, ujecie emulatora): tekst etapu na pelnym ekranie 320x256 (tytul y 35, wiersze od 56 co 11),
  '- PRESS BUTTON -' ($30AFBA) w (96, 187) miga 20 / 10 klatek po wczytaniu poziomu; przycisk -> 'GET READY, FLYNN'
  ($30B67A) w (96, 101), dzingiel 1, rozpakowanie - razem ok. 265 klatek; HUD rozjasnia sie przez ok. 10 klatek, plansza
  czarna ok. 32, potem odslania sie cegielkami 8 x 3 (rzedami, na zmiane przesuniete) przez ok. 20 klatek.
- Drzwi (emulator + $2E95AA, $2E98A6, $2E9D2C): UP na kaflu z bitem 4 atrybutu (kafel pod graczem, y - 6, ten sam indeks co
  w tablicy drzwi $30CB2A) obraca gracza tylem: klatki 85 (z prawej) albo 84 (z lewej), potem 86, co 6 klatek
  ($2EB1E4), i ustawia $2EB213; FIRE dopiero wchodzi ($2E9E38 -> $2DF3FA: drzwi z tablicy, indeks albo indeks - 1).
  Bez bitu 4 UP to zwykly skok (np. chatka L1 x 3216, kafel 10461 - z tej strony nie do otwarcia).
- Przejscie przez drzwi ($2DF568 -> $2DFBCA, powrot przez $2DD60E -> $2DD166): dzingiel 3, paleta planszy gasnie
  16 krokow po 1 na klatke (kolory $CEDA i ruchy koloru w copperze $CF9C..$D878; HUD bez zmian), potem sklep / ciemnosc /
  nowy obszar; dla obszaru gra wraca do petli jak na starcie etapu ($30CD00): plansza czarna, odslanianie cegielkami.
  Wyjscie przy nieuwolnionej zalodze: nic ($2DF550). Jasnienie palety $2DFD14 (licznik $30CCCA = 16) uzywane przy innych ekranach.
- Koniec biegu po skarb (petla $2DD69E, $2DD87C): sukces ($2DEEA6) - 10 klatek, melodia 18 od razu (modul skarbu, pozycja 17),
  200 klatek stopklatki, wygaszenie, ekran czyszczony, wyniki ($2DEF3C) z rozjasnieniem; upadek w chmury ($30CC75, $2DE926) -
  melodia 19 z wyciszeniem (pozycja 18), 195 klatek, wolne wygaszenie ($2DFC70, krok co 3 klatki), 100 klatek, wyniki.
  Powrot ($2DE94A): wygaszenie, wiersze z powrotem, obszar i melodia 11 poziomu, rozjasnienie 16 klatek (bez cegielek).
- GAME OVER ($2DE12E -> $2DE1BA, work/export_gameover.py): po smierci bez zyc od razu (bez FIRE); czeka na dzingle,
  dzingiel 10, wczytuje $1670D08 (bank BOB-ow 4076 B, ADF2 $96F0C) i $16804F8 (tapeta 320x160x2, ADF2 $97EFC), 80 klatek,
  wygaszenie, tapeta z czaszek w planszy (kolor 1 = $512 z gradientu $30C1B8, reszta paleta poziomu), aktory $2E1AAC ('Game',
  z gory) i $2E1AE6 ('Over', z dolu) po 132 px, rozjasnianie co 2 klatki ($30CD42); po dojechaniu dzwiek (6,22) i $30CCA2,
  FIRE (po koncu dzingla) -> Hall of Fame.
- Wiezien w klatce ($2F2FE2, dotyk $2E6F5E): dotyk przy y gracza = y klatki + 15 ustawia $30CC71; UP (kolejnosc w $2E9596:
  drabina, drzwi bit 4, klatka $30CC71, akcja bit 6 z wyrownaniem x, lina bit 5) obraca gracza tylem ($30CC8E), FIRE
  ($2E9D12) ustawia $30CC72 i uwalnia jedna klatke. Poz. 3: wspolny pokoj (9392, 352) z 6 drzwi ma 6 rekordow klatki -
  oryginal liczy je wszystkie (CREW 08 na starcie), kazde FIRE uwalnia jednego.
- Plytki i dzwignie wolaja procedure z poczatku bloku parametrow (jsr (a1)): $2E472A = zestaw kafli, $2E4554 / $2E4558 =
  przelacznik wody {proc, obszar.L, cel linii wody.W, opoznienie.W} (dzingiel $10 / $11, obszar +$12 = cel, $2F0E08 przesuwa
  +$10 o 1 px co opoznienie + 1 klatek). Odkryte w sesji ekstraktora (commit 5a98ca3); wczesniej eksport czytal te bloki jak
  zestawy kafli i silnik wpisywal smieciowe kafle (dziury w podlodze): L2 [50],[51], L3 [76],[97],[98], L4 [43].
- Upadek ($2F0B2A, emulator): przy starcie spadania predkosc $30CC28 = 1 (+1 co 3 klatki do 4) i zapas $30CC4C = $80;
  co klatke zapas -= predkosc (piksele w dol). Ladowanie z zapasem < 0 albo gracz > $CA ponizej kamery -> $30CC77:
  dzwiek (22,53), klatka 97 ($2F1B52), podskok z profilu $2F1C22, ciało przelatuje przez podlogi pod ekran, po 50 klatkach
  ($30CC22) Life = 0, zycie mniej, czekanie na FIRE (emulator: zrzut ze 171 px na poz. 1 zabija). Ladowanie z predkoscia > 2:
  dzwiek (24,0) ($2F1770 -> $2E42D4). Trampolina (tryb $30CC54) nie zuzywa zapasu.
- Dzwieki broni: start $2E9FD0 (33,12), miecz ze sklepu $2EA0A4 (33,8), morgensztern $2EA27A (60,20), szabla $2EA514 (60,10);
  kursor sklepu / kosci / zmiana narzedzia (63,30); wejscie w ciemnosc (54,8).

- Czolganie (stan 3, $2E9B0A, emulator): DOWN + kierunek na ziemi ($9DD4), 1 px/kl., klatki $2F18AE R 14-18-15 /
  $2F1972 L 43-47-44 co 5; postoj pod stropem $2EB194 (18/47), cios 19/48 (bron: przesuniecie z rekordu +$C/+$E [2]).
  $2F0A9E: przy czolganiu kafle wiersz nad (y-6) przy x-8 i x+8 - bit CEIL ustawia $2EB217: wtedy puszczenie DOWN nie
  podnosi gracza ($2E8B86), UP nie skacze ($2E94EC), samo LEFT/RIGHT czolga dalej. Bez stropu: puszczenie DOWN = wstanie,
  sam DOWN = kucniecie. Tunele 1 kafel: L2 x 6280-6440 y 79, L3, L4 (skan mapy).
- Spadochron ($2E945A, emulator): w powietrzu (skok $30CC54 albo spadanie $30CC59) DOWN ustawia okno $2EB13C = 10 klatek;
  UP w oknie -> $2EB20C, dzwiek (55,0), sekwencja $2EB1D4 (klatka 6 / 35). Ruch: 2 klatki po 1 px w gore, potem
  2 px/kl. w dol, w bok 1 px/kl. (pierwsze 2 klatki stara predkosc); zwykle spadanie ($2F0B22) pominiete, wiec bez
  zapasu i smierci od upadku (tylko gracz > $CA pod kamera, $2F0EF2). FIRE nic nie robi ($2E9CF4). Koniec: podloga
  ($2F0F18) albo woda.
- FIRE w powietrzu ($2E9D08, emulator): tylko w skoku ($30CC54 trwa do ladowania - profil skoku $2F1CE2 konczy sie
  stalym +4) i po wyrzucie z trampoliny; przy zwyklym spadaniu ($30CC59, zejscie z krawedzi) FIRE nic nie robi.
- Skrzynia ($2E9E5A): FIRE podnosi tylko z kierunkiem (d7), nie w skoku i bez aktywnego ciosu; niesiona dopoki FIRE
  wcisniete - puszczenie FIRE ($2E8BA8 -> $2EA840) stawia ja (dzwiek 46,48), przy scianie/suficie zostaje w rekach;
  chwyt drabiny tez ja odstawia ($2E9B9A).
- Cios w dol ($2E9EB2, emulator): FIRE w skoku zawsze (tez przy kulach) ustawia $30CCAB i sekwencje $2EB1B4 (klatka 8 /
  37), bez obiektu ciosu i bez obrazen dla wrogow; puszczenie FIRE ($2E8BC4) wraca do klatek skoku. Ladowanie z $30CCAB
  ($2F0D52, kruchy kamien $2F4A00) = odbicie profilem $2F1E98 (18 px w gore) i znow tryb skoku - z trzymanym FIRE gracz
  skacze w miejscu. Zapas spadania w skoku: $A4 na starcie ($2E9842), dy profilu odejmowane z znakiem ($2F0D16, wznoszenie
  oddaje), smierc przy zapasie <= 0 ($2F0D40); trampolina $80 ($2F4904).
- Chod ($2E9086, emulator): wskaznik $9B88 w tablicy dx (px/kl.) - w prawo -(a0), w lewo (a0)+, bez kierunku powrot
  do srodka (rozbieg 0,1,1,1,2,1,2,1,2,2; wybieg 2,1,2,1,2,1,1,1,0 = 11 px). Tablice w chip identyczne na 4 poziomach:
  zwykla $9BAC (srodek +10), sliska podloga - atrybut kafla $4000 ($2F1112, tylko poziom 4, kafle 134/153/172) $9BF8
  (srodek +40): dlugi rozbieg i poslizg. Zmiana tablicy ($2F125E) szuka tej samej predkosci od srodka. Czolganie
  $9D9C, w powietrzu ten sam wskaznik (bez zmiany tablicy).
- Wytrzymalosc i obrazenia wrogow ($2E3600): 2 pierwsze bajty opisu typu -> rekord +$16 (wytrzymalosc) i +$18 (obrazenia
  dla gracza); pojemnik ($2E6338) daje je pierwszemu aktorowi z listy. Trafienie ($2E6B82): +$17 += sila broni ($A0),
  wrog ginie, gdy +$17 >= +$16; bez rekordu ginie od razu. +$17 zostaje w rekordzie (odrodzony wrog pamieta trafienia;
  zeruja ghul $2EC850 i szkielet $2EEB36). Np. poziom 4: piraci 7 (miecz 7 ciosow), topornik 5/2, mumia z sarkofagu 9/3.
  Gracz ($2E666A): obrazenia z $A0 (klasa $78 bit 7), z rekordu +$18 albo 1; 0 = Life do zera (petla dbra $308FA6).
  Potem nietykalnosc $30CCD8 = $50 klatek, przy Life < 3 dodatkowo dzwiek (29,43), na ziemi podskok profilem $2F1E98.
- Lup z wrogow ($2E6B66 -> $2E6BBC -> $2E70D2, tez $2E6B12): los 0..77 z $2E8454 (40 x nic, zgnily 4, owoce 1-4: 10/8/6/4,
  klejnot 3, moneta 2, sakwa 25 1) -> opis $2E84C2[v-1]; przedmiot skacze jak owoc z dzbana ($2EEFA0: vy -5, limit 6/4,
  dzwiek odbicia z +$7E/+$7F: (62,30), sakwa (39,0)). Wartosc ($2E7304): kod $64+ -> $2E84F2 do zlota i punktow.
- Kamera ($2E528C, emulator): A4 += dx/dy gracza, gdy gracz wyjdzie poza okno: w poziomie 96..224 px ekranu (przy x
  kamery portu = A4 + 48), w pionie 88..92 px od gory planszy - tylko przy ruchu w danej osi (start etapu 1: 95 px, kamera
  32/176). Na drabinie/linie ($2E52DC) kamera dosuwa sie 1 px/kl. do x gracza - A4 = $B4.
- Plywanie w poziomie: ta sama mechanika wskaznika, tablica $9C9E (srodek +30, wejscie do wody $2F137E): rozbieg 0,0,0,
  1,0 x5, potem 1 px/kl.; po puszczeniu ok. 20 px poslizgu (emulator co do klatki). Prad ($2F1542) przesuwa wskaznik
  |dx|+1 razy na klatke, na koncu tablicy dx = predkosc pradu; wybieg wtedy wylaczony ($9DDC).
- Plywanie w pionie ($2E8C76, wskaznik $9B98 -> tablica $9D5E, 29 wpisow): DOWN -(a0) (zanurzanie 0,1,0,1,0,1,1..),
  bez DOWN (a0)+ ku koncowi -1 (wypornosc: wybieg, 6 klatek postoju, potem 1 px/kl. w gore); UP pod woda nic nie robi
  ($2E9576). Wpadniecie: indeks 0, na powierzchni (y < woda + 2) indeks 12, dno 18, sufit 12. Prad pionowy przesuwa
  wskaznik jak poziomy. Emulator zgodny co do klatki.
- Blyskawice (tylko poziom 4, tablica $301088 -> $30BC4B, $2DCE64): licznik $30BC52 = los 0..449 klatek ($2F0734), potem
  $30BC4A: sekwencja $30BC4E (jedna z 4 pod $30BC56: $30BC66, $30BC9E, $30BCC2, $30BCFA, do $FFFF) dodaje po wpisie na
  klatke do kanalow RGB kolorow nieba w copper ($2E550C, obciecie do $F). Bez dzwieku.
- Blysk trafienia ($2E6ACC -> jsr $2EC(a6) = chip $1CD6: aktor +$96 = licznik, +$97 = maska planow; blitter $2772
  rysuje wtedy BOB jako jednolita plame koloru +$97): trafiony wrog 2 klatki koloru 22 (biel; pod woda L1 #DDF, L4 #AFF),
  smierc $2E6E2A 3 klatki.
- Kafle smierci (atrybut $8000, sondy $30B8DA / $30B8D8, $2F51A2 -> $2E674A): bez nietykalnosci ustawiaja $30CBE4 = 2
  (petla glowna $2DD36E: Life -2, nietykalnosc $50, dzwieki trafienia); jesli Life > 2 albo gracz byl nietykalny i nie
  jest w wodzie - podrzut profilem zwyklego skoku $2F1CE2. Nie przenosza do punktu kontrolnego (port wczesniej tak robil).
- Plytki: $2E4544 (zestaw A na stale, dzwiek 58,2) i przytrzymywana $2E4532 (poziom 2, 4 sztuki): zapamietuje blok
  ($30CB8E, $30CCA5); $2E44DE puszcza ja (zestaw B przez $2E472A z d1 = 8, dzwiek 58,1), gdy gracz idzie, skacze albo
  nie trzyma UP ($30CC8E) i FIRE ($2EB202).

### Kompas i zapis gry (2026-10-20)

- Kompas ($308FF4, wywolanie $2E1FFE): cel biezacego obszaru to dwa slowa +$16/+$18;
  pozycja gracza w pasie +/-32 px jest traktowana jako wyrownana. Tabela $309DDE wybiera
  jeden z 8 kierunkow. Podniesienie mapy ($2E7684) wlacza kompas i 30 taktow wirowania.
- `work/export_compass.py` eksportuje 8 BOB-ow z banku $30CD60 + $1F66, z kotwica
  (100, 24) w dolnym panelu. Wszystkie 8 klatek po narysowaniu na panelu jest identyczne
  piksel w piksel ze skonczonymi klatkami emulatora `cmp1,3,5,7,9,11,13,15`.
  Parzyste zrzuty lapia przejsciowy stan rysowania igly i nie nadaja sie do tego porownania.
- Mapa pokazuje czas ucieczki (L1 2:00, L2 6:00, L3 3:00, L4 5:00), bez uruchamiania
  odliczania. Kompas, klatka igly, pozostale wirowanie i wyswietlany czas sa teraz zapisywane.
  Starszy zapis odzyskuje kompas z zebranego przedmiotu MAP w biezacym etapie; licznik
  `game.maps` zawiera tez poprzednie etapy, wiec nie moze sluzyc do tej migracji.
- `work/test_compass.js`: 8 scenariuszy na rzeczywistej grze w Playwright, w tym zapis
  podczas wirowania, starsze zapisy, nowy etap, kierunki i wszystkie 4 poziomy.
  Uruchomienie przez Playwright MCP `browser_run_code_unsafe` z `filename` wskazujacym ten plik.
- Ostatni test Claude nie zebral mapy L1: obiekt (8408,207) jest w obszarze 100, a test
  pozostawil obszar 32. Ograniczenie ruchu cofnelo gracza do x=3325. Z poprawnym obszarem
  zwykla aktualizacja gry podnosi mape i uruchamia kompas.
- Android: wersja 1.7 (versionCode 8), podpisana tym samym kluczem co poprzedni APK.
  `cap sync android` oraz `gradlew.bat assembleRelease lintRelease` przeszly; podpis v1/v2
  i wyrownanie ZIP poprawne. Wszystkie 121 plikow gry w APK sa identyczne z katalogiem `game/`.
  Start i ruch przez przyciski dotykowe sprawdzone na spakowanych plikach w mobilnym
  kontekscie przegladarki; aplikacja nie byla instalowana na fizycznym telefonie.

### Ruch gracza klatka po klatce z emulatorem (2026-10-20)

- `work/cmp_trace.js`: ta sama sekwencja joysticka w emulatorze (`T.trace` od startu poziomu 1) i w porcie,
  porownanie [kamera x, y, gracz x, y] co klatke. Emulator czyta joystick klatke pozniej (przesuniecie 1).
  Szybkie powtorki: snapshot vAmiga w iframe (`wasm_take_user_snapshot`, odtworzenie
  `wasm_loadfile('snap.vAmiga', bajty)`). Trzy sekwencje (chod, spadanie, plywanie, nurkowanie, skoki z ladu
  i z wody, krawedz poziomu; 1199 klatek) zgodne co do piksela razem z kamera.
- Wskaznik chodu w prawo ($2E92B8, `-(a0)`): wskaznik rowny poczatkowi tablicy nie jest zapisywany, wiec zostaje
  na indeksie 1 (odczyt t[0]). Wybieg w prawo jest o jeden wpis krotszy niz w lewo (zwykla tablica: 9 px zamiast
  11 px, w wodzie 15 jedynek). Tak samo prad ($2F157C) i zmiana tablicy ($2F125E szuka w dol do indeksu 1).
- Plywanie w pionie, DOWN ($2E9A88): to samo minimum 1; tuz po wpadnieciu (indeks 0) wskaznik stoi, dy = 1.
  Z DOWN nie ma sprawdzenia powierzchni - gracz moze dojsc do samej linii wody (325 na poziomie 1).
- Spadanie bez skoku ($2F0B2A): po zejsciu z krawedzi 4 klatki po 1 px, potem predkosc 1 i +1 co 3 klatki do 4
  (profil skoku zmienia predkosc co 4 klatki).
- Skok ($2E9818): stan i dzwiek w klatce wcisniecia, ruch od nastepnej. W tej klatce bez kierunku nie ma wybiegu
  (`moveq #1, d7` w $2E9A2A pomija $2E8D14). $2E99BE: przy fladze $30CD06 inny profil skoku (start -4, krok 5
  klatek zamiast 4) - nie wiadomo jeszcze, co ja ustawia.
- Woda ($2F0F4C): wejscie, gdy y > linia + 2 (wpadajac 4 px/kl. gracz przelatuje do 331); flaga trwa na powierzchni
  (326), znika przy wyskoku ($2E954C, od razu - krok poziomy tej klatki jeszcze z tablicy wodnej, potem zwykla)
  albo gdy poziom wody opadnie pod gracza (y + 5 <= linia, $2F0E4A).
- Kamera w pionie ($2E528C): A4 += dy gracza, gdy jest poza oknem 88..92 - bez dociagania do okna (start
  poziomu 1: gracz 95 px od gory zostaje 95 px przy spadaniu).
- $2F43DC: ruch poziomy cofany w calosci, gdy nowa pozycja wzgledem kamery gry (x - A4) <= 64 albo > 352
  (start poziomu 1: najmniejsze x = 49; ruch o 2 px z 50 jest odrzucony, o 1 px przechodzi).
- Poziom 2 w emulatorze: na mapie wyspy wpisac numer etapu - 1 do $30CD10 (slowo), potem FIRE jak w `T.boot`.
- Kamera ($2F42F8 -> $2E528C): przesuwa sie o ruch gracza tylko wtedy, gdy moze - w lewo/w gore przy A4 - 4 > min,
  w prawo/w dol przy A4 < max (min/max obszaru = rog - 16; poziom 2: kamera staje na A4.y = -12 przy min -16).
  Dosuwanie do gracza na drabinie/linie ($2E52DC) blokuje $30BC40 = 1 - we wszystkich zrzutach i poziomach, wiec
  w praktyce go nie ma. W dol bez przewijania w czasie smierci od upadku ($30CC22).
- Podloga ($2F4B86): kafel z bitem 0 pod srodkiem i pod x + x1, x + x2 ramki kolizji biezacej klatki (+$62/+$66
  obiektu sprite'a, z naglowka klatki: [szer, wys, kotwica x, y, x1, y1, x2, y2]; chod w prawo -5..8, w lewo -6..7,
  czolganie w lewo -6..11). x obiektu jest z poprzedniej klatki, wiec podloga liczy sie od x sprzed ruchu poziomego.
  `work/export_player.py` zapisuje teraz cala ramke (4 liczby).
- Czolganie ma wlasna tablice predkosci $9D9C [1,1,1,1,0,-1,-1,-1,-1] (srodek 4): w lewo najpierw 0, wybieg 2 px
  w prawo i 3 px w lewo. Przelaczenie ($2F1106 -> $2F13F2) dopiero w klatce po wlaczeniu czolgania i tylko na kaflu
  z bitem podlogi pod stopami (sonda po ruchu) - czolganie zaczete tuz przed krawedzia idzie dalej z predkoscia chodu.
- Kolejnosc obslugi joysticka ($2E8B0C): LEFT, RIGHT, UP, DOWN, FIRE; kierunek ustawia d7, wtedy DOWN zaczyna
  czolganie ($2E9B04), a bez kierunku idzie do kucania/drabiny. Chwyt drabiny przesuwa x na srodek kafla juz
  w klatce wcisniecia (w porcie klatke pozniej - jedyna roznica w porownaniu).
- Cios (bron startowa, emulator): FIRE ($2E9C82) jest obslugiwany po kierunkach, wiec w klatce zamachu chod i obrot
  jeszcze dzialaja. $30CC63 (blokada kierunkow) kasuje dopiero koniec animacji ciosu ($2F4602/$2F46CC, znaczniki
  $FF5/$FF8): 9 klatek od zamachu, dluzej niz obiekt miecza ($7E = 6). W porcie `pl.lockT` = czas miecza + 2
  (dla broni ze sklepu nie mierzone).
- Spadochron (poprawka do opisu wyzej): wlacza sie w klatce po wcisnieciu UP (jak skok), od razu 2 px/kl. w dol
  ($2F0F0A, bez klatek w gore - profil $2F1C20 zaczyna sie od $0FFF), w bok tablica wodna ($2E94B4 -> $2F1418),
  wiec najwyzej 1 px/kl. z poslizgiem i pelna predkosc po wpadnieciu do wody; ladowanie wraca do zwyklej ($2F0F1E).
- Poziom 4 od startu (most): ruch zgodny do klatki 334, potem gracza w porcie trafia odlamek butelki pirata
  ($2E135E), ktorej w emulatorze w tym miejscu nie bylo (rzut zalezy od losowania).
- Klatki animacji gracza: $2F1804 wskazuje naglowek biezacej klatki w banku ($30CDA4), indeks = numer klatki portu.
  Oryginal ustawia animacje juz w klatce wcisniecia (obsluga joysticka), a ruch widac klatke pozniej - klatki
  porownuje sie bez przesuniecia, pozycje z przesunieciem 1 (`cmpFrames` w `work/cmp_trace.js`).
- Skrypty animacji gracza (tabele $2EB164..$2EB1DC, para wskaznikow prawo/lewo, wybor wg $2EB222 = 0 / 4):
  $2F3EFC ustawia skrypt (pierwsza klatka od razu, licznik 1; nie przy blokadzie $30CC63), $2F459C co $2F185C
  klatek czyta nastepny wpis; $FFF stop, $FFE skok do petli, $FFD poczatek petli, $FF5/$FF8 koniec ciosu.
  Plywanie: wpadniecie $2EB1BC z opoznieniem 5, kierunek (gdy flaga chodu $2EB20D/$2EB20E jest inna) plywanie albo
  zwrot $2EB1CC (92 91 96, potem petla) z opoznieniem 4, a postoj ($2E8D3A: raz na zatrzymanie, licznik $2EB224
  zeruje kazdy kierunek i skok; wskaznik w srodku tablicy juz na poczatku klatki) zmienia opoznienie na 8.
  Spadanie kasuje flage chodu ($2E9110), skok nie. Poza ciosu trwa tyle co obiekt ciosu ($7E: 6/10/20), klatka
  skoku pojawia sie w klatce wcisniecia, a przy ladowaniu zostaje jeszcze jedna klatke.
- Poziom 2, klatki animacji: chod i czolganie bez kierunku trwaja dalej przez caly wybieg - postoj ustawia dopiero
  obsluga postoju ($2E8D3A, wskaznik w srodku tablicy na poczatku klatki); klatka spadania ma pierwszenstwo przed
  czolganiem; koniec drabiny (fizyka) zmienia klatke o jedna klatke pozniej, jak ladowanie. Pierwsza klatka czolgania
  trwa 6 klatek przy starcie z obslugi DOWN, 5 po ladowaniu (kolejnosc obslugi joysticka i przerwania z licznikiem
  animacji $2F05DA -> $2F459C).
- Wrogowie z rekordow ($2E35AE, lista $30CBE8 po $1A bajtow: x, y, flagi, skrypt, aktor +$A, procedura startowa
  +$E/+$12, licznik +$19): aktor powstaje dopiero, gdy rekord bez zywego aktora wejdzie w okno kamery gry (A4.x - 50
  .. A4.x + 466, A4.y - 50 .. A4.y + 306); poza oknem licznik odradzania maleje co 25 klatek i znika bit 3. Aktor
  z procedura $7A = $2E3694 znika poza oknem A4 - 83 .. A4.x + 499 / A4.y + 339, a rekord dostaje bit 3 (wraca od
  nowa w punkcie startu dopiero po wyjsciu rekordu z okna i ponownym wejsciu). Inni zywi aktorzy dzialaja dalej
  takze poza ekranem. Port wczesniej tworzyl wszystkich na starcie i zamrazal dalekich - poziom 2: chodzacy wrog
  z x 518 w oryginale stoi w rekordzie, w porcie juz chodzil; poziom 4: pirat rzucal butelke za wczesnie.
  Zapis gry trzyma zabite rekordy (`Actors.deadRecs`), jak dotad wg numeru rekordu.
- Ramki kolizji aktorow: naglowek BOB-a ma po w, h, ax, ay ramke x1, y1, x2, y2 (+8..+14, w obiekcie +$62..+$68),
  niezalezna od obrazka - spiacy nietoperz (poziom 2, $AD8E) -61..63 x -2..116, czyli "widzi" gracza pod soba;
  kruszacy sie blok ($B62C) -35..36 x -15..87; zwykly wrog jak chodzacy -7..9 x -28..0. y1 = y2: bez kolizji
  ($2E663C). Dotyk ($72 przy bicie 0 w $76), rany gracza i ciosy licza sie z tych ramek (dotad port bral
  prostokat obrazka i +-14 px). `work/level_data.py` / `export_actors.py`: klatki maja teraz 10 liczb.
- Spadajacy kawalek / stalaktyt ($2EE9E8 / $2EE8E6): petla `moveq #1,d3 ... dbra` - dwa kroki spadania na takt.
- Nietoperz ($2EE086): po zejsciu na wysokosc gracza $7A = $2E3694 (znika poza oknem), sciezka w bok rusza
  w nastepnym takcie. Porownanie aktorow poziomu 2 (`cmpActors`, nagranie act8_emu): nietoperz, blok i chodzacy
  zgodni co do piksela po starcie ruchu.
- Faza petli gry $5D(A4) (5..0, start poziomu 5, $2DD1C2/$2DD686) liczy w rytmie 25 Hz: tworzenie aktorow z rekordow
  ($2E35A4) tylko w fazie 1, czyli co 12 klatek (emulator: krab poziomu 1 z y 543 powstaje w klatce 100 przy A4.y 244,
  choc okno obejmuje go juz od A4.y 237), znikanie $2E3694 tylko w fazie 3. Licznik odradzania maleje co 25 wywolan
  ($2E5174), czyli co 300 klatek - wrog z licznikiem 20 wraca po ok. 2 min poza oknem (wczesniejsza notatka: 10 s).
- Pod woda ($2F4C50) kafel z bitem 8 (np. $101) nie jest dnem ani podloga - gracz i aktorzy przez niego plyna.
  Dno sprawdzane 7 px (DOWN, $2E9A9C) albo 5 px (bez DOWN, $2E8CC4) pod stopami, takze przy dy = 0 (wskaznik na
  zera $9D82) - gracz zostaje nad dnem (544 -> 537) i po puszczeniu od razu sie wynurza.
- Sciany ($2F4440): na ladzie sondy x + 10 / x - 9 (z poczatku klatki, $2F08DC) w wierszu stop i y + y1 + 4, w wodzie
  ($2F4EB2) krawedz ramki klatki + dx w wierszach y - 1 + y2 / y - 1 + y1; zablokowany ruch w calosci, wskaznik chodu
  zostaje. Kafel $87 (bit 7) to skrzynia: ta sama sonda ustawia $9F1C (FIRE z kierunkiem podnosi, $2E9E5A).
- Krab nad malzem ($2E65D4): dotyk co takt, takze w czasie czekania (licznik 10 od nowa). Porownanie aktorow pod
  woda (act9_emu, 550 klatek): krab w 1 px, rozgwiazda i trzy malze skacza w tych samych chwilach.
- Blokada na scianie ($2F4554 -> $2E8EBC): wskaznik chodu na srodek tablicy, na ladzie (nie przy spadaniu) poza postoju
  $2EB1A4, choc kierunek dalej wcisniety (flaga chodu zostaje, wiec animacja chodu nie wraca). Pod woda tylko wskaznik
  - po puszczeniu kierunku przy scianie animacja plywania od razu zwalnia (opoznienie 8). `work/oracle.js`: T.seq
  (pozycje i klatka gracza co klatke), T.snap / T.restore.
- Skrzynia (poziom 3, nagranie seq11, nietykalnosc w obu wersjach przez szczura): niesiona skrzynia (+17 / -14, y -1
  wzgledem stop) nie ma sondy sciany - gracz idzie dalej, skrzynia moze wisiec nad schodami. Odstawienie ($2EA840) po
  ruchu poziomym klatki: srodek kafla ((x + przesuniecie) & ~15) + 8, odmowa przy WALL/CEIL; gracz ustawiony 18 px
  przed srodkiem (w prawo) albo 16 px za nim, bez przewijania kamery; $9F10 = 4 - chwile skrzynia nie jest sciana.
  Rozjazd seq11 od klatki 259 (odstawienie klatke wczesniej, potem kamera 1 px) to artefakt nagrania, nie logika:
  kierunek ($DFF00C) i FIRE ($BFE001) czyta ta sama procedura $2E8ADC w przerwaniu VERTB $2F03F0 (cala obsluga
  gracza), a emulator w tej klatce zglasza puszczenie FIRE takt przed puszczeniem RIGHT. Z FIRE puszczonym klatke
  wczesniej port zgadza sie co do klatki do konca nagrania; regula "FIRE klatke wczesniej" psuje za to seq7, stomp1
  i poczatek seq11 - nie jest systematyczna. Petla glowna ($2DD36E: kolce $2F51A2 przez $2E2052, aktorzy) biegnie
  niezaleznie od przerwania i w emulatorze gubi takty - stad np. podrzut z kolcow w seq13 2 klatki pozniej.
  Podniesienie: 2 klatki postoju, potem chod od poczatku; zatrzymanie na scianie zmienia klatke na postoj klatke
  pozniej (jak ladowanie).
- `T.seq(S, true)` / sekwencja z `invuln`: nietykalnosc co klatke ($30CCD8, w porcie game.hurt), gdy faza wrogow
  ze snapshotu i portu sie rozni (snapshot jest ok. 400 klatek po starcie poziomu).
- Kafel smierci ($2F51A2 -> $2E674A): podrzut przez $2F48E0 profilem $2F1CE2 (-4 x3, -3 x3, -2 x4, -1 x4, 0, -1, 0, -1,
  0 x4, 1, 0, 1, 2, 2, 3, 3, 4, 4, dalej +4), nie skokiem - klatka spadania 88, od nastepnej klatki; przy
  nietykalnosci bez obrazen, ale z podrzutem. Poziom 2 (seq13, marsz 700 klatek w prawo) zgodny co do piksela przez
  pierwszy podrzut; drugi w oryginale czeka 3 klatki zamiast 1 (gracz zablokowany przy scianie) - roznica 2 klatek.
- Bledy portu znalezione przy porownaniach kolejnych nagran: `startLevel` wolal `respawn()` przed wyzerowaniem punktu
  kontrolnego - po ukonczeniu poziomu z punktem kontrolnym nastepny startowal w obszarze i na wspolrzednych z
  poprzedniego (np. bez wody); to samo przy nowej grze. Odrodzenie zostawialo tez stan poprzedniego zycia (jump,
  tablica chodu, klatka, licznik postoju), a aktorzy zrodzeni w ostatnim takcie poziomu przechodzili na nastepny.
- Kolejnosc w petli gry ($2DD33E): aktorzy z rekordow ($2E35A4, faza $5D = 1) powstaja przed czekaniem na wygaszanie
  ($2DF8EE) i przed przebiegiem aktorow ($1EF6: lista $176 od konca do poczatku, wstawianie $690 wg priorytetu
  ln_Pri jak Enqueue), a $5D maleje na koncu petli. Nowy aktor z rekordu dostaje wiec pierwszy krok animacji i
  sciezki juz w takcie powstania: krab poziomu 1 z rekordu x = 115 jest widoczny od razu w 116, pirat poziomu 4
  ($3077AA, sciezka $3077EA: $FFCA 5 zmniejszane od razu, potem $FFB8 butelka $307932 w -15, -7) rzuca 5 taktow
  po pojawieniu sie. W porcie `recTick` dopisuje aktora od razu do listy (wczesniej do `born`, czyli takt pozniej);
  seq6 (poziom 4) zgodny teraz w calosci - wczesniej od klatki 334 gracza trafial odlamek butelki.
- Emulator: przebieg aktorow konczy sie czasem juz po wygaszaniu (pozycje widac klatke pozniej), a przy duzym
  obciazeniu takt potrafi przepasc (malz poziomu 1 w klatkach 182-188) - faza $5D zmienia sie rowno co 2 klatki.
  Port liczy rowno 25 Hz, wiec porownania aktorow co klatke roznia sie o 1 klatke tu i tam.
- `T.save(n)` / `T.open(n)` (work/oracle.js): snapshot na dysk `work/dumps/snap_<n>.vAmiga` i z powrotem (L1, L4 - starty
  poziomow); `T.restore` wykonuje jeszcze 2 klatki. Poziom 4 (snapshot L4): w porcie faza 3 i parzystosc 0
  (`game.phase = 3; game.frame = 0`), wtedy pirat powstaje w klatce 137, a butelka w 147 jak w emulatorze.
- Kolce sprawdza petla gry ($2DD566 -> $2E2052 -> $2F51A2: kafle $30B8D8 / $30B8DA z bitem 15, raz na petle, przed
  czekaniem na wygaszanie), a nie co klatke: przy duzym obciazeniu petla trwa 3 klatki (seq13: faza $5D zmienia sie w
  322, 324, 327) i podrzut zaczyna sie 2-3 klatki po ladowaniu zamiast 1. Port sprawdza co klatke (pierwszy podrzut
  seq13 zgodny); drugi rozni sie przez te opoznienia petli.
- Sondy kafli ($2F08C0, z A4+4/6 po ruchu): $30B8D0 (x, y + 2) drabina w dol, $30B8D2 (x, y - 1) drabina w gore,
  $30B8DA (x, y - 6) drzwi (indeks $30CB2A), $30B8DC (x, y - 22) lina / akcja, $30B8E4 (x, y - 38) sufit, przy
  czolganiu $30B8DE / $30B8E0 (x -/+ 8, y - 22).
- Lina (emulator, poziom 3 przy linach nad kolcami, snapshot R3; `work/cmp_at.js`, nagrania rope1-3 zgodne co do piksela
  i klatki): chwyt sam przy dotyku rekami ($2F1170, co klatke po ruchu: kafel $30B8DC z bitem 5; nie w wodzie, nie
  na powierzchni, nie na spadochronie, $2EB228 = 0, x - A4 > 68), tez w locie bez UP; x na srodek kafla, w klatce
  chwytu zostaje jeszcze klatka skoku. UP: 2 px/kl. w gore, gdy kafel rak jest lina i nie ma sufitu ($30B8E4); gdy
  liny zabraknie - skok ($2E96E6 -> $2E9818). UP z kierunkiem bez trzymanego UP ($30CC8E = 0) = skok z liny i 20
  klatek bez chwytu ($2EB228, maleje co klatke w $2E8AFC); w klatce zgloszenia bez ruchu w bok. DOWN: 2 px/kl. w dol,
  bez liny przy rekach puszczenie ($2E9C22). LEFT / RIGHT tylko obraca ($2E9052), a zaraz po UP / DOWN (flagi z
  poprzedniej klatki $30CC8E / $2EB20B) jeszcze klatke nie zmienia pozy. Kolejnosc obslugi joysticka ($2E8B20): LEFT
  ($2E9004), RIGHT ($2E922E), UP ($2E945A; bez UP kasuje $30CC8E), DOWN ($2EB20B, $2E9A3C), FIRE ($2E9C82).
  Zjazd liny w kolce (emulator, rope2 zgodne co do piksela i klatki; stan gracza $30B8AE, dy A4+$12, profil $2F1854):
  w klatce najpierw ruch o dy, potem takt profilu ($2F490E), potem joystick (DOWN na linie: dy = 2 bez sprawdzania
  podlogi, bez liny przy rekach puszczenie $2E9C22 - stan 1, poza 2 / 31 z $2EB184, dy zostaje z profilu), co takt petli
  $2F51A2 (kafel smierci pod stopami albo w y - 6) zaczyna profil $2F1CE2 od nowa, chwyt $2F1170 kasuje go profilem
  $2F1C20. Z DOWN: 530 -> 532 -> 534 (puszczenie) -> 530 (-4, chwyt) co 3 klatki; w zawisie na linie profil przesuwa
  gracza (poza 65) - ponowiony w kolcach daje 4 x -4, szczyt 495, powrot +4 do podlogi 527, po 2 klatkach znowu.
- Po skoku bez kierunku klatka skoku zostaje na ziemi, dopoki trwa poslizg (oryginal zmienia ja dopiero obsluga
  postoju $2E8D3A) - lina 3: ladowanie w 157, postoj w 160.
- Lod (poziom 4, obszar 262, kafle x 3216-3504 z bitem $4000; snapshot I4, nagranie ice1 zgodne co do piksela i klatki):
  tempo animacji chodu (co 4, na lodzie co 3 - $2E940A, flaga $30CC80) ustawia tylko start chodu, wiec wejscie na lod w
  marszu zostawia co 4; kierunek przeciwny w poslizgu zaczyna chod od poczatku (osobne flagi $2EB20D / $2EB20E).
- Trampoliny ($2E63D4) na poziomach 2-4 leza we wnekach pod kaflami podlogi (L2 1128, 4535; L3 3049; L4 2327 pod
  podloga jednostronna) - przejscie po nich ani skok nie wyzwala ich w oryginale i w porcie.
- Drzwi (emulator, poziom 4 przed drzwiami x 1360-1407 -> obszar 262; snapshot D4, nagrania door1-3 zgodne co do piksela
  i klatki): poza tylem (85/84, potem 86) trwa tylko z trzymanym UP - po puszczeniu od razu postoj, a FIRE to zwykly
  cios; wejscie = FIRE z trzymanym UP. W klatce FIRE i podczas wygaszania (16 klatek) gracz zostaje tylem; nowa pozycja
  17 klatek po FIRE, klatke pozniej postoj; plansza czarna jeszcze 21 klatek, potem gra juz dziala (sterowanie 39 klatek
  po FIRE), a plansza rozjasnia sie przez ok. 7 klatek (jasnosc 31, 50, 67, 80, 90 ... %) - bez cegielek (port wczesniej:
  16 + 46 klatek z cegielkami).
- Przy scianie wskaznik chodu wraca na srodek co klatke (sonda sciany dziala tez, gdy krok z tablicy jest 0), wiec po
  puszczeniu kierunku przy scianie od razu postoj.
- Bronie reczne (emulator, $30CD50 = tablica broni: start $2EA95C, miecz $2EAA3C, morgensztern $2EABFC, szabla $2EAE9C,
  kule $2EADBC / $2EACDC / $2EAB1C; nagrania weap_* zgodne): obiekt ciosu zyje $7E klatek (6 / 6 / 20 / 10 - sprite broni
  i trafienia), a skrypt ciosu gracza ma opoznienie d ($2EA908: 3 / 3 / 8 / 5): poza ciosu 2d klatek, potem postoj d i
  koniec blokady kierunkow ($30CC63) klatke pozniej - kierunki od klatki 3d + 1 po zamachu (10 / 10 / 25 / 16).
- Tablica broni (16 B na wpis, 14 wpisow: stojac P/L, w kucki, drabina, ...): procedura, animacja gracza, skrypt
  pocisku, dx, dy. Kule (zelazna $2E1840 / $2E17F6, specjalna $2E17D0): stojac (+16, -5) / (-17, -5), w kucki
  (+14, 0) / (-14, 0), drabina i lina (+16, -7) / (-17, -7); ognista ($308E98): (+20, -8) / (-17, -8), w kucki
  (+20, -2) / (-16, -2), drabina (+22, -8) / (-20, -8). Kule leca 6 px na takt (emulator: start 1356 -> 1368 w klatce 8,
  zgodne co do piksela), w scianie albo przy trafieniu wroga ($2EA34A -> $2EA39A) oblok (x, y - 4), a kula stoi
  jeszcze ok. 13 klatek bez trafien (sciezka $2E188A). Ognista kula to obiekt broni gracza A4+$38 z procedura A4+$C
  wolana co klatke ($2EA1DA -> $2EA214): 2 px/kl. w bok, fizyka co klatke, do 75 wywolan, trafia jak miecz i leci
  dalej; po zetknieciu z podloga ogien $2E0B60 w ((y + 8) & ~15) - 1 (emulator: 1424, 399 w klatce 37) z dwoma
  plomieniami bocznymi.
- Rekordy obiektow sa podzielone na sekcje per obszar: przy wejsciu do petli ($2DD23C) $30CBE8 = tablica poziomu
  ($30CD14) +$64 [numer obszaru = obszar +0.L], sekcja konczy sie rekordem z x = 0 (to te "przerwy" w liscie). $2E35A4
  tworzy tylko aktorow z sekcji biezacego obszaru. Drzwi ($2DF568 -> $2DDF6A): wszyscy aktorzy znikaja ($2DF5A4,
  $2B8(a6)), $2E3820 zwalnia rekordy z licznikiem odradzania (+$19, flagi +4), a wszystkie rekordy sekcji traca
  powiazanie z aktorem (+$A) - po powrocie wrogowie powstaja od nowa; smierc ($2DDFF2) tak samo bez $2E3820. Eksport:
  `sect` w levelN.json (obszary) i levelN_actors.json (aktorzy, wyzwalacze) = wskaznik sekcji
  (work/level_data.py `sections`). Emulator po drzwiach (lista $176, `T.live()`): pirat 2505,543 i trampolina
  2327,431 - jak w porcie. Skan pamieci `T.actors()` znajduje tez usuniete struktury (np. plusk wody "zyl" 40 klatek).
- Klatka wieznia (emulator, poziom 2 klatka 560, 144, snapshot C2, nagranie cage1 zgodne): FIRE z trzymanym UP uwalnia od
  razu (wiezien znika, oblok $2E12C8 w miejscu klatki, klatka zostaje otwarta), gracz zostaje tylem jeszcze do 5. klatki
  od FIRE, potem postoj (UP dalej trzymane). Liczba punktow ($2E7300 -> skrypt $2E1A82, BOB z tablicy $2E8506) powstaje
  w (x przedmiotu, y gracza - 26) i wznosi sie sciezka $2EB926 co takt: -3 x 5, -2 x 3, -1 x 3, 0 x 3, potem znika.
- UP i FIRE naraz na ziemi: UP obslugiwane przed FIRE, wiec skok i poza 8 (FIRE w skoku) tak dlugo, jak FIRE trzymane -
  tor skoku bez zmian (stomp1). Sufit w skoku: ruch w gore odrzucony w calosci (gracz zostaje 2 px nizej niz przy ruchu
  piksel po pikselu), profil skoku przechodzi na opadanie: klatka 0, potem +1 x 4, +2 x 4...
- Bieg po skarb - wstep (emulator, poziom 1, $30CC3C = 4 wpisane recznie; klatki od ustawienia $30CC6C po 4 petlach):
  plansza gasnie cegielkami (jasnosc co 5 klatek od 9. do 49.), w 58. gracz w obszarze skarbu na tym samym x ekranu i y
  z tablicy (+$72) i sam idzie 2 px/kl. do x z tablicy (53 -> 192), 'CONGRATULATIONS !' od 129, 'TREASURE MAP COMPLETE !'
  od 169, w 475 scena rozjasnia sie przez ok. 14 klatek i od tej chwili gracz jest sterowalny (moze spasc), kamera rusza
  1 px/kl. dopiero w 695; lewa granica gracza A4 + 62. Port co do klatki zgodny z nagraniem (gracz i kamera, 760 klatek).
- Drzwi w oryginale lub dzwignia (V4): wyrownanie x przy UP i zmiana kafli w klatce FIRE zgodne; szczur L3 (runner,
  2 px/takt, 2 takty postoju na koncach) i "bob" L3 (zakresy 408-506, 419-517) zgodne.
- Bieg po skarb: diamenty powstaja tylko w klatkach ruchu kamery ($2E3786), gdy x <= A4 + 345 (emulator, poziom 1: x 312, 344, 392,
  440, 472, 520 w klatkach 702, 716, 764, 812, 844, 892 od $30CC6C - port tak samo), w y - 576.
- Sklep (emulator, poziom 4 sklep 1, snapshot SHOP): napisy w cieniowanej czcionce okienek wiadomosci z odstepem 6 px;
  ceny do prawej (prawa krawedz x 58 / 115, gora 8 px nad srodkiem rzedu); opis towaru: tytul od x 7 z odstepami na
  siatce 6 px (SOUP 49, BOMBS 43, PHARMACY 37), linie od x 7 co 9 px od y 24; powitanie w liniach 1 i 3 od x 25 i 37;
  ramka wyboru zaokraglona 57 x 20 w kolorze (48, 47, 143), kolumny od x 6 / 63, Exit od (36, 134). Sklep wczytuje
  sie z dysku (w emulatorze ok. 1000 klatek po FIRE).
- Wygaszanie planszy ($2DFBCA): 16 krokow co klatke, kazdy odejmuje 1 od kazdej niezerowej skladowej 4-bit 32 kolorow
  planszy ($CEDA) i kolorow copperlisty $180-$1C0 ($CF9C-$D878) - ciemne kolory gasna pierwsze, jasne ostatnie (HUD bez
  zmian). Wolne wygaszanie $2DFC70 to samo z krokiem co 3 klatki. Rozjasnianie ($2DFD14, co petle gry, licznik $30CCCA)
  dodaje 1 do skladowych mniejszych od docelowych - ciemne wracaja pierwsze (emulator po sklepie: jasnosc 23, 44, 60, 73,
  82, 89, 92, 95 ... %). Port: palFade() na pikselach planszy (kolory = skladowa x 17) zamiast przezroczystej czerni.
- Wyjscie ze sklepu ($2DDA86): po zakupie przy Exit napis 'SEE YOU SOON / STRANGER' (bez zakupu powitanie); FIRE ->
  wygaszanie, aktorzy i rekordy od nowa ($2DDF6A jak przy drzwiach), plansza z dysku (w emulatorze ok. 470 klatek
  czerni), potem gra od razu sterowalna (ruch w 3. klatce rozjasniania) i rozjasnianie - bez cegielek i bez komunikatu.
- Sklep - kursor i teksty (emulator, snapshot SHOP): kursor to kolumna $2EB232 i wiersz $2EB234 (wiersz n / 2 = Exit,
  $30CBFE), UP z Exit wraca do wiersza 2 w tej samej kolumnie; kazde nacisniecie kierunku (tez bez ruchu) gra dzwiek
  (63,30) i odswieza tekst ($2E8A66): na Exit 'SEE YOU SOON / STRANGER' ($30B322), powitanie tylko przy wejsciu. Wszystkie
  teksty okna na siatce: wiersze co 9 px od y 6, od x 8, spacja 6 px (w pamieci gry ze spacjami wiodacymi, np. powitanie
  '', '', '   WELCOME', '', '     STRANGER'). Ikony towarow z kotwica BOB-a w polach $2E1B24 (swiat - 32 = ekran), nie
  wysrodkowane. Ramka wyboru: dwie linie, zewnetrzna $339 z zaokraglonymi rogami i wewnetrzna $35B z kropkami $339 w
  rogach; po zakupie bez zmiany koloru. FIRE jest ignorowany, dopoki gra dzingiel ($2E234C).
- Gra w kosci ($2DDB2E, $2E8932, $2E89C2): stawka pobierana przy zakupie, melodia 11 od razu i dzingiel 8 (FIRE czeka 92
  klatki); tekst $30AFFA, ramka na parzyste / nieparzyste w (6, 44) / (63, 44), w grze tylko LEFT / RIGHT (wybor mozna
  zmienic az do wyniku). Rzut: twarz sprzedawcy znika (z reka bezczynnosci), reka $2E1EF0 w (247, 177) klatka 1 przez 6
  klatek (przycieta do y 150 swiata - zza lady, $2E0AA4), potem (241, 157) klatka 4; kosci $2E1E08 / $2E1E82 z (246, 126) /
  (261, 118) z fizyka $2EEC2A: x + 1 przez 64 klatki, y + v co klatke, v + 1 co 4 klatki do 5, odbicie od y 157 z
  v = min(v, 4) - 1 (pierwsze odbicie: dzingiel 9); toczenie klatki 0..5 co 5 (druga od 3), w 67 klatka 4 na 3 klatki,
  potem scianka rnd(6) + 5 przez 150. Wynik w 78 klatce ($2EB206): parzystosc sumy == wybor -> zloto + 2 x stawka, 'YOU WON'
  / 'YOU LOST' do ruchu kursora, ramka wraca na towar, melodia 12, dzingiel 6 / 7 (FIRE czeka do 190). Reka: 86 klatka 1,
  188 (245, 177), 192 (238, 195), 196 znika, 201 twarz od nowa ($2DDC52).
- Twarz sprzedawcy ($2E1B40, 4 aktorzy): oczy i usta krok co 7 klatek (nie taktow); czwarty aktor $2E1B62 to reka
  bezczynnosci: 200 klatek nic, (247, 177) klatka 1 przez 6, (241, 157) blok $2E1C0C (1,2,1,3,1,2,1,3,1,1,1,1,1,4 x 7,2,1,2,
  1,1,1,1,1 co 7) przez 200, (245, 177) i (238, 195) po 4, od nowa (okres 414).
- Pokoj premii za blokiem '?' (emulator, poziom 1, licznik $30CCD0 = 35 wpisany recznie; klatki od konca odliczania):
  odliczanie co petle glowna (2 klatki), w tym czasie bez skoku ($2E9818). Potem $2DEAF4: swiat stoi ($9DE8), dzingiel 4,
  wygaszenie 16 klatek, w 26 gracz w (x, y) z tablicy +$76, po dzinglu (128) wiersze 0-11 <-> 36-47, obszar pokoju, kamera
  A4 = rog - 16, aktorzy usunieci ($2DDF6A) i generator ze skryptu obszaru +0 (dwa przebiegi aktorow), w 144 rozjasnianie
  16 klatek przy stojacym swiecie i melodia 23, gra od 160. W petli pokoju nie ma aktorow z rekordow ($2E35A4).
  Generator (L1/L2 $2EFF62: x + rnd(176), L3 $2F0086: rnd(64), L4 $2EFFF4: rnd(256); x, y = 15, licznik 58 ze skryptu)
  co takt: licznik $7E 6..0, potem licznik +$A0 - 1 i przedmiot, gdy > 8 (49 sztuk co 7 taktow = 14 klatek), przy 0
  $30CC6F. Przedmiot ($2F0118 / $2F0164): co takt x + vx (+-1 losowo, bez scian), dwa kroki grawitacji (v + 1 co 4 kroki
  do 5); podloga (bit 0 na przejsciu kafla, $2F4D90) liczy sie dopiero ponizej progu (y pojawienia, po kazdym dotknieciu
  y + 48), odbicie v = min(v, granica) - 1 (monety $2F266C / $2F25C2: granica 6, dzwiek (62,30); reszta 4, (39,0)), przy
  y >= 220 znika - przedmioty przelatuja przez podlogi pokoju. Koniec ($2DED20): dzingiel 22 przy stojacym swiecie
  (138 klatek), wygaszenie, w 156 wiersze z powrotem, gracz i kamera jak przed pokojem, w 173 rozjasnianie, melodia 11.
- Kamera w obszarze o stalych granicach (min = max, np. pokoje za drzwiami poziomu 4: obszar 10268 [4576, 16, 4576, 16]):
  A4 = rog - 16 (emulator po drzwiach: 4560, 0), tak jak minimum zwyklych obszarow; port mial tu rog.
- Flagi $30CD06 (inny profil skoku, $2E99BE; pomijanie czesci fizyki i startu poziomu) i $30CD02 nie sa ustawiane przez
  zaden kod w zrzutach pamieci (tylko tst / clr) - martwe, nieodwzorowane.
- Ciemny obszar ($2DF50A -> $2DDDC4; emulator, poziom 2, drzwi 17493 -> obszar 556; klatki od FIRE przed drzwiami):
  wygaszenie 16 klatek, w 17 aktorzy usunieci i ekran czarny, potem petle czekania ($EA60 i $7530 przebiegow) z dzwiekiem
  (54,8) miedzy nimi, oczy ($2E1890 na graczu, $2E18B4 / $2E19E8 / $2E194E wokol A4) dopiero w 78. W petli: FIRE ($BFE001)
  = wyjscie bez wejscia (wygaszenie 16, potem czern i rozjasnianie 16 klatek przed drzwiami, od FIRE + 36); klawiatura
  dziala dalej ($2DF8EE): kursory gora / dol zmieniaja narzedzie, SPACJA ($20) przy wybranej lampie (rekord narzedzia 3,
  $309966, licznik $1313A) zuzywa ja i ustawia d7 -> obszar oswietlony ($2DF51E), wejscie jak drzwiami (pokoj 19 klatek po
  wygaszeniu, rozjasnianie po kolejnych 19); przy innym narzedziu dzwiek (28,32). Zadnych komunikatow. Port: T / przycisk
  narzedzia w ciemnosci.
- Obiekty i straznicy na liscie rekordow maja sekcje obszaru (tablica poziomu +$64) jak wrogowie: $2E35A4 tworzy tylko
  rekordy sekcji biezacego obszaru. Obszary nakladajace sie na mapie maja rozne zestawy obiektow (poziom 2: ciemny 556
  i 2022 na tym samym miejscu - straznik wyjscia $2F2E36 tylko w 2022; pokoj premii bez obiektow). Straznik wyjscia
  i ukryte kolce znikaja przy drzwiach ($2DDF6A) jak wszyscy aktorzy i powstaja z rekordow w oknie kamery.
- Bomba (emulator, poziom 2 przy scianie do wysadzenia x 512, y 400-447): uzycie ($2EA576, tabela jak bron $2EAF7C:
  {procedura, animacja gracza, skrypt $2E101C, dx, dy} - w prawo (12, -4), w lewo (-10, -4)) tylko gdy nie trwa lont
  ($2EB22E, inaczej nic i bez zuzycia), dzwiek (44,12). Sciana 6 px przed bomba ($2F4F5C): x na srodek kafla i bomba
  spada; inaczej rzut ($2EF4D6: vx +-2, vy -2, nie z drabiny / liny). Fizyka co takt $2EF51C: $2EF5D0 (granica 3, 2 kroki),
  vx do sciany albo do ladowania. Lont 37 taktow (w takcie rzutu juz -1), w 38. (74 klatki) wybuch $2E4C4C: dzwiek (45,1),
  wstrzas $30B746, aktor $2E1320 w y - 6 (rani tez gracza), sciany listy +$1C w oknie 5 x 5 kafli wokol (x, y - 6):
  licznik 20, odlamek $2E10F6 w (kafel x + 8, kafel y + 16) - platforma $2000, trzesie sie 20 taktow (x -1 / +1), potem
  spada 4 px/takt; pod kolumna gruz $2E1154, odlamki kolumny przyciete do jej dolu ($5E); dzwiek (51,0) przy pierwszej.
  $2E4DFE przez 25 taktow: licznik <= 2 -> kafel spod (19 taktow po wybuchu), 0 -> sciana zuzyta. W emulatorze petla
  przy wielu aktorach trwa ok. 2,7 klatki, wiec kafel znika ok. 53 klatki po wybuchu.
- Pamiec skryptow eksportu aktorow obejmuje teraz $2E0F00-$2E1A60 (odlamki $2E10F6 / $2E1154 i bomba $2E101C).
- Lupa ($2EA7B2): tylko kafel rak (x, y - 22, sonda $30B8DC) z bitem 6; bez niego 'Here is nothing to scrutinize.'
  ($30B3F0) i lupa nie jest zuzywana; inaczej zuzyta i pulapka z listy $30CBAE (kafel ponad $30CB2A) -> $30B3B4, reszta
  $30B38E.
- Mapa (narzedzie, $2E384C; emulator poziom 1 przy starcie, klatki od SPACJI): swiat stoi, dzingiel 4, wygaszenie
  do 16, aktorzy usunieci, kamera (0, 0), widok $2E39F8 rysowany do 56: 40 x 20 kafli od (x gracza & ~15) - 320,
  (y & ~15) - 160 w polowie skali - nieparzyste piksele (lsl #2 / roxl), parzyste wiersze kafla; tylko kafle w granicach
  kamery obszaru (x od +8 + 32 do +$C + 336, y od +$A + 32 do +$E + 176), reszta czarna. Linia wody w widoku ($2E387E):
  (woda - (y & ~15)) / 2 + 128 (min 16) w ukladzie A4 = 0, ponizej paleta wody, linia 2 kolorow powierzchni. Niebo
  poziomu 1: tablica $30BF16 ($59D x 4, potem 20 kolorow do $E92) po 2 wiersze, konczy sie na linii wody. Ludzik
  $2F3036 (bank przedmiotow $4F06, kotwica 5, 14) w (210, 135): sciezka co 3 klatki przesuwa go o 400 px - widoczny
  2 klatki, 20 poza ekranem, potem 27 / 18. Rozjasnianie ok. 9 klatek, FIRE dopiero po dzinglu (128), wygaszenie 16,
  powrot (aktorzy z rekordow, melodia 11 od razu) w FIRE + 16, rozjasnianie od FIRE + 34 przez 16 klatek.
- Rzut liny ($2EA718, tabela $2EB05C) i bomby ($2EAF7C) maja te same animacje gracza co cios bronia startowa ($2F18F6 /
  $2F19BA, kucanie $2F1900 / $2F19C4, drabina $2F1B86; sekwencja $2EA908 z opoznieniem 3); po rzucie liny $30CCE6 = 25
  - tyle klatek SPACJA nie dziala ($2DF9B0). Kazde uzycie narzedzia ustawia licznik bezczynnosci $9DE6 = $960. Tor liny
  zgodny z emulatorem co do piksela (poziom 2 przy starcie).
- Deszcz poziomu 4 (kontroler $2EB970, rekord typu $2F2A28): powstaje jak wrog z rekordu (faza 1, okno A4 -50..+466 /
  -50..+306, swoja sekcja obszaru); pierwszy ustawia flage $30CC9F i melodie 25 od razu, kolejne przy ustawionej fladze
  znikaja. Co 5 taktow kropla $307FEC (sciezka -2, +7, mozg $2EBA1A - podloga albo woda) lub $307FAA (-2, +10, mozg
  $2EBA2E - tylko woda), rnd(2) == 0 daje $307FEC; x = A4 x + 32 + rnd(340), +-64 gdy kamera ruszyla, y = A4 y + 32;
  rozprysk $30802E. $2DDF6A (drzwi, sklep, mapa, ciemnosc, pokoj premii) kasuje flage i daje melodie 11 od razu,
  $2DDFF2 (smierc) nie; wynurzenie gra 25 tylko przy fladze. Emulator: kropla co 10 klatek.
- Rzedy platform ($2EF0E4 / $2EF13A) tez sa rekordami: powstaja w oknie rekordow, nie przy wczytaniu poziomu, i wracaja
  po $2DDF6A. Brakujace kontrolery ($2F2A28 p1): poziom 1 $2EDF6E; 2 $2EBD72, $2EDDEE, $2EC5A0, $2ED4F6; 3 $2EBB38;
  4 $2EF184, $2EF978, $2EFD92.
- Bomba (przeglad Codex): sonda sciany przy rzucie x +-11, y - 1; vx zerowane, gdy fizyka zatrzyma bombe albo sonda
  przed nia trafi sciane; odliczanie kafli wybuchu przed nowymi wybuchami tego samego taktu. Poza rzutu nie przerywa
  ciosu ani trwajacej pozy.
- `work/cmp_actors.js`: ruch aktorow od tego samego miejsca w emulatorze (recEmu) i w porcie (cmpActors), slady laczone
  wg punktu i klatki pojawienia, najlepsze przesuniecie klatek.
- Kontrolery z rekordow (niewidzialny typ $2F2A28, `CTL` w game/actors.js) powstaja jak rekordy ($2E35A4: faza 1, okno
  kamery, sekcja obszaru); procedura startowa wpada od razu w procedure co takt, a petla aktorow wywoluje ja jeszcze raz
  w tym samym przebiegu (beczka z rekordu: dwa ruchy w takcie powstania). Znikanie: procedury wolajace $2F039A = $2E3694
  (faza 3, poza oknem A4 -83..+499 / +339) albo $2F03B8 = $2E3714 (faza 4, dalej niz 700 / 300 od gracza, A4 +4 / +6);
  rekord wraca po wyjsciu punktu z okna. Generatory $2EDF14 / $2EBCF8 / $2EBD0E: wpis {licznik, okres, ...} w danych
  poziomu (przetrwa znikniecie): przy 0 licznik = okres i nowy aktor, inaczej - 1; poczatkowy licznik z danych (np. 1 / 10
  / 20 - rozstawione). $2EBCF8 / $2EBD0E wolaja na dziecku $2EED08 (beczka) z predkoscia z wpisu +4 - wczesniej beczki
  z generatorow staly. Emulator (poziom 2, generator 3271,43): narodziny i tor beczek co do piksela.
- $2EF978 (poziom 4): co rnd(50) + 50 taktow (pierwszy po rnd(50)) kamien $3088E8 z dystansem p2 w +$A0; sciezka
  $30891C: animacja $308912, uspienie 14, potem $7A = $2EF9D2 - 8 px na takt, dopoki dystans - 16 > 0, na koniec
  y = ((y + 8) & ~15) + 1, sciezka $2E1010 (stop) i animacja $308932 (co 2, kill). Emulator: tor 60 > 68 > ... > 97 zgodny.
- $2EFD92 (poziom 4): slowa pod p2 {zwloka, okres}: po zwloce duch $307E2C, potem co okres + 1 taktow (emulator: 48, +161).
- $2EF184 (poziom 4): kolumna - podstawa $308294 w (x, y + 6) bez programu, wyzej co 16 px $308294 z programami z listy
  p2, ostatni $308246; programy $3082E2.. ($FF8 1, $FF1 -> lista $FF9 tam i z powrotem z lustrem $FF7 / $FF6) obracaja
  ramiona wokol podstawy - tor kazdej czesci zgodny z emulatorem.
- Petla aktorow ($1FBA): dla kazdego aktora animacja ($2188, bez bitu 12 w +$4C), sciezka ($2240, bez bitu 11), potem mozg
  $7A i rysowanie ($2442) - port mial odwrotnie (mozg przed sciezka; sciezka zaczeta przez mozg ruszala w tym samym takcie,
  stad dawny `pathWait`). Dzieci kontrolera dzialaja w tym samym przebiegu (kamien: uspienie 13 w klatce powstania).
  Usuniety aktor ($FFF6 -> $1E98: +$4E = 1) nie jest rysowany ($2724), z listy znika przy +$4E = 3.
- Uspienie ($FFCA) zapisuje n i od razu odejmuje 1 w tym samym takcie (powrot do petli interpretera), wznowienie po n taktach.
- Beczka ($2EED08): procedura startowa konczy sie taktem ($2EED4A); sonda sciany $2F4F5C przy krawedzi ramki kolizji
  (+$62 / +$66) w y - 1 i drugi raz w gorze ramki (+$64).
- Program ruchu ($2EF23E) konczy sie pierwszym taktem ($2EF26C): czesci kolumny / rzedu i rekordy z programem ruszaja
  dwa razy w przebiegu powstania (emulator, kolumna 5528: 5531 / 5534 / 5537 / 5540 po pierwszym przebiegu; przeglad Codex).
- Pozostale kontrolery: poziom 1 $2EDF6E - wpis {licznik, okres, y, strona}: $A5CC od lewej krawedzi ekranu (A4 x + 16) albo
  $A580 od prawej (+376), narodziny zgodne z emulatorem co do klatki; poziom 2 $2EDDEE - generator jak $2EDF14 z aktorem
  $B5B8 (do 22 wpisow); $2EBD72 - bajt stanu p2 ($30CAF0 z kombinacji $2ED8E0) wypuszcza beczke z predkoscia 2, jedna naraz
  ($30CC70), beczka nie znika poza ekranem, przy rozbiciu ($7E = $2EBDD6, d1 = indeks kafla) zwalnia blokade: kafel $3433 ->
  bajt $30CAF8, inaczej $B098 od lewej krawedzi (y 232 / 216); $2EC5A0 - gracz y >= 500 i A4 x <= 800: co rnd(30) + 20 taktow
  $AC78 z chodem $2EC646 (predkosc 4, konczy sie taktem) od krawedzi (A4 x > 576 z lewej, <= 160 z prawej, inaczej losowo);
  $2ED4F6 - plyta: gracz dokladnie na wysokosci rekordu i x +-8 -> kafle bloku $2F9598 +4 (mech), zejscie +8 (unmech), kafel
  $FD0 = $8C wylacza ja na zawsze; poziom 3 $2EBB38 - wysokosc gracza przy ostatniej rzutce; gdy y gracza przekroczy wysokosc
  wpisu {x, y, kierunek}, rzutka $300E54 / $300E90 w (x, y - 14) z dzwiekiem (33, 55).
- Emitery kropli ($2EF8A8 i warianty) tez sa rekordami: powstaja w oknie rekordow (faza 1), znikaja w fazie 3 ($2F039A) -
  dawniej port bral 400 px od kamery i kapalo tam, gdzie oryginal nie mial jeszcze emitera.
- Lista aktorow ($176 / $17A) jest uporzadkowana wg warstwy, a petla $1FBA idzie od ogona (od $17A po +4): dziecko
  kontrolera z warstwa wyzsza od niego dziala w tym samym przebiegu, z ujemna dopiero w nastepnym. Deszcz (emulator, poziom 4):
  kropla $307FEC (warstwa -127) widoczna najpierw w A4 y + 32, $307FAA (+127) juz 10 px nizej - port spawnuje krople jak
  dzieci kontrolera.
- Krople z emiterow ($2E0FC0, warstwa 2) sa dziecmi rekordu-emitera: ruszaja w tym samym przebiegu (emulator, poziom 3:
  postoj w miejscu 16 klatek, nie 18). `work/cmp_actors.js`: takt portu w pierwszej klatce zmiany fazy emulatora ma jej
  wartosc (faza poczatkowa = E[ch] + ch >> 1) - wczesniej port byl o takt za emulatorem (np. krople, bob poziomu 3).
- Lista rekordow poziomu 3 ma rekord poza mapa (biegacz $3001F4 w x 13464 > szerokosc 9600): odczyt z kontrola x < szerokosc
  rozjezdzal sie o 2 B i gubil dwa nastepne rekordy - krate $2ED34A w (1718, 127) z bajtem $30CB05 i podmiane kafli
  $2ED58E w (1383, 511) - w zamian dawal dwa smieciowe obiekty. Eksport aktorow i obiektow czyta teraz x do $7FFF jak
  $2E35A4 (po 26 B); krata zgodna z emulatorem (l3crawler).
- Poziom 3, $2EBA74 (rekord $300DFE w 8249,280, bajt $30CB04): licznik +$A0 0..45 - przy ustawionym bajcie w gore, przy 45
  zero i suwak $300E12 (mozg $2EBAF4) z lewej (x $1FDB, y $13E), przy skasowanym w dol, przy 0 = 45 i suwak z prawej ($2094).
  Wczesniej w porcie byly tylko 4 suwaki z rekordow - dojezdzaly do konca i nowe nie przychodzily (emulator: co 46 taktow).
- Poziom 2, $2ED3EE (rekord $300DC6 w 1925,95): dotyk ustawia $30CB05 (nie p2), przy bajcie 3 rekord znika na zawsze.
- Czerwony pirat twierdzy ($2EDC92 -> $2EDCCE): po chodzie $2ECA6C, gdy gracz dalej niz 32 px, pauza +$A (rnd(100) + 40),
  potem sciezka rzutu $3075C6 / $3075A2: animacja $3075F6 / $3075EA, po 10 taktach noz $307662 / $30762A w (+10 / -10, -18),
  po kolejnych 10 $2EDD30 - nowa pauza, bit 0 skasowany i animacja kierunku. Port nie rzucal nozami. Procedury startowe
  chodzacych piratow koncza sie taktem (bsr / wpadniecie).
- $2EFC02 (plywak poziomu 4): wznosi sie o 1 px na takt, gdy linia wody obszaru (+$10 struktury obszaru) jest wyzej niz y - 12
  - nie wg gracza (emulator: stoi, gdy woda nisko).
- Babelek pod woda ($2F106C): w klatce plusku ($2F0FFE) bez odliczania licznika.
- `work/cmp_actors.js`: tor bez czasu (kolejne rozne polozenia, poczatek wyrownany o 0-2) - emulator pod obciazeniem gubi takty,
  wiec porownanie klatka po klatce rozjezdza sie mimo zgodnego toru.
- $2EE724 -> $2EE758 (poziom 3 ryby $300D56, poziom 4): skrypt ustawia $7A = $2ED9E4, ale procedura startowa rekordu
  nadpisuje go swoim taktem. Gdy gracz jest w wodzie ($30CC7C / $30CC7D): zapamietane miejsce (+$7E) i predkosc (+$A0),
  ruch do (x, y + 6) gracza 4 krokami po 1 px w obu osiach ($2EE7E2, obrot przy zmianie strony); poza woda powrot 3 krokami
  na takt, potem zwykly chod $2EE86A. Emulator (obszar 2544): tor zgodny.
- Fizyka $2EF5D0 (przedmioty, owoce z dzbanow, beczki, maczugi, czaszki, rzucane) sprawdza podloge przez $2F4D90 - bez wyjatku
  dla wody; tylko $2EF6C8 (malz $2EC396, rozgwiazda $2EEE5E) uzywa $2F4DF2, ktore pod linia wody przepuszcza platformy
  jednostronne ($100). Port przepuszczal wszystko: przedmioty pod woda poziomu 1 (np. sakwy $2F271C w 7255,527 i 7319,479
  na kaflach $101) spadaly na dno; emulator: leza na platformach.
- Lista aktorow (emulator, poziom 3): od glowy $176 po +0 warstwy +$9 malejaco (100, 50, 2, 0, -126), petla $1FBA idzie od
  ogona (lh_TailPred przez +4), czyli od najnizszej warstwy - dziecko z warstwa wyzsza niz kontroler (0) jest jeszcze
  w tym przebiegu, nizsza (kropla -127) dopiero w nastepnym. Warstwa z rozkazu $FFF4 trafia do +$4F i flagi $2D40,
  nowe miejsce na liscie dostaje na poczatku przebiegu ($1F64). Zrzut po klatce bywa w polowie przebiegu (rzutka $2EBB38:
  w klatce powstania jeszcze w x wpisu, ruch 9 px w nastepnej klatce tego samego taktu).
- Zapisy gry: `dv: 2`; zapisy sprzed poprawki listy poziomu 3 (bez dv, sprzed 02abaf8) przeliczane w loadGame
  (migrateSave): obiekty 6-7 odrzucone, od 8 indeks + 1, rekordy wrogow od 2 indeks + 2.
- Przeglad Codex (093c9f9..b4ee8ab): A4 dla kontrolerow ustawiane przed recTick (kontrolery z krawedzi ekranu przy
  powstaniu); blokada beczki $30CC70 zwalniana przy drzwiach / smierci - beczka znika z innymi aktorami, a oryginal zostawilby
  bajt ustawiony na zawsze (kolejne kombinacje nie dawalyby beczki).
- `work/cmp_screen.py` + shotEmu / shotPort (`work/cmp_actors.js`): porownanie ekranu (bufor emulatora 4:1 w poziomie,
  przesuniecie szukane samo, kolory po 4 bity). Starty poziomow 1-4 i ekrany po sekwencjach seq5/6/9/11/12/13 (prawdziwy
  joystick): tlo, HUD i obiekty zgodne co do piksela, roznice tylko w stanie gry (wynik, narzedzie, witaminy) i aktorach
  w ruchu. Przestawienie kamery samym zapisem A4 nie przerysowuje planszy w emulatorze (smieci w kolumnach) - do obrazu
  trzeba dojsc ruchem.
- Nowe nagrania z joystickiem (seq14 L3, seq15 L4, seq16 L2; work/cmp_trace.js) - zgodne co do piksela i klatki po poprawkach:
  - $2F4B86 przycina tylko ruch do podlogi (dy = kafel - y - 1); ladowanie dopiero, gdy w nastepnej klatce dy = 0. Gdy gracz
    w tej klatce zejdzie z krawedzi, spada dalej ta sama predkoscia (bez zwisu 4 x 1 px) - port ladowal od razu.
  - Smierc od upadku: wykryta przy ladowaniu, ale w oryginale klatke pozniej (ruch w bok jeszcze trwa); profil $2F1C22 w calosci
    (-4, -3, ... 0 x 5, +1 ... +3), potem +4 przez podlogi do konca 50 klatek $30CC22 - potem gracz stoi ($30CC75).
    Po smierci gra czeka tylko na FIRE ($2DE174, $BFE001 bit 7) - port bral tez UP.
  - Zsuniecie z krawedzi w kucki: od razu klatka spadania; poza przy scianie znika, gdy gracz znow idzie (chod od poczatku).
- Ramka gracza +$62..$68 w emulatorze naprzemian pelna i zerowa (aktor gracza ma puste klatki, prawdziwa ramke wpisuje
  przerwanie) - zderzenia z wrogami ($28B4 w przebiegu aktorow) i sondy podlogi zaleza od chwili sprawdzenia; port uzywa
  zawsze pelnej ramki (trafienie szczura poziomu 3 bywa o klatke-dwie wczesniej). Takt petli glownej dla kolcow ($2F51A2) ma
  w emulatorze zmienna faze wzgledem klatek (zgubione takty) - port sprawdza kolce co klatke, co zgadza sie z seq16 i rope2.
- Losowe sekwencje joysticka (`work/cmp_rnd.js`: `rndSeq(ziarno, klatki)` w emulatorze i w porcie, snapshot l1,
  nietykalnosc): rnd1 (ziarno 101, 1532 klatki: chod, skoki, woda, nurkowanie) zgodne co do piksela i klatki po
  trzech poprawkach:
  - DOWN w skoku ($30CC54) albo na spadochronie ($2EB20C) bez kierunku: obsluga DOWN ($2E9AE0 / $2E9A46) ustawia d7,
    wiec wybieg ($2E8D14) nie dziala - ruch w bok staje od razu (przy spadaniu $30CC59 i w wodzie wybieg dalej).
  - Kierunek w wodzie co klatke ustawia opoznienie animacji plywania 4 ($2E9368), nie tylko przy zmianie kierunku -
    po postoju (opoznienie 8) ponowne wcisniecie tego samego kierunku przyspiesza animacje od nastepnej klatki.
  - W powietrzu kierunek ustawia skrypt skoku / spadania / spadochronu / ciosu w dol ($2E8FF4) przed zapisem zwrotu
    $2EB222 ($2E9448), wiec obrot w powietrzu widac klatke pozniej (krotkie stukniecie w ogole go nie pokazuje az do
    ladowania). Na ladzie chod ma osobne skrypty na zwrot ($2EA908), w wodzie zwrot jest zapisany przed $2E8FF6.
- Obsluga gracza (ruch, joystick, sondy kafli) jest w przerwaniu VERTB $2F03F0, petla glowna osobno.
- Losowe sekwencje rnd2-rnd4 (snapshoty L2, L3, l4, po 2000 klatek); rnd4 zgodne co do piksela i klatki po poprawkach:
  - Kucanie (stan 1 $30B8AE): DOWN na ziemi ze stanu innego niz 1 ustawia to samo okno $2EB13C = 10 co DOWN w
    powietrzu ($2E9C3E). UP w oknie poza powietrzem nic nie robi ($2E946E -> $2E988C: bez skoku, drabiny, drzwi, bez
    wybiegu i postoju - zostaje klatka kucania). Stan 0 przywraca chod, skok i obsluga postoju ($2E8E8C).
  - Ladowanie z ciosem w dol z profilu (odbicie $2F1E98 albo podrzut): profil konczy sie na podlodze dopiero, gdy
    sonda da dy = 0 ($2F49D2) - port liczy to jako ladowanie (odbicie od razu, bez klatki przerwy).
  - Klatka ladowania zostaje jeszcze raz tylko wtedy, gdy port wyladowal w klatce ruchu (przyciecie dy); bez ruchu
    oryginal tez laduje w tej klatce.
  - W skoku ($30CC54) podloge sprawdza tylko ruch w dol ($2F0D36): szczyt skoku tuz nad polka (dy = 0 przez 4 klatki)
    to dalej lot, ladowanie przy pierwszym dy > 0.
  - Skok z poslizgu bez kierunku: klatka skoku od razu. Koniec ciosu w dol (puszczenie FIRE, $2E8BCC) ustawia skrypt
    skoku juz z nowym zwrotem. Wyskok z wody z FIRE = cios w dol od razu (UP przed FIRE), ale FIRE trzymany w wodzie
    zapala blokade $2EB203 ($2E9CDC -> $2E9E9E), wiec wyskok z trzymanym FIRE to zwykly skok.
  - Wpadniecie do wody: skrypt plywania ze zwrotem sprzed obslugi kierunku tej klatki, kierunek przeciwny od razu
    daje zwrot ($2EB1CC).
  - Zatrzymanie na scianie: w klatce zatrzymania zwykla obsluga kierunku (po spadaniu chod od poczatku: 87 -> 39 -> 29),
    postoj od nastepnej.
- Petla glowna gubi takty: podrzut z kolcow w L2 przy x 727 (rnd2, seq13) startuje 1-2 klatki pozniej niz minimum
  (port: 2 klatki po ladowaniu). Obsluga gracza w przerwaniu: ruch ($2F401C) na poczatku VERTB, potem sondy
  ($2F0864), profil ($2F490E) i joystick ($2E8ADC) - pozycja w nagraniu emulatora to ruch z poprzedniej klatki.
- Zapas upadku w skoku: $2E9842 wpisuje $A4, ale ta sama obsluga skoku dochodzi do $2E9A16 i wpisuje $80 - skok
  zaczyna sie z zapasem 128 (jak zejscie z krawedzi), nie 164. Port pozwalal przezyc upadek o 36 px dluzszy po skoku
  (rnd3, poziom 3: skok z ciosem w dol, upadek 168 px pod szczyt - w oryginale smierc zamiast odbicia, $2F0D40 przed
  $2F0D52).
- Sonda podlogi po ruchu: oryginal sprawdza wiersz kafli celu (y + dy) w nastepnej klatce z pozycja po ruchu poziomym,
  wiec "tuz nad podloga" port liczy teraz z x po ruchu (nie x0) - skok obok krawedzi bloku przelatuje dalej (rnd3).
- Ladowanie bez ruchu (profil, szczyt skoku nad polka) - oryginal laduje przed obsluga joysticka, wiec DOWN kuca juz
  w tej klatce; DOWN w odbiciu ($30CC54) tez otwiera okno spadochronu.
- Smierc od upadku ustawia tylko $30CC77 (spadanie $2F0BE4, skok $2F0D48); klatke smierci 97 i profil ustawia petla
  glowna ($2DD5BE), wiec przy zgubionym takcie smierc widac klatke pozniej (rnd3: 2 klatki po ladowaniu, seq14: 1).
- rnd5 (poziom 1, 2500 klatek) zgodne co do piksela i klatki. Dalsze poprawki z rnd6-rnd8:
  - Blokada FIRE $2EB203 zapala sie przy kazdej obsludze FIRE ($2E9E9E: tez w wodzie, przy spadaniu, na spadochronie),
    gasi ja tylko klatka bez FIRE - FIRE wcisniety w spadaniu nie daje ciosu po ladowaniu.
  - W czasie blokady ciosu ($30CC63) obsluga spadania $2F0B22 sie nie wykonuje (warunek w $2F0864): gracz stoi nad
    przepascia z wybiegiem, spada klatke po koncu blokady.
  - Zejscie z krawedzi z kierunkiem: skrypt spadania ($2F0B22 przed joystickiem) ze starym zwrotem, nowy od nastepnej
    klatki.
  - respawn() zeruje tez poze skoku (pierwsza klatka po smierci w skoku byla klatka skoku).
- Narzedzia: runSeq/runAt zeruja zycia, smierc i pozegnanie (po wczesniejszym nagraniu ze smiercia seq14 konczyl sie
  GAME OVER).
- Dalsze poprawki z losowych nagran (rnd6-rnd8):
  - Przyciecie do podlogi rozstrzyga sonda nastepnej klatki z x po ruchu poziomym: gdy tam juz nie ma podlogi, gracz
    leci dalej (bez odbicia ciosu w dol i bez ladowania; rnd7: cios w dol tuz za krawedzia, y 143 -> 147).
  - Ramka gracza +$62..$68 w obiekcie zeruje przebieg aktorow petli glownej (zwykle co druga klatka, przy zgubionych
    taktach nieregularnie) - sondy z zerowa ramka widza tylko srodek. Port uzywa zawsze pelnej ramki; nie odwzorowane.
  - Kolce tylko w takcie petli (co druga klatka) psuja seq13 / seq16 / rope2 - zostaje sprawdzanie co klatke.
  - Czolganie przy scianie: sciana dopiero przy probie ruchu ($2F4554 w ruchu nastepnej klatki), potem poza 18/47
    ($2EB194).
  - Stan 1 (kucanie) trwa po puszczeniu DOWN do obslugi postoju, ktora nie dziala w czasie ciosu ($2E8D4E): FIRE zaraz
    po puszczeniu DOWN to cios w kucki (3/32, potem kucanie 2/31 do konca blokady), skok konczy stan 1.
  - Flaga wody liczona przed obsluga kierunkow (jak $2F0F4C w przerwaniu przed $2E8ADC): DOWN w klatce wpadniecia do
    wody nie odnawia okna spadochronu. W oknie w wodzie skrypt plywania biegnie dalej.
- Zatrzymanie na scianie tylko przy probie ruchu (dx != 0, $2F4554 w ruchu nastepnej klatki): z kucania LEFT pod sciana
  chod 39 przez 3 klatki (wskaznik od srodka: 0, 0, -1), potem 29; juz stojac przy scianie sonda co klatke trzyma
  wskaznik w srodku. Po ladowaniu chod od nowa (sciana znow klatke pozniej).
- Skok w czasie profilu (podrzut z kolcow): fizyka skoku ($30CC55, $2F0CFC) zamiast profilu ($2F490E tylko w galezi
  else, $2F049A) - skok z kolcow to zwykly skok, a profil stoi i po ladowaniu rusza dalej (klatka przerwy, potem caly
  podrzut; emulator, poziom 2).
- UP w spadaniu ($30CC59 - tez w profilu podrzutu nad przepascia, bo obsluga spadania $2F0B22 dziala) zapala blokade
  $30CC8E ($2E9588): po ladowaniu z trzymanym UP nie ma skoku.
- rnd8 (poziom 4, 2520 klatek) zgodne co do piksela i klatki. Poprawki:
  - Drabina, drzwi, klatka wieznia i kafel akcji tylko UP bez kierunku: obsluga UP pomija je, gdy kierunek juz ustawil
    d7 ($2E9592 -> $2E95DC) - UP+RIGHT przy wejsciu to skok.
  - Koniec czolgania ($2E8B7E) po obsludze kierunku: z kierunkiem jeszcze klatka skryptu czolgania, chod od nastepnej.
  - Pierwsza klatka czolgania zaraz po ladowaniu: ze spadania 5 klatek, ze skoku 6 (jak start z obslugi DOWN).
- Nagrania rnd9-rnd12 (3000 klatek); rnd12 (poziom 4) zgodne w pozycjach w calosci. Poprawki:
  - Wskaznik chodu przy scianie krazy: kierunek przesuwa go zwyczajnie (0, 0, +-1), dopiero proba ruchu o +-1 trafia
    w sciane ($2F4554) i wraca go na srodek. Odejscie od sciany zaczyna sie wiec od 1-3 klatek bez ruchu (rnd11), a nie
    zawsze od jednej. Port nie sprawdza juz sciany przy kroku 0.
  - Postoj przy scianie bez kierunku: bez poslizgu w animacji chodu (klatka postoju zostaje).
  - Ladowanie w klatce ruchu: zamiast zamrozenia poprzedniej klatki klatka skoku / spadania z tej klatki (z obrotem
    ustawionym w tej klatce: 33 -> 4).
  - Zwrot w czolganiu ustawia skrypt czolgania od nowa (pierwsza klatka 6); cios w oknie UP po kucnieciu pokazuje poze
    ciosu w kucki.
- Cios w dol zaczety w powietrzu ustawia skrypt juz z nowym zwrotem (FIRE po kierunkach, $2E9EC4). W odbiciu
  ($30CC54) UP nie zaczyna nowego skoku ($2E94F6), choc stopy sa nad podloga.
- Podrzut z kolcow na poziomie 2 (x 610-735) w oryginale zwykle klatke pozniej niz w porcie (rnd2/6/10, seq13 o 2):
  petla glowna z $2F51A2 biegnie co ok. 2 klatki z faza zalezna od obciazenia; sprawdzanie co druga klatka
  (obie fazy) psuje seq16 i rope2, wiec zostaje co klatke.
- rnd9 (poziom 1, 3020 klatek) zgodne co do piksela i klatki. Pod woda z DOWN ($2E9A88) bez sprawdzenia powierzchni:
  wypornosc wynosi gracza nawet ponad linie wody, poki trwa flaga wody (325 -> 322).
- Zapas upadku maleje o predkosc spadania / skoku ($30CC28 w $2F0BC2, d2 w $2F0D16), nie o ruch po przycieciu do
  podlogi: w klatce przyciecia caly krok (rnd11: spadanie 128 px z zapasem 128 - w oryginale smierc).
- Smierc od upadku widac 1-3 klatki po ladowaniu zaleznie od taktu petli glownej (seq14 1, rnd3 2, rnd11 3); port 1.
- Losowe sekwencje ze snapshotow przestawionego gracza (work/cmp_rnd.js RNDAT, cmpRndAt): I4 (lod), D4 (drzwi), C2
  (klatka) po 2000 klatek zgodne co do piksela i klatki. Czolganie na lodzie idzie tablica lodu ($2F1106: kafel
  $4000 -> $2F1352 = te same tablice co $2F1326), nie wolna tablica czolgania.
- Parzystosc taktu: ramka gracza zerowana przez petle glowna pokazuje faze (l1, L2, l4, I4, D4, C2: zero w klatkach
  parzystych od startu nagrania; L3, R3: w nieparzystych). runAt ustawia teraz game.frame = 1 na starcie sekwencji
  (wczesniej zalezalo od poprzedniego przebiegu - rope2 zgadzal sie przypadkiem).
- Aktorzy w losowych nagraniach (cmpRndActors, nagrania rnd<n>a_emu z seqActs w play.html: lista $176 co 10 klatek):
  aktorzy petli glownej porownywani bez przesuniecia (port po t klatkach = emulator po t), gracz z przesunieciem 1.
  rnd1a: wrogowie co do piksela; plusk ($2E1468) i babelki ($2E14BC) powstaja w x sprzed ruchu poziomego tej klatki
  (sprawdzenie wody w przerwaniu przed joystickiem); plusk w emulatorze zyje o takt dluzej (22 / 20 klatek),
  babelki maja losowy odstep.
- Petla glowna (rekordy wrogow, okno powstawania, znikanie, emitery, deszcz, takt aktorow) biegnie po przerwaniu, ktore
  juz przesunelo kamere za graczem - A4 z kamery po ruchu tej klatki. Port przesuwal kamere dopiero po update(), wiec
  aktorzy widzieli kamere sprzed klatki: krab i malze poziomu 1 (rnd9a) powstawaly takt (12 klatek) za pozno przy
  ruchu kamery w dol. enemies25 liczy teraz A4 z podgladu follow() na kopii kamery.
- Porownania aktorow dalej: emulator gubi takty petli glownej pod obciazeniem (rnd9a od t680 ryba i meduza o 1-3
  takty z tylu, chwilowe roznice 2 px przy zrzucie w polowie przebiegu).
- Dlugie nagrania rnd13 (poziom 1) i rnd14 (poziom 4), po 8000 klatek, zgodne co do piksela i klatki. Poprawki:
  - Sufit pod woda ($2E8CDE -> $2F4FC6): sondowany 4 px nad gora ramki biezacej klatki (plywanie: gora -15, nie -26)
    w x, x + lewa, x + prawa krawedz ramki; kafel $100 ponizej linii wody nie jest sufitem; ruch w calosci albo wcale.
  - Obrot do drzwi / klatki ($2E98A6 / $2E98D6): pierwsza klatka UP zeruje wskaznik chodu (bez wybiegu, chod od srodka);
    ze skrzynia w rekach UP przy drzwiach to skok.
  - Wskaznik chodu z poczatku klatki brany po zmianie tablicy (woda / kafel w przerwaniu przed joystickiem): wpadniecie
    do wody bez kierunku = postoj od razu (pierwsza klatka plywania 8).
  - Start i koniec czolgania zeruja postoj przy scianie (sciana znow przy probie ruchu). Kierunek w czasie blokady ciosu
    nie konczy stanu 1 (kucanie po ciosie w kucki do konca blokady). Skok w klatce ladowania bez ruchu mozliwy.
- Faza petli glownej w snapshotach ($5D(A4) co klatke po T.restore, bez wejscia): l1 3322110055.., L2 2211005544..,
  L3 5443322110.., l4 3322110055.., R3 3221100554.., I4 / D4 5544332211.., C2 4433221100.. - zmiana co 2 klatki,
  w klatkach parzystych (l1, L2, l4, I4, D4, C2) albo nieparzystych (L3, R3). work/cmp_rnd.js SNAPPH = [game.frame,
  game.phase] na starcie sekwencji portu (cmpRnd, cmpRndAt, cmpRndActors; runAt ma parametr ph).
- Przy tej fazie sprawdzanie kolcow tylko w takcie petli (game.frame parzyste) przesuwa pierwsze roznice w rnd6/7/10/rndR
  dalej, ale psuje seq16 i rnd2 - petla glowna trwa raz krocej, raz dluzej niz klatka, wiec $2F51A2 wypada w takcie albo
  w klatce po nim. Zostaje sprawdzanie co klatke.
- Nagrania z procesorem 4x (rnd2oc/3oc/6oc/7oc/10oc/11oc, rndRoc, seq14-16oc, rope1-3oc; work/cmp_rnd.js ocCheck): petla
  glowna bez zgubionych taktow, wzorzec dla portu. rnd2oc (2000 klatek) i rnd6oc (2500) zgodne co do piksela i klatki
  (rnd6oc poza 1 px w 1 klatce). Poprawki:
  - Kolce ($2F51A2) tylko w takcie petli (game.frame parzyste); smierc od upadku w pierwszej nieparzystej klatce >=
    ladowanie + 1. Smierc omija dzwiek ladowania i odbicie ciosu w dol ($2F0D48 -> $2F0E06), flagi skoku / spadania
    zostaja - do klatki 97 klatka z lotu.
  - Podrzut z kolcow: obsluga spadania $2F0B22 dziala tez w profilu. Gdy stopy (x z poczatku klatki, ramka klatki) sa na
    powierzchni bloku - na starcie i w przejsciu w gore - joystick i klatka jak na ziemi: chod 10/39 na 1 klatke, kucanie
    (bez poslizgu, wskaznik chodu na srodek przez caly podrzut), czolganie (tablica czolgania trwa w powietrzu), poza
    przy scianie. W powietrzu to spadanie: DOWN otwiera okno $2EB13C, UP w nim = spadochron, takze w klatce ladowania
    (klatka 6/35 ze zwrotem z tej klatki, w nastepnej koniec $2F0F18 i tablica zwykla od predkosci wodnej).
  - Cios w blokadzie $30CC63: obsluga UP pominieta (dyspozytor $2E8B16), wybieg chodu trwa od klatki po zamachu.
  - Obrot do kafla akcji ($2E9906) zeruje wskaznik chodu ($2E9918).
  - Zejscie z krawedzi w tej klatce (sonda z x z poczatku klatki, $2F0B22 przed joystickiem) to juz spadanie: UP bez skoku.
  - Smierc od upadku: cialo leci przez podlogi do ok. 238 px pod kamera gry (L3: stop na 239 i 240); licznik $30CC22 = 50
    taktow petli glownej (100 klatek) - dopiero potem Life = 0 i FIRE (wczesniejszy FIRE pominiety). Od FIRE do
    odrodzenia ok. 61 klatek na A500 (emulator 61-63, z procesorem 4x 41 - wczytywanie etapu).
  - Punkt kontrolny tylko z rekordu $2F2A3A (dotyk $2E7B06 zapisuje polozenie w $30CCF8); $2F2A28 to niewidzialne
    kontrolery - port bral je za punkty kontrolne (L3: odrodzenie w 956,377 zamiast na starcie).
- Zostaje: rnd10oc 1 px przy starcie czolgania pod sciana (725 -> 726 zamiast 727), rnd6oc 1 px przed kaflem akcji,
  rope2oc (ponowienie podrzutu na linie), czas odrodzenia +-1 klatka (wczytywanie).
- Lina nad kolcami (emulator 4x, rope1-3oc zgodne w calosci): $2F51A2 zaczyna podrzut od nowa takze z trzymanym UP / DOWN,
  a przy ponowieniu w trakcie w nastepnej klatce jest jeszcze dy starego profilu, nowy profil od kolejnej (puszczenie DOWN
  gleboko w kolcach: 4 x -4). Puszczenie liny u dolu z DOWN ($2E9C22 - kucanie) otwiera okno $2EB13C: UP w nim nie skacze z
  liny i nie wspina sie. Na starcie podrzutu z ziemi wybieg chodu trwa (klatka chodu, nie postoju).
- Aktorzy w nagraniach z procesorem 4x (work/oracle.js T.seqActs -> rnd1-4oca; cmpRndActors: aktorzy jak gracz - port po
  t - 1 klatkach = emulator po t; dymek HELP nad klatka pominiety): rnd1oca 12/153 chwil z roznica (rozpryski, babelki),
  rnd2oca 34/202 (1-2 px - zrzut w polowie przebiegu). Poprawki:
  - Chodzacy ($2EE820 -> $2EE86A) i rozgwiazda: procedura startowa wpada w takt, a petla aktorow wola go jeszcze raz - dwa
    kroki w takcie powstania (wrog z rekordu 518 -> 514).
  - Aktor wstawiony w czasie przebiegu ($2B0, wg priorytetu) rusza juz w tym przebiegu: nietoperz po przebudzeniu ($2E71B4),
    dzieci rozbitego dzbana.
  - Znikanie wg procedury co takt ($7A): $2F039A = $2E3694 (faza 3, okno A4) albo $2F03B8 = $2E3714 (faza 4, |dx| >= 700 albo
    |dy| > 300 od gracza). Procedura startowa z rekordu podmienia $7A - chodzacy, krab, malz, miecznik, rozgwiazda, biegacz,
    piraci znikaja dopiero daleko od gracza (wczesniej port zdejmowal ich oknem; L2: wrog doszedl do A4 + 515 i wrocil).
    Procedury z $2F039A: slizgacz, kobra, wspinacze, skoczek, nietoperz, strzelec, pocisk, odbijacze, krople, dryfujacy,
    wznoszacy, strzalka, kula; z $2F03B8: rzucany, wloczega, latajace, pulapka, duchy, wynurzajacy.
  - Snapshot L3 ma juz zywego biegacza (port tworzy go od nowa) - porownanie L3 od startu nie dziala dla aktorow z poczatku.
- Nowe nagrania 4x rnd15oc-rnd20oc (L2, L3, L2, L3, L1, L4; po 3000 klatek). Zrzut stanu z emulatora (play.html recSt:
  tablica chodu $9B88, wskaznik, stan $30B8AE, $30CC81, $9DD4, spadanie $30CC59) pokazal, ze stany 1 i 3 trwaja w powietrzu:
  - stan 1 (kucanie): postoj $2E8D3A tylko na ziemi, wiec przy zsunieciu / spadaniu z trzymanym DOWN stan zostaje; po
    ladowaniu obsluga DOWN ($2E9C34, stan juz 1) nie ustawia skryptu kucania - poza postoju 0 / 29 do puszczenia DOWN.
  - stan 3 (czolganie, $9DD4 i prosba $30CC81): trwa w powietrzu, poki DOWN i kierunek wcisniete; po ladowaniu $2F1106 od
    razu przelacza na tablice czolgania (pierwszy krok +1, nie +2). Puszczenie konczy go tez w powietrzu - wtedy tablica
    zwykla od razu przy ladowaniu.
  - Start podrzutu z kolcow (liftI <= 2) to dla klatek jeszcze ziemia (czolganie, kucanie). Koniec czolgania z ciosem w tej
    samej klatce: cios z postawy (1 / 30), nie z czolgania ($2E8B7E przed FIRE).
- Przeglad Codex: ponowienie podrzutu na linie tworzylo nowa tablice - sprawdzenia "pl.lift === SPIKE_HOP" jej nie widzialy
  (teraz znacznik spike). Uwaga o chodzacych z $2E3694 sprawdzona w kodzie: procedury startowe $11A90 / $11B14 / $11D6E
  (wszystkie poziomy) wpisuja $7A = $2EE86A, wiec znikanie daleko od gracza jest wlasciwe.
- rnd10oc, rnd15oc, rnd17oc, rnd19oc, rnd20oc (L1-L4, 3000 klatek) zgodne co do piksela i klatki; rnd3/7/11/16/18oc rozjezdzaja
  sie dopiero po smierci (wczytywanie etapu z procesorem 4x krotsze). Poprawki:
  - Sonda podlogi $2F4B86 bada tylko bit 0 (srodek i krance ramki), takze kafel pod murem - port odrzucal podloge pod
    kaflem sciany (skok przy krawedzi bloku: oryginal laduje na x + 8).
  - Zwrot w trwajacym czolganiu: pierwsza klatka 5 (nie 6). Start czolgania przy scianie: blokada kroku z tej klatki
    liczy sie dopiero w nastepnej (14, 14, 18).
  - Spadochron: w klatce otwarcia i z trzymanym UP bez wybiegu (d7). Cios w dol zaczety w klatce ladowania: klatka 8 / 37.
- Nagrania 4x rnd21oc-rnd26oc (4000 klatek): rnd21oc, rnd23oc zgodne w pozycjach (rnd23oc tez w klatkach). Poprawki:
  - Sufit w skoku ($2F4FC6) sondowany w srodku i na krancach ramki biezacej klatki (x - 6 / x + 8 dla klatki skoku), nie
    x +-4 (L3 przy starcie: blok nad prawym krancem zatrzymuje skok na 92).
  - FIRE w skoku to zawsze cios w dol: dziurka od klucza / dziennik tylko z ziemi (obsluga $2E9D2C po sprawdzeniu skoku).
  - Czolganie po spadaniu: pierwsza klatka 5, gdy stan kucania / czolgania trwal z ziemi przez spadanie; 6, gdy DOWN
    wcisniety dopiero w powietrzu.
- Wszystkie nagrania 4x (rnd2-26oc, seq14-16oc, rope1-3oc) zgodne co do piksela i klatki az do pierwszej smierci (potem
  czas wczytywania etapu z procesorem 4x jest krotszy) - poza 1 px w rnd6oc i rzadkim przypadkiem liny w rndRoc. Poprawki:
  - Profil w gore ($2F490E -> $2F4FC6): sufit w wierszu glowa + dy w srodku i na krancach ramki; w tym samym wierszu
    kafla co glowa ruch w calosci, przy wejsciu w nowy wiersz glowa staje na dolnym pikselu kafla sufitu, profil $2F1D68
    (0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, potem 4).
  - Ladowanie ze skoku z DOWN (landing0): wybieg chodu juz w tej klatce (skok skonczony przed joystickiem).
  - Czolganie zaczete na nowo przy scianie: blokada kroku z pierwszej klatki dopiero w nastepnej; stan czolgania z
    powietrza (trwajacy) bez tej przerwy. Odejscie od sciany w czolganiu: skrypt czolgania od poczatku.
  - Koniec ciosu w dol (puszczenie FIRE) w klatce ladowania: klatka skoku 4 / 33.
- Nagrania 4x rnd27oc-rnd30oc (5000 klatek): rnd27-29oc zgodne w calosci po poprawkach:
  - Dziennik ($2F31F2, dotyk $2E7636) zabierany tylko w kucki (stan 1) - nie FIRE-em; FIRE przy nim to zwykly cios.
  - Cios na starcie podrzutu z kolcow (stopy na powierzchni): poza ciosu w powietrzu, a do konca blokady $30CC63 obsluga
    spadania stoi - poza postoju 0 / 29, dopiero potem 88.
  - Flaga wody $30CC7C znika tylko przy wyskoku (UP przy powierzchni) albo przy opadaniu linii wody ($2F0E4A: y + 5 <=
    linia); wypornosc z DOWN wynosi gracza do 5 px nad linie, a on dalej plywa.
- Odrodzenie po smierci (emulator 4x i A500, porownanie dalej po smierci: work/cmp_rnd.js ustawia game.respawnWait /
  respawnFrozen / respawnBlank na czasy z procesorem 4x, z rozrzutem 1 klatki wczytywania):
  - Od FIRE do polozenia w punkcie startu ok. 61 klatek na A500 (4x: 41-42); 10 klatek wczesniej (4x: 6-7) obiekt gracza
    juz zerowany (klatka 0). Potem 63 klatki bez sterowania (4x: 46) - port mial 76.
  - Petla glowna rusza od nowa 5 klatek po oddaniu sterowania (faza 5, takty w innej parzystosci niz przed smiercia - kolce,
    smierc od upadku, aktorzy).
  - Po odrodzeniu bez blokady UP; okno $2EB13C zostaje z chwili smierci (w klatce smierci od upadku joystick juz nie dziala),
    wiec trzymane UP skacze od razu albo dopiero po jego wygasnieciu.
  - Ladowanie ze smiercia: bez czolgania / kucania (flagi powietrza zostaja).
  - Koniec czolgania bez kierunku i DOWN: klatka czolgania jeszcze raz, gdy wskaznik chodu poza srodkiem.
- Testy: runSeq w czasie planszy po odrodzeniu wola revealTick zamiast update (jak petla gry).
- Zycia ($1311A, emulator 4x rnd22oc: 3 -> 2 -> 1 -> 0): zycie mniej juz przy smierci ($2DE5EC, przy upadku razem z
  Life = 0 po 50 taktach $30CC22), nie przy odrodzeniu; 0 -> od razu GAME OVER ($2DE124). Port dawal jedno zycie wiecej.
- Odstawienie skrzyni (puszczenie FIRE) w nagraniu widac klatke wczesniej niz ruch: przestawienie gracza ($2EA8AC) jest
  przed zapisem pozycji w tej klatce emulatora, ruch po nim - to nie roznica portu (cmpRnd / posDiff: parametr from).
- Nagrania 4x rnd31oc-rnd34oc (5000 klatek, poziomy 1-4): zgodne w calosci (poza rozrzutem odrodzenia) po poprawkach:
  - FIRE klatke po zgloszeniu skoku (np. skok ze szczytu drabiny) to juz cios w dol - $30CC54 ustawiony od zgloszenia.
  - Skok zgloszony klatke wczesniej: bez zejscia z krawedzi ($2F0B22 przed joystickiem widzi skok) - skok z czolgania na
    krawedzi szedl z 4 klatkami zawisu.
  - Ladowanie z ciosem w dol, gdy ruch w dol przyciety do 0 juz w tej klatce (stopy na podlodze przy malej predkosci):
    odbicie $2F1E98 od nastepnej klatki, bez klatki przerwy.
- Odrodzenie: FIRE czytany wprost z CIA ($2DE174: btst #7, $BFE001) w takcie petli; obiekt gracza zerowany ($2F1808 =
  $2F182C) po wygaszeniu, potem 6-7 klatek do polozenia - rozrzut 1 klatki zostaje (czas wczytywania).
- Lina nad kolcami z DOWN (rndRoc): UP w oknie $2EB13C po puszczeniu liny daje w oryginale dy +1 i ponowny podrzut
  ($2F1CE2) w kolejnym takcie - port jeszcze nie.
- Nagrania 4x rnd35oc-rnd38oc (5000 klatek, L1-L4): wszystkie nagrania 4x zgodne co do piksela i klatki az do GAME OVER
  (poza dwoma artefaktami zapisu: przestawienie x przed zapisem pozycji klatki - odstawienie skrzyni, kafel akcji) i lina
  nad kolcami w rndRoc. Poprawki:
  - Zejscie z krawedzi w tej klatce ($2F0B22 przed joystickiem, x z poczatku klatki) to juz spadanie: DOWN nie kuca (stan
    zostaje 0, okno spadochronu), FIRE bez ciosu.
  - Ladowanie na kolcach z DOWN po stanie 0: kucanie dopiero na ziemi, wybieg trwa jeszcze w klatkach startu podrzutu (na
    podlodze); po czolganiu z powietrza x stoi od razu. Stan 3 ($9DD4) trwa w powietrzu z samym DOWN (bez kierunku).
  - Sufit pod woda ($2F4FC6) sondowany z x sprzed ruchu poziomego tej klatki.
  - Ladowanie z ciosem w dol przy ruchu przycietym do 0: odbicie tez, gdy FIRE puszczony w tej klatce (ladowanie przed
    joystickiem).
  - Podniesienie skrzyni: animacja stoi do nastepnego taktu petli ($9F0A), obrot w tej klatce daje pierwsza klatke chodu;
    potem chod od poczatku (A500 seq11: 2 klatki przez zgubiony takt).
- Odrodzenie w testach: czasy dla kazdej smierci osobno (RND [3]: [wczytywanie, klatki 0, postoj], fitRespawn dobiera).
- Nagrania 4x rnd39oc-rnd42oc (5000 klatek, L1-L4) zgodne do GAME OVER po poprawkach:
  - Spadochron: klatka 6/35 juz ze zwrotem z klatki otwarcia; otwarcie konczy podrzut z kolcow (profil $2F1CE2); w klatce
    wpadniecia do wody UP bez kierunku nie trzyma juz wskaznika chodu (spadochron skonczony przed joystickiem).
  - Zamek ($2E9D2C -> $2E9D54): tylko po obrocie tylem (UP, $2EB213) jak drzwi - kafle drzwi z zamkiem maja bit 4; bez
    obrotu FIRE przy zamku to zwykly cios (port wczesniej otwieral / pukal bez obrotu).
- Nagrania 4x ze snapshotow w glebi poziomow (rndIoc/rndDoc/rndCoc 2000 klatek, rndD2oc 5000) zgodne w calosci;
  rndR2oc (R3: liny nad kolcami, krata, 5000 klatek) zgodne co do piksela po poprawkach:
  - Chwyt liny ($2F1170): profil $2F1C20 (stop) - kasuje tez wstrzymany podrzut; w nastepnej klatce dy = predkosc spadania
    $30CC28 (podrzut z kolcow w powietrzu: od 1, licznik $30CC2A od 6, +1 co 3 klatki do 4; ze skoku 0), nad podloga
    przyciete. Chwyt w locie: klatka spadania ze zwrotem z tej klatki; z ziemi: klatka z obslugi joysticka (chod).
  - Tryb wspinaczki $2EB212: wejscie z UP ($2E9640) zatrzymuje profil, z DOWN nie; kierunek / postoj go konczy.
  - Kolce ($2F51A2) zaczynaja profil od nowa tez w trakcie innego (odbicie po ciosie w dol, wznowiony podrzut) - w
    nastepnej klatce jeszcze dy starego profilu.
  - Cios / rzut z liny: bez wspinaczki i obrotu do konca blokady $30CC63.
  - Koniec ciosu w dol w podrzucie: klatka skoku 4 / 33 (tez w klatce ladowania).
  - Krata ($2E5F6A): przy zderzeniu ramek (krawedz w krawedz) $9F06 = x kraty - x gracza, ruch w jej strone stoi jak
    przy scianie ($2F4440), z poza postoju.
  - Lina: zmiana kierunku UP / DOWN bez nowego skryptu - biezaca klatka do konca kroku, potem tablica nowego kierunku.
- rndC2oc / rndI2oc (C2, I4 z procesorem 4x, 5000 klatek) zgodne co do piksela i klatki:
  - Kucniecie w trakcie podrzutu z kolcow (krawedz bloku w locie): wybieg trwa - x stoi tylko przy stanie 1 ze startu
    podrzutu.
  - Odbicie po ciosie w dol: po ladowaniu z profilu przycietym do podlogi tez klatka przerwy.
  - UP jest obslugiwane przed FIRE ($2E8B40): UP+FIRE przy drzwiach / kaflu akcji to obrot i akcja, nie cios.
  - Okienko tekstu: poza tylem do kafla akcji biegnie dalej (85 -> 86) i zostaje jeszcze 2 klatki po zamknieciu.
- Testy: runSeq / runAt jak petla gry przy okienku tekstu (bez update, FIRE po puszczeniu, 1 litera na klatke); dbgAt.
- Nagrania 4x rnd43oc-46oc, rndR3oc / rndI3oc / rndD3oc / rndC3oc (5000 klatek); rndR2oc, rndR3oc, rndI3oc zgodne w calosci:
  - Brak zatrzymania x w kucki w podrzucie z kolcow - wczesniejsze przypadki to sciana ($2F4554 -> $2E8EBC wysrodkowuje
    wskaznik chodu przy zablokowanym ruchu, tez w powietrzu).
  - Lina: skrypt wspinaczki tylko przy wejsciu w tryb $2EB212 (UP / DOWN), dalej biegnie tez bez ruchu (UP w oknie
    $2EB13C); zmiana kierunku - ten sam cykl 61-62-63 wstecz od biezacej klatki; cios z liny konczy skrypt (zawis 64/65),
    w blokadzie $30CC63 joystick pominiety (flaga DOWN $2EB20B tez); kierunek bez DOWN z poprzedniej klatki konczy tryb.
  - Chwyt liny: wskaznik chodu na srodek ($2F1218 - skok z liny bez wybiegu).
  - Ponowienie podrzutu na linie: kolce sondowane pod stopami (y + 1).
  - Wznowiony po skoku podrzut: pierwszy ruch jeszcze z klatka z ziemi.
  - Zejscie po linie do wody konczy line (plywanie).
- Testy: snapshot I4 to obszar startu poziomu 4 z przestawionym graczem - woda 453 ('262:453' w RNDAT); runAt / runSeq
  zeruja wygaszanie drzwi i zatrzask przycisku, runSeq obsluguje wygaszanie drzwi.
- Wszystkie nagrania 4x (rnd2-46oc, ze snapshotow R3/I4/D4/C2) zgodne co do piksela i klatki az do GAME OVER (poza
  artefaktami zapisu i lina nad kolcami w rndRoc od 1601). Poprawki:
  - Sufit w skoku ($2F4FC6, podpiete w emulatorze wywolanie: sonda z ramka [-6, 7] co klatke): x sprzed ruchu poziomego,
    wiersz glowa + dy; w tym samym wierszu kafla co glowa bez sufitu ($2F5084) - jak przy profilu.
  - Zejscie z krawedzi z UP w oknie spadochronu: spadochron juz w tej klatce.
  - Skok zgloszony klatke wczesniej: w pierwszej klatce lotu klatka skoku ze starym zwrotem.
  - W czasie wygaszania przy drzwiach skrypt gracza biegnie dalej (84/85 -> 86).
  - Po odrodzeniu bez blokady FIRE (trzymany FIRE od razu cios).
  - UP w oknie spadochronu po ladowaniu ze spadania: postoj (klatka skoku zostaje).
- Testy: przejscie drzwiami z procesorem 4x (nowa pozycja 16 klatek po FIRE, sterowanie 10 klatek pozniej) - doorExtra /
  doorBlack (A500: 17 / 21).
- rndRoc (lina nad kolcami, R3) zgodne w calosci - teraz wszystkie nagrania 4x zgodne co do piksela i klatki (poza
  artefaktami zapisu i kamera po GAME OVER). Podpiete w emulatorze wywolania $2F48E0 (ustawienie profilu) i $2F51A2
  (kolce) pokazaly kolejnosc w klatce: wejscie na line z UP ustawia stop $2F1C20, a kolce w tym samym takcie zaczynaja
  podrzut $2F1CE2 juz po nim (w porcie takt jest na koncu poprzedniej klatki - wejscie nie zatrzymuje wtedy profilu).
- Lina: skrypt wspinaczki zostaje z kierunku wejscia w tryb (UP: 61, 62, 63, 62..., DOWN: 63, 62, 61, 62...) - zmiana
  kierunku w trybie nie zmienia skryptu.
- Nowy rozklad losowych wejsc (ziarno >= 100000: wiecej w lewo, FIRE z kierunkami, DOWN+FIRE, krotsze odcinki) -
  rndb1-4oc i rndbR/I/D/Coc (5000 klatek): pozycje zgodne wszedzie. Poprawki:
  - Blad portu: indeks profilu za koncem tablicy (profil z liny po skoku) dawal dy NaN.
  - Blad z wczesniejszej poprawki: komentarz polknal czesc instrukcji przy otwarciu spadochronu (bez blokady UP, ciosu
    i dzwieku) - naprawione.
  - DOWN w klatce startu skoku (skok zgloszony klatke wczesniej): bez wybiegu.
  - Podrzut z kolcow z tego taktu wygrywa z odbiciem po ciosie w dol przy ladowaniu; cios w dol trwa dalej; stare dy na
    starcie ponowionego podrzutu nie konczy profilu (tez na linie).
  - Puszczenie liny u dolu konczy stan czolgania i tablice czolgania ($2E9C22: $9DD4 = 0).
  - Cios z liny: w blokadzie $30CC63 bez skoku i puszczenia liny.
  - Chwyt liny nie w klatce, w ktorej ruch konczy sie w wodzie (flaga wody po ruchu, przed chwytem); w klatce wyskoku
    z wody - klatka skoku.
  - Ladowanie przed joystickiem (profil z dy > 0 nad podloga): FIRE to cios z ziemi, tablica chodu juz w tej klatce.
  - Spadochron otwarty w klatce ladowania: dalej postoj (nie klatka skoku); koniec czolgania z obrotem: skrypt od nowa.
- Druga partia rozkladu B (rndb5-8oc, rndbR2/I2/D2/C2oc) i poprawki (rndb5oc, rndbDoc, rndbD2oc, rndbC2oc, rndbRoc w
  calosci zgodne):
  - Tablica chodu wg kafla pod stopami ($2F1106) dziala co klatke, tez w powietrzu (spadanie tuz obok kafla podlogi:
    wybieg czolgania urywa sie na tablicy zwyklej); nie z tablicy wodnej. Warunek oryginalu: bit podlogi i ($30CC81 -
    czolganie bylo juz w tym poziomie, albo tablica lodu $30CC80); ten sam kod kasuje spadochron ($2EB20C).
  - UP w oknie $2EB13C (bez wybiegu i postoju): skrypt czolgania biegnie dalej.
  - Podrzut z kolcow wstrzymany skokiem przed pierwszym ruchem: po ladowaniu od razu pierwsze dy.
  - Spadanie w stanie 1 na kolce: poza 0 / 29 tez na starcie podrzutu; klatka skoku w poslizgu tez na starcie podrzutu.
  - $2F4A48: ladowanie z profilu w skoku (odbicie po ciosie w dol, tez po koncu profilu - w oryginale profil trwa ze
    stalym +d) ustawia od razu skrypt postoju; zwykly skok zostawia klatke skoku do postoju.
  - Kolce przy nietykalnosci nie kasuja skoku ($2E674A kasuje $30CC54 tylko przy trafieniu): UP w podrzucie to nie
    nowy skok, klatka skoku (4/33) zostaje.
  - Start podrzutu z kolcow bez skoku: obsluga postoju ($2E8D3A) dziala (poza 0 / 29).
  - Ladowanie ze spadochronem: klatka 6/35 ze zwrotem z tej klatki; chwyt liny w klatce ladowania spadochronu.
  - Chwyt liny w przerwaniu bywa miedzy skryptem a zapisem zwrotu obslugi kierunku (przerwanie VERTB w srodku petli
    glownej): pierwsza klatka po chwycie - zawis ze zwrotem sprzed kierunku; chwyt w skoku - klatka skoku tez.
  - Chwyt liny z czolgania: stan 3 trwa, puszczenie DOWN daje stan 0 ($2E8B78), wiec cios z tablicy ziemi ($30CD50,
    indeks $30B8AE) - klatki 30/29 do konca blokady; z ziemi z DOWN + kierunek klatka czolgania.
  - Cios na linie w trybie wspinaczki nie konczy trybu (blokada $30CC63 pomija postoj).
  - Kierunek po UP / DOWN na linie bez skryptu wspinaczki: zawis ze starym zwrotem jeszcze klatke.
  - Recenzja Codex: spadochron kasuje tez wstrzymany podrzut; skrypt skoku (jumpScript) kasowany przy odrodzeniu.
- Rozklad B, dalsze poprawki (rndb6oc, rndb7oc, rndb8oc, rndbI2oc zgodne; rndb6oc poza dwoma znanymi artefaktami x przy
  chwycie drabiny):
  - $30CC81 (czolganie bylo w tym poziomie, zerowane na starcie poziomu - snapshoty tez maja 0): tablica wg kafla z
    tablicy wodnej i kasowanie spadochronu nad kaflem podlogi ($2F1146) tylko po czolganiu albo z lodu. Spadochron
    skasowany w powietrzu: ruch tej klatki jeszcze 2 px, gracz bez flag skoku i spadania jak na ziemi (chod), w nastepnej
    klatce zejscie z krawedzi ($2F0B22).
  - Drabina: zejscie na szczycie dopiero UP w klatce po dojsciu (sonda $30B8D2 z pozycji przed ruchem) - postoj, a UP
    swiezo wcisniety (bez $30CC8E, ktory UP na drabinie ustawia co klatke - $2E9940) to skok; bez UP gracz zostaje na
    drabinie (w bok tylko obrot). Na dole DOWN bez drabiny pod stopami = kucniecie jak po puszczeniu liny ($2E9BB0 ->
    $2E9C22, okno $2EB13C). Skrypt wspinaczki tylko przy ruszeniu i po obrocie ($2E903C kasuje $2EB210) - zmiana
    kierunku bez obrotu ciagnie stary skrypt. Cios z drabiny: klatka 80/81 do konca blokady.
  - Drzwi, zamek, klatka, kafel akcji: $2EB213 / $2EB214 zyja tylko w klatce obslugi UP (koniec obslugi joysticka
    $2E8E9E je kasuje, gdy d7 ustawione) - FIRE po puszczeniu UP to zwykly cios.
  - Koniec ciosu w dol w klatce ladowania: klatka skoku zostaje w poslizgu do postoju.
  - Podrzut z kolcow z flaga skoku (nietykalnosc) to lot, nie ziemia (bez kucania i chodu).
  - Otwarte: spadochron na kolce z DOWN (rndb2oc 1972), puszczenie DOWN w podrzucie z czolgania (rndbCoc 4827), zwrot
    zawisu na linie w trybie wspinaczki z DOWN + kierunek (rndbR2oc 4369 - proba z zapamietanym zwrotem psula R2/R3).
- Rozklad B, trzecia partia (rndb9-12oc, rndbR3/I3/D3/C3oc): rndb9-12oc i rndbD3oc zgodne w calosci, rndbR2oc teraz
  tez co do pozycji. Poprawki:
  - Cios na starcie podrzutu z kolcow: blokada $30CC63 trwa w powietrzu (dyspozytor pomija kierunki, tylko wybieg).
  - Skrzynia: FIRE podnosi ja tylko, gdy ruch poprzedniej klatki zatrzymala sciana-skrzynia ($9F1C, $2F4546; ruch bez
    sciany go kasuje $2F44FE) - kierunek wcisniety dopiero teraz to cios.
  - Spadochron otwarty w klatce ladowania ratuje przed smiercia od upadku (profil $2F1C20 przez $2F48E0 ustawia zapas
    $80, smierc liczy sie dopiero w nastepnej klatce).
  - Wyskok z wody ($2E953E) bez $30CC8E: trzymany UP tez wyskakuje na powierzchni.
  - Drzwi, klatka, kafel akcji: obrot i akcja tez przy ladowaniu z profilu przed joystickiem; w blokadzie ciosu bez obrotu.
  - $30CCCA: po przejsciu do obszaru 16 klatek rozjasniania, w nich obsluga UP pominieta ($2E945C) - bez skoku, drzwi,
    drabiny; $30CC8E skasowany ($2DD312), wiec trzymany UP po nich to skok.
  - Wejscie w drzwi: petla glowna odbiera FIRE w swoim takcie - w klatce nieparzystej przejscie klatke wczesniej.
  - Nagranie rndb11oc z dopasowanym odrodzeniem [41, 7, 46].
  - UP+FIRE na starcie podrzutu z kolcow: skok i cios w dol (jak z ziemi).
  - Recenzja Codex: flaga skrzyni ($9F1C) kasowana przy podniesieniu i odstawieniu.
- Rozklad B, trzecia partia, dalej: rndbI3oc zgodne w calosci, rndbR3oc co do pozycji (zostaje 8 klatek przy scianie
  po ladowaniu):
  - Wpadniecie do wody: sciana sprawdzana juz ramka klatki plywania ($2EB1BC ustawiany przed ruchem).
  - Po przejsciu do obszaru petla glowna rusza od nowa: takt (kolce, wejscie w drzwi) w klatkach parzystych od oddania
    sterowania (port: game.frame = 1).
  - Chwyt liny w klatce ladowania z ciosem w dol: profil stop ($2F1C20), bez odbicia; kolce pod lina zaczynaja potem
    podrzut od nowa.
  - Wstrzymany podrzut z kolcow wznawia sie po ladowaniu tylko bez nowego skoku - skok zaraz po ladowaniu (UP trzymany
    w powietrzu nie ustawia $30CC8E) wstrzymuje go dalej.
  - Spadochron otwarty w tej klatce blokuje chwyt liny.
  - Podrzut przez krawedz: przyciecie do podlogi spod x sprzed ruchu, a pod x po ruchu jej nie ma - profil leci dalej
    (rndbC3oc teraz zgodne co do pozycji).
  - Recenzja Codex: klatka (cykl HELP) i oczekujaca smierc od upadku przeliczane po wyzerowaniu licznika klatek.
  - Recenzja Codex proponowala dalszy lot profilu tez bez ruchu w dol w tej klatce - odrzucone: psuje rndb1/5/10oc
    (gracz juz stojacy na podlodze laduje).
- Rozklad B, czwarta partia (rndb13-16oc, rndbR4/I4/D4/C4oc): pozycje zgodne w rndb13-16oc i rndbD4oc (D4 tez co do
  klatki). Flagi chodu $2EB20D / $2EB20E (port: pl.swimDir): kierunek na ziemi je ustawia ($2E9150, nie w skoku ani w
  klatce zgloszenia skoku), w spadaniu kierunek kasuje tylko swoja flage ($2E9110); kasuja je tez start skoku
  ($2E982E), kucniecie ($2E9C54), poczatek czolgania ($2E9B12), spadochron ($2E9496), obrot do drzwi ($2E99B0) i
  postoj ($2E8E46). W wodzie kierunek z juz ustawiona flaga nie zmienia skryptu plywania - po chodzie w lewo i spadaniu
  z RIGHT gracz plywa dalej skryptem w prawo mimo LEFT.
- Pakiet demo do repozytorium publicznego (github.com/SychPL/traps-n-treasures-port): `work/make_demo_assets.py`
  rysuje wlasna grafike (pirat, kafle, przedmioty, HUD, fonty, ekrany) i buduje 4 krotkie etapy testowe (woda, drabina,
  lina, kolce, skrzynie, lod, drzwi wyjscia) w formatach silnika -> `game/assets-demo/` (92 pliki, bez wrogow i muzyki).
  Silnik: katalog assetow `ASSETS` - `game/assets` gdy `assets/level1.json` da sie pobrac i jest JSON-em etapu (w, attr),
  inaczej `game/assets-demo`; `?assets=demo` wymusza demo. Mapa wyspy bez skryptow (demo) nie wywraca `mapStart`. Test
  awaryjny przechodzi tez na pakiecie demo (4 etapy, 4000 klatek losowych klawiszy).
- `work/export_public.py`: eksport z `git ls-tree HEAD` wg listy dozwolonych sciezek (dokladna glebokosc, bez
  rozszerzen danych poza pakietem demo), uzgadnia katalog publiczny (usuwa niedozwolone, zostawia README/LICENSE/
  .gitignore), czysci adres LAN i baner `start-server.bat` (poprawki z recenzji Codex).
- Ekstraktor z dyskietek (trasa B z `EXTRACTOR.md`), `extractor/`: `adf.js` rozpoznaje dyski PSG po SHA-1 zakresu danych
  gry i czyta pliki (PowerPacker gdy najwyzszy bit dlugosci), `music.js` 11 modulow MED, `tiles.js` banki kafli `CHR!`
  (5 bitplanow, paleta w pliku od +6, kolor 1 przezroczysty; paleta podwodna: etap 1 RGB -2/-2/+2, etap 4 -5/+1/+3, kolor 0
  bez zmian, obciecie 0..15), `levels.js` mapy `LEV!` (mapa od +18). Mapa z dysku nie ma kafli skrzyn, kruchych kamieni i
  scian do wysadzenia - gra naklada je z tablic przy starcie etapu; silnik robi to teraz w `load()` z list w JSON etapu
  (dla map ze zrzutu bez zmian). Zgodnosc z eksportem: muzyka 11/11 bajt w bajt, kafle 8/8 piksel w piksel, mapy 4/4 po
  nalozeniu (`node extractor/extract.test.mjs`). Strona `extractor/index.html` zapisuje wynik w Cache Storage
  (`tnt-assets-v1`) pod adresami `game/assets/...`; `game/sw.js` podaje je grze przed serwerem i przed pakietem demo
  (nie w aplikacji Capacitor ani z file://). Sprawdzone w przegladarce: 23 pliki, mapa etapu 1 w grze = referencja. Na
  razie strona zapisuje tylko muzyke - kafle i mapy dopiero razem z tabelami etapu (level{n}.json), bo z atrybutami kafli
  pakietu demo etap z dysku nie bylby grywalny.
- Ekstraktor, tabele etapow (`extractor/tables.js`, `seg2.js`): syntetyczna pamiec etapu w ukladzie A - glowny program
  SEG2 z dysku 1 relokowany (seg1 -> $2DC97C, seg2 -> $9A4C, BSS $100FC), hunk obszarow etapu z dysku 2 ($21AA4,
  $3C314, $56DB0, $72500: jeden HUNK_DATA czytany bez relokacji, +0 x/y startu, +4 obszar startowy) pod $9014 (etap 1)
  / $52024 (2-4), zmienne $30CD14 (tablica etapu z listy $30B70E, 8 B na etap: x, y wyspy, tablica), $30CD98,
  $30CBA2, $30CAA2 (szerokosc mapy). Odczyty jak w `work/export_level.py`: wszystkie 28 pol level{n}.json zgodne w 4
  etapach. `under` skrzyn, scian i kamieni gra bierze z mapy przy nakladaniu - kolejnosc skrzynie, sciany do
  wysadzenia, kruche kamienie (kamien na skrzyni ma under = kafel skrzyni); silnik naklada teraz w tej kolejnosci.
  Szerokosc/wysokosc mapy z naglowka LEV! (+10/+12 kafle ekranu 20x12, +14/+16 liczba ekranow). Niebo: tablica etapu
  +$54 = kolor na 4 linie, rysowany [k, poprzedni, k, k]; okno linii, linia wody, 2 kolory lustra i tlo pod woda $003
  to stale pomiarowe (RECIPE). Strona zapisuje etapy (kafle, mapy, tabele) tylko z obiema dyskietkami; 4 oryginalne
  etapy z grafika pakietu demo przechodza test 4000 klatek losowych klawiszy.
- Ekstraktor, obiekty etapow (`extractor/objects.js`): listy rekordow z glownego programu, bank przedmiotow z dysku 2
  ($16E68, bez kompresji, w chip pod $1EDA4, zmienna $30CD58), opisy typow, animacje, teksty i emitery kropli jak w
  `work/export_objects.py`: level{n}_objects.json zgodne w 4 etapach, atlasy piksel w piksel poza
  level4_objects_water.png. Paleta podwodna z reguly: CHR! z odcieniem, kolor 1 = tlo wody, kolory 2 i 3 bez odcienia -
  copper (etap 1) barwi je tylko na 2 liniach lustra pod linia wody, nizej przywraca. W zrzucie lvl4_a copper zeruje
  kolory 16-31 od linii 191 (i 2-3 od 207), wiec eksport level4_*_water.png wyszedl czarny; gracz tez uzywa 16-31,
  wiec to raczej lista coppera w trakcie przebudowy - do sprawdzenia w emulatorze pod woda w etapie 4. Strona zapisuje
  obiekty razem z kaflami, mapami i tabelami; 4 etapy z dysku z grafika gracza/HUD z pakietu demo przechodza test
  4000 klatek.
- Gracz pod woda byl bez odcienia: `export_player.py` i `export_sword.py` braly palety ze zrzutu lvl1_g, gdzie linia 143
  (woda etapu 1) jest jeszcze nad woda - player_water.png i sword_water.png byly identyczne z _surface. Copper barwi
  kolory 16-31 (sprite'y) pod woda (kolor 16: $EC1 -> $CA3), wiec palety teraz z lvl1_h; player_water.png i
  sword_water.png wyeksportowane od nowa (player_surface bez zmian). Ekstraktor (`extractor/player.js`, hunk danych z
  dysku 2 $940C = bank $131A4) daje to samo piksel w piksel.
- Ekstraktor, bronie i miecz (`extractor/weapons.js`): tablica klatek $308EA2 z glownego programu, struktury i dane
  sprite'ow w seg2 (bez zmian wzgledem zrzutu); miecz = pary SPR4/5 $C298/$C2C0 (w prawo) i $C300/$C328 (w lewo), 8 linii
  (pos/ctl w czystym programie sa zerami, wysokosc ustawia gra). Klatki 37 i 41 to struktury w BSS ($13118) z zerowymi
  wskaznikami sprite'ow - eksporter rysowal w ich komorkach pamiec od adresu 4; silnik ich nie uzywa (4, 5, 13, 24-35).
  `export_weapons.py` pomija teraz wskazniki < $1000, weapons.json/png wyeksportowane od nowa; ekstraktor = eksport.
- Ekstraktor, wrogowie (`extractor/actors.js`): banki BOB-ow wrogow z dysku 2 (PP: $34660, $4DBB0, $6B90C, $88924, w
  chip pod $65484 / $64694 / $67494 / $68BA4, zmienna $30CD70) + bank przedmiotow, aktorzy, wyzwalacze, okna pamieci
  skryptow jak w `work/export_actors.py`; procedura startowa bez disasemblera: slowa $237C / $22BC / $217C..$007A /
  $43F9 do pierwszego $4E75. Zgodne: banki, klatki, kolejnosc, wyzwalacze, aktorzy, atlasy (poza level4_actors_water,
  jak u obiektow). Rozni sie tylko stan z chwili zrzutu: okna pamieci 128 / 226 / 362 / 428 B na ~59 KB ($9800-$9A4B pod
  seg2, zmienne gracza $9B8A-$9F03, flagi $2EB2xx w etapie 1, bufor $2FFD3A etapu 3, $3016ED / $3073FA etapu 4) oraz p3
  10 aktorow etapu 3 (blok danych zmieniany w grze). Regresja nagran z emulatora (ocCheck 61 wierszy, fullCheck 117)
  identyczna z aktorami z ekstraktora i z eksportu - silnik tych bajtow nie czyta albo czyta je po zapisaniu.
- Ekstraktor, drobne grafiki (`extractor/hud.js`): czcionka z seg1 ($30AC49), okno komunikatu (bank przedmiotow +$2218),
  czcionka komunikatow (bank $30CD5C = dysk 2 $15028 bez kompresji, w chip $71B4), ikony narzedzi i igla kompasu (bank
  $30CD60 = dysk 2 $1F53C, chip $2747C), pociski ($F7F2 / $F870 w seg2). Paleta HUD = tablica w seg1 $30B6CE (+$2ED52),
  rowna linii 20 coppera; reczna paleta 7 kolorow kompasu ma te same wartosci. Wszystko piksel w piksel.
- Ekstraktor, efekty dzwiekowe (`extractor/sfx.js`): ta sama budowa utworu z blokiem na efekt co `work/export_sfx.py`,
  z modulow muzyki etapow; sfx/level{n}.med bajt w bajt.
- Paleta sklepu: $2DFD14 to rozjasnianie 32 kolorow ku tablicy docelowej - sklep ($30CC83) bierze $30B9BA, inny ekran
  ($30CD08) $30B97A, plansza ($30C324 < 0) +$3C(A4). Paleta sklepu dopasowana wczesniej do zrzutu ekranu byla zlapana w
  trakcie rozjasniania (kolory 16-29 o stopien za ciemne, 30-31 zgadniete); `export_shop.py` czyta teraz tablice z
  programu, shop_bg.png / shop_items.png wyeksportowane od nowa. Ekstraktor (`extractor/shop.js`) = eksport.
- Ekstraktor, bieg po skarb i GAME OVER (`extractor/screens.js`): bank diamentow = dysk 2 $B13B0 (w chip $299E4 na
  czas biegu), serce = BOB 0 banku przedmiotow, niebo z tablic seg1; tapeta i bank GAME OVER z dysku 2 bez kompresji.
  Paleta mapy wyspy nie lezy w programie jako zwykla tablica (szukane dopasowanie 26/32 kolorow +-1) - do RE.
- Ekstraktor, ekran tytulowy: obraz z dysku 1 (PP $CC20, 352x290, 6 planow po kolei, EHB, 289 linii widocznych), paleta
  32 kolorow w module startowym (dysk 1 $646E = SEG2 $3214 +$325A), ta sama w kazdej linii; title.png piksel w piksel.
- Ekstraktor, panele HUD (`extractor/hud.js`): plik dysku 2 $A0824 (320x53, 5 planow po kolei, paleta HUD), linie 0-11
  gorny pasek, 12-51 dolny panel. Gra dorysowuje: pola zycia = BOB 0 (pelne) / $86 (puste) banku HUD, 11x9, x = 47 + 11k
  (kotwica 8, -1; $308FA6); pasek witamin kopiuje kolumny pikseli ($309750) z 5 planow 64x8 (wskazniki $309864, 8 B na
  wiersz) do x 256.., linie 1-8; pole mapy = BOB $1CF4 (19x25) w 249, 10 panelu; cyfry = 10 BOB-ow 5x6 od $16BC (pierwszy,
  $1696, to puste pole). W linii 55 copper zmienia kolor 27 na 000 od x 135. hud_top, hud_life_empty, hud_digits piksel w
  piksel; hud_bottom rozni sie tylko licznikiem narzedzia i zalogi (stan gry na zrzucie, silnik je przemalowuje).
  hud_top_vit.png byl wyciety ze zrzutu z surowymi 8-bitowymi kolorami vAmiga (np. #30003f zamiast #330044) - zastapiony
  wersja z dysku (= x17 starego w obszarze witamin).
- Paleta mapy wyspy: $2F3A8C rozjasnia 32 kolory listy coppera mapy ($9DEC, kolory od $9E7A) ku tablicy $2F3B70, co 4
  takty, 16 krokow. Paleta dopasowana do zrzutu byla w trakcie rozjasniania (jasne kolory obciete do $A: plaze, zamek,
  fale za ciemne); `export_screens.py` czyta tablice z programu, island_clean / map_actors / map_marker wyeksportowane od
  nowa. Ekstraktor (`extractor/map.js`) = eksport; w oknie skryptow mapy 2 B stanu ze zrzutu.
- Ekstraktor, zakonczenie (`extractor/screens.js`): obraz z dysku 2 (PP $C21E4, 320x256, 5 planow; 6. plan to
  przewijany tekst), kolory jak w kodzie segmentu zakonczenia $438: 32 kolory z seg1 +$6E0 do listy coppera (seg2 +$96),
  30 kolorow morza z +$720 od linii 202 (seg2 +$632), gradient koloru 27 nieba z tablicy +$111C wzorem t[k], t[k+1], t[k]
  ($4CE). Render 243 linii od linii 44 zgadza sie z ujeciem emulatora w kolorach 4-bit poza zaokraglonymi rogami ekranu
  emulatora i linia horyzontu 158 (copper zmienia palete w trakcie linii). Brakujace glify ('<' '>' '@') to wlasna
  czcionka segmentu (seg1 +$F08, ASCII od 32, 9 B). ending_bg / ending_dark / ending_sky zastapione renderem z dysku
  (stare: wyciete ze zrzutu, surowe kolory 8-bit vAmiga, latane rogi); ending.json bez zmian.
- Ekstraktor, polskie litery (`extractor/hud.js`): wzory `work/make_font_ext.py` (nasze) nakladane na glify czcionki gry
  z dysku - font_ext.png/json piksel w piksel.
- Ekstraktor, menu i logo Hall of Fame (`extractor/menu.js`): modul $309DF0 laduje bank BOB-ow dysku 2 (PP $9C6BC: zwoj z
  logo 205x57, medalion z kapitanem 120x119, wstega START/PASSWORD 284x42, rzad pol hasla 160x19, podswietlenie PASSWORD
  65x23, ramka kursora 20x20) i bank obrazkow hasla ($96AA8, 6 nieprzezroczystych BOB-ow 16x16); paleta 32 kolorow z
  $30C4B2 ($30A3FA kopiuje ja do coppera $E4F6). Polozenia sprawdzone piksel w piksel na ujeciach: logo 58,1, medalion
  100,41, wstega 18,158, podswietlenie 130,173, pola 81,174 co 20 px, obrazek w polu +2,+2, ramka kursora +0,+0.
  menu.png, menu_icons.png, pass_icons.png i hof_logo.png zastapione wersja z dysku (kolory x17 zamiast surowych 8-bit
  vAmiga; logo to caly BOB 205x57 z ciemnym konturem, wyciecie ze zrzutu gubilo ciemne piksele i 2 ostatnie wiersze).
  Hasla z tablicy $30C438.
- Ekstraktor, intro i historia (`extractor/intro.js`): modul startowy (dysk 1 SEG2 $3214, seg1 $2000, seg2 $40D8) laduje
  muzyke tytulu ($7DF4), tytul ($CC20), bank liter ($1BA58: 81 BOB-ow ozdobnej czcionki) i glowny program. Litery:
  tablica znak -> BOB $58AA, krok = ramka (x2 - x1 + 1), spacja 8. Ekrany napisow ($2702): rekordy {x, y, tekst} od
  $5AA6 ($00 nastepny, $01 koniec ekranu, $02 koniec): 'Starbyte presents', potem 'a' / 'Nightingale' / 'production';
  paleta $50B6 z kolorami 0 i 2 = 000. Historia ($2408): wiersze od $5240 do $FF, srodek x 176, co 42 px; tlo = kolor 0
  kazdej linii z tablicy $5AEE (21 kolorow w kolko). Przesuniecia okna: napisy -64, -29, historia -16. Wynik: tlo
  historii i tekst piksel w piksel (stare ciecie gubilo kilka wierszy ozdobnikow), Nightingale = ujecie bez obcietego
  czerwonego (zrzut w trakcie rozjasniania). Malowane logo Starbyte (intro_starbyte.png z ujecia) nie pochodzi z plikow
  gry (modul startowy pokazuje tylko napis 'Starbyte presents', za glownym programem dysk 1 jest pusty) - ekstraktor
  daje ekran napisu. Polska historia skladana z liter banku (akcenty jak w `export_story_pl.py`), title_wide = tytul na
  czarnym tle (reczne poszerzenie z eksportu zostaje w prywatnych assetach). Silnik nie laduje juz island.png (nigdy
  nie byl rysowany). Ekstraktor daje teraz komplet: 107 plikow, gra z repo publicznego + wlasne dyskietki nie siega do
  pakietu demo; test awaryjny daje te same wyniki co na wyeksportowanych assetach.
- Zwrot w wodzie (rndb13oc od 1625, klatki): obsluga kierunku ($2E9146 / lustrzana) ustawia flage chodu tylko, gdy nie
  byla ustawiona ($2EB20D = lewa, $2EB20E = prawa), a w wodzie wybiera skrypt wg znacznika $2EB222 (4 = lewo, 0 = prawo;
  `adda.w $2EB222, a0` w $2E8FF6): zgodny z nowym kierunkiem -> plywanie $2EB1BC, inny -> zwrot $2EB1CC. Sonda w emulatorze
  (zapis $2EB222 i flag co klatke, 1700/1700 klatek jak nagranie): $2EB222 zmienia kazdy kierunek, takze w powietrzu
  (flagi bez zmian) i w wodzie przy ustawionej juz fladze. Przypadek: chod w lewo na ladzie (flaga lewa), skok/spadanie
  z RIGHT (znacznik prawo, flaga lewa zostaje), w wodzie LEFT (znacznik lewo, flaga juz jest - skrypt bez zmian), potem
  RIGHT: flaga prawa nowa, znacznik lewo -> zwrot 92/91/96. Port porownuje teraz z pl.face0 (zwrot z poczatku klatki =
  $2EB222 przed obsluga kierunku) zamiast ze zwrotem skryptu plywania; regresja: rndb13oc zgodne, reszta bez zmian.
  Odrzucone proby: zwrot przy przeciwnej fladze (psuje rnd24oc / rndb8oc / rndb16oc), osobny znacznik ustawiany razem
  z flaga (9 nowych roznic) - znacznik nie zalezy od flag.
- UP+FIRE przy czolganiu poza krawedz (rndb14oc): skok tylko z podloga pod stopami jak w samym skoku ($2E988E) - bez
  niej UP+FIRE w pierwszej klatce spadania to spadanie bez ciosu (warunek upJump: `pl.ground && (floorAt || pl.plat)`
  albo podloga podrzutu z kolcow).
- Stan 1 w locie podrzutu z kolcow (rndb14oc 4302, nagranie 4x): obsluga DOWN ($2E9AD6) i kierunkow ($2E92FC /
  lustrzana) przy fladze skoku $30CC54 wychodzi przed zmiana stanu $30B8AE (DOWN: tylko okno $2EB13C, kierunek: skrypt
  lotu $2EB174), wiec kucniecie ze startu podrzutu trwa przez lot mimo kierunku. Ladowanie na kolcach z DOWN w stanie 1
  - bez nowego skryptu kucania ($2E9C34), poza 0 (port: crouchSt nie konczy kierunek w locie podrzutu, dalej st1Land).
  Czolganie po takim ladowaniu startuje od nowa jak po skoku (pierwsza klatka 6, rndbC3oc 575-580): pl.hopSt wylacza
  regule "stan 1 z ziemi przez spadanie = 5". Regresja: rndb14oc zgodne, fullCheck i ocCheck bez innych zmian.
  Odrzucone: brak kucania na calym podrzucie / w klatkach 0-1 podrzutu (7 nowych roznic - kucniecie ze startu jest
  w wiekszosci nagran).
- Sciana w czolganiu (rndb15oc 4673, sonda `work/probe_seq.js`: wskaznik skryptu $2F184C, opoznienie $2F185E): chod
  w lewo, DOWN+RIGHT - czolganie w prawo ($2F18AE, klatka 14), predkosc jeszcze w lewo, krok w lewo w sciane ($2F4554 ->
  $2E8EBC). Ta przy $9DD4 ustawia skrypt stojacego czolgania z tablicy $2EB194 ($2F18C0 prawo / $2F1984 lewo, klatka
  18 / 47) bez sprawdzania kierunku ruchu (w chodzie $2E8F28 sprawdza flage chodu i znak predkosci $2E516E), od
  nastepnej klatki. Skrypt trwa w ruchu w prawo (12 klatek 18 przy 1 px/kl.), bo obsluga kierunku ustawia skrypt
  czolgania tylko przy nowej fladze chodu; koniec czolgania z kierunkiem - jeszcze klatka 18. Port: pl.crawlStop
  (zderzenie przy kierunku przeciwnym do trzymanego; ten sam kierunek dalej pl.wallStand), kasowany zwrotem, koncem
  czolgania albo puszczeniem kierunku. Regresja: rndb15oc zgodne, fullCheck i ocCheck bez innych zmian.
- Stan 1 przez spadochron (rndb2oc 1972, sonda $30B8AE / $2EB20C / $30CC59): kucniecie na kolcach (1932) trwa przez
  podrzut i przez spadochron otwarty UP+RIGHT w oknie DOWN - obsluga kierunku przy $2EB20C idzie od razu do skryptu
  spadochronu ($2E922E -> $2E92B0 -> $2E92DA), DOWN przy $2EB20C nic nie robi ($2E9A46). Flaga gasnie w klatce
  ladowania na kolcach; DOWN w stanie 1 - bez skryptu kucania, poza 29 ze startu podrzutu. Port: kierunek na
  spadochronie nie konczy crouchSt (jak w locie podrzutu, gdzie wychodzi przy $30CC59 - $30CC54 jest wtedy 0).
- Stan 3 przez lot podrzutu (rndb2oc 2323, sonda): czolganie z przejscia przez powierzchnie bloku w podrzucie (2310)
  zostawia $30B8AE = 3 i $9DD4 przez caly lot z DOWN+RIGHT (skrypt spadania $2F189A). Po ladowaniu RIGHT bez DOWN:
  flaga chodu byla skasowana przez start czolgania, wiec obsluga kierunku przy $9DD4 ustawia skrypt czolgania ($2F18AE,
  klatka 14), koniec czolgania zeruje stan i $9DD4 - chod od nastepnej klatki. Bez kierunku od razu postoj $2EB1A4
  (rndbC2oc 4536: klatka 0, nie 18). Port: crawlEnd tez z crawlSt0 (stan 3 z poprzedniej klatki), tylko z kierunkiem.
- Cios w kucki na starcie podrzutu z kolcow (rndbR4oc 779-788): po koncu ciosu reszta blokady $30CC63 w powietrzu
  pokazuje kucanie (2 / 31), nie postoj - skrypt po ciosie wraca do kucania, gdy stan 1. Port: poza blokady w podrzucie
  wg crouchSt. Tez rndbR3oc 2995 (8 -> 4 klatki).
- Pozostale roznice nagran 4x poza graczem: rnd11/26/30/33/37oc - zmienna kamery gry zerowana 172-173 klatki po
  wejsciu w GAME OVER (wszystkie konca zyc na poziomie 3 w tym samym dole), potem klatka 0 po FIRE (nowa gra); harness
  portu nie przechodzi ekranu GAME OVER. rnd6oc 2072, rnd22oc 2059, rndb3oc 4712, rndb6oc 1542: klatka przed UP
  (skok / drabina) - gra ustawia x startu skoku / srodek drabiny w obsludze UP przed rysowaniem, wiec w nagraniu
  pozycja z przesunieciem 1 pokazuje go klatke wczesniej (artefakt porownania, w grze bez roznicy).
- Lina i podrzut z kolcow (rndbR4oc, teraz pozycje zgodne w calosci):
  - Chwyt liny w podrzucie juz w powietrzu (liftI za startem): klatka spadania 88 / 87, nie klatka ze startu (855);
    podrzut z flaga skoku (nietykalnosc) to lot - klatka skoku 33 zostaje i bez opadu przy chwycie (grabDrop: flaga
    skoku przed opadem podrzutu, 1670 - stad caly rozjazd pozycji od 1671).
  - Koniec liny u gory z UP i skok z liny z kierunkiem ($2E96E6 / $2E9628) ida od razu do startu skoku $2E9818, ktory
    ustawia $30CC54 (z ziemi tylko zgloszenie $30CC55 przez $2E99A4): FIRE w tej samej klatce to cios w dol $2E9EB2
    (klatka 8 / 37, 1599), nie cios z postawy.
  - Skok z liny w klatce, w ktorej stopy schodza na podloge (zejscie po linie na kolce): klatka skoku 4 / 33 od razu
    (1874, rndbR3oc 4959) - wczesniej zostawala klatka liny z galezi ladowania.
