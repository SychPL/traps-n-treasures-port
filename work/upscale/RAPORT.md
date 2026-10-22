# Grafika 2x - raport z badania

Traps 'n Treasures, nowa wersja (`game/`). Pytanie: czy da sie poprawic grafike do 2x liczby
pikseli w kazdej osi (ekran 320x211 -> 640x422) i jak. To jest badanie - nic w `game/` nie
zostalo zmienione. Wszystko w `work/upscale/`: skrypty, obrazy porownawcze (`img/`), liczby
(`stats.md`) i ten raport.

## W skrocie

- **Da sie, i to tanio.** Grafika jest pixel-artem z ograniczona paleta, wiec klasyczne skalery
  pixel-art (MMPX, xBR, HQ2x, Scale2x) daja czytelny wynik 2x bez recznej pracy.
- **Najlepsza droga to skalowanie gotowej klatki w shaderze WebGL** (silnik dalej rysuje 320x211,
  shader robi z tego 640x422 albo od razu rozmiar ekranu). Zero zmian w assetach i w logice,
  brak szwow miedzy kaflami, sprite'y lacza sie z prawdziwym tlem, metode mozna przelaczac w
  locie (nearest / MMPX / xBR). Wynik rozni sie od "assetow 2x" tylko na 0.1-0.5% pikseli.
- **Jesli assety 2x offline** - MMPX dla wszystkiego: jedyna z testowanych metod, ktora daje
  wyraznie gladsze krawedzie i jednoczesnie nie dodaje ani jednego koloru (trzyma palete Amigi).
  Kafle trzeba skalowac **w kontekscie calej mapy**, nie kafel po kaflu (szwy).
- **xBR / HQ2x** sa gladsze ("wektorowe"), ale dodaja setki-tysiace kolorow, zamieniaja
  dithering skal w plamy ("akwarela") i pokazuja szwy siatki 16x16, jesli kafle skaluje sie osobno.
- **Font 8x9 i cyfry HUD**: MMPX albo zwykly nearest. Gladkie skalery zaokraglaja literom rogi.
- **Upscaling AI**: nie uruchamiany (wymaga pobrania modelu 18-45 MB). Dla tak malego pixel-artu
  spodziewane wady przewazaja (szczegoly nizej).
- **Prawdziwie "wiecej detalu"** daje tylko reczne przerysowanie; wynik MMPX nadaje sie na podklad.
- **Przelacznik HD / oryginal w locie jest realny i tani** (rozdz. 9): `game/assets/hd/` z tymi
  samymi nazwami PNG, canvas zawsze 640x422, oryginal rysowany nearest x2, HD 1:1, klawisz G /
  `?gfx=hd` / localStorage. Gotowy diff (42 linie) i przykladowy zestaw HD (MMPX) sa w `work/upscale/`,
  sprawdzone w przegladarce na kopii gry.

## 1. Jak silnik rysuje dzis (`game/main.js`, numery linii wg commita a275d32)

| element | dzis (1x) | uwagi dla 2x |
|---|---|---|
| ekran | canvas 320x211 (`W`, `SH`), skalowany CSS-em o calkowity mnoznik, `image-rendering: pixelated` ([main.js:5](../../game/main.js:5), [main.js:9](../../game/main.js:9)) | canvas 640x422 albo shader na koncu |
| plansza | 320x159 od y=12 (`PFY`), clip + translate ([main.js:332](../../game/main.js:332)) | bez zmian w jednostkach logicznych |
| kafle | 16x16, atlasy `level1_surface.png` / `level1_water.png` 256x256 (16x16 kafli), kolor 1 = alfa 0 (przeswituje niebo); kafel 0 nie rysowany ([main.js:286](../../game/main.js:286)) | atlas 512x512, prostokat zrodla x2 |
| niebo | gradient z coppera, linia po linii `fillRect`, paralaksa 1/2 kamery; pod linia wody `waterColor` ([main.js:278](../../game/main.js:278)) | rysowane kodem, nie skalowane; w 2x moze byc nawet plynniejsze (pol linii) |
| woda | druga paleta: cala scena rysowana drugi raz atlasami `_water` w clipie ponizej `waterY`, potem 2 linie lustra ([main.js:338](../../game/main.js:338)) | bez zmian, oba atlasy skalowane ta sama metoda |
| obiekty | BOB-y w komorkach 48x48 (`objects_*.png` 768x96), `w/h/ax/ay` z `level1_objects.json` ([main.js:306](../../game/main.js:306)) | komorki 96x96, metadane bez zmian (logiczne) |
| gracz | komorki 32x48 (`player_*.png` 384x432, 12 kolumn), lustro przez `scale(-1, 1)` ([main.js:294](../../game/main.js:294)) | komorki 64x96 |
| HUD | `hud_top.png` 320x12 i `hud_bottom.png` 320x40 (zrzuty z emulatora), `hud_life_empty.png` 9x7 ([main.js:328](../../game/main.js:328)) | 640x24, 640x80, 18x14 |
| cyfry | `hud_digits.png` 60x6, cyfra 5x6 co 6 px ([main.js:323](../../game/main.js:323)) | 120x12 |
| font | `font.png` 128x36, znak 8x9, kolorowany przez `source-in` ([main.js:116](../../game/main.js:116)) | 256x72, kolorowanie dziala tak samo |

Wazne: cala logika (fizyka, kolizje, kamera, kotwice sprite'ow) jest w pikselach logicznych 320x159
i **nie musi sie zmieniac**. 2x dotyczy tylko rysowania.

## 2. Testowane metody

| metoda | co robi | paleta | zrodlo implementacji |
|---|---|---|---|
| nearest | powiela piksel 2x2 (tak wyglada dzis gra w 2x) | trzyma | `scalers.py` |
| Scale2x / EPX | 4 proste reguly na sasiadach 3x3, tylko kopiuje kolory | trzyma | `scalers.py`, wynik identyczny bit w bit z `ffmpeg -vf epx` |
| MMPX (McGuire, Gagiu 2021) | reguly dla pixel-artu: ukosy 1:1 i 2:1, przeciecia, czubki; sasiedztwo 5x5 (+-3) | trzyma | `scalers.py`, port kodu referencyjnego z publikacji (sprawdzony na prostych wzorach, brak niezaleznej referencji) |
| xBR 2x (Hyllian) | wykrywa krawedzie w YUV, miesza piksele wzdluz krawedzi (wagi 1/4..7/8) | dodaje kolory | `scalers.py`, port `vf_xbr.c` z ffmpeg: te same decyzje co ffmpeg, rozne zaokraglenie (+1 na 2.7% kanalow); mieszanie w premultiplied alpha, wiec dziala tez dla sprite'ow |
| HQ2x | 256 wzorcow sasiedztwa 3x3 z tablicy interpolacji | dodaje kolory | `ffmpeg -vf hqx=2`; alfa: przezroczyste -> kolor-klucz, potem odmieszanie (ffmpeg interpoluje kanal alfa tymi samymi wagami) |
| xBR + paleta | xBR, potem kazdy kolor -> najblizszy kolor zrodla, alfa progowana na 50% | trzyma | `scalers.py` (`palette_snap`) |

Nie testowane offline (opis w rozdz. 6): **xBRZ** (biblioteka C++ na GPL-3, nie ma jej lokalnie;
jest jako shader libretro `xbrz-freescale`), **ScaleFX** (wieloprzebiegowy shader libretro, natywnie
3x - do 2x sie nie nadaje bez dodatkowego zmniejszania), **Super2xSaI** (jest w ffmpeg, ale to
starsza i slabsza generacja niz xBR/HQ2x).

Przezroczystosc: w kazdej metodzie piksel z alfa 0 jest osobnym "kolorem". Metody kopiujace
(nearest, Scale2x, MMPX) daja twarda alfe 0/255. xBR i HQ2x daja miekka krawedz (alfa posrednia,
kolor bez domieszki tla) - na niebie wyglada to jak antyaliasing sylwetki.

## 3. Obrazy porownawcze

Wszystkie w `img/`, generowane przez `make_comparisons.py`. Rysowanie odtwarza `draw()` z gry
(niebo z paralaksa, kafle, obiekty z poziomu, gracz, druga paleta pod woda, lustro wody, HUD).
Pierwsza kolumna "nearest" to dokladnie to, co gra pokazuje dzis po powiekszeniu.

**Plansza (3 ekrany poziomu 1, 640x318 kazdy):**
[plansza_start.png](img/plansza_start.png) (start gry, kamera 32,176),
[plansza_sklep.png](img/plansza_sklep.png) (sklep na palach),
[plansza_pod_woda.png](img/plansza_pod_woda.png) (pod linia wody, paleta podwodna) oraz
[plansza_zblizenia.png](img/plansza_zblizenia.png) - 4 wycinki 80x56 w powiekszeniu, metody obok siebie.

![zblizenia planszy](img/plansza_zblizenia.png)

- **Scale2x** - wygladza tylko pojedyncze schodki; skaly i tekstury wygladaja prawie jak nearest.
- **MMPX** - ostre krawedzie jak w oryginale, ukosy i luki (pal, liscie, garnek) wyraznie gladsze,
  dithering skal zachowany. Najblizej "tej samej gry, tylko w wyzszej rozdzielczosci".
- **xBR** - najgladsze krawedzie (gracz, napis Shop, rury), ale tekstura skal zlewa sie w obly
  wzor, cienkie elementy (liny, trawa) robia sie miekkie. Wyglada jak filtr, nie jak pixel-art.
- **HQ2x** - kompromis: krawedzie gladkie, mniej rozmycia niz xBR, ale dithering tez zmiekczony.
- **xBR + paleta** - ksztalty z xBR w kolorach oryginalu: na napisie Shop i obrysach wyglada
  dobrze, ale na teksturze skal przyciaganie do palety rozbija gladkie przejscia xBR na szum
  (pojedyncze piksele). Ciekawy kompromis, ale nie lepszy od MMPX.

**Szwy kafli:** [szwy_kafli.png](img/szwy_kafli.png) - ten sam wycinek mapy skalowany jako cala
mapa (poprawnie), kafel po kaflu (kazdy kafel 16x16 jak osobny plik, brzegi powielone) i caly atlas
256x256 jako jeden obraz; czerwone = piksele rozne od wersji "cala mapa".

![szwy kafli](img/szwy_kafli.png)

**Sprite'y:** [sprite_gracz.png](img/sprite_gracz.png) (7 klatek gracza, w tym plywanie z palety
podwodnej) i [sprite_obiekty.png](img/sprite_obiekty.png) (wrogowie i przedmioty). Kazdy sprite
skalowany osobno z przezroczystym otoczeniem, nalozony na kolor nieba / wody.

![sprite'y gracza](img/sprite_gracz.png)

- Gracz: MMPX zachowuje oczy, guziki i obrys 1 px, a wygladza kapelusz i buty. xBR daje
  najladniejsze luki (kapelusz, piora), ale rozmywa twarz i stroj (przy 32x29 px kazdy piksel twarzy
  to szczegol). HQ2x jest blisko MMPX, z miekka krawedzia.
- Wrogowie (rekin, piraci, topornik, papuga): to samo - MMPX ostry, xBR "pluszowy". Male
  przedmioty (moneta 8x8) wychodza prawie jak nearest w kazdej metodzie - za malo pikseli.

**HUD i font:** [hud_font.png](img/hud_font.png) (caly HUD z cyframi i tekst ekranu konca
poziomu) i [hud_zblizenie.png](img/hud_zblizenie.png) (powiekszenie).

![HUD i font](img/hud_zblizenie.png)

- Font 8x9 (1 kolor + przezroczystosc) jest blokowy, wiec wszystkie metody daja czytelny tekst i
  roznice sa male: Scale2x i MMPX wygladzaja schodki ukosow (2, 7, ?, Y) i zostaja ostre; xBR i
  HQ2x dodatkowo zaokraglaja rogi i daja miekka krawedz alfa.
- Cyfry HUD 5x6 (z cieniowaniem): wszystkie metody prawie jak nearest, xBR lekko je zmiekcza.
- Ramka HUD (zrzut z emulatora, 32 kolory): HQ2x wyglada najczysciej (klejnoty kluczy robia sie
  okragle, pierscien kompasu rowny). Scale2x i MMPX zamieniaja 1-pikselowe odblaski na klejnotach w
  ukosne kreski (regula ukosu laczy pojedyncze piksele), a romby na pierscieniu w "strzalki".
  xBR rozmywa fioletowy wzor tla i lancuszek ramki.

**Assety 2x vs shader na gotowej klatce:** [assety_vs_shader.png](img/assety_vs_shader.png) i
[assety_vs_shader_zblizenie.png](img/assety_vs_shader_zblizenie.png) - ekran startowy zlozony z
assetow przeskalowanych offline vs cala klatka 320x211 przeskalowana na koncu (jak zrobilby to
shader). Czerwone = roznica wieksza niz 24 na kanal.

![assety vs shader](img/assety_vs_shader_zblizenie.png)

Roznice sa tylko na obrysach sprite'ow (w klatce sprite miesza sie z prawdziwym tlem zamiast z
przezroczystoscia) i na krawedziach krzakow / HUD. Na oko oba podejscia daja prawie to samo.

## 4. Liczby

Pelne tabele: [stats.md](stats.md) (generowane). Najwazniejsze:

| metoda | kolory: kafle | kolory: ekran start | kolory: gracz | kolory: obiekty | kolory: HUD dol | szwy: kafel osobno / atlas w calosci vs mapa | assety vs shader (piks. > 24) |
|---|---|---|---|---|---|---|---|
| oryginal 1x | 26 | 75 | 15 | 16 | 32 | - | - |
| nearest | 26 | 75 | 15 | 16 | 32 | - | - |
| scale2x | 26 | 75 | 15 | 16 | 32 | 0.4% / 0.4% | - |
| mmpx | 26 | 75 | 15 | 16 | 32 | 0.2% / 0.2% | 0.1% |
| xbr | 2061 | 1764 | 799 | 539 | 660 | 2.1% / 2.1% | 0.5% |
| hq2x | 840 | 1107 | 297 | 316 | 329 | 1.7% / 1.6% | 0.2% |
| xbr_pal | 26 | 75 | 15 | 16 | 32 | - | - |

- Metody kopiujace (nearest, Scale2x, MMPX) maja dokladnie tyle kolorow co oryginal: 26 w atlasie
  kafli, 15 u gracza. xBR robi z 26 kolorow ponad 2000, HQ2x ok. 800.
- Szwy: przy skalowaniu kafel po kaflu 0.2% pikseli (MMPX) do 2% (xBR) obszaru 3x2 ekranow
  (razem z niebem) rozni sie od poprawnego wyniku - przy xBR/HQ2x to widoczna siatka 16x16 na
  skalach. Skalowanie atlasu w calosci daje praktycznie te same liczby, czyli nie pomaga.
- Cala warstwa kafli mapy poziomu 1 w 2x (17280x1536) to 2 MB PNG (MMPX) do 5 MB (xBR) na palete;
  z dwiema paletami (nad / pod woda) 4-10 MB na poziom.
- Skalowanie w kontekscie zamienia 256 kafli w 3.7 tys. (MMPX) do 7.6 tys. (xBR) roznych blokow
  32x32 - atlas "kafli z kontekstem" nie ma sensu, lepiej juz cala mapa albo shader.

## 5. Mapa: kafle osobno czy w kontekscie

Skalery patrza na sasiadow (Scale2x +-1 px, xBR +-2 px, MMPX +-3 px). Kafel skalowany osobno nie
widzi sasiada z mapy, wiec na brzegach kafli wynik jest inny niz powinien (szew). Mozliwosci:

1. **Kafel po kaflu (atlas 512x512)** - najprostsze dla silnika (podmiana PNG), ale szwy. Dla
   MMPX/Scale2x szwy sa rzadkie i malo widoczne (pojedyncze piksele); dla xBR/HQ2x - siatka.
   Skalowanie calego atlasu jednym przebiegiem nie pomaga (sasiadami sa wtedy przypadkowe kafle z
   atlasu, roznic jest tyle samo), patrz kolumna "atlas jako 1 obraz".
2. **Cala mapa przeskalowana offline** - poprawnie, ale silnik musi rysowac warstwe z duzego obrazu
   (17280x1536 x 2 palety; trzeba pociac na strony np. 1024x1536) zamiast z kafli. Animowane lub
   zmieniane w trakcie gry kafle (jesli sa) trzeba by dorysowac osobno.
3. **Shader na klatce** - poprawnie z definicji, nic nie trzeba trzymac (rozdz. 6).

## 6. Opcja runtime: shader WebGL na gotowej klatce

Silnik rysuje jak dzis do niewidocznego canvasa 320x211, a co klatke: `texImage2D` z tego canvasa
(270 KB, pomijalne) i jeden prostokat z fragment shaderem skalujacym do canvasa WebGL 640x422
(albo od razu do rozmiaru okna).

Zalety:

- zero zmian w assetach, w eksporcie z emulatora i w logice; nowe poziomy i grafiki dzialaja od razu;
- brak szwow kafli i "brzegow sprite'ow" - skaler widzi cala klatke, tak jak gracz;
- metode mozna przelaczac klawiszem (nearest / MMPX / xBR / ewentualnie CRT) i porownywac na zywo;
- mozna isc dalej niz 2x: xBR/xBRZ "freescale" i ScaleFX (3x) dzialaja na pelny ekran;
- koszt GPU zaniedbywalny (67 tys. pikseli wejscia, 50 Hz);
- gotowe shadery: xBR-lv2 (1 przebieg, libretro, MIT), xBRZ-freescale (2 przebiegi), ScaleFX
  (5 przebiegow, 3x). MMPX jest czysto lokalny (5x5 + 4 piksele), wiec przenosi sie 1:1 na
  fragment shader w jednym przebiegu.

Wady:

- trzeba dopisac WebGL: kontekst, tekstura, shader, obsluga utraty kontekstu - ok. 100-150 linii
  plus sam shader (xBR-lv2 ok. 150 linii GLSL, MMPX ok. 100);
- HUD i font dostaja ten sam filtr co plansza (jesli to przeszkadza: HUD rysowac osobno w nearest
  albo drugim przebiegiem);
- wynik zalezy od tla: sprite na tle o podobnym kolorze moze sie z nim "zlac" (xBR traktuje kolory
  bliskie w YUV jak rowne), a obrys poruszajacego sie sprite'a moze sie minimalnie zmieniac z klatki
  na klatke, gdy przesuwa sie nad rozna tekstura (nie mierzone - do sprawdzenia w prototypie);
- w xBR/HQ2x tez powstaja nowe kolory (jesli zalezy nam na palecie - MMPX).

Wedlug pomiaru z rozdz. 4 shader na klatce i assety 2x roznia sie (wiecej niz 24 na kanal) tylko na
0.1% (MMPX) - 0.5% (xBR) pikseli ekranu.

## 7. Upscaling AI - koszt i ocena

Nie uruchamiany. Lokalnie jest `onnxruntime` 1.29 (CPU), `opencv` i karta RTX 4070 Ti SUPER,
ale brak modelu. Mozliwosci i koszt:

- `realesrgan-ncnn-vulkan` (gotowy program z modelami, Vulkan dziala na tej karcie): pobranie
  ok. 45 MB, bez instalacji; model `realesr-animevideov3` / `RealESRGAN_x4plus_anime_6B`;
- sam model ONNX (np. anime 6B, ok. 18 MB) przez juz zainstalowany `onnxruntime`; na CPU kilka
  sekund na ekran, z `onnxruntime-directml` albo `-gpu` (kolejne kilkadziesiat-kilkaset MB) ulamek
  sekundy;
- modele "pixel-art" z OpenModelDB (np. rodzina PixelPerfect) - te same wymagania, zwykle 4x.

Czego sie spodziewac na tych assetach:

- modele sa 4x - do 2x trzeba zmniejszac (dodatkowe rozmycie);
- brak kanalu alfa - przezroczystosc trzeba skalowac osobno i sklejac;
- tysiace nowych kolorow, dithering skal "zamalowany" na gladko (styl ilustracji anime);
- szwy kafli gorsze niz w xBR (siec patrzy na dziesiatki pikseli wokol);
- kazda klatka animacji przetwarzana osobno - szczegoly "plywaja" miedzy klatkami (migotanie);
- przy 8x8 (moneta) i 32x29 (gracz) model dopowiada szczegoly, ktorych nie bylo.

Wniosek: dla tej gry AI ma sens najwyzej jako podklad do recznego przerysowania wybranych grafik
(np. ekran tytulowy), nie jako automatyczny eksport. Probe moge zrobic po zgodzie na pobranie
ok. 45 MB (`realesrgan-ncnn-vulkan`).

## 8. Koszt wdrozenia assetow 2x w silniku

Dla wariantu "assety 2x offline" (shader z rozdz. 6 tego nie wymaga). Ponizej ogolny opis;
konkretna, przetestowana wersja z przelacznikiem HD / oryginal jest w rozdz. 9.

1. Nowy katalog `assets/hd/` z tymi samymi nazwami plikow (rozdz. 9). Metadane obiektow, gracza,
   aktorow i fontu (`cell`, `w`, `h`, `ax`, `ay`, prostokaty klatek) zostaja w pikselach logicznych.
2. Canvas `W*S x SH*S` ([index.html](../../game/index.html), [main.js:5](../../game/main.js:5)) i na poczatku `draw()`
   `cx.setTransform(S, 0, 0, S, 0, 0)` + `cx.imageSmoothingEnabled = false`. Dalej caly kod rysuje
   w jednostkach logicznych jak dzis (`translate`, `clip`, `fillRect` nieba, lustro wody, `scale(-1,1)`
   gracza dzialaja bez zmian).
3. Zrodlo kazdego `drawImage` x S: jeden pomocnik, np.
   `blit(img, sx, sy, sw, sh, dx, dy) => cx.drawImage(img, sx*S, sy*S, sw*S, sh*S, dx, dy, sw, sh)`,
   uzyty w `tiles()` ([main.js:291](../../game/main.js:291)), `objects()` ([main.js:311](../../game/main.js:311)),
   `player()` ([main.js:301](../../game/main.js:301)), `number()` ([main.js:325](../../game/main.js:325)),
   `text()` ([main.js:124](../../game/main.js:124)).
4. Wywolania 3-argumentowe (`drawImage(img, x, y)`) rysuja obraz w naturalnym rozmiarze, czyli przy
   transformacji x2 bylyby 4x za duze - trzeba podac rozmiar logiczny: HUD ([main.js:328](../../game/main.js:328))
   i pole zycia ([main.js:330](../../game/main.js:330)).
5. `fit()` ([main.js:9](../../game/main.js:9)) - mnoznik CSS liczyc od 640x422 (calkowity), zeby piksele 2x
   nie byly nierowne. Na ekranie 1080p wychodzi to samo 1280x844 co dzis.
6. Niebo: bez zmian; opcjonalnie gradient w polowie linii (paralaksa `camY/2` da sie wtedy rysowac
   dokladniej). Kamera zostaje w calych pikselach logicznych (przewijanie co 2 px fizyczne, jak w
   oryginale).
7. Eksport: skrypt wywolujacy `scalers.py` na kazdym PNG z `game/assets` (sprite'y - kazda komorka
   osobno z przezroczystym otoczeniem; kafle - patrz rozdz. 5; HUD i font - wybrana metoda).

Szacunek: 30-40 zmienionych linii w `main.js` + skrypt eksportu (~50 linii) - ok. pol dnia z
testami. Pamiec: atlasy 4x wieksze, razem ok. 1-2 MB PNG; wydajnosc canvas 2D bez znaczenia.
Wariant "cala mapa jako obraz" (rozdz. 5, pkt 2) dochodzi do tego zmiana `tiles()` na rysowanie
stron duzego obrazu i 4-10 MB PNG na poziom.

## 9. Przelacznik HD / oryginal w locie

Wymaganie: przelaczac w grze grafike HD i oryginalna bez przeladowania strony. **Da sie** - i to
mniejsza zmiana niz same assety 2x z rozdz. 8, bo logika gry juz jest w jednostkach 1x. Sprawdzone
na kopii gry z commita `af19c05` (poziomy 1 i 2) w przegladarce - szczegoly testu nizej.

### Uklad katalogow

```
game/assets/        oryginal 1x: wszystkie PNG + JSON + BIN (wspolrzedne logiczne)
game/assets/hd/     te same nazwy PNG w 2x; bez JSON i BIN
```

- JSON-y i mapy sa tylko w `assets/` i wspolne dla obu zestawow (komorki, kotwice, prostokaty
  klatek aktorow sa w pikselach logicznych).
- Skala zestawu wynika z rozmiaru obrazu: `s = szerokosc HD / szerokosc oryginalu` (tu 2). Nie
  trzeba nowego pola w JSON-ie; po podniesieniu `R` (rozmiar canvasa) do 3 zadzialalby tez zestaw 3x.
- Brak pliku w `hd/` - gra bierze oryginal. Grafiki mozna wiec wymieniac stopniowo (np. recznie
  poprawione pojedyncze pliki).
- Przykladowy zestaw: [hd/](hd/) - 22 pliki (poziomy 1 i 2, MMPX, 0.8 MB), generowany przez
  [export_hd.py](export_hd.py). Skopiowanie do `game/assets/hd/` wlacza go w grze. Inna metoda:
  `python work/upscale/export_hd.py hq2x`.

### Wybor zestawu

- `?gfx=hd` / `?gfx=org` w adresie, potem zapamietany wybor (`localStorage` `tnt.gfx`), domyslnie `org`;
- klawisz **G** przelacza i zapisuje wybor (tak jak L dla jezyka).

### Jak to dziala

- Canvas jest zawsze 640x422. Co klatke `cx.setTransform(2, 0, 0, 2, 0, 0)` - caly kod rysuje dalej
  w 320x211 (niebo, clip planszy, linia wody, lustro gracza bez zmian).
- Kazdy obraz ma skale zrodla `.s` (oryginal 1, HD 2). Jedna owijka `cx.drawImage` mnozy prostokat
  zrodla przez `.s` (wywolania 9-argumentowe), a `drawImage(obraz, x, y)` rysuje w rozmiarze logicznym
  (HUD, pole zycia). Owijka obejmuje tez `Actors.draw` w `actors.js` - ten plik sie nie zmienia.
- Oryginal (s = 1) na canvasie 640 przy `imageSmoothingEnabled = false` to nearest x2, czyli obraz
  piksel w piksel jak dzisiejsza gra powiekszona 2x. HD (s = 2) rysuje sie 1:1.
- `setGfx()` podmienia 16 obrazow w `L` (kafle, obiekty, aktorzy, gracz, miecz, HUD, cyfry, oba
  fonty). Pierwsze wczytanie HD jest asynchroniczne - w tym czasie gra rysuje stary zestaw - potem
  przelaczanie jest natychmiastowe (obrazy w pamieci). `startLevel()` po wczytaniu poziomu wola
  `setGfx(gfx)`, wiec wybor trwa po zmianie poziomu.
- Kolorowany font: kopia z `tint()` dziedziczy `.s`; kluczem pamieci podrecznej jest adres obrazu,
  wiec kopie HD i oryginalu sie nie mieszaja.

### Minimalne zmiany w `game/main.js`

Gotowy diff: [hd_switch.patch](hd_switch.patch) (42 linie +/-, naklada sie na `af19c05`:
`git apply work/upscale/hd_switch.patch`). Zawartosc:

1. po `const info`: `R = 2`, rozmiar canvasa, `imageSmoothingEnabled = false`, owijka `drawImage` (11 linii);
2. `img()` zapamietuje nazwe pliku (`i.file`);
3. `tint()`: `c.s = src.s`;
4. nowa sekcja obok jezykow: `gfx` z adresu / localStorage, `setGfx()`, klawisz G (~20 linii);
5. `startLevel()`: `await setGfx(gfx)` po `load()`;
6. petla klatki: `cx.setTransform(R, 0, 0, R, 0, 0)` przed `draw()` / `clearScreen()`.

Logika, fizyka, kamera, kolizje, `actors.js` i `index.html` (rozmiar canvasa ustawia JS) - bez zmian.

### Test (kopia gry w katalogu tymczasowym, lokalny serwer, przegladarka)

- `?gfx=org`: canvas 640x422, wszystkie 67 520 blokow 2x2 jednolite (= dokladnie oryginal x2);
- G: wszystkie 16 obrazow ma `s = 2`, ok. 3 tys. (poziom 1) / 5.6 tys. (poziom 2) blokow 2x2 ma
  szczegol HD; G jeszcze raz - z powrotem 0; wybor zapisany w localStorage i przywrocony po
  przeladowaniu bez parametru;
- zmiana poziomu w trybie HD (2 -> 1) - nowy poziom od razu w HD;
- usuniety jeden plik HD (`hud_top.png`) - ten element w oryginale, reszta HD, gra dziala;
- woda (druga paleta), aktorzy, HUD i font rysuja sie poprawnie; brak bledow w konsoli.

### Na co uwazac

- `fit()` liczy mnoznik CSS od 320x211. Przy nieparzystym mnozniku (np. 3: 960 px) canvas 640 jest
  powiekszany 1.5x - oryginal dalej rowny (2 px canvasa = 3 px ekranu), HD lekko nierowny. Jesli
  przeszkadza: w trybie HD brac parzysty mnoznik albo liczyc go od 640x422.
- Owijka zmienia `cx.drawImage` dla calego kodu: nowe wywolania podaja zrodlo w pikselach
  logicznych (jak dzis). Alternatywa bez owijki: pomocnik `blit()` w kazdym miejscu rysowania
  (6 miejsc w `main.js` i `Actors.draw`) - wiecej zmian, ten sam efekt.
- Nowy obraz dodany do `L` w przyszlosci trzeba dopisac do `pics()` - inaczej zostanie w oryginale
  (bezpieczny brak, nic sie nie psuje).
- Kafle HD w atlasie sa skalowane kafel po kaflu, wiec maja szwy z rozdz. 5 (przy MMPX 0.2% pikseli,
  praktycznie niewidoczne). Lepsze kafle wymagaja mapy skalowanej w kontekscie albo shadera.
- Trzeci tryb "shader" (rozdz. 6) moze dzialac obok: zestaw `org` rysowany do 320x211 i skalowany
  przez WebGL; G przechodziloby wtedy org -> hd -> shader.
- Opis klawisza G w pasku informacji trzeba dopisac do `lang/*.json` (`controls`).

## 10. Rekomendacja

| co | rekomendacja | dlaczego |
|---|---|---|
| ogolnie | **shader WebGL na gotowej klatce, domyslnie MMPX, przelaczany na xBR i nearest** | brak szwow, zero zmian w assetach, wybor stylu w locie |
| kafle (offline) | MMPX na calej mapie w kontekscie; kafel po kaflu tylko MMPX/Scale2x | trzyma palete i dithering; szwy przy MMPX 0.2% pikseli |
| sprite'y (offline) | MMPX (wierny pixel-art) albo HQ2x (gladszy, ale +300 kolorow) | xBR za mocno rozmywa twarze i drobne detale |
| HUD (ramka) | HQ2x (albo zostawic nearest) | HQ2x najczystszy; MMPX/Scale2x robia kreski z 1-pikselowych odblaskow |
| font i cyfry | MMPX albo nearest | font jest blokowy - zysk maly, MMPX wygladza schodki i zostaje ostry |
| AI | nie jako eksport; ewentualnie podklad do recznego przerysowania | alfa, paleta, szwy, migotanie animacji |
| przelacznik HD / org | `game/assets/hd/` z MMPX + `hd_switch.patch`; shader jako trzeci tryb pozniej | malo zmian, oryginal zostaje piksel w piksel |

Jesli chodzi o wyglad najblizszy Amidze w wyzszej rozdzielczosci - MMPX. Jesli o "nowoczesny,
gladki" - xBR jako tryb shadera do wlaczenia, nie jako jedyne assety.

## 11. Pliki

- [scalers.py](scalers.py) - skalery (nearest, Scale2x, MMPX, xBR, HQ2x przez ffmpeg, xBR + paleta)
  na tablicach numpy RGBA; `python work/upscale/scalers.py` uruchamia samosprawdzenie (Scale2x ==
  ffmpeg epx, xBR zgodny z ffmpeg xbr co do decyzji, metody kopiujace trzymaja palete).
- [make_comparisons.py](make_comparisons.py) - sklada ekrany jak gra i generuje `img/*.png` oraz
  `stats.md`; `python work/upscale/make_comparisons.py` (ok. 4 min, glownie statystyki calej mapy).
- [export_hd.py](export_hd.py) - zestaw grafik HD (te same nazwy co `game/assets/*.png`) do
  przelacznika z rozdz. 9; `python work/upscale/export_hd.py [metoda] [katalog]`, domyslnie MMPX do
  `work/upscale/hd/` (ok. 2 s).
- [hd_switch.patch](hd_switch.patch) - przelacznik HD / oryginal dla `game/main.js` (baza `af19c05`).
- Wymagania: Python 3, numpy, Pillow, ffmpeg w PATH (filtr `hqx`). Nic nie trzeba instalowac.
