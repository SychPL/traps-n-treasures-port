<!-- wygenerowane przez make_comparisons.py -->

| metoda | kolory: kafle | kolory: ekran start | kolory: gracz | kolory: obiekty | kolory: HUD dol | szwy: kafel osobno / atlas w calosci vs mapa | assety vs shader (piks. > 24) |
|---|---|---|---|---|---|---|---|
| oryginal 1x | 26 | 75 | 15 | 16 | 32 | - | - |
| nearest | 26 | 75 | 15 | 16 | 32 | - | - |
| scale2x | 26 | 75 | 15 | 16 | 32 | 0.4% / 0.4% | - |
| mmpx | 26 | 75 | 15 | 16 | 32 | 0.2% / 0.2% | 0.1% |
| xbr | 2061 | 1764 | 799 | 539 | 660 | 2.1% / 2.1% | 0.5% |
| hq2x | 840 | 1107 | 297 | 316 | 329 | 1.7% / 1.6% | 0.2% |
| xbr_pal | 26 | 75 | 15 | 16 | 32 | - | - |

| warstwa kafli calej mapy (nad woda) | rozmiar PNG | rozne bloki 16x16 / 32x32 | czas |
|---|---|---|---|
| 1x (8640x768) | 1022 KB | 256 | - |
| nearest 2x (17280x1536) | 1424 KB | 256 | 0.1 s |
| mmpx 2x (17280x1536) | 1968 KB | 3743 | 1.7 s |
| xbr 2x (17280x1536) | 5100 KB | 7594 | 36.2 s |
| hq2x 2x (17280x1536) | 4370 KB | 6183 | 3.7 s |

Rozne konteksty 3x3 kafli (kafel + 8 sasiadow) na mapie: 9560 (kafli uzytych: 255)

| atlas kafli 256 szt. | rozmiar PNG |
|---|---|
| 1x 256x256 | 48 KB |
| nearest 512x512 | 60 KB |
| mmpx 512x512 | 80 KB |
| xbr 512x512 | 242 KB |
| hq2x 512x512 | 192 KB |
