'use strict';
// Traps 'n Treasures - nowa wersja. Poziom 1 z oryginalnych danych + gracz z fizyka zmierzona
// w emulatorze (work/oracle.js). Wszystkie stale ruchu w cwiartkach piksela (Q), logika 50 Hz.
// ekran jak w oryginale: gorny pasek 12 linii, plansza 159 linii (linie Amigi 56-214), dolny panel 40 linii
const W = 320, H = 159, PFY = 12, SH = 211, TS = 16, STEP = 1000 / 50, Q = 4;
const cv = document.getElementById('c'), cx = cv.getContext('2d');
const info = document.getElementById('info');

// plotno ma rozmiar ekranu gry (320x211), na czas tytulu rozmiar obrazu tytulowego (352x289) - zawsze
// powiekszane calkowita wielokrotnoscia, piksel w piksel; na ekranie dotykowym (touch.js) wypelnia caly ekran.
// Szeroki ekran (opcja, domyslnie wlaczona na dotyku): plotno ma VW x 211 w proporcjach okna (do 512), plansza pokazuje
// wiecej poziomu w bok; HUD i menu zostaja 320 px na srodku (przesuniecie OX), kamera gry liczy jak oryginal - patrz viewX()
let VW = W, OX = 0, WIDE = null;
function fit() {
  const w = cv.width, h = cv.height, touch = document.documentElement.classList.contains('touch'), ih = innerHeight - (touch ? 0 : 40);
  if (WIDE === null) { try { WIDE = localStorage.getItem('tnt.wide'); } catch (e) {} WIDE = WIDE === null ? touch : WIDE === '1'; }
  VW = WIDE ? Math.min(512, Math.max(W, W + 2 * Math.floor((innerWidth * SH / ih - W) / 2))) : W; OX = (VW - W) / 2;
  const r = Math.min(innerWidth / w, ih / h), s = touch ? r : Math.max(1, Math.floor(r));
  cv.style.width = w * s + 'px'; cv.style.height = h * s + 'px';
}
function screenSize(w, h) { if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; cx.imageSmoothingEnabled = false; fit(); } }
addEventListener('resize', fit); fit();

// katalog assetow: game/assets (dane z wlasnych dyskietek - work/export_*.py, ekstraktor) albo pakiet demo game/assets-demo
// (wlasna grafika i poziom testowy, repozytorium publiczne) - gdy assets/ nie ma albo ?assets=demo
let ASSETS = 'assets/', BLOBS = null;
const ap = src => src.startsWith('assets/') ? BLOBS?.[src.slice(7)] || ASSETS + src.slice(7) : src;
// wybor katalogu: GET level1.json z kontrola tresci (serwer bez HEAD albo z odpowiedzia 200 na brakujacy plik); kazde
// wczytanie assetu czeka na wybor (dzwiek moze ruszyc pierwszym klawiszem wczesniej niz poziom)
const assetsReady = (new URLSearchParams(location.search).get('assets') === 'demo' ? Promise.resolve(false)
  : fetch('assets/level1.json').then(r => r.ok && r.json()).then(j => !!(j && j.w && j.attr), () => false)).then(async ok => {
    // pliki z wlasnych dyskietek (disks.js / extractor/) bez service workera (przegladarka bez niego, okno prywatne):
    // prosto z Cache Storage jako adresy blob
    if (!navigator.serviceWorker?.controller && window.caches && location.protocol.startsWith('http') && !window.Capacitor && new URLSearchParams(location.search).get('assets') !== 'demo') try {
      const c = await caches.open('tnt-assets-v1'), keys = await c.keys(), base = new URL('assets/', location.href).href;
      const stages = keys.some(k => k.url === base + 'level1.json');   // stage files (level*) only as a complete set
      for (const k of keys) if (k.url.startsWith(base) && (stages || !/^level[^/]*$/.test(k.url.slice(base.length)))) (BLOBS = BLOBS || {})[k.url.slice(base.length)] = URL.createObjectURL(await (await c.match(k)).blob());
    } catch (e) {}
    if (!ok) ASSETS = 'assets-demo/';
  });
const afetch = src => assetsReady.then(() => fetch(ap(src)));
const img = src => assetsReady.then(() => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = ap(src); }));
const json = src => afetch(src).then(r => r.json());

async function load(name) {
  const [meta, map, surface, water, pmeta, psurf, pwater, hudTop, hudBottom] = await Promise.all([
    json(`assets/${name}.json`),
    afetch(`assets/${name}.bin`).then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
    img(`assets/${name}_surface.png`), img(`assets/${name}_water.png`),
    json('assets/player.json'), img('assets/player_surface.png'), img('assets/player_water.png'),
    img('assets/hud_top.png'), img('assets/hud_bottom.png')]);
  const [hudTopVit, shopBg, shopKeeper, mapMarker, toolIcons, msgBox, msgFont, msgFontMap] = await Promise.all([img('assets/hud_top_vit.png'),
    img('assets/shop_bg.png'), json('assets/shop_keeper.json'), img('assets/map_marker.png'), img('assets/tool_icons.png'),
    img('assets/msgbox.png'), img('assets/msgfont.png'), json('assets/msgfont.json')]);
  const [hofLogo, storyText, storyBg, introStarbyte, introNightingale, storyTextPl] = await Promise.all([img('assets/hof_logo.png'),
    img('assets/story_text.png'), img('assets/story_bg.png'), img('assets/intro_starbyte.png'), img('assets/intro_nightingale.png'),
    img('assets/story_text_pl.png')]);
  const [treasureImg, treasureMap] = await Promise.all([img('assets/treasure.png'), json('assets/treasure.json')]);
  const [endingBg, endingDark, endingSky, ending] = await Promise.all([img('assets/ending_bg.png'), img('assets/ending_dark.png'),
    img('assets/ending_sky.png'), json('assets/ending.json')]);
  const [menuImg, menuIcons, passIcons, menu] = await Promise.all([img('assets/menu.png'), img('assets/menu_icons.png'),
    img('assets/pass_icons.png'), json('assets/menu.json')]);
  const [islandClean, mapAtlas, mapActors, shotsImg, gameoverImg, wSurf, wWater, wMeta] = await Promise.all([img('assets/island_clean.png'), img('assets/map_actors.png'),
    json('assets/map_actors.json'), img('assets/shots.png'), img('assets/gameover.png'),
    img('assets/weapons_surface.png'), img('assets/weapons_water.png'), json('assets/weapons.json')]);
  const weapons = {surface: wSurf, water: wWater, json: wMeta};
  const [compassImg, compass] = await Promise.all([img('assets/compass.png'), json('assets/compass.json')]);   // igla kompasu (work/export_compass.py)
  const [shopAtlas, shopFrames, titleImg, titleWide] = await Promise.all([img('assets/shop_items.png'), json('assets/shop_items.json'),
    img('assets/title.png'), img('assets/title_wide.png')]);
  const [digits, lifeEmpty, font, fontMap, fontExt, fontExtMap] = await Promise.all([img('assets/hud_digits.png'),
    img('assets/hud_life_empty.png'), img('assets/font.png'), json('assets/font.json'), img('assets/font_ext.png'), json('assets/font_ext.json')]);
  // obiekty poziomu (lista z gry); grafiki tylko dla typow juz wyciagnietych (work/export_objects.py)
  const objs = await json(`assets/${name}_objects.json`); objs.n0 = objs.objects.length;   // dalej dochodza przedmioty z dzbanow, kamieni
  [objs.surface, objs.water] = await Promise.all([img(`assets/${name}_objects_surface.png`), img(`assets/${name}_objects_water.png`)]);
  const [actors, asurf, awater, swS, swW] = await Promise.all([json(`assets/${name}_actors.json`), img(`assets/${name}_actors_surface.png`),
    img(`assets/${name}_actors_water.png`), img('assets/sword_surface.png'), img('assets/sword_water.png')]);
  // straznik wyjscia ($2F2E36) i ukryte kolce ($2F2F4E) to rekordy listy jak wrogowie: powstaja w oknie kamery tylko w swojej
  // sekcji obszaru ($2E35A4) i znikaja przy drzwiach / smierci ($2DDF6A)
  const GUARD = {'2f2e36': 0x2f2e38, '2f2f4e': 0x2f2f50};
  for (const o of objs.objects) if (GUARD[o.type]) { o.actor = 1; actors.actors.push({x: o.x, y: o.y, type: o.type, script: GUARD[o.type], sect: o.sect}); }
  Actors.load(actors);
  // kafle skrzyn, scian do wysadzenia i kruchych kamieni (w tej kolejnosci) gra naklada na mape z dysku (LEV!) przy
  // starcie etapu - mapa z ekstraktora ich nie ma, eksport ze zrzutu juz tak (wtedy bez zmian)
  for (const k of ['crates', 'bombwalls', 'brittle']) for (const e of (meta[k] && meta[k].list) || []) map[e.idx] = meta[k].tile;
  const rain = (actors.triggers || []).filter(t => t.kind === 'rain');
  return {...meta, rain, map, surface, water, hudTop, hudBottom, hudTopVit, shopBg, shopKeeper, mapMarker, toolIcons, msgBox, msgFont, msgFontMap, hofLogo, storyText, storyTextPl, storyBg, introStarbyte, introNightingale, treasureImg, treasureMap, endingBg, endingDark, endingSky, ending, menuImg, menuIcons, passIcons, menu, islandClean, mapAtlas, mapActors, shotsImg, gameoverImg, weapons, compassImg, compass, digits, lifeEmpty, font, fontMap, fontExt, fontExtMap, objs, shopAtlas, shopFrames, titleImg, titleWide,
    actors: {surface: asurf, water: awater, banks: actors.banks}, sword: {surface: swS, water: swW}, player: {...pmeta, surface: psurf, water: pwater}};
}

// --- atrybuty kafli (tablica z gry): b0 stoi sie na nim, b1 sciana, b2 sufit, b3 drabina, b15 smierc ---
const FLOOR = 1, WALL = 2, CEIL = 4, LADDER = 8, ENTRANCE = 0x10, ROPE_T = 0x20, ACTION = 0x40, DEADLY = 0x8000;   // ROPE_T: zawieszona lina (kafel 130, $2E9BC8), wspinaczka z klatkami liny (stan 6)
let L = null;
function attr(x, y) {
  if (x < 0 || x >= L.w * TS) return WALL | FLOOR | CEIL;
  if (y < 0 || y >= L.h * TS) return 0;
  return L.attr[L.map[(y >> 4) * L.w + (x >> 4)]];
}

// --- gracz: pomiary z emulatora (RESEARCH.md, "Fizyka gracza") ---
const P = {
  WALK: 8, SWIM: 4, ACC: 1,        // chod 2 px/kl., w wodzie 1 px/kl., przyspieszenie 1/4 px/kl.
  GRAV: 1, FALL: 16, JUMP: -16,    // skok -4 px/kl., co 4 klatki +1 px/kl., max 4 px/kl. (40 px wysokosci)
  CLIMB: 8,                        // drabina 2 px/kl. w gore i w dol (A4+$12 = -+2, $2E999A / $2E9BA6; emulator)
  HALF: 5, HEIGHT: 26, CRAWL_H: 15 // ramka kolizji z naglowka klatki (dx -5, dy -26; czolganie 14..18: -13..-15)
};
const pl = {x: 0, y: 0, fx: 0, fy: 0, vx: 0, vy: 0, face: 1, ground: false, water: false,
            climb: false, rope: false, anim: 0, frame: 58, fallB: 128, flip: false, idle: 2400, seq: null, hang: 0, wasWater: false, attack: 0, pose: 0, lockT: 0, crouch: false};
// miecz (emulator): FIRE = pchniecie ~8 klatek, bez powtarzania przy trzymaniu; dol = kucniecie, dol+FIRE = cios w kucki.
// klatki gracza: cios 1/30 (prawo/lewo), kucniecie 2/31, cios w kucki 3/32; sprite miecza 16x8 wzgledem stop:
// czas ciosu: obiekt ciosu $2E0B0C zyje $7E klatek (start i miecz 6, szabla 10, morgensztern 20) - tyle trwa poza ciosu
// (emulator, bron startowa: klatka 1 przez 6 klatek)
const ATTACK_T = {crooked_sword: 10, morning_star: 20};   // zycie obiektu ciosu $7E (sprite broni i trafienia)
// opoznienie skryptu ciosu gracza ($2EA908 d0, emulator): poza 2 kroki, postoj 1, koniec blokady kierunkow klatke pozniej
const ATTACK_D = {crooked_sword: 5, morning_star: 8};
const ATTACK = 6;
// sprite broni ($308EA2, work/export_weapons.py): klatki w prawo / w lewo co d klatek; polozenie = stopy gracza + przesuniecie
// z tabeli obslugi broni (+$C/+$E: stoi, kuca, w skoku; prawo / lewo) - kotwica klatki. Morgensztern: kula leci po
// sciezce $308A6A / $308A20 (dx na klatke) razem z obiektem ciosu
const WEAPON_GFX = {
  start: {R: [4], L: [5], d: 1, off: [[[24, -7], [-21, -7]], [[21, -2], [-17, -2]], [[19, 0], [-16, 0]]]},
  sword: {R: [34], L: [35], d: 1, off: [[[24, -7], [-21, -7]], [[21, -2], [-17, -2]], [[18, 0], [-16, 0]]]},
  crooked_sword: {R: [24, 25, 26, 27, 28], L: [29, 30, 31, 32, 33], d: 2, off: [[[24, 1], [-21, 1]], [[20, 6], [-17, 6]], [[19, 9], [-17, 9]]]},
  morning_star: {R: [13], L: [13], d: 1, off: [[[16, -4], [-14, -4]], [[14, 1], [-11, 1]], [[12, 3], [-11, 3]]],
    path: [0, 8, 8, 8, 8, 8, 4, 2, 2, 0, -2, -2, -4, -8, -8, -8, -8, -8]}};
function weaponGfx() {
  if (!(pl.attack > 0) || AMMO.has(game.weapon)) return null;
  const G = WEAPON_GFX[game.weapon] || WEAPON_GFX.start, R = pl.face > 0, e = (pl.attackN || ATTACK) - pl.attack, seq = R ? G.R : G.L;
  const f = L.weapons.json[seq[Math.min(seq.length - 1, Math.floor(e / G.d))]];
  if (!f) return null;
  const [ox, oy] = G.off[pl.crawl ? 2 : pl.crouch || pl.crouchSt || pl.stomp || !pl.ground ? 1 : 0][R ? 0 : 1];   // [2] = czolganie (stan 3)
  let px = 0; if (G.path) for (let i = 0; i <= Math.min(e, G.path.length - 1); i++) px += G.path[i];
  return {f, x: pl.x + ox + (R ? px : -px) - f[4], y: pl.y + oy - f[5]};
}

// --- zbieranie: wartosci zmierzone w emulatorze (punkty i zloto rosna o tyle samo) ---
// typ = adres opisu typu w pamieci gry (work/level_data.py): klejnot, moneta, worki ze zlotem
// wartosci z kodu gry: procedura dotkniecia przedmiotu wola $2E7304 z numerem $64+i -> tabela $2E84F2[i]
// (zloto i punkty): klejnot, moneta (2 typy), sakwy 25/50/75/100/150
const VALUE = {'2f266c': 5, '2f25c2': 10, '2f2626': 10, '2f26d0': 25, '2f271c': 50, '2f2768': 75, '2f27b4': 100, '2f2800': 150, '2f284c': 200};
const KEYS = {'2f29dc': 0, '2f28f8': 1, '2f2944': 2, '2f2990': 3};
// drzwi na klucz (niewidoczne obiekty $2F2ABC.., dotyk ustawia bit $30CD0A): kolor klucza; -1 = nie do otwarcia z tej strony
const KEYHOLE = {'2f2abc': 0, '2f2a60': 1, '2f2a8e': 2, '2f2aea': -1};   // klucze: zloty, zielony, niebieski, czerwony (HUD)
const POTION = '2f3134', MAP = '2f2594', TOOLS = new Set(), ROPE = '2f340e';   // mikstura +3 Life, kawalek mapy, narzedzia
// owoce z dzbanow ($2E742A...): rodzaj k = 1..8 -> witaminy +3k ($1311C), punkty $2E84F2[k-1], licznik owocow ($30B64E);
// zgnily ($2E73DA) zeruje witaminy. Dzban: los z 28 wpisow $2E84A2 (0 = zgnily). Kawalek mapy ($3096E8) - do 6 w HUD.
// Punkty kontrolne ($2E7B06, niewidoczne): miejsce odrodzenia po utracie zycia.
const FRUIT = {'2e7d92': 1, '2e7dcc': 2, '2e7e06': 3, '2e7e40': 4, '2e7e7a': 5, '2e7eb4': 6, '2e7eee': 7, '2e7f28': 8};
const FRUIT_PTS = [5, 10, 25, 50, 75, 100, 150, 200], ROTTEN = '2e7d1e', PIECE = '2f317a', CHECKPOINT = new Set(['2f2a3a']);   // $2F2A3A: dotyk $2E7B06 zapisuje punkt odrodzenia; $2F2A28 to niewidzialne kontrolery (deszcz itp.)
const POT_TABLE = [1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 0];
const POT_ITEM = [ROTTEN, ...Object.keys(FRUIT)];
const LOOT_TABLE = [...Array(39).fill(0), 1, 1, 1, 1, ...Array(10).fill(2), ...Array(8).fill(3), ...Array(6).fill(4), 5, 5, 5, 5, 10, 10, 10, 11, 11, 12, 0];
const LOOT_ITEM = [ROTTEN, ...Object.keys(FRUIT).slice(0, 8), '2f266c', '2f25c2', '2f26d0'];   // $2E84C2: zgnily, owoce, klejnot 5, moneta 10, sakwa 25
const POTS = new Set(['2f2898', '2f28ca']);                         // dzbany: 2 ciosy mieczem ($2E6990), wypada przedmiot
const gameNav = {};
const game = {navLatch: gameNav, score: 0, gold: 0, popups: [], life: 5, lives: 3, hurt: 0, frame: 0, crew: 0, tools: 0, keys: [0, 0, 0, 0], maps: 0, lit: {},
  vit: 0, vitShow: 0, fruits: 0, pieces: 0, checkpoint: null, tool: null, toolBob: {}, bombs: [],
  maxLife: 5, weapon: 'start', ammo: 0, inv: {}, shots: []};
// bron: sila trafienia (opisy w sklepie); kule i ognista kula to amunicja rzucana jako pocisk
// bron startowa to osobny rekord ($3098B8, tabela $2EA95C) - miecz ze sklepu ($2E4F32 -> $3098C6) da sie wiec kupic
// ($2E4F1A porownuje tabele obslugi); dzwiek ciosu z procedury broni: $2E9FD0 (33,12), $2EA0A4 (33,8), $2EA27A (60,20), $2EA514 (60,10)
// sila = $A0 obiektu ciosu z procedury broni: start $2E9FFC 1, miecz $2EA0D0 1, morgensztern $2EA2A6 2, szabla $2EA540 3,
// kule zelazne $2EA310 2, specjalne $2EA408 1, ognista $2EA1A0 10 (ogien 8)
const WEAPON = {start: 1, sword: 1, morning_star: 2, crooked_sword: 3, special_balls: 1, iron_balls: 2, fireball: 10};
const WEAPON_SFX = {start: 'sword', sword: 'sword2', morning_star: 'balls', crooked_sword: 'crooked'};
const AMMO = new Set(['special_balls', 'iron_balls', 'fireball']);
const FIRE_T = 52, FIRE_DX = [0, 1, 3, 5, 7, 9, 11, 12];   // ogien: 26 taktow ($2E0BB2), boczne plomienie 24
// pociski (takt 25 Hz): kula zelazna $2E1840 sciezka 15 krokow po 6 px w bok, potem oblok $2E176A; specjalna $2EA442
// odbija sie (fizyka $2EF5D0: vy -3, granica 8, 2 kroki) 6 px/takt, 3 odbicia; ognista $2EA1DA vy -4, 2 px/takt,
// do 75 taktow, po zetknieciu z podloga ogien $2E0B60 (sila 8). Sciana: kula zelazna konczy, inne zawracaja.
// start pocisku: tablica broni $30CD50 (16 B: procedura, animacja gracza, skrypt, dx, dy) - stojac / w kucki / drabina i lina
const SHOT_AT = {fireball: [[20, -17, -8], [20, -16, -2], [22, -20, -8]], balls: [[16, -17, -5], [14, -14, 0], [16, -17, -7]]};
const SHOT = {iron_balls: {max: 3, v: 3, t: 30}, special_balls: {max: 3, v: 3, t: 600, brain: [-3, 8, 2], bounces: 3},
  fireball: {max: 1, v: 2, t: 150, brain: [-4, 1, 1], perFrame: true}};   // ognista: obiekt gracza A4+$C, wolany co klatke ($2EA214)
// klatki z zaloga (typ 16666) i ksiazki/zwoje z tekstem (typ 16876) - adresy opisow typow w pamieci gry
const CAGE = '2f2fe2', BOOK = '2f31f2';
const countCrew = () => L.objs.objects.filter(o => o.type === CAGE && !o.taken).length;
// akcja FIRE ($2E6F5E, $2E7636): przy klatce (stopy gracza = dol klatki + 15) wiezien najpierw mowi (jesli ma
// tekst), potem zostaje uwolniony: +1000 pkt (tabela $2E84F2, pozycja 9), CREW - 1; ksiazke gracz zabiera i czyta
// --- blok '?' ($2F2530, platforma): uderzony glowa od dolu podskakuje (dzwiek $2E653C), po 35 taktach ($30CCD0, petla
// glowna co 2 klatki; w tym czasie bez skoku, $2E9818) pokoj premii ($2DEAF4): wiersze mapy 0-11 zamieniaja sie z 36-47,
// gracz w punkcie startu z tablicy +$76, kamera stoi w pokoju. Emulator (poziom 1, klatki od konca odliczania): swiat
// stoi, dzingiel 4, wygaszenie 16 klatek, w 128 pokoj, w 144 rozjasnianie 16 klatek (melodia 23), gra od 160. Generator
// (skrypt obszaru +0, $2EFF62 / $2EFFF4 / $2F0086) co 7 taktow: licznik 58 - 1, gdy > 8 przedmiot z wazonej tablicy
// w (x + rnd(176 / 256 / 64), 15); przy 0 ($30CC6F) koniec: dzingiel 22 przy stojacym swiecie (138 klatek), wygaszenie,
// w 156 powrot (przedmioty znikaja, $2DDF6A), w 173 rozjasnianie, gra od 189
const QBLOCK = '2f2530';
function swapBonusRows() {
  const n = 12 * L.w, off = 36 * L.w;
  for (let i = 0; i < n; i++) { const t = L.map[i]; L.map[i] = L.map[i + off]; L.map[i + off] = t; }
}
function qblockTick() {
  for (const o of L.objs.objects) {
    if (o.type !== QBLOCK || o.off) continue;
    if (o.bump > 0) o.bump--;
    // glowa gracza w spodzie bloku przy skoku w gore
    if (pl.vy < 0 && !game.bonusRun && Math.abs(pl.x - o.x) < 12 && pl.y - P.HEIGHT <= o.y + 1 && pl.y - P.HEIGHT >= o.y - 8) {
      pl.vy = 0; pl.y = o.y + P.HEIGHT + 2; o.bump = 8; Sfx.play('bonus');
      for (const s of [0x2e0d2c, 0x2e0db8, 0x2e0d72, 0x2e0dfe, 0x2e0e44]) Actors.spawnScript(s, o.x, o.y);   // iskry ($2E64E2)
      if (L.bonus && !game.bonusWait && !game.bonusRun) game.bonusWait = 69;
    }
    // stoi na bloku (platforma +$76 = $2000)
    if (pl.vy >= 0 && Math.abs(pl.x - o.x) < 13 && pl.y >= o.y - 16 && pl.y <= o.y - 15 + Math.max(1, pl.vy >> 2)) {
      pl.y = o.y - 16; pl.vy = 0; pl.fy = 0; pl.ground = true;
    }
  }
  if (game.bonusWait > 0 && --game.bonusWait === 0) {
    game.state = 'bonus'; game.bonusSeq = {t: 0, out: false, x: pl.x, y: pl.y, cx: cam.x, cy: cam.y, area: L.areaId};
    Music.jump(4, 23);
  }
  if (game.bonusRun && (game.frame & 1) === 0) bonusTick();
}
function bonusTick() {                                   // jeden takt aktorow pokoju: przedmioty, potem generator
  const R = game.bonusRun, G = L.bonus.gen;
  for (const o of R.items) if (!o.taken) rainFall(o);
  if (R.c > 0) { R.c--; return; }
  R.c = 6;
  if (--R.n > 8) {
    const type = L.bonus.items[Math.floor(Math.random() * L.bonus.items.length)], coin = type === '2f266c' || type === '2f25c2';
    const o = {x: G.x + Math.floor(Math.random() * G.w), y: G.y, type,   // $2F0118: dryf +-1, granica odbicia i dzwiek z opisu typu
      rain: {vy: 0, acc: 0, thr: G.y, vx: Math.random() < 0.5 ? -1 : 1, cap: coin ? 6 : 4, snd: coin ? 'clink' : 'sack'}};
    L.objs.objects.push(o); R.items.push(o); rainFall(o);
  } else if (R.n <= 0) { game.state = 'bonus'; game.bonusSeq = Object.assign(game.bonusSeq, {t: 0, out: true}); Music.jump(22, 11); }
}
// $2F0164: przedmiot z deszczu co takt - x + vx, dwa kroki grawitacji; podloga (przejscie kafla, $2F4D90) liczy sie dopiero
// ponizej progu (start: y pojawienia, po kazdym dotknieciu y + 48), wiec przedmiot odbija sie i spada przez kolejne
// podlogi; przy y >= 220 znika
function rainFall(o) {
  const b = o.rain; o.x += b.vx;
  for (let i = 0; i < 2; i++) {
    const vy = b.vy, ny = o.y + vy;
    if (attr(o.x, ny) & FLOOR && (ny & ~15) !== (o.y & ~15) && b.thr <= o.y) {
      b.thr = o.y + 48;
      const v = Math.min(vy, b.cap) - 1;
      if (v <= 0) { o.y = (ny & ~15) - 1; b.vy = 0; }
      else { b.vy = -v; b.acc = 0; o.y = ny & ~15; Sfx.play(b.snd); }
      break;
    }
    o.y = ny;
    if (b.acc <= 0) { b.acc = 4; if (b.vy < 5) b.vy++; }
    b.acc--;
  }
  if (o.y >= 220) o.taken = true;
}
function bonusStep() {                                   // stan 'bonus': swiat stoi (wejscie / wyjscie z pokoju)
  const S = game.bonusSeq, t = ++S.t, B = L.bonus;
  if (!S.out && t === 128) {                             // $2DEB86: wiersze, obszar pokoju, gracz, generator (dwa przebiegi)
    resetActors(true);
    swapBonusRows(); L.areas.bonus = {cam: B.cam, water: null, doors: []}; enterArea('bonus');
    Object.assign(pl, {x: B.x, y: B.y, vx: 0, vy: 0, fx: 0, fy: 0, climb: false, rope: false, lift: null, plat: null}); follow(true);
    // w petli pokoju nie ma aktorow z rekordow ($2E35A4) - obiekty poziomu z wierszy 0-11 nie istnieja, tylko deszcz
    game.bonusRun = {n: B.gen.n, c: 0, items: [], objs: L.objs.objects}; L.objs.objects = [];
    bonusTick(); bonusTick(); game.bonusRun.c = 3;   // emulator: drugi przedmiot 9 klatek po rozjasnieniu
  }
  if (S.out && t === 156) {                              // $2DED56: wiersze z powrotem, przedmioty znikaja, gracz i kamera jak przed
    L.objs.objects = game.bonusRun.objs; game.bonusRun = null; resetActors(true);
    swapBonusRows(); enterArea(S.area);
    Object.assign(pl, {x: S.x, y: S.y, vx: 0, vy: 0, fx: 0, fy: 0}); Object.assign(cam, {x: S.cx, y: S.cy, px: S.x, py: S.y});
  }
  if (t >= (S.out ? 189 : 160)) { game.state = null; pl.latch = pl.fireLatch = true; }
}
function bonusMask() {
  const S = game.bonusSeq, t = S.t;
  if (!S.out) palFade(t < 144 ? t : t - 144, t < 144);
  else if (t > 138) palFade(t < 173 ? t - 138 : t - 173, t < 173);
}

// --- narzedzia ze sklepu (T = uzyj, Tab = nastepne; HUD: pole TOOL): lupa ($2EA7B2: kafel z bitem $40 -> pulapka
// z listy L.traps albo nic), bomba ($2E4C4C: lont, wybuch odslania sciany L.bombwalls w oknie 5x5 po 25 taktach),
// mapa (widok okolicy w trybie foto, oddalony). Kazde uzycie zuzywa jedna sztuke ---
const TOOL_LIST = ['book', 'magnifier', 'bomb', 'map', 'rope'];
// przedmioty z gry dajace narzedzie o numerze ($309926 = rekord; level.json quest.items {typ: id}), uzywane w miejscach
// quest.spots ($2E47D8: id, prostokat, obszar, procedura); lina ($2EA718) rzucana po luku, zaczep z quest.ropes ($2ED1BC)
const TOOL_ICON = {book: 0, bomb: 1, rope: 2, magnifier: 3, map: 5, q3: 4, q4: 6, q11: 7, q5: 8, q6: 9, q7: 10, q9: 11, q10: 12,
  q13: 13, q12: 14, q14: 15, q8: 16};
function toolKeys() { return [...TOOL_LIST, ...Object.keys(game.inv).filter(k => k[0] === 'q')]; }
// opisy przy podniesieniu ($2E788C..$2E7AF2 -> $2E3E14 z $30CC26 = 4: poza triumfu $2F1AD4), teksty $2E852E..$2E866A
const QDESC = {
  7: "This charm seems to have a magic power...^I think, I've seen it somewhere before?!",
  5: "Heavens, this thing is heavy!^With this hammer you could easily smash a wall.",
  13: "A powder bag with the inscription \"Aipres\".^What may this be good for...?!",
  12: "The Snake-ring !!!",
  10: "An old file.^It's pretty worn out but can still be used.",
  14: "Old salad-oil^Heavens, this stuff stinks!"};
function giveQuest(id) {
  const k = 'q' + id;
  game.inv[k] = Math.min(99, (game.inv[k] || 0) + 1); game.tool = k; Sfx.play('item');   // $2E753E
  if (QDESC[id]) { message(QDESC[id]); game.msgPose = 58; }
}
function questPickups() {
  const Q = L.quest;
  if (!Q) return;
  for (const a of Actors.list) {
    const id = Q.items[a.type];
    if (!id || a.dead) continue;
    if (Math.abs(a.x - pl.x) < 14 && pl.y > a.y - 20 && pl.y - P.HEIGHT < a.y + 4) { giveQuest(id); a.dead = true; }
  }
}
// procedury miejsc ($2E47D8 wola procedure z rekordu miejsca)
const SPOT = {
  '2e4886': s => { s.idx.forEach((ix, i) => { L.map[ix] = s.tiles[i]; }); sparkTiles(s.idx); Music.jump(2); },   // blok kafli (bez dzwieku)
  '2f025a': () => {                                     // poziom 3, puchar: z gory wypada przedmiot 13 ($300F42) w obloku
    Music.jump(2); Actors.spawnScript(0x300f42, 4172, 456, '300f40', 'faller'); Actors.spawnScript(0x2e12c8, 4172, 456);
  },
  '2f02a2': () => {                                     // poziom 3, worek: z gracza wylatuje chmura $301010 (sciezka w lewo, klasa $4000)
    Sfx.play('puff'); Actors.spawnScript(0x301010, pl.x, pl.y - 16).kills = 9;
    pl.face = -1; pl.vx = 0; pl.wp = null;                            // $2F1942: gracz staje twarza w lewo (klatka 29), jak chmura
  },
  '2e48c4': s => { game.bell = {xs: [...s.xs], t: 20}; Sfx.play('bell'); },      // poziom 4, dzwon: spadaja kamienie
  '2f030c': () => {                                     // poziom 4, narzedzie 14: iskry i bajt $30CAF8 (tloki $2ECF84 ruszaja)
    Music.jump(2); Actors.spawnScript(0x2e1656, 8103, 525); Actors.spawnScript(0x2e16fe, 8103, 518); Actors.flags['30caf8'] = 1;
  },
};
function useQuest(k) {
  const id = +k.slice(1), s = (L.quest.spots || []).find(s => s.id === id && s.area === L.areaId &&
    pl.x >= s.rect[0] && pl.x <= s.rect[2] && pl.y >= s.rect[1] && pl.y <= s.rect[3] + 16);
  if (!s || !SPOT[s.handler]) { Sfx.play('locked'); return false; }
  SPOT[s.handler](s);
  return true;
}
// dzwon ($2E48F6): co 12 taktow kamien $308870 z kolejnego x listy, y = $190; ladowanie -> kafel $DF i wstrzas ($30B746)
const SHAKE = [-3, 1, -1, 3, -3, 1, -1, 3, -2, 2, -1, 1, -2, 2, -1, 1, -2, 2, -1, 1, -1, 1, -1, 1, 0];
function bellTick() {
  const B = game.bell;
  if (!B || --B.t > 0) return;
  B.t = 12;
  const x = B.xs.shift();
  if (x === undefined) game.bell = null; else Actors.spawnScript(0x308870, x, 400, 'stone', 'dropstone');
}
Actors.onStone = a => { L.map[((a.y - 8) >> 4) * L.w + (a.x >> 4)] = 0xdf; game.shake = SHAKE.slice(); Sfx.play('mech'); };
// $2E463A / $2E46B2: nowe kafle (lina, blok narzedzia) - na kazdym iskra $2E1656 / $2E16FE na przemian
function sparkTiles(idx) { idx.forEach((ix, i) => Actors.spawnScript(i & 1 ? 0x2e16fe : 0x2e1656, (ix % L.w) * TS + 8, Math.floor(ix / L.w) * TS + 16)); }
function throwPose() { if (!pl.attack && !(pl.pose > 0) && !(pl.lockT > 0)) { pl.pose = 6; pl.lockT = 10; } }   // $2EA908 (d0 = 3) jak cios bronia startowa; $2F3EFC: nie w trakcie innej animacji ($30CC63)
function throwRope() {                                  // $2EA718 (tabela $2EB05C): lina w luku od gracza (sciezka $2EB3DA / $2EB4A2)
  const r = pl.face > 0, a = Actors.spawnScript(r ? 0x2e1424 : 0x2e1446, pl.x + (r ? 17 : -16), pl.y);
  throwPose(); game.toolLock = 25;                      // $30CCE6: 25 klatek bez uzycia narzedzia
  Actors.startPath(a, r ? 0x2eb3da : 0x2eb4a2, 1, 1); Sfx.play('rope');
}
Actors.onRope = a => {                                  // trafienie w kolumne zaczepu: lina zwisa (kafle), zuzyta sztuka
  const Q = L.quest, ix = ((a.y - 8) >> 4) * L.w + (a.x >> 4);
  const e = Q && Q.ropes.find(e => !e.used && ix >= e.start && ix <= e.end && (ix - e.start) % L.w === 0);
  if (!e) return false;
  e.used = true; e.tiles.forEach((t, i) => { L.map[e.start + i * L.w] = t; });
  sparkTiles(e.tiles.map((t, i) => e.start + i * L.w));
  game.inv.rope = Math.max(0, (game.inv.rope || 0) - 1); if (!game.inv.rope) nextTool();
  Music.jump(21);                                       // $2ED230: zdarzenie 21, bez dzwieku
  return true;
};
function nextTool() {
  const have = toolKeys().filter(t => game.inv[t] > 0);
  if (!have.length) { game.tool = null; return; }
  game.tool = have[(have.indexOf(game.tool) + 1) % have.length];
}
function useTool() {
  if (game.toolLock > 0) return;                         // $2DF9B0: po rzucie liny ($30CCE6)
  pl.idle = 2400;                                       // $2DF9EC: licznik bezczynnosci $9DE6 = $960
  const t = game.tool;
  if (!t || !(game.inv[t] > 0)) { Sfx.play('locked'); return; }
  if (t[0] === 'q') { if (useQuest(t) && --game.inv[t] <= 0) nextTool(); return; }
  if (t === 'rope') { throwRope(); return; }            // zuzywana dopiero przy zaczepieniu
  if (t === 'book') {                                    // dziennik ($2DFA94): strona z tablicy $12F88; potem poprzednia (w grze kursory)
    message(game.pages[game.page]); game.page = (game.page + game.pages.length - 1) % game.pages.length; game.inv.book = game.page + 1;
    return;
  }
  if (t === 'magnifier') {
    // $2EA7B2: tylko kafel rak (x, y - 22, sonda $30B8DC) z bitem 6; bez niego lupa nie jest zuzywana
    const ix = ((pl.y - 6) >> 4) * L.w + (pl.x >> 4);
    if (!(attr(pl.x, pl.y - 22) & ACTION)) { message('Here is nothing to scrutinize.'); return; }
    message((L.traps || []).includes(ix - L.w) ? 'After having a closer look, this seems to be a nasty trap.' : 'Here is nothing unusual to be found.');
  } else if (t === 'bomb') {                            // $2EA576 (tabela jak bron $2EAF7C): jedna bomba naraz ($2EB22E)
    if (game.bombs.length) return;                       // lont trwa: nic, bez zuzycia
    const r = pl.face > 0, x = pl.x + (r ? 12 : -10), b = {x, y: pl.y - 4, t: 37, k: 0, base: (L.actors.banks['30cd58'] || 0) + 0x3b20, frame: 1,
      brain: {vy: 0, acc: 0, cap: 3, iter: 2, vx: 0}};
    // $2F4F5C: sciana przy krawedzi ramki (+-5) + 6 px, y - 1 -> na srodek kafla
    if (attr(x + (r ? 11 : -11), b.y - 1) & WALL) b.x = ((x + (r ? -8 : 8)) & ~15) + 8;
    else if (!pl.climb && !pl.rope) { b.brain.vx = r ? 2 : -2; b.brain.vy = -2; }      // $2EF4D6: rzut (nie z drabiny / liny)
    game.bombs.push(b); throwPose(); Sfx.play('bombthrow');            // pierwszy krok i lont w najblizszym takcie (jak petla gry)
  } else if (t === 'map') {                             // $2E384C: widok okolicy w polowie skali (mapView)
    game.state = 'mapview'; game.mapView = {t: 0, ph: 0, img: null}; Music.jump(4);
  }
  if (--game.inv[t] <= 0) nextTool();
}
// mapa (narzedzie, $2E384C, emulator poziom 1 przy starcie): swiat stoi, dzingiel 4, wygaszenie 16 klatek, potem widok
// $2E39F8 - 40 x 20 kafli od (x gracza & ~15) - 320, (y & ~15) - 160 w polowie skali (co drugi piksel i wiersz kafla),
// tylko kafle w granicach kamery obszaru (+32 .. +336 / +176), reszta czarna; tlo jak przy A4 = (0, 0), linia wody
// ($2E387E) w (woda - (y & ~15)) / 2 + 128 - 48 (min 16), ponizej paleta wody; mrugajacy ludzik $2F3036 (bank przedmiotow
// $4F06) w (210, 135) - sciezka co 3 takty: 6 krokow poza ekranem, 9 widoczny. Rozjasnianie 16 klatek, FIRE dopiero po
// dzinglu (126 klatek), wygaszenie, powrot (aktorzy od nowa, melodia 11 od razu) i rozjasnianie swiata 16 klatek
const MAP_JINGLE = 128;
// niebo widoku mapy: gradient copperlisty w polowie wysokosci (2 wiersze na kolor) konczy sie na linii wody; poziom 1 -
// tablica $30BF16 (po $59D: 20 kolorow do $E92, emulator); ponytail: inne poziomy - co drugi wiersz ich nieba z gry
const MAP_SKY_L1 = ['49c', '49b', '49a', '499', '599', '699', '698', '697', '696', '796', '896', '895', '995', 'a95', 'a94', 'b94', 'c94', 'c93', 'd93', 'e92']
  .map(v => '#' + [...v].map(c => c + c).join(''));
function halfAtlas(img) {
  if (img.half) return img.half;
  const w = img.width, h = img.height, c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = w; c.height = h; g.drawImage(img, 0, 0);
  const src = g.getImageData(0, 0, w, h).data, out = new ImageData(w >> 1, h >> 1), d = out.data;
  for (let y = 0; y < h >> 1; y++) for (let x = 0; x < w >> 1; x++) {
    const a = ((2 * y) * w + 2 * x + 1) * 4, b = (y * (w >> 1) + x) * 4;   // lsl #2 / roxl: nieparzyste piksele, parzyste wiersze
    d[b] = src[a]; d[b + 1] = src[a + 1]; d[b + 2] = src[a + 2]; d[b + 3] = src[a + 3];
  }
  const hc = document.createElement('canvas'); hc.width = w >> 1; hc.height = h >> 1; hc.getContext('2d').putImageData(out, 0, 0);
  return (img.half = hc);
}
function mapViewImage() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const a = L.areas && L.areas[L.areaId], [ax0, ay0, ax1, ay1] = a ? a.cam : [-1e9, -1e9, 1e9, 1e9];
  const x0 = (pl.x & ~15) - 320, y0 = (pl.y & ~15) - 160;
  const wl = L.waterY < 99999 ? Math.max(16, ((L.waterY - (pl.y & ~15)) >> 1) + 128) - 48 : 1e9;
  const sky = levelNo === 1 ? MAP_SKY_L1 : L.sky.filter((c, i) => !(i & 1)), g0 = Math.min(wl, H) - 2 * sky.length + 1;
  const hs = halfAtlas(L.surface), hw = halfAtlas(L.water);
  for (let j = 0; j < 20; j++) for (let i = 0; i < 40; i++) {
    const wx = x0 + 16 * i, wy = y0 + 16 * j, top = 8 * j;
    if (wx < 0 || wy < 0 || wx < ax0 + 32 || wy < ay0 + 32 || wx > ax1 + 336 || wy > ay1 + 176) continue;
    for (let r = 0; r < 8; r++) {
      const y = top + r, k = y - g0;
      g.fillStyle = y >= wl ? L.waterColor : k < 0 ? L.skyTop : sky[Math.min(k >> 1, sky.length - 1)];
      g.fillRect(8 * i, y, 8, 1);
    }
    const v = wx >> 4 < L.w && wy >> 4 < L.h ? L.map[(wy >> 4) * L.w + (wx >> 4)] : 0;
    if (!v) continue;
    const sx = (v & 15) * 8, sy = (v >> 4) * 8, split = Math.max(0, Math.min(8, wl - top));
    if (split > 0) g.drawImage(hs, sx, sy, 8, split, 8 * i, top, 8, split);
    if (split < 8) g.drawImage(hw, sx, sy + split, 8, 8 - split, 8 * i, top + split, 8, 8 - split);
  }
  if (wl < H) L.surfaceLine.forEach((col, k) => { g.fillStyle = col; g.fillRect(0, wl + k, W, 1); });
  return c;
}
// emulator (klatki od uzycia): wygaszenie do 16, czern do 56 (rysowanie widoku), rozjasnianie ok. 9 klatek, ludzik od 56
// (widoczny 2, potem 20 poza ekranem, dalej 27 / 18 - sciezka co 3 klatki), FIRE od 128 (koniec dzingla); po FIRE
// wygaszenie 16, swiat w FIRE + 16, rozjasnianie od FIRE + 34 przez 16 klatek
function mapViewStep(press) {
  const V = game.mapView, t = ++V.t;
  if (V.ph === 0 && t === 56) { V.img = mapViewImage(); V.ph = 1; V.t0 = t; }
  else if (V.ph === 1 && press && t >= MAP_JINGLE) { V.ph = 2; V.t0 = t; }
  else if (V.ph === 2 && t === V.t0 + 16) {             // $2E3930: powrot - aktorzy z rekordow od nowa, melodia 11
    V.ph = 3; V.t0 = t; resetActors(true); Music.tune(11, true);
  } else if (V.ph === 3 && t === V.t0 + 34) { game.state = null; game.mapView = null; pl.latch = pl.fireLatch = true; }
}
function mapViewDraw() {
  const V = game.mapView, k = V.t - (V.t0 || 0);
  if (V.ph === 0) { draw(); palFade(V.t, true); return; }
  if (V.ph === 3) { draw(); palFade(k - 18, false); return; }
  hud();
  cx.save(); cx.translate(0, PFY);
  cx.fillStyle = '#000'; cx.fillRect(-OX, 0, VW, H); cx.drawImage(V.img, 0, 0);
  const m = V.t - 56;                                    // ludzik $2F3036 (bank przedmiotow $4F06)
  if (m < 2 || m >= 22 && (m < 49 || (m - 49) % 45 >= 18)) {
    const f = Actors.bob({base: (L.actors.banks['30cd58'] || 0) + 0x4f06, frame: 0});
    if (f) cx.drawImage(L.actors.surface, f[0], f[1], f[2], f[3], 162 - f[4], 87 - f[5], f[2], f[3]);
  }
  cx.restore();
  palFade(V.ph === 1 ? Math.round(k * 16 / 9) : k, V.ph === 2);
}

// bomba co takt (emulator, poziom 2 przy scianie 512, 400): $2EF51C - fizyka $2EF5D0 (granica 3, 2 kroki), x + vx do sciany
// albo ladowania; lont 37 taktow ($2EB22E), w 38. wybuch $2E4C4C: dzwiek (45,1), wstrzas $30B746, aktor $2E1320 w y - 6,
// sciany do wysadzenia w oknie 5 x 5 kafli ($2E4CC8): licznik 20, odlamek $2E10F6 w srodku kafla (trzesie sie 20 taktow,
// potem spada, platforma $2000), pod kolumna gruz $2E1154 i dolna granica odlamkow kolumny ($5E); pierwszy dzwiek (51,0).
// $2E4DFE przez 25 taktow: licznik sciany <= 2 -> kafel spod (po 19 taktach), 0 -> sciana zuzyta
function bombFly(b) {                                    // vx do ladowania (0; odbicie -1 nie zatrzymuje) albo sciany przy krawedzi ramki
  const B = b.brain, r = Actors.physics(b);
  if (B.vx) { if (r === 0 || attr(b.x + (B.vx < 0 ? -5 : 5) + B.vx, b.y - 1) & WALL) B.vx = 0; else b.x += B.vx; }
}
function bombsTick() {
  if (game.frame & 1) return;
  if (game.bombWalls > 0) {                             // $2E4DFE: licznik <= 2 -> kafel spod (19 taktow po wybuchu), 0 -> zuzyta
    game.bombWalls--;
    for (const e of (L.bombwalls || {list: []}).list) {
      if (!e.timer) continue;
      if (e.timer <= 2) L.map[e.idx] = e.under;
      if (--e.timer === 0) e.used = true;
    }
  }
  for (const b of game.bombs) {
    b.k ^= 1; b.frame = b.k ? 0 : 1;
    if (b.t-- > 0) { bombFly(b); continue; }
    b.done = true;
    Sfx.play('bomb'); game.shake = SHAKE.slice();
    Actors.spawnScript(0x2e1320, b.x, b.y - 6);         // aktor wybuchu $2E1320 (+$78 = $8002: rani gracza)
    for (const q of Actors.boxes())                    // wrogowie w zasiegu wybuchu
      if (Math.abs(q.l + q.w / 2 - b.x) < 28 && Math.abs(q.t + q.h / 2 - (b.y - 8)) < 28 && Actors.hit(q.a, 10) && q.a.dying) Sfx.play(q.a.kill || 'kill');
    const cx0 = (b.x >> 4) - 2, cy0 = ((b.y - 6) >> 4) - 2, cols = {};
    let snd = false;
    for (const e of (L.bombwalls || {list: []}).list) {
      const ex = e.idx % L.w, ey = Math.floor(e.idx / L.w);
      if (e.used || L.map[e.idx] !== L.bombwalls.tile || ex < cx0 || ex >= cx0 + 5 || ey < cy0 || ey >= cy0 + 5) continue;
      e.timer = 20;
      const d = Actors.spawnScript(0x2e10f6, ex * TS + 8, ey * TS + 16);
      (cols[ex] = cols[ex] || []).push(d);
      if (!snd) { snd = true; Sfx.play('explode'); }
    }
    for (const list of Object.values(cols)) {           // $2E4DAA: gruz pod najnizszym kaflem kolumny, odlamki przyciete do niego
      const yb = Math.max(...list.map(d => d.y));
      Actors.spawnScript(0x2e1154, list[0].x, yb);
      for (const d of list) d.clipY = yb;
    }
    game.bombWalls = 25;
  }
  game.bombs = game.bombs.filter(b => !b.done);
}

// --- skrzynie (level.json crates, tablica poziomu +$18): FIRE przy skrzyni przed graczem podnosi ja ($2E9E74), gracz
// trzyma ja przed soba przy stopach (+17 / -14 px, $2E3C56), FIRE stawia na srodku kafla przed soba, jesli nie ma tam
// sciany ani sufitu ($2EA840); skrzynie bez podloza spadaja o kafel na takt ($2E3D58) ---
const carryX = () => pl.face > 0 ? 17 : -14;
function crateAhead() {
  const C = L.crates;
  if (!C || pl.climb || !pl.ground || !pl.push || !pl.crateBlock) return null;   // $2E9E62: tylko z kierunkiem (pchanie), nie w skoku; $2E9E5A: skrzynia zatrzymala ruch poprzedniej klatki ($9F1C, emulator 4x, L3)
  const x = pl.x + (pl.face > 0 ? 10 : -9), ix = (pl.y >> 4) * L.w + (x >> 4);   // ta sama sonda co sciana ($9DC8/$9DCA)
  return L.map[ix] === C.tile ? C.list.find(e => e.idx === ix) : null;
}
// niesienie tylko z wcisnietym FIRE: puszczenie stawia skrzynie ($2E8BDC -> $2EA840), przy scianie zostaje w rekach
function crateUse(release) {
  if (game.carry) {                                     // postaw
    const x = ((pl.x + carryX()) & ~15) + 8, y = pl.y - 1, ix = (y >> 4) * L.w + (x >> 4);
    if (attr(x, y) & (WALL | CEIL)) { if (!release) Sfx.play('locked'); return true; }
    const e = game.carry; game.carry = null;
    e.idx = ix; e.under = L.map[ix]; L.map[ix] = L.crates.tile; Sfx.play('put'); pl.crateBlock = false;
    const px = pl.x; pl.x = x > pl.x ? x - 18 : x + 16;   // $2EA8AC: gracz przy skrzyni (18 px przed srodkiem, 16 za)
    if (cam.px !== undefined) cam.px += pl.x - px;      // przestawienie gracza nie przewija kamery (tylko jego ruch)
    game.crateGhost = 3;                                // $9F10 = 4: chwile skrzynia nie jest jeszcze sciana (port odstawia klatke pozniej)
    return true;
  }
  const e = crateAhead();
  if (!e) return false;
  L.map[e.idx] = e.under; e.idx = 0; game.carry = e; Sfx.play('lift'); pl.crateBlock = false;
  pl.wallStand = 0; pl.pickT = game.frame % 2 ? 1 : 2;  // animacja stoi do nastepnego taktu petli ($9F0A), potem chod od poczatku (emulator 4x / A500)
  return true;
}
function cratesFall() {
  const C = L.crates;
  if (!C) return;
  for (const e of C.list) {
    const below = e.idx + L.w;
    if (!e.idx || below >= L.map.length || L.map[e.idx] !== C.tile || L.attr[L.map[below]] & FLOOR) continue;
    L.map[e.idx] = e.under; e.idx = below; e.under = L.map[below]; L.map[below] = C.tile;
  }
}

// wiezien ($2E6F5E): dotyk klatki przy y gracza = y klatki + 15 ustawia $30CC71; UP obraca gracza tylem ($2E95BE -> $2E98D6,
// $30CC8E), dopiero FIRE uwalnia ($2E9D12 -> $30CC72, jedna klatka na nacisniecie)
const cageAt = () => L.objs.objects.find(o => o.type === CAGE && !o.taken && !o.off && Math.abs(pl.x - o.x) <= 20 && Math.abs(pl.y - (o.y + 15)) <= 2);
function freeCage(o, A) {
  if (o.text && !o.spoke) { o.spoke = true; message(o.text); pl.atDoor = A; return true; }   // najpierw slowa wieznia, dalej tylem
  o.taken = true; game.crew = countCrew(); game.score += 1000; Sfx.play('free'); Actors.spawnScript(0x2e12c8, o.x, o.y);
  game.popups.push({x: o.x, y: pl.y - 26, v: 1000, k: 0});
  if (!game.crew) { Music.jump(24); message(tr('msg.men_free')); game.msgPose = 58; game.timer = L.escape * 50; }   // $2DD414/$2DD44A: ucieczka
  else if (cageAt()) pl.atDoor = A;                     // kolejny wiezien w tym samym miejscu: dalej tylem
  else pl.atDoor = Object.assign(A, {hold: 4});         // emulator: tylem jeszcze do 5. klatki od FIRE, potem postoj
  return true;
}
function action(up, landing0) {
  if (game.treasure) return false;
  if (crateUse()) return true;
  // drzwi: FIRE po obrocie do drzwi (UP, $2EB213) -> $2E9E38 -> $2DF3FA szuka kafla w tablicy drzwi (indeks lub indeks - 1);
  // $2EB213 / $2EB214 zyja tylko w klatce obslugi UP (koniec joysticka $2E8E9E je kasuje) - FIRE bez UP to cios
  // (emulator 4x, L3: tylem do zamka, puszczenie UP, FIRE)
  const ar = L.areas && L.areas[L.areaId], t = ((pl.y - 6) >> 4) * L.w + (pl.x >> 4);
  if (ar && (pl.ground || landing0) && (pl.atDoor || pl.doorNoTurn) && up) {
    const A = pl.atDoor || pl.doorNoTurn, back = pl.atDoor ? A : null; pl.atDoor = null;   // bez obrotu (UP z blokada) poza zostaje
    if (A.cage) { const c = cageAt(); return c ? freeCage(c, A) : true; }
    if (A.action) { actionCheck(); pl.atDoor = back; return true; }   // $2E9E4A ($2EB214): akcja na FIRE, gracz dalej tylem
    if (keyhole()) { pl.atDoor = back; return true; }
    const d = ar.doors.find(d => d.tile === t || d.tile + 1 === t);
    if (d) { enterDoor(d); pl.atDoor = back; }               // w klatce FIRE i przy wygaszaniu gracz zostaje tylem (emulator)
    return true;                                         // wejscie bez drzwi w tablicy: nic, bez ciosu ($2DF550)
  }
  return false;
}
// zamek ($2E9D54): tylko po obrocie tylem (UP, $2EB213) - bez obrotu FIRE przy zamku to zwykly cios (emulator 4x, L3)
function keyhole() {
  for (const o of L.objs.objects) {
    if (o.taken || o.off || Math.abs(pl.x - o.x) > 20) continue;
    const kh = KEYHOLE[o.type];
    if (kh !== undefined && Math.abs(pl.y - o.y) <= 24) {
      if (kh < 0) { message('The door cannot be opened from this side.'); return true; }   // $2E68EA
      if (!game.keys[kh]) { Sfx.play('locked'); return true; }
      game.keys[kh]--; o.taken = true; Sfx.play('mech');  // klucz otwiera drzwi 2x2 (kafle z tablicy poziomu +$68)
      const c = ((o.x + 2) >> 4) - 1, r = (o.y >> 4) - 1;
      L.keydoor.forEach((v, i) => { L.map[(r + (i >> 1)) * L.w + c + (i & 1)] = v; });
      return true;
    }
  }
  return false;
}
// okno komunikatu jak w grze ($2E3ED0): ramka 176x48 nad graczem, czcionka proporcjonalna (glif + 1 px, spacja 5 px),
// 4 linie co 10 px, szerokosc 160 px (ostatnia linia strony 150 - miejsce na strzalke), tekst pojawia sie litera po literze
const ACCENT = {'ą': 'ao', 'ć': 'ca', 'ę': 'eo', 'ł': 'ls', 'ń': 'na', 'ó': 'oa', 'ś': 'sa', 'ź': 'za', 'ż': 'zd',
  'Ą': 'Ao', 'Ć': 'Ca', 'Ę': 'Eo', 'Ł': 'Ls', 'Ń': 'Na', 'Ó': 'Oa', 'Ś': 'Sa', 'Ź': 'Za', 'Ż': 'Zd'};   // polskie: litera + znak
const glyph = ch => L.msgFontMap.glyphs[((ACCENT[ch] || ch)[0]).charCodeAt(0) - 0x21];
const glyphW = ch => ch === ' ' ? 5 : (glyph(ch) ? glyph(ch)[1] + 1 : 5);
// '^' konczy strone ($2E4048 -> $2E40CA: czekanie na FIRE), nie tylko wiersz (emulator 4x, rndbC4oc: tablica przy zejsciu)
function message(text) {
  const t = (LANG.texts && LANG.texts[text]) || text, width = s => [...s].reduce((n, c) => n + glyphW(c), 0);
  game.msgPages = [];
  for (const par of t.split('^')) {
    const lines = [], limit = () => lines.length % 4 === 3 ? 150 : 160;
    let line = '';
    for (const w of par.split(' ')) {
      const next = line ? line + ' ' + w : w;
      if (line && width(next) > limit()) { lines.push(line); line = w; } else line = next;
    }
    lines.push(line);
    for (let i = 0; i < lines.length; i += 4) game.msgPages.push(lines.slice(i, i + 4));
  }
  game.msgShown = 0; game.msgT = 0; game.msgPose = 0; game.msgAfter = 0; game.state = 'msg';
}
// przycisk: nastepna strona tekstu albo koniec (w trakcie pisania: cala strona)
// poza tylem do drzwi / kafla akcji biegnie dalej (skrypt w przerwaniu); po zamknieciu petla okienka ($2E411C) trwa jeszcze
// 2 klatki bez obslugi joysticka - ruch dopiero potem (emulator 4x, I4, rndbC4oc)
function msgInput(press) {
  pl.anim++; if (pl.atDoor) pl.frame = doorPose();
  if (game.msgAfter > 0) { if (--game.msgAfter <= 0) { game.msgPages = []; game.state = null; } return; }   // ramka jeszcze w klatce po FIRE
  if (press && game.msgShown < game.msgPages[0].join('').length) game.msgShown = 1e9;
  else if (press && game.msgPages.length > 1) { game.msgPages.shift(); game.msgShown = game.msgT = 0; }
  else if (press) { game.msgAfter = 2; pl.latch = pl.fireLatch = true; }
}
// napisy sklepu (emulator): odstep 6 px zamiast 5 jak w okienkach wiadomosci
const msgW = s => [...s].reduce((n, c) => n + (c === ' ' ? 6 : glyphW(c)), 0);
function msgStr(s, x, y) { for (const ch of s) { if (ch !== ' ') msgGlyph(ch, x, y); x += ch === ' ' ? 6 : glyphW(ch); } }
function msgGlyph(ch, x, y) {                            // y = linia bazowa (kotwica glifu)
  const g = glyph(ch), a = ACCENT[ch];
  if (!g) return;
  const [gx, w, h, ax, ay] = g, l = x - ax, t = y - ay;
  cx.drawImage(L.msgFont, gx, 0, w, h, l, t, w, h);
  if (!a) return;
  cx.fillStyle = '#fff';
  if (a[1] === 'a') { cx.fillRect(l + w - 2, t - 2, 1, 1); cx.fillRect(l + w - 1, t - 3, 1, 1); }      // kreska
  else if (a[1] === 'd') cx.fillRect(l + (w >> 1), t - 2, 1, 1);                                          // kropka
  else if (a[1] === 'o') { cx.fillRect(l + w - 2, t + h, 1, 1); cx.fillRect(l + w - 1, t + h + 1, 1, 1); } // ogonek
  else cx.fillRect(l + (w >> 1) - 1, t + (h >> 1), 3, 1);                                                 // l z kreska
}
function messageBox() {
  const page = game.msgPages[0], sx = pl.x - viewX() - OX, sy = pl.y - Math.round(cam.y);
  // $2E3E30: srodek ramki nad graczem w granicach ekranu; gracz wysoko -> ramka pod nim; dol ramki na wysokosci glowy
  const bx = Math.max(92 - OX, Math.min(W - 92 + OX, sx)), base = sy - 16 <= 111 ? sy + 88 : Math.min(sy, 156), top = PFY + base - 80;
  cx.drawImage(L.msgBox, bx - 88, top);
  const now = performance.now(); game.msgT = game.msgT || now;
  const before = game.msgShown;
  let n = game.msgShown = Math.max(game.msgShown, Math.min((now - game.msgT) / 20 | 0, page.join('').length));   // 50 liter/s
  if ((n >> 1) !== (before >> 1)) Sfx.play('tick');     // $2E42BC: tykniecie przy literach (co druga)
  page.forEach((line, i) => {
    let x = bx - 78;
    for (const ch of line) { if (n-- <= 0) return; if (ch !== ' ') msgGlyph(ch, x, top + 10 + 10 * i); x += glyphW(ch); }
  });
  if (game.msgShown >= page.join('').length) {          // strzalka 'dalej' (klatki 0/1 co 3 takty 25 Hz)
    const [gx, w, h, ax, ay] = L.msgFontMap.arrow[(performance.now() / 120 | 0) & 1];
    cx.drawImage(L.msgFont, gx, 0, w, h, bx + 74 - ax, top + 40 - ay, w, h);
  }
}

// --- wrogowie: skrypty i zachowania z oryginalu (game/actors.js), takt 25 Hz ---
// trampolina: gracz staje -> platforma zjezdza 5 px (1 px co 2 takty), czeka 10 taktow, wyrzuca gracza ($2EFC6C: profil
// dy na klatke z rekordu, 102-464 px) i wraca 5 px w gore naraz
function springs() {
  for (const a of Actors.list) {
    const S = a.spring;
    if (!S || a.dead) continue;
    S.t++;
    if (S.t <= 20) { if (S.t % 4 === 0) { a.y++; if (pl.plat && pl.plat.a === a) pl.y++; } continue; }
    if (S.t < 40) continue;
    if (pl.plat && pl.plat.a === a) {
      pl.y -= 5; pl.vy = 0; pl.fy = 0; pl.ground = false; pl.plat = null; pl.latch = true; Sfx.play('spring');
      if (a.lift) { pl.lift = a.lift; pl.liftI = 0; } else pl.vy = -6 * 4;
      pl.jump = true; pl.fallB = 128;                    // $2EFCA4: wyrzut jak skok ($30CC54), zapas $80 ($2F4904)
    }
    a.y -= 5; a.spring = null;
  }
}
// straznik wyjscia ($2F2E36, jeden na poziom): obiekt z listy chodzi tam i z powrotem jako aktor ($2F2E68), rani gracza
// ekran ciemnosci: oczy gracza $2E1890 (x, y-6) i oczy w mroku $2E18B4/$2E19E8/$2E194E (miejsca wzgledem kamery)
const DARK_EYES = [[0x2e18b4, 48, 72], [0x2e19e8, 256, 136], [0x2e19e8, 112, 40], [0x2e18b4, 288, 56], [0x2e194e, 160, 88]];
// ciemnosc ($2DDDC4, emulator poziom 2, drzwi 17493; klatki od wygaszenia przed drzwiami): w 17 ekran czarny i aktorzy
// usunieci, dzwiek (54,8) w polowie czekania (~46 klatek pozniej), w 61 oczy; potem FIRE = wyjscie bez wejscia, SPACJA
// (uzycie narzedzia, $2DF9F4) tylko przy wybranej lampie zuzywa ja i otwiera obszar (inne narzedzie: dzwiek (28,32));
// kursory zmieniaja narzedzie. Wyjscie: wygaszenie 16 klatek, potem jak po drzwiach (czern i rozjasnianie) - przed
// drzwiami albo w obszarze; bez komunikatow
const DARK_EYES_T = 61;
// $2DDF6A (drzwi, sklep, mapa, ciemnosc, pokoj premii): aktorzy i pociski znikaja, flaga deszczu $30CC9F skasowana
// (melodia 11 od razu); $2DDFF2 (smierc) - bez flagi: generator znika, ale nowy nie powstanie az do drzwi
function resetActors(door) {
  Actors.reset(door); game.shots = []; game.rainGen = null;
  if (L.objs) for (const o of L.objs.objects) o.live = o.hold = false;
  if (door && game.rainFlag) { game.rainFlag = false; Music.tune(11, true); }
}
function openDark(d) { game.dark = {d, t: 0}; game.state = 'dark'; resetActors(true); }
function darkInput(press, k1) {
  const D = game.dark, t = ++D.t;
  if (t === 46) Sfx.play('dark');
  if (t === DARK_EYES_T) {
    Actors.spawnScript(0x2e1890, pl.x, pl.y - 6, 'seye').eye = true;
    for (const [sc, x, y] of DARK_EYES) Actors.spawnScript(sc, Math.round(cam.x) + x, Math.round(cam.y) + y, 'seye').eye = true;
  }
  if (t < DARK_EYES_T) return;
  if (game.frame++ % 2 === 0) Actors.tick(cam.x + W / 2, cam.y + H / 2, a => a.eye);
  if (press || k1('Escape')) darkLeave(false);
}
function darkUse() {
  const D = game.dark;
  if (!D || D.t < DARK_EYES_T || game.pfFade) return;
  if (game.tool !== 'q3' || !(game.inv.q3 > 0)) { Sfx.play('locked'); return; }
  if (!--game.inv.q3) nextTool();
  game.lit[D.d.area] = 1; darkLeave(true);               // $2DF51E: obszar zostaje oswietlony
}
function darkLeave(lit) {
  const d = game.dark.d;
  pfFade(true, () => {
    game.dark = null; resetActors(true); pl.latch = pl.fireLatch = pl.doorLatch = true;
    if (lit) { d.go = true; doorGo(d); }
    else { game.state = 'reveal'; game.revealT = 41; game.revealDoor = 'area'; }
  });
}
function darkScreen() {
  hud();
  cx.save(); cx.beginPath(); cx.rect(-OX, PFY, VW, H); cx.clip(); cx.translate(-OX, PFY);
  cx.fillStyle = '#000'; cx.fillRect(0, 0, VW, H);
  Actors.draw(cx, L.actors.surface, viewX(), Math.round(cam.y), VW, H, a => a.eye);
  cx.restore();
}
// emitery kropli ($2EF8A8, level<n>_objects.json emit): licznik 0 -> kropla $2E0FC0 w (x+dx, y+dy), licznik = okres;
// warunek: bajt dzwigni != enot ($2EF880/$2EF894), gracz w 100 px ($2EF8B6); tylko w poblizu kamery
// emitery kropli ($2EF8A8 / $2EF8B6, warianty z bajtem $2EFAFA..): rekordy jak wrogowie - powstaja w fazie 1 w oknie kamery
// (A4 -50..+466 / -50..+306, sekcja obszaru), znikaja w fazie 3 poza oknem -83..+499 / +339 ($2F039A = $2E3694) i wracaja
// po wyjsciu punktu z okna; liczniki sa w danych poziomu, wiec przetrwaja znikniecie
function emitterRecs(ph, ax, ay) {
  for (const o of L.objs.objects) {
    if (!o.emit || o.off) continue;
    if (ph === 1 && !o.live) {
      if (o.x < ax - 50 || o.x > ax + 466 || o.y < ay - 50 || o.y > ay + 306) o.hold = false; else if (!o.hold) o.live = true;
    } else if (ph === 3 && o.live && (o.x < ax - 83 || o.x > ax + 499 || o.y < ay - 83 || o.y > ay + 339)) { o.live = false; o.hold = true; }
  }
}
function emitters() {
  for (const o of L.objs.objects) {
    if (!o.emit || o.off || !o.live) continue;
    if (o.eflag && (game.flags[o.eflag] | 0) === o.enot) continue;
    if (o.enear && Math.abs(o.x - pl.x) > 100) continue;
    o.cnt = o.cnt || o.emit.map(e => e[3]);
    o.emit.forEach((e, i) => { if (o.cnt[i] <= 0) { o.cnt[i] = e[2]; Actors.kid(0x2e0fc0, o.x + e[0], o.y + e[1]); } else o.cnt[i]--; });
  }
}
// kompas ($308FF4, co takt): po podniesieniu mapy ($2E7684) 30 taktow wirowania, potem igla w strone celu obszaru
// (+$16/+$18): poza pasem +-32 px w poziomie / pionie - jeden z 8 kierunkow (tablica $309DDE)
const COMPASS_DIR = [0, 0, 4, 6, 7, 5, 2, 1, 3];
function compassTick() {
  if (!game.compass) return;
  if (game.compassSpin > 0) { game.compassSpin--; game.compassF = ((game.compassF || 0) + 1) & 7; return; }
  const A = L.areas && L.areas[L.areaId], t = A && A.target;
  if (!t) return;
  const xi = pl.x > t[0] + 32 ? 1 : pl.x < t[0] - 32 ? 2 : 0, yi = pl.y > t[1] + 32 ? 1 : pl.y < t[1] - 32 ? 2 : 0;
  game.compassF = COMPASS_DIR[xi * 3 + yi];
}
// generator deszczu ($2EB970, poziom 4; emulator: kropla co 10 klatek): rekord jak wrogowie - w fazie 1, gdy wejdzie w okno
// kamery w swojej sekcji; pierwszy ustawia $30CC9F (melodia 25 od razu), potem co 5 taktow kropla $307FEC / $307FAA (rnd 2)
// w (A4 x + 32 + rnd(340), A4 y + 32), +-64 gdy kamera ruszyla w prawo / lewo; kolejne przy ustawionej fladze znikaja
function rainTick(ph, ax, ay) {
  if (ph === 1 && !game.rainGen && !game.rainFlag && L.rain) {
    const sect = L.areas && L.areas[L.areaId] && L.areas[L.areaId].sect;
    if (L.rain.some(g => (!g.sect || !sect || g.sect === sect) && g.x >= ax - 50 && g.x <= ax + 466 && g.y >= ay - 50 && g.y <= ay + 306)) {
      game.rainFlag = true; game.rainGen = {c: 0, lx: ax}; Music.tune(25, true);
    }
  }
  const G = game.rainGen;
  if (!G) return;
  if (G.c > 0) { G.c--; return; }
  G.c = 4;
  let x = ax + 32 + Math.floor(Math.random() * 340);
  if (ax > G.lx) x += 64; else if (ax < G.lx) x -= 64;
  G.lx = ax;
  Actors.kid(Math.random() < 0.5 ? 0x307fec : 0x307faa, x, ay + 32);   // dziecko kontrolera: dziala juz w tym przebiegu
}
function enemies25() {
  if (game.loopHold > 0) { game.loopHold--; return; }
  if (game.frame++ % 2) return;
  // petla gry ($2DD686, 25 Hz jak aktorzy) liczy faze $5D(A4) 5..0: w fazie 1 aktorzy z rekordow w oknie ($2E35A4), w fazie 3
  // znikaja aktorzy z $2E3694 poza oknem - co 12 klatek (emulator: krab poziomu 1 powstaje w klatce 100, nie 94)
  // petla glowna biegnie po przerwaniu, ktore juz przesunelo kamere za graczem: A4 z kamery po ruchu tej klatki (port
  // przesuwa kamere dopiero po update - podglad na kopii; emulator: krab poziomu 1 powstaje takt wczesniej)
  const cv = {x: cam.x, y: cam.y, px: cam.px, py: cam.py}; follow(false, cv);
  const ph = game.phase ?? 5, ax = Math.round(cv.x) - 48, ay = Math.round(cv.y) - 48;
  Actors.a4 = [ax, ay];                                  // kontrolery z krawedzi ekranu ($2EDF6E, $2EC5A0) czytaja A4 juz przy powstaniu
  if (ph === 1) Actors.recTick(ax, ay); else if (ph === 3 || ph === 4) Actors.despawnTick(ax, ay, ph);
  emitterRecs(ph, ax, ay);
  rainTick(ph, ax, ay);
  game.phase = ph ? ph - 1 : 5;
  compassTick();
  Actors.escape = game.timer > 0;
  emitters();
  Actors.tick(cv.x + W / 2, cv.y + H / 2);
  bellTick();
  chestsTick();
  const bx = Actors.boxes();                             // chmura z worka: trafia wrogow, ktorych dotknie (prostokaty klatek)
  for (const k of bx) if (k.a.kills && !k.a.dead)
    for (const b of bx) if (b.a !== k.a && k.l < b.l + b.w && b.l < k.l + k.w && k.t < b.t + b.h && b.t < k.t + k.h && Actors.hit(b.a, k.a.kills) && b.a.dying) Sfx.play(b.a.kill || 'kill');
  for (const o of L.objs.objects) {                     // owoce z dzbanow: skok z odbiciami ($2EF5D0), potem mrugaja i znikaja
    if (o.taken || (!o.life && !o.brain)) continue;
    if (o.brain) {
      const b = o.brain, r = Actors.physics(o);
      if (r < 0 && b.clink) Sfx.play(b.clink === true ? 'clink' : b.clink);
      if (r <= 0) b.vx = 0;                              // $2EBEFE: dryf w bok do pierwszego dotkniecia podlogi
      if (b.vx) { if (attr(o.x + 6 * b.vx, o.y - 4) & WALL) b.vx = -b.vx; o.x += b.vx; }
      if (r === 0) o.brain = null;
    }
    if (o.life && --o.life <= 0) o.taken = true;
  }
  // wyzwalacze: podmiana kafli mapy ($2E472A: nowe wartosci bajtow mapy pod indeksami, np. ukryte przejscia)
  Actors.triggerTick(pl.x, pl.y, (idx, vals) => { idx.forEach((ix, i) => { L.map[ix] = vals[i]; }); Sfx.play('mech'); });
}
function hits() {
  if (game.life <= 0) {                                 // $2E67B2: smierc - animacja, potem FIRE (deathStep)
    Sfx.play('die'); Music.jump(6, levelNo === 4 ? 25 : 11);   // $2E67E2: dzingiel 6, potem utwor poziomu ($2DD14C)
    game.dying = {t: 0, water: pl.y > L.waterY + 2, x0: pl.x, lift: 0, fy: 0, wait: 0};
    Object.assign(pl, {attack: 0, pose: 0, lockT: 0, vx: 0, vy: 0, climb: false, rope: false, lift: null, crouch: false, crawl: false, chute: 0, wp: null}); pl.surf = false; game.hurt = 0;
    return;
  }
  if (game.hurt > 0) { game.hurt--; return; }
  // ramka kolizji gracza z naglowka biezacej klatki (kucniecie: 13 px zamiast 26 - kule przelatuja gora)
  // ramki z naglowkow klatek gracza i aktora ($2E662E: pusta ramka, y1 = y2, nie zderza sie)
  const box = playerBox();
  if (box[1] === box[3]) return;
  for (const {a, l, t, w, h} of Actors.boxes()) {
    if (!(a.f[0x78] & 0x8000) || a.stun) continue;    // $78 bit 15: aktor rani gracza; swiezo trafiony ($4C bit 12, $2E6654) nie
    if (pl.x + box[2] <= l || pl.x + box[0] >= l + w || pl.y + box[3] <= t || pl.y + box[1] >= t + h) continue;
    // $2E666A: obrazenia z $A0 (klasa bit 7), z rekordu +$18 (bajt opisu typu) albo 1; 0 = Life do zera ($308FA6: dbra od -1)
    const n = a.f[0x78] & 0x80 ? a.f[0xa0] ?? 1 : a.rec !== undefined ? a.hurt ?? 1 : 1;
    game.life = n > 0 ? Math.max(0, game.life - n) : 0; game.hurt = 80;   // $30CCD8 = $50 klatek nietykalnosci
    if (game.life < 3) Sfx.play('die');                // $2E66AE: przy malym Life dodatkowy dzwiek (29,43)
    Sfx.play('hurt'); pl.stomp = false;                // $2E66D0; $2E6738: koniec ciosu w dol
    // $2E6714: na ziemi (nie w wodzie, na drabinie/linie, w czolganiu) podskok z profilu $2F1E98
    if (game.life > 0 && pl.ground && !pl.water && !pl.climb && !pl.crawl) { pl.lift = BOUNCE; pl.liftI = 0; pl.ground = false; pl.plat = null; pl.jump = false; }
    break;
  }
}
// --- tekst fontem gry (8x9), kolorowany; podkolorowane kopie fontu w pamieci podrecznej ---
// znaki narodowe: font_ext.png (8x12, 2 wiersze nad komorka, 1 pod; work/make_font_ext.py)
const tinted = {};
function tint(src, color) {
  const key = src.src + color;
  if (!tinted[key]) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); tinted[key] = c;
  }
  return tinted[key];
}
function text(str, x, y, color = '#fff', adv = 8) {
  for (const ch of str.toUpperCase()) {
    const i = L.fontMap[ch], e = L.fontExtMap[ch];
    if (i !== undefined) cx.drawImage(tint(L.font, color), i % 16 * 8, Math.floor(i / 16) * 9, 8, 9, x, y, 8, 9);
    else if (e !== undefined) cx.drawImage(tint(L.fontExt, color), e * 8, 0, 8, 12, x, y - 2, 8, 12);
    x += adv;
  }
}
const center = (str, y, color) => text(str, (W - str.length * 8) >> 1, y, color);

// --- muzyka: moduly OctaMED z dyskow gry (work/export_music.py) przez libopenmpt (game/lib/chiptune3, AudioWorklet);
// start po pierwszym klawiszu (przegladarki blokuja dzwiek bez gestu), M = wycisz (zapamietane)
const setting = (key, def) => { try { const v = localStorage.getItem('tnt.' + key); return v === null ? def : +v; } catch (e) { return def; } };
const save = (key, v) => { try { localStorage.setItem('tnt.' + key, v); } catch (e) {} };
const Music = {
  player: null, track: null, playing: null, vol: setting('music', setting('mute', 0) ? 0 : 10), last: 10,   // glosnosc 0-10
  init() {
    if (this.player || this.loading) return;
    this.loading = true;
    import('./lib/chiptune3/chiptune3.js').then(m => {
      this.player = new m.ChiptuneJsPlayer({repeatCount: -1});
      this.player.onInitialized(() => { this.setVol(this.vol); this.ready = true; this.sync(); Sfx.load(levelNo).catch(() => {}); this.loadJingles(levelNo).catch(() => {}); });
    }).catch(e => console.warn('muzyka:', e));
  },
  play(name) { this.track = name; this.sync(); },
  sync() {
    if (!this.ready || this.playing === this.track) return;
    const name = this.playing = this.track;
    this.stopJingle(); clearTimeout(this.fadeT); this.setVol(this.vol);
    if (!name) { this.player.stop(); return; }
    // utwor poziomu: L4 zaczyna melodia 25 ($2DD142, flaga $30CC9F z punktow kontrolnych), reszta 11 (pozycja 0 -> skok na 18)
    const start = name === 'level' + levelNo ? this.pos(levelNo === 4 ? 25 : 11) : 0;
    afetch(`assets/music/${name}.med`).then(r => r.arrayBuffer()).then(ab => {
      if (this.playing !== name) return;
      this.player.play(ab); this.player.unpause(); if (start) this.player.setOrderRow(start, 0);
    }).catch(e => console.warn('muzyka:', e));
  },
  setVol(v) {
    this.vol = Math.max(0, Math.min(10, v)); if (this.vol) this.last = this.vol; save('music', this.vol);
    if (this.player) { this.player.gain.gain.cancelScheduledValues(0); this.player.setVol(2.5 * this.vol / 10); }
    if (this.jgain) this.jgain.gain.value = 2.5 * this.vol / 10;
  },
  toggle() { this.setVol(this.vol ? 0 : this.last); },
  // Tablica zdarzen poziomu (+$34, $2E2348) sluzy dwojako:
  // - dzingiel ($2E22BE -> $2E22D6): wartosc = numer BLOKU; gra raz, potem powrot do zapamietanego bloku i wiersza
  //   ($2E2FB0), kolejne zdarzenie w trakcie jest pomijane. Bloki dzingli nie leza na liscie pozycji, wiec kazdy jest
  //   dekodowany osobno (modul z jedna pozycja), a utwor stoi na pauzie.
  // - melodia ($2E351E): wartosc - 1 = POZYCJA; wyciszenie o 4/takt (16 klatek), skok, narastanie ($2E2EEE);
  //   $2E3522 = od razu. 11 = poziom (pozycja 0 -> 18), 14 = pod woda, 23 = pokoj premii, 25 = L4 na zewnatrz.
  pos(ev) { const p = L && L.music_events && L.music_events[ev]; return p ? Math.max(0, p - 1) : 0; },
  level() { return this.ready && this.playing === 'level' + levelNo; },
  tune(ev, now) {
    if (!this.level() || !L.music_events) return;
    if (this.jsrc) { this.jnext = ev; return; }          // po dzinglu
    this.seek(this.pos(ev), now);
  },
  seek(pos, now) {                                       // pozycja biezacego modulu: od razu albo wyciszenie i skok
    if (!this.ready || !this.player) return;
    const g = this.player.gain.gain, ctx = this.player.context, v = 2.5 * this.vol / 10, name = this.playing;
    clearTimeout(this.fadeT);
    if (now) { this.player.setOrderRow(pos, 0); return; }
    g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(g.value, ctx.currentTime); g.linearRampToValueAtTime(0, ctx.currentTime + 0.32);
    this.fadeT = setTimeout(() => {
      if (this.playing !== name) return;
      this.player.setOrderRow(pos, 0);
      g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(0, ctx.currentTime); g.linearRampToValueAtTime(v, ctx.currentTime + 0.06);
    }, 320);
  },
  jump(ev, then) {
    if (!this.level()) return;
    const buf = this.jingles[L.music_events && L.music_events[ev]];
    if (!buf || this.jsrc) { if (then !== undefined) this.tune(then, true); return; }
    const ctx = this.player.context, src = ctx.createBufferSource();
    if (!this.jgain) { this.jgain = ctx.createGain(); this.jgain.connect(ctx.destination); }
    this.jgain.gain.value = 2.5 * this.vol / 10;
    src.buffer = buf; src.connect(this.jgain);
    this.player.pause(); this.jsrc = src; this.jnext = then;
    src.onended = () => {
      if (this.jsrc !== src) return;
      this.jsrc = null; const n = this.jnext; this.jnext = undefined;
      if (n !== undefined) this.player.setOrderRow(this.pos(n), 0);
      this.player.unpause();
    };
    src.start();
  },
  stopJingle() { const s = this.jsrc; this.jsrc = null; this.jnext = undefined; if (s) try { s.stop(); } catch (e) {} },
  jingles: {}, jl: 0,
  async loadJingles(n) {
    if (!this.ready || this.jl === n || !L || !L.music_events) return;
    this.jl = n; this.jingles = {};
    const [m, ab] = await Promise.all([import('./lib/chiptune3/chiptune3.js'), afetch(`assets/music/level${n}.med`).then(r => r.arrayBuffer())]);
    const ctx = this.player.context, dec = new m.ChiptuneJsPlayer({repeatCount: 0, context: ctx});
    await new Promise(r => dec.onInitialized(r));
    let done = null; dec.onFullAudioData(r => done && done(r));
    const song = new DataView(ab).getUint32(8);
    for (const b of new Set(L.music_events.filter(b => b))) {
      const u = new Uint8Array(ab.slice(0)), v = new DataView(u.buffer);
      if (b >= v.getUint16(song + 504)) continue;
      v.setUint16(song + 506, 1); u[song + 508] = b;     // MMD0: songlen = 1, playseq[0] = blok
      const res = await new Promise(r => { done = r; dec.decodeAll(u.buffer); });
      if (this.jl !== n) return;
      const [l, rr] = res.data;
      if (!l || !l.length) continue;
      const buf = ctx.createBuffer(2, l.length, ctx.sampleRate);
      buf.getChannelData(0).set(l); buf.getChannelData(1).set(rr || l);
      this.jingles[b] = buf;
    }
  }
};
addEventListener('keydown', e => { Music.init(); if (e.code === 'KeyM') Music.toggle(); });
addEventListener('pointerdown', () => Music.init());   // dotyk/klik tez jest gestem odblokowujacym dzwiek
// efekty: nuty instrumentow modulu poziomu (work/export_sfx.py) - caly utwor dekodowany raz przez libopenmpt,
// pociety na rowne bloki (jeden na efekt), uciety po czasie z wywolania w grze (d3, klatki 50 Hz) z wygaszeniem
const Sfx = {
  bufs: {}, level: 0, vol: setting('sfx', 10), out: null,
  async load(n) {
    if (!Music.ready || this.level === n) return;
    this.level = n; this.bufs = {};
    const [m, names, ab] = await Promise.all([import('./lib/chiptune3/chiptune3.js'), json('assets/sfx/sfx.json'),
      afetch(`assets/sfx/level${n}.med`).then(r => r.arrayBuffer())]);
    const ctx = Music.player.context, dec = new m.ChiptuneJsPlayer({repeatCount: 0, context: ctx});
    await new Promise(r => dec.onInitialized(r));
    const res = await new Promise(r => { dec.onFullAudioData(r); dec.decodeAll(ab); });
    const [l, rr] = res.data, keys = Object.keys(names), seg = Math.floor(l.length / keys.length);
    keys.forEach((k, i) => {
      const len = Math.min(seg, Math.round(names[k] / 50 * ctx.sampleRate)), b = ctx.createBuffer(2, len, ctx.sampleRate);
      for (const [ch, src] of [[0, l], [1, rr || l]]) {
        const d = b.getChannelData(ch);
        for (let j = 0; j < len; j++) d[j] = src[i * seg + j] * 2.5 * Math.min(1, (len - j) / (0.1 * ctx.sampleRate));
      }
      this.bufs[k] = b;
    });
    if (this.level !== n) this.bufs = {};
  },
  play(name) {
    const b = this.bufs[name];
    if (!b || !this.vol) return;
    const ctx = Music.player.context;
    if (!this.out) { this.out = ctx.createGain(); this.out.connect(ctx.destination); }
    this.out.gain.value = this.vol / 10;
    const src = ctx.createBufferSource(); src.buffer = b; src.connect(this.out); src.start();
  },
  setVol(v) { this.vol = Math.max(0, Math.min(10, v)); save('sfx', this.vol); }
};

// --- jezyki: game/lang/<kod>.json (lista w languages.json); wybor: ?lang=, zapis w localStorage, klawisz L ---
let LANG = {}, langCode = 'en', langs = ['en'];
const tr = key => key.split('.').reduce((o, k) => o && o[k], LANG) ?? key;
async function setLang(code) {
  LANG = await json(`lang/${code}.json`); langCode = code;
  try { localStorage.setItem('tnt.lang', code); } catch (e) {}
}
async function initLang() {
  langs = await json('lang/languages.json');
  let code = new URLSearchParams(location.search).get('lang');
  try { code = code || localStorage.getItem('tnt.lang'); } catch (e) {}
  code = code || (navigator.language || 'en').slice(0, 2);
  await setLang(langs.includes(code) ? code : 'en');
}
addEventListener('keydown', e => { if (e.code === 'KeyL') setLang(langs[(langs.indexOf(langCode) + 1) % langs.length]); });

// --- menu opcji (klawisz O, Esc zamyka): muzyka i efekty (glosnosc 0-10 jak pola Life), jezyk, grafika (hd.js),
// pelny ekran; wyglad z HUD-u gry: lina, purpurowy marmur, zlote ramki, miecz jako kursor ---
const OPT = ['music', 'sfx', 'lang', 'gfx', 'full', 'wide', 'photo', 'back'];
const opt = {sel: 0};
// tryb foto tylko, gdy trwa etap (opcje z gry albo z pauzy); z menu tytulowego pozycji nie ma
const optItems = () => OPT.filter(it => it !== 'photo' || opt.prev === null || opt.prev === 'pause');
function openOptions() {
  if (game.state === 'loading' || game.state === 'options') return;
  opt.prev = game.state; opt.sel = 0; opt.fresh = true; game.state = 'options'; game.anyLatch = true;
}
function openOptionsFrom(prev) { game.state = prev; openOptions(); }
function closeOptions() { game.state = opt.prev; game.anyLatch = true; pl.latch = pl.fireLatch = pl.doorLatch = true; }
// O: opcje tylko z gry, pauzy i menu tytulowego (nie przy wpisie imienia w Hall of Fame ani w trybie foto)
addEventListener('keydown', e => { if (e.code === 'KeyO' && [null, 'pause', 'menu', 'title', 'options'].includes(game.state)) game.state === 'options' ? closeOptions() : openOptions(); });
addEventListener('keydown', e => {
  if (game.state !== null && game.state !== 'dark') return;
  if (e.code === 'KeyT') game.state === 'dark' ? darkUse() : useTool();
  if (e.code === 'Tab') { e.preventDefault(); const t0 = game.tool; nextTool(); if (game.tool !== t0) Sfx.play('cursor'); }   // $2DFABA: zmiana narzedzia (63,30)
});
function optionsInput(press, k1) {
  if (opt.fresh) { opt.fresh = false; return; }
  const items = optItems(), n = items.length, it = items[opt.sel];
  if (k1('Escape')) return closeOptions();
  if (k1('ArrowUp', 'KeyW')) opt.sel = (opt.sel + n - 1) % n;
  if (k1('ArrowDown', 'KeyS')) opt.sel = (opt.sel + 1) % n;
  const d = k1('ArrowRight', 'KeyD') - k1('ArrowLeft', 'KeyA');
  if (!d && !press) return;
  const cycle = (list, cur) => list[(list.indexOf(cur) + (d || 1) + list.length) % list.length];
  switch (it) {
    case 'music': if (d) Music.setVol(Music.vol + d); else Music.toggle(); break;
    case 'sfx': Sfx.setVol(d ? Sfx.vol + d : Sfx.vol ? 0 : 10); Sfx.play('pickup'); break;
    case 'lang': setLang(cycle(langs, langCode)); break;
    case 'gfx': if (window.HD && HD.ok) HD.set(cycle(HD.MODES, HD.mode)); break;
    case 'full': (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}); break;
    case 'wide': WIDE = !WIDE; save('wide', +WIDE); fit(); break;
    case 'photo': if (press) { closeOptions(); photoOpen(); } break;   // z pauzy: po zamknieciu zdjec powrot do pauzy
    case 'back': if (press) closeOptions(); break;
  }
}
function frameBox(x, y, w, h) {                        // ramka jak pola HUD-u: ciemny srodek, zlota linia, cien
  cx.fillStyle = 'rgb(0,0,34)'; cx.fillRect(x - 1, y - 1, w + 2, h + 2);
  cx.fillStyle = 'rgb(255,187,85)'; cx.fillRect(x, y, w, h);
  cx.fillStyle = 'rgb(51,0,68)'; cx.fillRect(x + 1, y + 1, w - 2, h - 2);
}
function optionsScreen() {
  const T = L.hudTop, B = L.hudBottom;
  for (let y = 0; y < SH; y += 8) for (let x = 0; x < W; x += 94) {   // marmur z paska Life/Vitamins, co drugi rzad odbity
    cx.save(); if ((y >> 3) & 1) { cx.translate(0, 2 * y + 8); cx.scale(1, -1); }
    cx.drawImage(T, 104, 2, 94, 8, x, y, 94, 8); cx.restore();
  }
  cx.drawImage(B, 0, 0, W, 4, 0, 0, W, 4); cx.drawImage(B, 0, 36, W, 4, 0, SH - 4, W, 4);   // lina z HUD-u
  for (let y = 4; y < SH - 4; y += 32) { cx.drawImage(B, 0, 4, 4, 32, 0, y, 4, 32); cx.drawImage(B, 316, 4, 4, 32, W - 4, y, 4, 32); }
  const title = tr('options.title');
  frameBox(W / 2 - title.length * 4 - 10, 9, title.length * 8 + 20, 15); center(title, 12, '#e85');
  const items = optItems();
  frameBox(20, 28, W - 40, items.length * 11 + 8);
  const gfx = {off: 'gfx_off', mmpx: 'gfx_mmpx', xbr: 'gfx_xbr', nearest: 'gfx_2x'};
  items.forEach((it, i) => {
    const y = 33 + i * 11, on = i === opt.sel;
    if (on) cx.drawImage(L.sword.surface, 0, 0, 16, 8, 26, y, 16, 8);
    text(tr('options.' + it), 46, y, on ? '#fff' : '#79f');
    const bar = v => { for (let j = 0; j < 10; j++) { if (j < v) cx.drawImage(T, 51, 2, 9, 7, 186 + j * 11, y, 9, 7); else cx.drawImage(L.lifeEmpty, 186 + j * 11, y); } };
    let val = null;
    if (it === 'music') bar(Music.vol);
    else if (it === 'sfx') bar(Sfx.vol);
    else if (it === 'lang') val = LANG._name || langCode;
    else if (it === 'gfx') val = tr('options.' + (window.HD && HD.ok ? gfx[HD.mode] : 'gfx_off'));
    else if (it === 'full') val = tr(document.fullscreenElement ? 'options.on' : 'options.off');
    else if (it === 'wide') val = tr(WIDE ? 'options.on' : 'options.off');
    if (val) text(val, W - 26 - val.length * 8, y, '#ec1');
  });
  const keys = tr('options.keys') || [];
  const lh = Math.min(10, Math.floor((SH - 135) / keys.length));   // wiecej linii: ciasniej, ramka w ekranie
  frameBox(20, 127, W - 40, keys.length * lh + 8);
  keys.forEach((l, i) => text(l, 28, 132 + i * lh, i % 2 ? '#dc9' : '#ec1'));
}

// --- zapis gry (localStorage tnt.save.<slot>): sloty 1-3 i 'auto' (przejscie drzwiami, start etapu); stan etapu:
// mapa (dzwignie, kamienie, skrzynie), zebrane przedmioty, pokonani wrogowie, bajty stanu, gracz i jego dobytek ---
const SAVE_KEYS = ['score', 'gold', 'life', 'lives', 'maxLife', 'weapon', 'weaponBob', 'ammo', 'ammoBob', 'inv', 'tools', 'keys', 'maps', 'timer',
  'compass', 'compassSpin', 'compassF', 'timeShow', 'vit', 'vitShow', 'fruits', 'pieces', 'checkpoint', 'tool', 'toolBob', 'lit', 'pages', 'page', 'chest'];
function snapshot() {
  let map = '';
  for (let i = 0; i < L.map.length; i += 4096) map += String.fromCharCode(...L.map.subarray(i, i + 4096));
  const O = L.objs.objects, n0 = L.objs.n0;
  return {v: 1, dv: 2, t: Date.now(), level: levelNo, area: L.areaId, pl: {x: pl.x, y: pl.y, face: pl.face},
    g: Object.fromEntries(SAVE_KEYS.map(k => [k, game[k]])), flags: game.flags, combos: game.combos, map: btoa(map),
    taken: O.slice(0, n0).flatMap((o, i) => o.taken ? [i] : []), spoke: O.slice(0, n0).flatMap((o, i) => o.spoke ? [i] : []),
    extra: O.slice(n0), crates: L.crates ? L.crates.list.map(e => [e.idx, e.under]) : [],
    carry: game.carry && L.crates ? L.crates.list.indexOf(game.carry) : -1,
    dead: Actors.deadRecs()};                            // zabici wrogowie wg numeru rekordu (aktorzy powstaja z rekordow w oknie)
}
function saveGame(slot) { try { localStorage.setItem('tnt.save.' + slot, JSON.stringify(snapshot())); return true; } catch (e) { return false; } }
function saveInfo(slot) { try { return JSON.parse(localStorage.getItem('tnt.save.' + slot)); } catch (e) { return null; } }
const MAP_JUNK = {"2":[[46,0],[17752,0],[2155,66],[16522,5],[20480,0],[13394,5],[20480,232]],"3":[[5437,96],[12037,0],[16174,6],[16942,66],[16942,0],[16942,5],[16982,224],[9125,0],[13325,0],[16174,5],[16942,226],[16982,0],[1464,5],[4464,228],[16174,0],[16982,5],[4507,230],[11107,0],[16942,232],[6855,234],[328,0],[48,0],[3726,5],[3481,236],[447,0],[1,238],[96,0],[32,0],[46,0],[17748,96]],"4":[[1903,0],[13123,0],[13504,224],[22084,0],[1233,0],[512,0],[1663,5],[544,230],[4,0]]};
// zapisy sprzed 02abaf8 (dv < 2): lista rekordow poziomu 3 czytana z bledem - obiekty 6-7 nie istnialy (smieci), od 8 indeks
// +1 (krata, podmiana kafli, biegacz poza mapa wstawione wczesniej); rekordy wrogow od 2 maja indeks +2
function migrateSave(d) {
  if ((d.dv | 0) >= 2 || d.level !== 3 || d.t >= 1792660848000) return;   // zapisy z wersji po poprawce (bez dv) sa juz w nowym ukladzie
  const obj = i => i <= 5 ? [i] : i <= 7 ? [] : [i + 1];
  d.taken = (d.taken || []).flatMap(obj); d.spoke = (d.spoke || []).flatMap(obj);
  d.dead = (d.dead || []).map(i => i <= 1 ? i : i + 2);
}
async function loadGame(slot) {
  const d = saveInfo(slot);
  if (!d) return false;
  migrateSave(d);
  await startLevel(d.level);
  enterArea(d.area); Object.assign(game, d.g); Object.assign(game.flags, d.flags); game.combos = d.combos || {};
  const orig = L.map.slice(), m = atob(d.map); for (let i = 0; i < m.length; i++) L.map[i] = m.charCodeAt(i);
  // zapisy sprzed poprawki eksportu: plytki wody wpisywaly smieciowe kafle (dziury w podlodze) - przywroc oryginal
  for (const [ix, v] of MAP_JUNK[levelNo] || []) if (L.map[ix] === v && orig[ix] !== v) L.map[ix] = orig[ix];
  for (const [k, v] of Object.entries(game.flags)) if (k.startsWith('water') && L.areas[k.slice(5)]) [L.areas[k.slice(5)].water, L.areas[k.slice(5)].waterT, L.areas[k.slice(5)].waterD] = v;
  enterArea(d.area);
  if (L.quest) for (const e of L.quest.ropes) e.used = L.map[e.start] === e.tiles[0];   // zawieszone liny z zapisanej mapy
  const O = L.objs.objects; O.length = L.objs.n0;
  for (const i of d.taken) O[i].taken = true;
  for (const i of d.spoke || []) O[i].spoke = true;
  O.push(...d.extra);
  if (L.crates) d.crates.forEach(([idx, under], i) => Object.assign(L.crates.list[i], {idx, under}));
  game.carry = d.carry >= 0 && L.crates ? L.crates.list[d.carry] : null;
  Actors.killRecs(d.dead || []);
  Object.assign(pl, {x: d.pl.x, y: d.pl.y, face: d.pl.face, vx: 0, vy: 0, fx: 0, fy: 0, climb: false, rope: false, attack: 0, pose: 0, lockT: 0, water: d.pl.y > L.waterY, jumpReq: false});
  // Starsze zapisy nie maja stanu kompasu: odzyskaj go z mapy zebranej w tym etapie (game.maps liczy tez poprzednie).
  if (d.g.compass === undefined && O.some(o => o.type === MAP && o.taken)) {
    game.compass = true; if (!game.timer) game.timeShow = L.escape * 50; compassTick();
  }
  game.crew = countCrew(); follow(true);
  game.state = null; pl.latch = pl.fireLatch = pl.doorLatch = true; game.anyLatch = true;
  return true;
}
function slotText(slot) {
  const d = saveInfo(slot);
  if (!d) return tr('pause.empty');
  const t = new Date(d.t), z = n => String(n).padStart(2, '0');
  return `${tr('pause.level')} ${d.level}  ${z(t.getDate())}.${z(t.getMonth() + 1)} ${z(t.getHours())}:${z(t.getMinutes())}`;
}

// --- pauza (Esc w grze, utrata fokusu okna): dalej, zapis (slot 1-3), wczytanie (auto, 1-3), opcje, menu tytulowe ---
const PAUSE = ['resume', 'save', 'load', 'options', 'quit'], LOAD_SLOTS = ['auto', 1, 2, 3];
// wczytywanie (pauza i menu tytulowe): tylko istniejace zapisy, na starcie najnowszy, lewo/prawo kolejny
const saveSlots = () => LOAD_SLOTS.filter(s => saveInfo(s));
const newestSlot = () => saveSlots().sort((a, b) => (saveInfo(b).t || 0) - (saveInfo(a).t || 0))[0];
function nextSlot(cur, d) { const have = saveSlots(); return have.length ? have[(Math.max(0, have.indexOf(cur)) + d + have.length) % have.length] : undefined; }
const pause = {sel: 0, save: 1, load: 0, note: ''};
function openPause() {
  if (game.state !== null) return;
  Object.assign(pause, {sel: 0, note: '', fresh: true, load: newestSlot()}); game.state = 'pause'; game.anyLatch = true;   // fresh: ten sam Esc nie zamyka
}
function closePause() { game.state = null; game.anyLatch = true; pl.latch = pl.fireLatch = pl.doorLatch = true; }
addEventListener('keydown', e => { if (e.code === 'Escape' && game.state === null) openPause(); });
addEventListener('blur', () => openPause());
document.addEventListener('visibilitychange', () => { if (document.hidden) openPause(); });
function pauseInput(press, k1) {
  if (pause.fresh) { pause.fresh = false; return; }
  const n = PAUSE.length, it = PAUSE[pause.sel];
  if (k1('Escape')) return closePause();
  if (k1('ArrowUp', 'KeyW')) { pause.sel = (pause.sel + n - 1) % n; pause.note = ''; }
  if (k1('ArrowDown', 'KeyS')) { pause.sel = (pause.sel + 1) % n; pause.note = ''; }
  const d = k1('ArrowRight', 'KeyD') - k1('ArrowLeft', 'KeyA');
  if (it === 'save' && d) pause.save = (pause.save + 2 + d) % 3 + 1;
  if (it === 'load' && d) pause.load = nextSlot(pause.load, d);
  if (!press) return;
  if (it === 'resume') closePause();
  else if (it === 'save') { pause.note = saveGame(pause.save) ? tr('pause.saved') : '-'; Sfx.play(pause.note === '-' ? 'locked' : 'pickup'); }
  else if (it === 'load') { if (pause.load !== undefined && saveInfo(pause.load)) loadGame(pause.load); else Sfx.play('locked'); }
  else if (it === 'options') openOptionsFrom('pause');
  else if (it === 'quit') { game.state = 'title'; Music.play('title'); }
}
function pauseScreen() {
  draw();
  const title = tr('pause.title'), bw = 232, bh = PAUSE.length * 14 + 30, bx = (W - bw) >> 1, by = 40;
  frameBox(bx, by, bw, bh); center(title, by + 6, '#e85');
  PAUSE.forEach((it, i) => {
    const y = by + 22 + i * 14, on = i === pause.sel;
    if (on) cx.drawImage(L.sword.surface, 0, 0, 16, 8, bx + 6, y, 16, 8);
    let label = tr('pause.' + it);
    if (it === 'save') label += ' ' + pause.save;
    if (it === 'load' && pause.load !== undefined) label += ' ' + (pause.load === 'auto' ? tr('pause.auto') : pause.load);
    text(label, bx + 26, y, on ? '#fff' : '#79f');
  });
  const it = PAUSE[pause.sel], info = it === 'save' ? slotText(pause.save) : it === 'load' ? (pause.load !== undefined ? slotText(pause.load) : tr('pause.empty')) : '';
  if (info || pause.note) center(pause.note || info, by + bh + 6, pause.note ? '#6f6' : '#ec1');
}

// --- tryb fotograficzny (P): gra stoi, caly poziom rysowany raz do bufora tymi samymi funkcjami co gra (kawalki
// 320x159), oglad na calym oknie: przesuwanie (strzalki/WASD, mysz), zoom (kolko, +/-), 0 = gracz, S = zapis widoku,
// G = zapis calej mapy (PNG), P/Esc = powrot. Niebo: gradient z biezacej kamery rozciagniety na cala mape ---
const photo = {z: 2, x: 0, y: 0};
const pc = document.createElement('canvas'), pcx = pc.getContext('2d'), tip = document.createElement('div');
pc.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:none;z-index:10;cursor:grab;image-rendering:auto';
tip.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);display:none;z-index:11;padding:4px 10px;' +
  'color:#fb5;background:rgba(51,0,68,.85);border:2px solid #fb5;font:12px monospace;white-space:nowrap;pointer-events:none';
document.body.append(pc, tip);
function photoRender() {
  const map = document.createElement('canvas'); map.width = L.w * TS; map.height = L.h * TS;
  const g = map.getContext('2d'), g0 = L.skyRow0 - Math.floor(cam.y / 2) + Math.round(cam.y);
  for (let y = 0; y < map.height; y++) {
    const i = y - g0;
    g.fillStyle = y >= L.waterY ? L.waterColor : i < 0 ? L.skyTop : L.sky[Math.min(i, L.sky.length - 1)];
    g.fillRect(0, y, map.width, 1);
  }
  screenSize(W, SH);
  for (let y = 0; y < map.height; y += H) for (let x = 0; x < map.width; x += W) {
    cx.clearRect(0, 0, W, H);
    scene(false, x, y);
    const wl = L.waterY - y;
    if (wl < H) { cx.save(); cx.beginPath(); cx.rect(0, Math.max(0, wl), W, H); cx.clip(); cx.clearRect(0, 0, W, H); scene(true, x, y); cx.restore(); }
    g.drawImage(cv, 0, 0, W, H, x, y, W, H);
  }
  L.surfaceLine.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, L.waterY + i, map.width, 1); });
  return map;
}
function photoOpen() {
  photo.map = photoRender(); Object.assign(photo, {x: pl.x, y: pl.y - 16, z: 3});
  photo.prev = game.state === 'pause' ? 'pause' : null;
  game.state = 'photo'; pc.style.display = tip.style.display = ''; tip.textContent = tr('photo.hint');
}
function photoClose() { pc.style.display = tip.style.display = 'none'; photo.map = null; game.state = photo.prev || null; pl.latch = pl.fireLatch = true; game.anyLatch = true; }
addEventListener('keydown', e => {
  if (e.code === 'KeyP' && (game.state === null || game.state === 'photo')) game.state ? photoClose() : photoOpen();
});
function photoZoom(f, mx = innerWidth / 2, my = innerHeight / 2) {     // zoom wokol punktu (kursor)
  const min = Math.min(innerWidth / photo.map.width, innerHeight / photo.map.height) / 2;
  const z = Math.max(min, Math.min(12, photo.z * f));
  photo.x += (mx - innerWidth / 2) * (1 / photo.z - 1 / z); photo.y += (my - innerHeight / 2) * (1 / photo.z - 1 / z); photo.z = z;
}
pc.addEventListener('wheel', e => { e.preventDefault(); photoZoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, {passive: false});
pc.addEventListener('pointerdown', e => { photo.drag = [e.clientX, e.clientY]; pc.setPointerCapture(e.pointerId); pc.style.cursor = 'grabbing'; });
pc.addEventListener('pointermove', e => {
  if (!photo.drag) return;
  photo.x -= (e.clientX - photo.drag[0]) / photo.z; photo.y -= (e.clientY - photo.drag[1]) / photo.z; photo.drag = [e.clientX, e.clientY];
});
pc.addEventListener('pointerup', () => { photo.drag = null; pc.style.cursor = 'grab'; });
function savePng(canvas, name) {
  canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
}
function photoInput(k1) {
  if (k1('Escape')) return photoClose();
  const sp = (k('ShiftLeft', 'ShiftRight') ? 24 : 8) / photo.z;
  photo.x += (k('ArrowRight', 'KeyD') - k('ArrowLeft', 'KeyA')) * sp;
  photo.y += (k('ArrowDown', 'KeyS') - k('ArrowUp', 'KeyW')) * sp;
  if (k1('Equal', 'NumpadAdd')) photoZoom(1.25);
  if (k1('Minus', 'NumpadSubtract')) photoZoom(0.8);
  if (k1('Digit0', 'Numpad0')) Object.assign(photo, {x: pl.x, y: pl.y - 16});
  if (k1('KeyF')) savePng(pc, `tnt-foto-${levelNo}.png`);
  if (k1('KeyG')) savePng(photo.map, `tnt-mapa-${levelNo}.png`);
  photo.x = Math.max(0, Math.min(photo.map.width, photo.x)); photo.y = Math.max(0, Math.min(photo.map.height, photo.y));
}
function photoDraw() {
  const r = devicePixelRatio || 1, w = Math.round(innerWidth * r), h = Math.round(innerHeight * r), z = photo.z * r;
  if (pc.width !== w || pc.height !== h) { pc.width = w; pc.height = h; }
  pcx.setTransform(1, 0, 0, 1, 0, 0); pcx.fillStyle = '#07090d'; pcx.fillRect(0, 0, w, h);
  pcx.imageSmoothingEnabled = z < 1;                  // oddalenie gladko, przyblizenie ostre piksele
  pcx.setTransform(z, 0, 0, z, Math.round(w / 2 - photo.x * z), Math.round(h / 2 - photo.y * z));
  pcx.drawImage(photo.map, 0, 0);
}

// --- drzwi i obszary (dane poziomu gry, work/export_level.py: areas): gora przy drzwiach przenosi do celu
// w innym obszarze (granice kamery, linia wody); cel x = 0 -> wyjscie z etapu, 'shop' -> sklep.
// Indeks kafla drzwi jak w kodzie gry ($2F0A5C): ((y - 6) >> 4) * szerokosc + (x >> 4); pasuje tez kafel obok.
function enterArea(id) {
  L.areaId = String(id); pl.atDoor = null;
  const a = L.areas[L.areaId], sect = a && a.sect;
  Actors.setSect(sect);
  if (L.objs) for (const o of L.objs.objects) o.off = !!(o.sect && sect && o.sect !== sect);   // obiekt z sekcji innego obszaru nie istnieje
  L.waterY = a && a.water != null ? a.water : 99999;
}
// akcje na kaflach ($2E42EC, tablica poziomu): kafel wiersz nad kaflem drzwi; tabliczki, zamek (czerwony klucz),
// dzwignie (kafel dzwigni L.actions.lever: wlaczona/wylaczona) ustawiajace bajt stanu albo zestaw kafli A/B
// linia wody biezacego obszaru (+$10) idzie o 1 px ku celowi (+$12) co opoznienie + 1 klatek ($2F0E08, $9DE4)
function waterTick() {
  const A = L.areas && L.areas[L.areaId];
  if (!A || A.waterT == null || A.water === A.waterT) return;
  game.wtick = (game.wtick || 0) + 1;
  if (game.wtick % ((A.waterD || 0) + 1)) return;
  if (A.water == null) A.water = A.waterT; else A.water += Math.sign(A.waterT - A.water);
  L.waterY = A.water; waterSave(L.areaId, A);
}
const waterSave = (id, A) => { game.flags['water' + id] = [A.water, A.waterT, A.waterD || 0]; };
function setTiles(e, which) { e.idx.forEach((ix, i) => { L.map[ix] = e[which][i]; }); }
function actionCheck() {
  const A = L.actions;
  if (!A) return false;
  const t = ((pl.y - 6) >> 4) * L.w + (pl.x >> 4) - L.w;
  let list = A.list.filter(e => e.tile === t);          // gra wola wszystkie wpisy z tym kaflem
  if (!list.length) list = A.list.filter(e => Math.abs(e.tile - t) === 1).slice(0, 1);
  return list.map(action1).some(Boolean);
}
function action1(e) {
  const F = game.flags, [on, off] = L.actions.lever;
  const flip = () => { const was = L.map[e.tile] === on; L.map[e.tile] = was ? off : on; Sfx.play('mech'); return !was; };
  switch (e.kind) {
    case 'msg': message(e.text); break;
    case 'lock':                                        // $2E4590
      if ((F[e.state] | 0) === 3) { message("Hello... it's already been used!"); break; }   // $2E45B0
      if (game.keys[3] > 0) { F[e.state] = 1; game.keys[3]--; Sfx.play('mech'); } else Sfx.play('locked');
      break;
    case 'lever_state': F[e.state] = flip() ? 2 : 1; break;                    // $2E441C
    case 'toggle_state': F[e.state] = (F[e.state] | 0) === 1 ? 2 : 1; flip(); break;   // $2E43B4
    case 'lever_tiles': setTiles(e, flip() ? 'b' : 'a'); break;                 // $2E4478
    case 'plate': setTiles(e, 'a'); Sfx.play('mech'); break;                    // $2E4544
    case 'plate_hold': setTiles(e, 'a'); Sfx.play('mech'); game.plateHold = e; break;   // $2E4532: trzymana (UP + FIRE)
    case 'water': {                                     // $2E4554 / $2E4558: przelacznik linii wody obszaru (cel +$12)
      const A = L.areas[String(e.area)];
      if (A && (A.waterT ?? A.water) !== e.level) { Music.jump(e.event); A.waterT = e.level; A.waterD = e.delay; waterSave(e.area, A); }
      break;
    }
    case 'set_state': if (!F[e.state]) F[e.state] = 1; Sfx.play('mech'); break; // $2E4336
    case 'not_state': F[e.state] = (F[e.state] | 0) ? 0 : 1; Sfx.play('mech'); break;
    case 'timed':                                       // $2E435C: otwarte przez czas, tykanie coraz wyzej, potem stan 2
      if (!game.timed) { game.timed = {state: e.state}; F[e.state] = 1; }
      Object.assign(game.timed, {t: e.time, step: e.time >> 3, c: e.time >> 3, n: 1});
      Sfx.play('tick0'); Sfx.play('mech');
      break;
    case 'combo': {                                     // $2ED696...: przyciski po kolei wg sekwencji z gry
      const pos = game.combos[e.id] | 0;
      if (pos >= e.seq.length) { Sfx.play('mech'); break; }
      game.combos[e.id] = e.seq[pos] === e.button ? pos + 1 : 0;   // pomylka = od poczatku
      if (!game.combos[e.id] && COMBO_TRAP[e.id]) {      // $2ED7DA: pomylka w zamku czterech bogow (L3) - dwie kule $3003E4
        const [x, y] = COMBO_TRAP[e.id];
        for (const v of [-1, 1]) Actors.spawnScript(0x3003e4, x, y, undefined, 'bouncer').brain = {v, vy: 5};   // jak $2EF7F4 / $2EF7FE
        Sfx.play('balls'); break;
      }
      if (game.combos[e.id] < e.seq.length) { Sfx.play('mech'); break; }
      if (e.state) F[e.state] = 1;
      if (e.idx) setTiles(e, 'a');
      Music.jump(15);                                   // $2ED6BC: fragment utworu (zdarzenie 15)
      break;
    }
    case 'summon': Actors.spawnScript(e.script, e.x, e.y); Sfx.play('mech'); break;   // $2EBCAC: pulapka - wrog
    case 'hazard': Actors.spawnScript(e.script, pl.x, pl.y); Sfx.play('mech'); break;  // $2EBCD0: pulapka - rani gracza
    default: return false;
  }
  return true;
}
const COMBO_TRAP = {be8a: [5487, 95]};
// przedmioty z fizyka od startu (init $2EEB66 klucze, $2EEB92 sakwy, ksiazka, lina, $2EEBB6 moneta; procedura
// $2EF000 = $2EF5D0): spadaja z miejsca ze spisu poziomu na podloge; [granica odbicia, krokow, dzwiek odbicia]
const FALL_ITEM = {'2f28f8': [6, 3, 'keydrop'], '2f2944': [6, 3, 'keydrop'], '2f2990': [6, 3, 'keydrop'],
  '2f29dc': [6, 3, 'keydrop'], '2f26d0': [7, 3], '2f271c': [7, 3], '2f2768': [7, 3], '2f27b4': [7, 3], '2f2800': [7, 3], '2f284c': [7, 3],
  '2f31f2': [7, 3], '2f340e': [7, 3], '2f2626': [10, 2, 'clink']};
// licznik przelacznika czasowego ($2F16D6)
function timedTick() {
  const T = game.timed;
  if (!T) return;
  if (--T.t <= 0) { game.flags[T.state] = 2; game.timed = null; return; }
  if (--T.c <= 0) { T.c = T.step; if (T.n < 8) Sfx.play('tick' + T.n++); }
}
// ekran konca etapu: naliczanie premii krok po kroku ($2DF1E8)
// rozjasnianie / wygaszanie palety planszy po 1 kroku na klatke przez 16 klatek ($2DFD14 z licznikiem $30CCCA, $2DFBCA);
// w tym czasie gra czeka (petla w oryginale), HUD bez zmian
const POP_DY = [-3, -3, -3, -3, -3, -2, -2, -2, -1, -1, -1, 0, 0, 0];
// $2DFBCA: wygaszanie odejmuje co klatke 1 od kazdej 4-bitowej skladowej kolorow planszy (16 krokow), $2DFD14: rozjasnianie
// dodaje 1 az do koloru docelowego - ciemne kolory gasna pierwsze i wracaja pierwsze (kolory portu = skladowa x 17)
function palFade(k, out) {
  if (out ? k <= 0 : k >= 15) return;
  cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0);
  if (out ? k >= 15 : k <= 0) { cx.fillStyle = '#000'; cx.fillRect(0, PFY, cv.width, H); cx.restore(); return; }
  const im = cx.getImageData(0, PFY, cv.width, H), p = im.data, v = 17 * k;
  if (out) for (let i = 0; i < p.length; i += 4) { p[i] -= v; p[i + 1] -= v; p[i + 2] -= v; }
  else for (let i = 0; i < p.length; i += 4) { if (p[i] > v) p[i] = v; if (p[i + 1] > v) p[i + 1] = v; if (p[i + 2] > v) p[i + 2] = v; }
  cx.putImageData(im, 0, PFY); cx.restore();
}
function pfFade(out, done, extra = 0) { game.pfFade = {t: 0, out, done, extra}; }   // extra: klatki po wygaszeniu przed done
function pfFadeTick() {
  pl.anim++; if (pl.atDoor) pl.frame = doorPose();   // skrypt gracza biegnie w przerwaniu tez w czasie wygaszania (emulator 4x, L4: 84 -> 86)
  if (++game.pfFade.t >= 16 + game.pfFade.extra) { const d = game.pfFade.done; game.pfFade = null; if (d) d(); }
}
const doorPose = () => pl.anim - pl.atDoor.t <= 6 ? (pl.face > 0 ? 85 : 84) : 86;   // tylem do drzwi
function pfFadeDraw() {
  const F = game.pfFade; if (!F) return;
  palFade(F.t, F.out);
}
function levelClear() {
  const sec = Math.ceil(game.timer / 50);            // $2DF1E8: minuty x 300, sekundy x 5, owoce x 100, kawalki mapy x 1000
  // naliczanie krok po kroku ($2DF1E8): minuty po 300, dziesiatki sekund po 50, sekundy po 5, owoce po 100, kawalki po 1000
  const steps = [];
  for (let m = Math.floor(sec / 60); m > 0; m--) steps.push(['time', 300, 60]);
  for (let t = Math.floor(sec % 60 / 10); t > 0; t--) steps.push(['time', 50, 10]);
  for (let s = sec % 10; s > 0; s--) steps.push(['time', 5, 1]);
  for (let f = game.fruits; f > 0; f--) steps.push(['fruits', 100, 0]);
  for (let p = game.pieces; p > 0; p--) steps.push(['pieces', 1000, 0]);
  game.bonus = {sec, time: 0, fruits: 0, pieces: 0, steps, wait: 25};
  game.timer = 0; game.state = 'clear'; pfFade(false);   // $2DF16E: ekran wyniku rozjasnia sie
}
// UP na kaflu z bitem 4 atrybutu (pod graczem, y - 6: $2E95AA / $2F0A5C) obraca gracza tylem do drzwi (klatki 85 albo 84,
// potem 86 co 6, tablica $2EB1E4) i ustawia $2EB213; wejscie dopiero na FIRE (action). Ruch w bok albo skok konczy obrot
function doorCheck(UP, landing0) {
  pl.doorNoTurn = null;
  if (!UP || game.treasure) { pl.doorLatch = false; return false; }
  const ar = L.areas && L.areas[L.areaId];
  // ze skrzynia w rekach UP przy drzwiach / klatce to skok ($2E98A6 / $2E98D6 -> $2E9818); obrot zeruje wskaznik chodu
  if (pl.doorLatch || !ar || !(pl.ground || landing0) || game.carry) return false;   // ladowanie z profilu przed joystickiem tez (emulator 4x, R3)
  // UP z blokada $30CC8E (trzymany od skoku albo spadania): bez obrotu i wysrodkowania, ale drzwi i kafel akcji dalej na
  // FIRE ($2E98B0 -> $2E98CE: $2EB213, $2E990A -> $2E9936: $2EB214; klatka bez flagi) - emulator 4x, rndbI4oc
  const turn = A => {
    if (pl.latch && !pl.atDoor) { if (!A.cage) pl.doorNoTurn = A; return true; }
    pl.doorLatch = true; if (!pl.atDoor) { if (A.action) pl.x = (pl.x & ~15) + 7; pl.atDoor = A; pl.wp = null; } return true;   // $2E9918: wskaznik chodu na srodek
  };
  if (attr(pl.x, pl.y - 6) & ENTRANCE) return turn({t: pl.anim});
  const cg = cageAt();
  if (cg) return turn({t: pl.anim, cage: cg});
  if (L.actions && attr(pl.x, pl.y - 22) & ACTION) return turn({t: pl.anim, action: true});   // $2E95D4 -> $2E9906: kafel akcji (bit 6, wiersz nad), x na srodek
  return false;
}
// przejscie ($2DF568): dzingiel 3, plansza wygasa przez 16 klatek ($2DFBCA, 1 krok palety na klatke), potem sklep / ciemnosc /
// nowy obszar; po obszarze gra wraca do $2DD166 jak na starcie etapu: plansza czarna i odslania sie cegielkami
function enterDoor(d) {
  if (d.exit) {                                          // $2DF43A: wyjscie dopiero po uwolnieniu calej zalogi, inaczej nic
    // $2DF444..$2DF46A: melodia 9 (od razu), gracz macha (sekwencja $2F1ABC: klatki 27/28 co 4), $2DE4CA: 131 klatek
    if (!game.crew) { Music.tune(9, true); game.exitWave = 131 + 16; Object.assign(pl, {vx: 0, vy: 0, attack: 0, pose: 0, lockT: 0}); }   // + wygaszanie $2DE4D6
    return;
  }
  Music.jump(3); Sfx.play('door'); pfFade(true, () => doorGo(d), (game.doorExtra ?? 1) - game.frame % 2);   // petla glowna odbiera FIRE w swoim takcie: klatka wczesniej poza nim (emulator 4x, R3 / D4)   // emulator: nowa pozycja 17 klatek po FIRE (doorExtra: testy z nagraniami 4x)
}
function doorGo(d) {
  if (d.shop !== undefined && L.shops[d.shop]) openShop(L.shops[d.shop]);
  // ciemny obszar (+$14): ekran ciemnosci z oczami ($2DDDC4, openDark); lampa zuzyta raz, obszar zostaje oswietlony
  else if (L.areas[String(d.area)] && L.areas[String(d.area)].dark && !game.lit[d.area] && !d.go) openDark(d);
  else {
    d.go = false;
    resetActors(true);                 // $2DDF6A: aktorzy i pociski znikaja, rekordy starego obszaru od nowa
    pl.x = d.x; pl.y = d.y; pl.vx = pl.vy = pl.fx = pl.fy = 0; pl.wp = null; pl.plat = null; pl.lift = null; pl.fallB = 128; enterArea(d.area); Actors.player = pl; follow(true);
    pl.cycle = null;
    game.state = 'reveal'; game.revealT = 62 - (game.doorBlack ?? 21); game.revealDoor = 'area';   // emulator: plansza czarna 21 klatek, potem gra i rozjasnianie 7 klatek (FIRE -> sterowanie 39 klatek)
  }
}
// tytul (352x289 z emulatora, pomniejszony do wysokosci ekranu) i mapa wyspy (320x200) miedzy etapami
function titleScreen() {
  // natywne 352x289 (EHB z pamieci gry); szeroki ekran: poszerzona wersja 626x289 (title_wide.png, ta sama wysokosc)
  const T = OX ? L.titleWide : L.titleImg;
  screenSize(T.width, T.height);
  cx.drawImage(T, 0, 0);
  const now = performance.now(); game.titleT = game.titleT || now;
  if (now - game.titleT > 12000) { game.titleT = 0; game.state = 'story'; game.storyT = now; }   // pokaz jak w grze: tytul, historia, Hall of Fame
  if ((game.frame++ >> 5) & 1) text(tr('press_button'), (cv.width - tr('press_button').length * 8) >> 1, cv.height - 13, '#fff');
  if (saveInfo('auto')) { const c = tr('pause.continue'); text(c, (cv.width - c.length * 8) >> 1, cv.height - 25, '#ec1'); }
}
// ekrany startowe jak w grze: logo Starbyte, 'a Nightingale production' (zrzuty emulatora), potem tytul; przenikanie
function splashScreen() {
  cx.fillStyle = '#000'; cx.fillRect(0, 0, W, SH);
  const t = performance.now() - game.splashT, k = t < 4000 ? 0 : 1, u = t - 4000 * k;
  if (t > 7500) { game.state = 'title'; game.titleT = 0; return; }
  cx.globalAlpha = Math.max(0, Math.min(1, u / 500, (3500 - u) / 500));
  cx.drawImage(k ? L.introNightingale : L.introStarbyte, 0, 5);
  cx.globalAlpha = 1;
}
// historia z intra ('The previous history...', work/export_story.py): tekst przewijany 1 px/klatke w gore na nieruchomych
// paskach coppera (320 x 256), potem Hall of Fame
function storyScreen() {
  screenSize(320, 256);
  cx.drawImage(L.storyBg, 0, 0, 1, 256, 0, 0, 320, 256);
  const t = (performance.now() - game.storyT) / 20 | 0, s = langCode === 'pl' ? L.storyTextPl : L.storyText;   // PL: work/export_story_pl.py
  cx.drawImage(s, 0, 256 - t);
  if (t > s.height + 256) menuOpen();                  // potem dysk B i menu ($309DF0, muzyka $16A06FC)
}
// --- Hall of Fame (pamiec gry $D002F): 10 miejsc, domyslnie JEREMY FLYNN 100000..10000, font 8x9, kolor (176,144,112),
// wiersze co 11 px pod logo-zwojem (work/export_hof.py); wyniki w localStorage, imie do 12 znakow z zestawu gry ---
const HOF_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.!$@%/ ', HOF_COL = 'rgb(187,153,119)';
const HOF_ORD = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', '9TH', '10TH'];
function hofList() {
  try { const h = JSON.parse(localStorage.getItem('tnt.hof')); if (Array.isArray(h) && h.length === 10) return h; } catch (e) {}
  return HOF_ORD.map((_, i) => ({name: 'JEREMY FLYNN', score: (10 - i) * 10000}));
}
function hofRank(score) { return hofList().findIndex(e => score > e.score); }
function hofScreen() {
  screenSize(VW, SH); cx.fillStyle = '#000'; cx.fillRect(0, 0, W, SH);
  cx.drawImage(L.hofLogo, 58, 15);
  text('HALL OF FAME', 112, 70, HOF_COL);
  const E = game.hofEdit, h = E ? E.list : hofList();
  h.forEach((e, i) => text(HOF_ORD[i].padStart(4) + '  ' + e.name.padEnd(12) + '   ' + String(e.score).padStart(7, '0'), 49, 92 + 11 * i, HOF_COL));
  if (E && performance.now() % 500 < 300) {             // kursor: aktualna litera migajaca na koncu imienia
    const n = E.list[E.rank].name.length;
    if (n < 12) text(HOF_CHARS[E.ch] === ' ' ? '-' : HOF_CHARS[E.ch], 49 + 6 * 8 + n * 8, 92 + 11 * E.rank, '#fff');
  }
  if (!E && performance.now() - game.hofT > 6000) menuOpen(true);   // pokaz w menu: 300 klatek, potem z powrotem menu
}
// autorzy (pamiec gry za tabela wynikow, ujecie emulatora z pokazu w menu): logo jak w Hall of Fame, '(C) 1993 STARBYTE
// SOFTWARE' od x = 64, opisy od x = 48 i nazwiska od x = 152 w wierszach 99..187 ekranu gry (+14 jak tabela wynikow)
const CREDITS = [[99, 'idea', 'ROMAN WERNER'], [110, '', 'RUEDI HUGENTOBLER'], [132, 'programming', 'ROMAN WERNER'],
  [154, 'graphics', 'ORLANDO'], [165, '', 'ROMAN WERNER'], [187, 'sound', 'RUEDI HUGENTOBLER']];
function creditsScreen() {
  screenSize(VW, SH); cx.fillStyle = '#000'; cx.fillRect(0, 0, W, SH);
  cx.drawImage(L.hofLogo, 58, 15);
  cx.fillStyle = HOF_COL;                               // znak (C) z fontu zakonczenia
  L.ending.glyphs['@'].forEach((r, k) => { for (let c = 0; c < 8; c++) if (r[c] === '#') cx.fillRect(64 + c, 80 + k, 1, 1); });
  text(' 1993 STARBYTE SOFTWARE', 72, 80, HOF_COL);
  for (const [y, k, name] of CREDITS) { if (k) text(tr('credits.' + k), 48, y + 14, HOF_COL); text(name, 152, y + 14, HOF_COL); }
  if (performance.now() - game.hofT > 6000) menuOpen(true);
}
// easter egg autora portu: na tytule albo w menu joystickiem gora gora dol dol lewo prawo lewo prawo + FIRE
// (kod Konami; pad dotykowy tez wysyla strzalki) -> ekran jak autorzy oryginalu, Jeremy macha (klatki 27/28)
const PORT_AUTHOR = 'MATEUSZ SYCH', EGG = 'UUDDLRLR';
function eggKey(hit, press) {
  const E = game.egg || (game.egg = []);
  for (const c of hit) if (c.startsWith('Arrow')) { E.push(c[5]); if (E.length > EGG.length) E.shift(); }
  if (game.state === 'author') { if (press || performance.now() - game.hofT > 15000) { E.length = 0; game.eggBack(); } return true; }
  if (!press || !['title', 'menu'].includes(game.state) || E.join('') !== EGG) return false;
  E.length = 0;
  game.eggBack = game.state === 'menu' ? () => menuOpen(true) : () => { game.state = 'title'; game.titleT = 0; };
  game.state = 'author'; game.hofT = game.screenT = performance.now(); Sfx.play('cheer');
  return true;
}
function authorScreen() {
  screenSize(VW, SH); cx.fillStyle = '#000'; cx.fillRect(0, 0, W, SH);
  cx.drawImage(L.hofLogo, 58, 15);
  center(tr('egg.port'), 84, HOF_COL); center(PORT_AUTHOR, 102, '#fff'); center('2026', 118, HOF_COL);
  center(tr('egg.thanks'), 186, HOF_COL);
  const m = L.player, fr = (performance.now() / 160 | 0) & 1 ? 28 : 27, f = m.frames[fr], [cw, ch] = m.cell;   // machanie co 4 klatki
  if (f) cx.drawImage(L.player.surface, (fr % m.cols) * cw, Math.floor(fr / m.cols) * ch, cw, f.h, 160 - f.ax, 170 - f.ay, cw, f.h);
}
function hofInput(press, k1, hit) {
  const E = game.hofEdit;
  if (!E) { if (press) menuOpen(); return; }
  const e = E.list[E.rank];
  for (const c of hit) {                                // klawiatura: litery, cyfry, Backspace, Enter
    const ch = c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c === 'Period' ? '.' : c === 'Slash' ? '/' : c === 'Space' ? ' ' : null;
    if (ch && HOF_CHARS.includes(ch) && e.name.length < 12) e.name += ch;
    if (c === 'Backspace') e.name = e.name.slice(0, -1);
    if (c === 'Enter' || c === 'NumpadEnter') return hofDone();
  }
  if (k1('ArrowUp')) E.ch = (E.ch + 1) % HOF_CHARS.length;   // joystick jak w grze: gora/dol litera, ogien dopisuje
  if (k1('ArrowDown')) E.ch = (E.ch + HOF_CHARS.length - 1) % HOF_CHARS.length;
  if (k1('ArrowLeft')) e.name = e.name.slice(0, -1);
  if (k1('ControlLeft', 'ControlRight') || (k1('ArrowRight') && e.name.length < 12)) {
    if (e.name.length < 12) e.name += HOF_CHARS[E.ch]; else hofDone();
  }
  if (k1('Escape')) hofDone();
}
function hofDone() {
  const E = game.hofEdit;
  E.list[E.rank].name = E.list[E.rank].name.trim() || 'PIRATE';
  try { localStorage.setItem('tnt.hof', JSON.stringify(E.list)); } catch (e) {}
  game.hofEdit = null; game.hofT = performance.now(); game.anyLatch = true;
}
// mapa wyspy ($2F3770, work/export_map.py): czysty obraz + aktorzy mapy z wlasnego interpretera skryptow (25 Hz):
// flagi zamku zawsze, w etapie 1 statek wplywa po sciezce i spuszcza szalupe, dalej statek na kotwicy i znacznik etapu
const MapActors = makeActors({absPos: true});
function mapStart() {
  const S = L.mapActors.scripts;
  MapActors.load(L.mapActors); MapActors.spawn();
  for (const k of ['flag1', 'flag2', levelNo === 1 ? 'sail' : 'anchor']) if (S && S[k]) MapActors.spawnScript(...S[k]);   // pakiet demo: bez skryptow mapy
  game.mapOn = true; game.mapF = 0;
}
function mapTick() { if (!game.mapOn) mapStart(); if (game.mapF++ % 2 === 0) MapActors.tick(160, 100); }
function mapScreen() {
  cx.fillStyle = '#04a'; cx.fillRect(0, 0, W, SH);
  cx.drawImage(L.islandClean, 0, 0);
  if (game.mapOn) MapActors.draw(cx, L.mapAtlas, 0, 0, W, SH);
  // znacznik etapu (BOB $5A banku mapy, kotwica 6,12) w miejscach z tablicy gry $30B70E; miga 1 s / 0,6 s ($2F3C48),
  // tylko od etapu 2 ($2F3848: w etapie 1 zamiast niego wplywajacy statek)
  const [mx, my] = [[199, 159], [113, 120], [208, 89], [265, 22]][levelNo - 1];
  if (levelNo > 1 && performance.now() % 1600 < 1000) cx.drawImage(L.mapMarker, mx - 6, my - 12);
}
// ekran konca etapu: ocena, pozostaly czas, owoce i kawalki mapy z premiami ($2DF1E8), punkty i zloto
// --- sklep (oferty z gry: work/export_level.py shops) ---
function openShop(items) { game.shop = {items, col: 0, row: items.length >> 1, sel: items.length, dice: null, roll: null, text: null, moved: false, wait: 0, ft: 0}; game.state = 'shop'; Music.play('extra1'); pfFade(false); }   // $2DD9EC   // muzyka sklepu z dysku ($1790EEC = $B20F0)
function buy(it) {
  const S = game.shop;
  if (game.gold < it.price) { Sfx.play('nobuy'); return; }
  const ok = (() => {
    switch (it.act) {
      case 'life1': case 'life2': case 'life3':            // $2E5000: Life + 1/2/3, nie przy pelnym zdrowiu
        if (game.life >= game.maxLife) return false;
        game.life = Math.min(game.maxLife, game.life + +it.act[4]); return true;
      case 'maxlife': if (game.maxLife >= 13) return false; game.maxLife++; game.life++; return true;   // $2E50BC
      case 'life_up': if (game.lives >= 9) return false; game.lives++; return true;
      case 'dice': S.dice = {stake: it.price, pick: 0}; S.wait = 92; Music.seek(10, true); return true;   // $2DDB2E: stawka pobrana, melodia 11 od razu, dzingiel 8 (FIRE czeka 92 klatki)
      default:
        if (WEAPON[it.act]) {
          if (game.weapon === it.act) return false;      // $2E4F1A: ta sama bron - nie do kupienia
          game.weapon = it.act;
          if (AMMO.has(it.act)) game.ammoBob = it.bob;     // kule bez amunicji ($2EA2F4: tylko limit w locie)
          game.weaponBob = it.bob; return true;
        }
        game.inv[it.act] = (game.inv[it.act] || 0) + 1; game.tools++; game.toolBob[it.act] = it.bob; game.tool = it.act; return true;
    }
  })();
  if (ok) { game.gold -= it.price; Sfx.play('buy'); } else Sfx.play('nobuy');   // $2E891C / $2E892C; ramka zostaje niebieska
}
// sklep jak w grze ($2DD8CE): tlo z dysku (sprzedawca, ramki, 'Exit'), towary w siatce 2 x 3 (pozycje $2E1B24),
// cena obok ikony, opis wybranego towaru w lewym gornym oknie, niebieska ramka wyboru; ostatnia pozycja = Exit
const SHOP_SLOTS = [[19, 94], [76, 94], [19, 113], [76, 113], [19, 132], [76, 132]];
// rzut ($2E8932, emulator od klatki FIRE): reka $2E1EF0 (bank od $C88) w (247, 177) klatka 1 przez 6, potem (241, 157)
// klatka 4 i kosci $2E1E08 / $2E1E82 z (246, 126) / (261, 118): fizyka $2EEC2A (x + 1 przez 64 klatki, y co klatke + v,
// v + 1 co 4 klatki do 5, odbicie od y 157 z v = min(v, 4) - 1), toczenie klatki 0..5 co 5 (druga od 3), w 67 klatka 4
// na 3 i scianka rnd(6) + 5 ($2E1E6E / $2E1EDC) przez 150; w 78 wynik ($2EB206 -> $2E89C2: dwa razy czekanie na
// wygaszanie, potem wszystko 2 klatki pozniej); reka w 86 klatka 1, 188 (245, 177), 192 (238, 195), 196 znika, w 201 twarz
// sprzedawcy od nowa ($2DDC52). Swiat - 32 = ekran sklepu
const DICE_FACE_T = 67, DICE_RES_T = 78, DICE_END_T = 225;
function diceFall(d) {                                    // $2EEC80: jeden krok pionowy kosci
  if (d.vy >= 0 && d.y + d.vy >= 157) {
    d.y = 157; const v = Math.min(d.vy, 4) - 1;
    if (v <= 0) { d.vy = 0; return 0; }
    d.vy = -v; d.cnt = 0; return -1;
  }
  d.y += d.vy;
  if (d.cnt <= 0) { d.cnt = 4; if (d.vy < 5) d.vy++; }
  d.cnt--; return 1;
}
function rollTick(S) {
  const R = S.roll; R.t++;
  if (R.t === 6) R.dice = [{x: 246, y: 126, vy: 1, cnt: 0, ph: 0}, {x: 261, y: 118, vy: 1, cnt: 0, ph: 3}];   // $2E8988
  if (R.dice && R.t - 6 < 64) R.dice.forEach(d => {     // $2EEC50: 64 klatki, potem bez ruchu
    if (diceFall(d) < 0 && !R.snd) { R.snd = true; Sfx.play('throw'); }   // pierwsze odbicie: dzingiel 9 ($2E89BA)
    d.x++;
  });
  if (R.t === DICE_RES_T) {                               // $2E89C2: koniec gry, ramka wraca na towar, wynik do ruchu kursora
    const D = S.dice, win = ((R.faces[0] + R.faces[1]) & 1) === D.pick;
    if (win) game.gold += 2 * D.stake;                    // stawka pobrana przy zakupie
    S.text = win ? 'shop.won' : 'shop.lost'; S.dice = null; S.wait = 112;   // dzingiel 6 / 7: FIRE czeka do 190
    Music.seek(11, true);                                 // $2E8A2C: melodia 12 od razu
  }
  if (R.t === 201) S.ft = 0;                              // twarz sprzedawcy od nowa
  if (R.t >= DICE_END_T) S.roll = null;
}
function shopInput(press, k1) {
  const S = game.shop, n = S.items.length, rows = n >> 1;
  S.ft++; if (S.wait > 0) S.wait--;
  if (S.roll) rollTick(S);
  // joystick sklepu ($2E8710): LEFT, RIGHT, w grze w kosci bez UP / DOWN, FIRE; kazdy ruch: dzwiek (63,30) i nowy tekst
  const left = k1('ArrowLeft', 'KeyA'), right = k1('ArrowRight', 'KeyD');
  if (S.dice) {                                           // $2E87E8 / $2E882A: parzyste / nieparzyste (zmiana do wyniku)
    if (left) { S.dice.pick = 0; Sfx.play('cursor'); }
    if (right) { S.dice.pick = 1; Sfx.play('cursor'); }
    if (press && !S.wait && !S.roll) {                    // $2E8884: nie w czasie dzingla ($2E234C) ani rzutu ($2EB205)
      S.roll = {t: -1, faces: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)], dice: null};
      rollTick(S);
    }
    return;
  }
  const up = k1('ArrowUp', 'KeyW'), down = k1('ArrowDown', 'KeyS');
  if (left || right || up || down) {                      // kolumna $2EB232, wiersz $2EB234 (n / 2 = Exit, $30CBFE)
    if (left) S.col = 0; if (right) S.col = 1;
    if (up && S.row > 0) S.row--; if (down && S.row < rows) S.row++;
    S.sel = S.row < rows ? 2 * S.row + S.col : n; S.moved = true; S.text = null; Sfx.play('cursor');
  }
  // $2DDA86: wygaszenie ($2DFBCA), aktorzy i rekordy od nowa ($2DDF6A), wczytanie planszy z dysku (w porcie krotka
  // przerwa), potem gra od razu sterowalna i plansza rozjasnia sie ($2DFD14) - bez cegielek i bez komunikatu
  const leave = () => pfFade(true, () => {
    game.state = null; resetActors(true); game.fadeIn = 15; pl.latch = pl.fireLatch = true; Music.play('level' + levelNo);
  }, 10);
  if (k1('Escape', 'Backspace')) return leave();
  if (press && !S.wait) { if (S.sel === n) leave(); else buy(S.items[S.sel]); }
}
function shopBob(off, x, y, clipY) {                      // BOB banku sklepu w (x, y) swiata; clipY: dolna granica ($5E, $2E0AA4)
  const f = L.shopFrames[off]; if (!f) return;
  if (clipY) { cx.save(); cx.beginPath(); cx.rect(0, 0, W, clipY - 32); cx.clip(); }
  cx.drawImage(L.shopAtlas, f[0], f[1], f[2], f[3], x - 32 - f[4], y - 32 - f[5], f[2], f[3]);
  if (clipY) cx.restore();
}
// reka sprzedawcy ($2E1B62, czwarty aktor twarzy): 200 klatek nic, (247, 177) klatka 1 przez 6 (zza lady, dol do y 150),
// (241, 157) blok $2E1C0C co 7 klatek przez 200, (245, 177) i (238, 195) po 4, od nowa
const IDLE_HAND = [1, 2, 1, 3, 1, 2, 1, 3, 1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 4, 4, 2, 1, 2, 1, 1, 1, 1, 1];
function shopScreen() {
  const S = game.shop, n = S.items.length, R = S.roll;
  hud();
  cx.save(); cx.translate(0, PFY); cx.beginPath(); cx.rect(0, 0, W, H); cx.clip();
  cx.drawImage(L.shopBg, 0, 0);
  const K = L.shopKeeper, hand = fr => K.order[K.order.indexOf('c88') + fr];
  if (!R || R.t < 2 || R.t >= 201) {                      // twarz ($2E1B40): krok co 7 klatek; w czasie rzutu usunieta ($2E8932)
    for (const k of K.keeper) {
      const off = K.order[K.order.indexOf(k.base) + k.seq[Math.floor(S.ft / k.delay) % k.seq.length]], f = L.shopFrames[off];
      if (f && f[2] > 1) cx.drawImage(L.shopAtlas, f[0], f[1], f[2], f[3], k.x - f[4], k.y - f[5], f[2], f[3]);
    }
    const t = S.ft % 414;
    if (t >= 200) {
      const [fr, x, y, c] = t < 206 ? [1, 247, 177, 150] : t < 406 ? [IDLE_HAND[Math.floor((t - 206) / 7) % IDLE_HAND.length], 241, 157]
        : t < 410 ? [1, 245, 177, 150] : [1, 238, 195, 150];
      shopBob(hand(fr), x, y, c);
    }
  }
  S.items.forEach((it, i) => {
    const [x, y] = SHOP_SLOTS[i], f = L.shopFrames[it.bob];
    if (f) cx.drawImage(L.shopAtlas, f[0], f[1], f[2], f[3], x - f[4], y - f[5], f[2], f[3]);   // ikona z kotwica BOB-a w polu $2E1B24
    const pr = String(it.price); msgStr(pr, (i & 1 ? 115 : 58) - msgW(pr) + 3, y - 8 + glyph('0')[4]);   // emulator: cieniowana czcionka, do prawej (58 / 115)
  });
  if (R && R.t < 196) {                                   // reka rzutu ($2E1F1E)
    const [fr, x, y, c] = R.t < 6 ? [1, 247, 177, 150] : R.t < 86 ? [4, 241, 157] : R.t < 188 ? [1, 241, 157]
      : R.t < 192 ? [1, 245, 177, 150] : [1, 238, 195, 150];
    shopBob(hand(fr), x, y, c);
  }
  if (R && R.dice) {
    const order = L.shopOrder || (L.shopOrder = Object.keys(L.shopFrames).sort((a, b) => parseInt(a, 16) - parseInt(b, 16)));
    const base = order.indexOf('61dc');
    R.dice.forEach((d, i) => {
      const fr = R.t < DICE_FACE_T ? (Math.floor((R.t - 6) / 5) + d.ph) % 6 : R.t < DICE_FACE_T + 3 ? 4 : 4 + R.faces[i];
      shopBob(order[base + fr], d.x, d.y);
    });
  }
  // ramka wyboru (emulator): zaokraglona 57 x 20, kolumny od x 6 / 63, gora 15 px nad srodkiem rzedu; Exit od (36, 134);
  // w grze w kosci na (6, 44) / (63, 44) ($30CD28 w (66, 95) / (123, 95))
  const [sx, sy] = S.dice ? [S.dice.pick ? 63 : 6, 44] : S.sel < n ? [S.sel & 1 ? 63 : 6, SHOP_SLOTS[S.sel][1] - 15] : [36, 134];
  // dwie linie: zewnetrzna $339 z zaokraglonymi rogami, wewnetrzna $35B z kropkami $339 w rogach (emulator)
  cx.fillStyle = 'rgb(51,51,153)';
  cx.fillRect(sx + 1, sy, 56, 1); cx.fillRect(sx + 1, sy + 20, 56, 1); cx.fillRect(sx, sy + 1, 1, 19); cx.fillRect(sx + 57, sy + 1, 1, 19);
  for (const [x, y] of [[2, 2], [55, 2], [2, 18], [55, 18]]) cx.fillRect(sx + x, sy + y, 1, 1);
  cx.fillStyle = 'rgb(51,85,187)';
  cx.fillRect(sx + 1, sy + 1, 56, 1); cx.fillRect(sx + 1, sy + 19, 56, 1); cx.fillRect(sx + 1, sy + 2, 1, 17); cx.fillRect(sx + 56, sy + 2, 1, 17);
  // lewe gorne okno: wiersze co 9 px od y 6, od x 8 (spacja 6 px); opis towaru - tytul wysrodkowany na siatce 6 px, opis od
  // wiersza 2; teksty sklepu jak w pamieci gry: powitanie ($2CEA25), 'SEE YOU SOON' przy Exit po ruchu kursora ($30B322),
  // gra w kosci ($30AFFA), wynik ($2EB140) do ruchu kursora; czcionka okienek wiadomosci (cieniowana)
  const top = glyph('A')[4];
  if (!S.dice && !S.text && S.sel < n) {
    const d = tr('shop.items.' + S.items[S.sel].item), lines = Array.isArray(d) ? d : [String(d)];
    lines.forEach((l, i) => {
      if (!i) msgStr(l, 8 + 6 * Math.round((63.5 - msgW(l) / 2 - 7) / 6), 6 + top);   // tytul: w oryginale odstepy przed tekstem (siatka 6 px od x 7)
      else msgStr(l, 8, 24 + 9 * (i - 1) + top);
    });
  } else tr(S.dice ? 'shop.game' : S.text || (S.moved ? 'shop.bye' : 'shop.welcome')).forEach((l, i) => msgStr(l, 8, 6 + 9 * i + top));
  cx.restore();
}

// ekran konca etapu ($2DF1E8..$2DF3C8, ujecie emulatora po etapie 1): HUD zostaje, wiersze od x = 8 co 15 px
// (liczba do x = 200, 'X' w 208, mnoznik do 256, wynik do 312), potem 'PASSWORD FOR THE NEXT STAGE:' i 8 obrazkow
// hasla co 23 px od (72, 140), po jednym co 6 taktow ($2DE586); po ostatnim etapie 'YOU'VE MADE IT!!!'
function clearScreen() {
  cx.fillStyle = '#000'; cx.fillRect(0, 0, W, SH);
  hud();
  const B = game.bonus || {sec: 0, time: 0, fruits: 0, pieces: 0}, C = '#dc9', R = (s, x, y) => text(s, x - s.length * 8, y, C);
  center(tr('rating')[3], 35, C);                     // w grze zawsze "WELL DONE!" ($30AF51); reszta ocen to inny ekran
  const row = (label, n, mult, val, y) => { text(label, 8, y, C); R(n, 200, y); text('X', 208, y, C); R(mult, 256, y); R(String(val), 312, y); };
  row(tr('remaining_time'), Math.floor(B.sec / 60) + ':' + String(B.sec % 60).padStart(2, '0'), '3000', B.time, 65);
  row(tr('collected_fruits'), String(game.fruits), '100', B.fruits, 80);
  row(tr('remaining_maps'), String(game.pieces), '1000', B.pieces, 95);
  if (B.steps && B.steps.length) { game.frame++; return; }
  B.done = B.done || game.frame;
  if (levelNo === LEVEL_COUNT) center(tr('made_it'), 136, C);
  else {
    const P = L.menu.passwords[levelNo - 1] || [];
    text(tr('password'), 8, 120, C);
    P.forEach((v, i) => { if (game.frame - B.done > 6 * i) cx.drawImage(L.passIcons, v * 16, 0, 16, 16, 72 + 23 * i, 140, 16, 16); });
  }
  game.frame++;
}
// --- menu po tytule (modul Hall of Fame $309DF0, work/export_menu.py): wstega START / PASSWORD, gora/dol wybor;
// haslo = 8 obrazkow z 6 ($30C47A): lewo/prawo pole (20 px), gora/dol obrazek, FIRE sprawdza z tablica $30C438
// (wiersz k = start od etapu k + 2) i wraca do menu; bez ruchu 200 klatek -> Hall of Fame ($30C48E). Muzyka extra4.
// port: pod wstega WCZYTAJ GRE (lewo/prawo: slot auto/1-3, domyslnie najnowszy zapis) i OPCJE
function menuOpen(cycle) {
  const next = cycle && game.menu ? game.menu.next ^ 1 : 0;
  game.state = 'menu'; game.menu = {sel: 0, pw: null, t: 200, next, slot: newestSlot()}; game.screenT = performance.now();
  Music.play('extra4');                                 // ten sam utwor: bez przerwy
}
function menuInput(press, k1) {
  const M = game.menu, P = M.pw, U = k1('ArrowUp', 'KeyW'), D = k1('ArrowDown', 'KeyS'), Lf = k1('ArrowLeft', 'KeyA'), Rt = k1('ArrowRight', 'KeyD');
  if (press || U || D || Lf || Rt) M.t = 200;
  else if (!P && --M.t <= 0) { game.state = M.next ? 'credits' : 'hof'; game.hofT = game.screenT = performance.now(); return; }   // na zmiane
  if (!P) {
    if (U || D) { M.sel = (M.sel + (D ? 1 : 3)) % 4; Sfx.play('tick'); }   // START, PASSWORD, (port) WCZYTAJ GRE, OPCJE
    if (M.sel === 2 && (Lf || Rt) && M.slot !== undefined) { M.slot = nextSlot(M.slot, Rt ? 1 : -1); Sfx.play('tick'); }
    if (press) {
      if (M.sel === 3) openOptions();
      else if (M.sel === 2) { if (M.slot !== undefined && saveInfo(M.slot)) loadGame(M.slot); else Sfx.play('locked'); }
      else if (M.sel) M.pw = {v: [0, 0, 0, 0, 0, 0, 0, 0], c: 0}; else { game.state = 'map'; Music.play('map'); }
    }
    return;
  }
  if (Lf) P.c = Math.max(0, P.c - 1);
  if (Rt) P.c = Math.min(7, P.c + 1);
  if (U) P.v[P.c] = (P.v[P.c] + 1) % 6;
  if (D) P.v[P.c] = (P.v[P.c] + 5) % 6;
  if (press) {
    const k = L.menu.passwords.findIndex(r => r.every((x, i) => x === P.v[i]));
    if (k >= 0) { levelNo = k + 2; Sfx.play('item'); } else Sfx.play('locked');
    M.pw = null; M.sel = 0;
  }
}
function unfold(draw) {                                 // nowy ekran menu / tabeli / autorow rozwija sie od srodka
  const p = Math.min(1, (performance.now() - (game.screenT || 0)) / 400);
  if (p >= 1) { draw(); return; }
  cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height); cx.restore();
  cx.save(); cx.translate(0, cv.height / 2); cx.scale(1, Math.max(0.02, p)); cx.translate(0, -cv.height / 2); draw(); cx.restore();
}
function menuScreen() {
  screenSize(320, 243);
  const M = game.menu, P = M.pw, [bx, by] = L.menu.slot;
  cx.drawImage(L.menuImg, 0, (P ? 2 : M.sel % 2) * 243, 320, 243, 0, 0, 320, 243);
  if (!P) {                                             // dodatkowe pozycje portu pod wstega (oba wiersze wstegi zgaszone)
    if (M.sel >= 2) cx.drawImage(L.menuImg, 0, 243 + 165, 320, 18, 0, 165, 320, 18);
    const has = M.slot !== undefined && saveInfo(M.slot);
    const item = (t, y, on, dim) => { const x = (320 - t.length * 8) >> 1; text(t, x + 1, y + 1, '#402010'); text(t, x, y, on ? '#e0c090' : dim ? '#503820' : '#806040'); };
    const slot = has ? ' ' + (M.slot === 'auto' ? tr('pause.auto') : M.slot) : '';
    item(tr('pause.load') + slot, 201, M.sel === 2, !has);
    item(tr('pause.options'), 215, M.sel === 3);
    if (M.sel === 2) { const t = has ? slotText(M.slot) : tr('pause.empty'); text(t, (320 - t.length * 8) >> 1, 230, '#a08050'); }
    return;
  }
  P.v.forEach((v, i) => cx.drawImage(L.menuIcons, v * 18, 0, 18, 18, bx + 1 + 20 * i, by + 1, 18, 18));
  cx.strokeStyle = L.menu.cursor; cx.lineWidth = 1; cx.strokeRect(bx + 20 * P.c + 0.5, by + 0.5, 19, 19);
}
// zakonczenie gry (segment SEG2, work/export_ending.py): nieruchomy statek o zachodzie, po 70 klatkach tekst przewija
// sie w gore o 1 px co 3 klatki, widoczny tylko na niebie jako tlo o polowie jasnosci (EHB); wiersze co 10 px od x = 16,
// $01..$02 = panel (przyciemniony prostokat x 8..311, tekst w nim jasny). FIRE konczy (petla $A6: btst #7, $BFE001)
const endCv = Object.assign(document.createElement('canvas'), {width: 320, height: 243}), endCx = endCv.getContext('2d');
function endGlyph(ch, x, y) {
  const g = L.ending.glyphs[ch], i = L.fontMap[ch], e = L.fontExtMap[ch];
  if (g) { g.forEach((r, k) => { for (let c = 0; c < 8; c++) if (r[c] === '#') endCx.fillRect(x + c, y + k, 1, 1); }); return; }
  if (i !== undefined) endCx.drawImage(L.font, i % 16 * 8, Math.floor(i / 16) * 9, 8, 9, x, y, 8, 9);
  else if (e !== undefined) endCx.drawImage(L.fontExt, e * 8, 0, 8, 12, x, y - 2, 8, 12);   // polskie litery
}
function endingScreen() {
  screenSize(320, 243);
  cx.drawImage(L.endingBg, 0, 0);
  const t = Math.max(0, game.frame - 70) / 3 | 0;
  endCx.globalCompositeOperation = 'source-over'; endCx.clearRect(0, 0, 320, 243); endCx.fillStyle = '#fff';
  let panel = false;
  L.ending.lines.forEach((l, i) => {
    const y = 243 + 10 * i - t;                         // gora komorki glifu
    if (l === '\x01') panel = true; else if (l === '\x02') panel = false;
    if (y < -10 || y > 243) return;
    if (panel) { endCx.globalCompositeOperation = 'source-over'; endCx.fillRect(8, y + 1, 304, 10); endCx.globalCompositeOperation = 'destination-out'; }
    else endCx.globalCompositeOperation = 'source-over';
    const pl = LANG.ending && LANG.ending[l.trim()], s = pl ? l.slice(0, l.length - l.trimStart().length) + pl : l;   // tlumaczenie z wcieciem
    [...s].forEach((ch, k) => { if (ch > ' ') endGlyph(ch, 16 + 8 * k, y); });
  });
  endCx.globalCompositeOperation = 'destination-in'; endCx.drawImage(L.endingSky, 0, 0);   // statek i wyspa zaslaniaja
  endCx.globalCompositeOperation = 'source-in'; endCx.drawImage(L.endingDark, 0, 0);
  cx.drawImage(endCv, 0, 0);
  game.frame++;
}
// wstep do etapu: tytul w cudzyslowie (pomaranczowy), opis (niebieski), - PRESS BUTTON -
// tekst etapu (ujecie emulatora): tytul w y = 35, wiersze od 56 co 11, '- PRESS BUTTON -' w (96, 187) miga
// 20 klatek / 10 klatek ($2DD006); przycisk -> 'GET READY, FLYNN' w (96, 101) na czarnym ekranie, dzingiel 1,
// potem rozpakowanie poziomu: razem ok. 265 klatek (emulator); dalej HUD rozjasnia sie przez 10 klatek, plansza czarna
// do 42, potem odslania sie cegielkami 8 x 3 (na zmiane przesuniete) przez 20 klatek i gra rusza
function introScreen() {
  screenSize(320, 256); cx.fillStyle = '#000'; cx.fillRect(0, 0, 320, 256);   // pelny ekran PAL jak historia
  const lines = (tr('intro') || [])[levelNo - 1] || [];
  center('"' + (tr('level')[levelNo - 1] || '') + '"', 35, '#e85');
  lines.forEach((l, i) => center(l, 56 + 11 * i, '#79f'));
  if (performance.now() % 600 < 400) center(tr('press_button'), 187, '#79f');
}
function readyStart() {
  game.state = 'ready'; game.readyT = performance.now();
  Music.jump(1, levelNo === 4 ? 25 : 11);
}
function readyScreen() {
  screenSize(320, 256); cx.fillStyle = '#000'; cx.fillRect(0, 0, 320, 256);
  center(tr('get_ready'), 101, '#e85');
  if (performance.now() - game.readyT > 5300) { game.state = 'reveal'; game.revealT = 0; }
}
function revealTick() {                                 // po odslonieciu Life napelnia sie: segment co 2 klatki od 76 (emulator)
  const t = ++game.revealT, D = game.revealDoor; if (!D) game.lifeFill = t < 76 ? 0 : (t - 74) >> 1;
  if (D === 'area' && t === 62 - (game.doorBlack ?? 21) + (game.doorStand ?? 1)) pl.frame = pl.face > 0 ? 0 : 29;   // klatke po przejsciu postoj (emulator; doorBlack / doorStand: testy z nagraniami 4x)
  if (t >= (D ? 62 : 86)) {
    game.state = null; game.lifeFill = game.revealDoor = null; pl.latch = pl.fireLatch = true; saveGame('auto'); if (D === 'area') { game.fadeIn = 15; game.upLock = 16; game.frame = 1; if (pl.dieNext) pl.dieNext = 1; }   // petla glowna od nowa po przejsciu: takt (kolce, drzwi) w klatkach parzystych od oddania sterowania (emulator 4x, R3)   // $2DD30A (emulator 4x, D4)
    // po odrodzeniu bez blokady UP; okno $2EB13C zostaje z chwili smierci (emulator 4x: 10 -> skok dopiero po 10 klatkach)
    // petla glowna rusza od nowa 5 klatek po oddaniu sterowania: faza 5, pierwszy takt wtedy (emulator 4x, L3: takty po smierci
    // w innej parzystosci klatek niz przed)
    if (game.revealRespawn) { game.revealRespawn = false; pl.latch = pl.fireLatch = false; pl.ground = floorAt(pl.x, pl.y + 1); game.frame = 0; game.phase = 5; game.loopHold = 5; }
  }
}
function bricks(n) {                                     // czarne cegielki 8 x 3: odslonietych rang n (0..6) - rzad w cegielce + parzystosc
  cx.fillStyle = '#000';
  for (let y = 0; y < H; y++) for (let p = 0; p < 2; p++) {
    if (p * 3 + y % 3 < n) continue;
    for (let xb = (p + Math.floor(y / 3)) & 1; xb * 8 < VW; xb += 2) cx.fillRect(xb * 8 - OX, PFY + y, 8, 1);
  }
}
function revealMask() {
  const t = game.revealT;
  cx.fillStyle = '#000';
  if (t < 42 || game.revealDoor === 'area') cx.fillRect(-OX, PFY, VW, H);   // szeroki ekran: plansza od -OX
  else bricks(Math.floor((t - 42) * 6 / 20));
  if (t < 10 && !game.revealDoor) { cx.globalAlpha = 1 - t / 10; cx.fillRect(-OX, 0, VW, SH); cx.globalAlpha = 1; }
}

// GAME OVER ($2DE1BA, work/export_gameover.py): dzingiel 10, 80 klatek stopklatki, plansza gasnie, w jej miejscu tapeta
// z czaszek; napisy 'Game' (72x36) z gory i 'Over' (66x31) z dolu jada po 132 px (1 px/takt), plansza rozjasnia sie co
// 2 klatki ($30CD42); po dojechaniu dzwiek ($FFC0 6,22) i FIRE -> Hall of Fame
function gameOverStart() { game.state = 'gameover'; game.goT = 0; Music.jump(10); }
function gameOverScreen() {
  const t = game.goT, s = t - 96;
  if (s < 0) { draw(); if (t >= 80) { cx.globalAlpha = (t - 80) / 16; cx.fillStyle = '#000'; cx.fillRect(-OX, PFY, VW, H); cx.globalAlpha = 1; } return; }
  hud();
  cx.save(); cx.beginPath(); cx.rect(-OX, PFY, VW, H); cx.clip(); cx.translate(0, PFY);
  cx.fillStyle = '#000'; cx.fillRect(-OX, 0, VW, H);
  const row = 160 * ((levelNo - 1) & 3), d = Math.min(132, s >> 1);
  for (let x = -320; x < VW; x += 320) if (x + 320 > -OX) cx.drawImage(L.gameoverImg, 0, row, 320, 160, x, 0, 320, 160);
  cx.drawImage(L.gameoverImg, 320, row, 72, 36, 103, 51 - 132 + d, 72, 36);       // 'Game': x 192 - 48 - 41, y 4 + d - 37
  cx.drawImage(L.gameoverImg, 392, row, 66, 31, 156, 82 + 132 - d, 66, 31);       // 'Over': x 208 - 48 - 4, y 300 - d - 38
  cx.globalAlpha = 1 - Math.min(1, (s >> 1) / 16); cx.fillStyle = '#000'; cx.fillRect(-OX, 0, VW, H); cx.globalAlpha = 1;
  cx.restore();
}
function gameOverInput(press) {
  game.goT++;
  if (game.goT === 96 + 264) Sfx.play('gameover');
  if (press && game.goT > 96 + 264) gameOver();
}
// koniec zyc: od nowa od etapu 1, ekran tytulowy
function gameOver() {                                   // wynik w Hall of Fame -> wpisanie imienia, potem tabela i tytul
  const score = game.score, rank = hofRank(score);
  newGame(); levelNo = 1;
  startLevel(1).then(() => {
    Music.play('title'); game.titleT = 0;
    if (rank < 0) { game.state = 'title'; return; }
    const list = hofList(); list.splice(rank, 0, {name: '', score}); list.length = 10;
    game.hofEdit = {list, rank, ch: 0}; game.state = 'hof'; Music.play('hof_new');   // $309FDC: muzyka nowego wyniku
  });
}
function newGame() {
  Object.assign(game, {score: 0, gold: 0, popups: [], life: 5, lives: 3, hurt: 0, maxLife: 5, weapon: 'start', weaponBob: null, ammo: 0, inv: {}, shots: [], vit: 0, vitShow: 0, tool: null, toolBob: {}, bombs: [], bell: null, shake: null, lit: {}});
  for (const o of L.objs.objects) { o.taken = o.spoke = false; o.hits = 0; }
  game.checkpoint = null;                                // nowa gra od startu poziomu, nie od starego punktu kontrolnego
  Actors.spawn(); respawn(); game.crew = countCrew(); game.tools = 0;
}
function pickups() {
  for (const o of L.objs.objects) {
    const v = VALUE[o.type], key = KEYS[o.type], g = L.objs.gfx[o.type], fr = FRUIT[o.type], qid = L.quest && L.quest.items[o.type];
    // dziennik ($2E7636, dotyk): strona tylko w kucki (stan 1) - FIRE przy nim to zwykly cios (emulator 4x, L1)
    if (o.type === BOOK) {
      if (o.taken || o.off || !g || !pl.crouchSt) continue;
      const l = o.x - g.ax, t = o.y - g.ay;
      if (pl.x + P.HALF < l || pl.x - P.HALF > l + g.w || pl.y < t || pl.y - P.HEIGHT > t + g.h) continue;
      o.taken = true; game.tools++;
      if (o.text) { game.pages.push(o.text); game.page = game.pages.length - 1; game.inv.book = game.pages.length; game.tool = 'book'; message(o.text); }
      continue;
    }
    if (o.taken || o.off || !g || (!v && key === undefined && !fr && !qid && o.type !== ROPE && o.type !== ROTTEN && o.type !== PIECE && o.type !== POTION && o.type !== MAP && !TOOLS.has(o.type))) continue;
    const l = o.x - g.ax, t = o.y - g.ay;
    if (pl.x + P.HALF < l || pl.x - P.HALF > l + g.w || pl.y < t || pl.y - P.HEIGHT > t + g.h) continue;
    o.taken = true;
    if (!qid && o.type !== PIECE) Sfx.play(o.type === POTION ? 'potion' : o.type === ROTTEN ? 'rotten' : o.type === MAP ? 'item' : 'pickup');
    if (qid) { giveQuest(qid); continue; }
    if (o.type === ROPE) { game.inv.rope = Math.min(99, (game.inv.rope || 0) + 1); game.tool = 'rope'; continue; }   // $2E637C
    if (fr) { game.vit += 3 * fr; game.fruits++; game.score += FRUIT_PTS[fr - 1]; game.popups.push({x: o.x, y: pl.y - 26, v: FRUIT_PTS[fr - 1], k: 0}); }
    else if (o.type === ROTTEN) game.vit = game.vitShow = 0;
    else if (o.type === PIECE) { game.pieces = Math.min(6, game.pieces + 1); if (game.pieces === 6 && L.treasure) game.treasureWait = 4; else Music.jump(0); }   // $3096E8: bez dzwieku, zdarzenie muzyczne 0
    else if (v) { game.score += v; game.gold += v; game.popups.push({x: o.x, y: pl.y - 26, v, k: 0}); }   // liczba nad przedmiotem
    else if (key !== undefined) game.keys[key]++;
    else if (o.type === POTION) game.life = Math.min(5, game.life + 3);   // $2E75EA
    else if (o.type === MAP) {                         // $2E7684: kompas w panelu (wirowanie 30 taktow), TIME pokazuje czas ucieczki
      game.maps++; game.compass = true; game.compassSpin = 30; if (!game.timer) game.timeShow = L.escape * 50;
    }
    else game.tools++;
  }
  // odliczanie ucieczki (level<n>.json escape, dane poziomu +$58/+$5A): koniec czasu = utrata zycia, czas od nowa
  if (game.timer > 0 && game.timer <= 30 * 50 && game.timer % 50 === 0) Sfx.play('warn');   // $3091B2: ostatnie 30 s co sekunde
  if (game.timer > 0 && --game.timer === 0) { game.life = 0; game.hurt = 0; game.timer = L.escape * 50; }
  for (const o of L.objs.objects)                       // punkt kontrolny: odrodzenie tutaj
    if (CHECKPOINT.has(o.type) && !o.off && Math.abs(pl.x - o.x) < 16 && pl.y > o.y - 40 && pl.y < o.y + 24) game.checkpoint = {x: o.x, y: o.y, area: L.areaId};
  // licznik witamin w HUD idzie do celu o 1 na takt; pelny (62) = +1 Life albo 5000 pkt ($309750)
  if (game.vitShow < game.vit && ++game.vitShow >= 62) {
    game.vit -= 62; game.vitShow = 0;
    if (game.life < game.maxLife) { game.life++; Sfx.play('potion'); } else game.score += 5000;
  } else if (game.vitShow > game.vit) game.vitShow--;
  // $2E7300: liczba punktow ($2E1A82) w (x przedmiotu, y gracza - 26), sciezka $2EB926 co takt, potem znika (emulator: klatka L2)
  if ((game.frame & 1) === 0) for (const p of game.popups) if (p.k !== undefined) p.y += POP_DY[p.k++] || 0;
  game.popups = game.popups.filter(p => p.k === undefined ? p.t > 0 : p.k <= POP_DY.length);
}

// skrzynie skarbow (level.json chests, $2E4990): gracz w prostokacie x-24..x+40, y-24..y+16 przy zamknietym kaflu ->
// kafel otwarty (pod woda 3 babelki), potem co 5 taktow ($2E4ABE) jeden przedmiot z listy wylatuje z (x + 2..13, y + 4)
// z vy -3..-5 i vx +-1, odbija sie (granica odbicia z opisu typu, natywne $2EFA86: kawalek mapy i mikstura 4, reszta 6).
// Tylko jedna skrzynia naraz; stan skrzyni = kafel mapy (zapis gry), kolejka w game.chest.
const CHEST_CAP = {[PIECE]: 4, [POTION]: 4};
function chestsTick() {
  const C = L.chests, q = game.chest;
  if (q) {
    if (q.cnt-- > 0) return;
    q.cnt = 4;
    const t = q.items[q.i++] === '2f30ee' ? POTION : q.items[q.i - 1];   // $2F30EE: druga mikstura (ta sama obsluga $2E75EA)
    if (q.i >= q.items.length) game.chest = null;
    L.objs.objects.push({x: q.x + 2 + Math.floor(Math.random() * 12), y: q.y, type: t,
      brain: {vy: -3 - Math.floor(Math.random() * 3), acc: 0, cap: CHEST_CAP[t] || 6, iter: 2, vx: q.i & 1 ? 1 : -1, clink: t !== PIECE}});
    Sfx.play('throw');
    return;
  }
  if (!C) return;
  for (const e of C.list) {
    if (L.map[e.idx] !== C.shut || pl.x + P.HALF < e.x - 24 || pl.x - P.HALF > e.x + 40 || pl.y < e.y - 24 || pl.y - P.HEIGHT > e.y + 16) continue;
    L.map[e.idx] = C.open;
    if (L.waterY < e.y) [[0x2e14bc, 8, 0], [0x2e15a2, 11, -8], [0x2e15fc, 4, -4]].forEach(([s, dx, dy]) => Actors.spawnScript(s, e.x + dx, e.y + dy));
    if (e.items.length) game.chest = {items: e.items, i: 0, cnt: 0, x: e.x, y: e.y + 4};
    return;
  }
}

// kruche kamienie (level.json brittle, $2F4B1A): ladowanie z ciosem w dol kruszy kamien pod stopami,
// pod nim kafel tla i czasem przedmiot (tablica $2F24A0)
function crumble() {
  const B = L.brittle, row = (pl.y + 1) >> 4;
  for (const d of [0, -8, 7]) {
    const ix = row * L.w + ((pl.x + d) >> 4), e = B && B.list.find(e => e.idx === ix);
    if (!e || L.map[ix] !== B.tile) continue;
    L.map[ix] = e.under; Sfx.play('crumble');
    if (e.item) L.objs.objects.push({x: (ix % L.w) * TS + 6, y: row * TS + 15, type: e.item});
    return;
  }
}

const keys = {};
const pressed = new Set();                            // nacisniecia od ostatniego kroku (menu: krotkie stukniecie i autopowtarzanie)
addEventListener('keydown', e => { keys[e.code] = true; pressed.add(e.code); if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
const k = (...c) => c.some(x => keys[x]) ? 1 : 0;

// start poziomu (stopy gracza) z rekordu gracza w zrzucie - level<n>.json 'start'
// kafle smierci (atrybut $8000, $2F51A2 -> $2E674A): nie zabijaja od razu - Life -2 ($30CBE4, petla glowna $2DD36E:
// nietykalnosc $50, dzwieki jak przy trafieniu), stan skoku skasowany; jesli gracz to przezyje (albo byl nietykalny)
// i nie jest w wodzie - podrzut profilem zwyklego skoku ($2F1CE2)
function spikeHit() {
  if (game.hurt > 0) return false;
  game.life = Math.max(0, game.life - 2); game.hurt = 80;
  if (game.life < 3) Sfx.play('die');
  Sfx.play('hurt'); return true;
}
// $2E679A: podrzut z kafla smierci profilem $2F1CE2 przez $2F48E0 (nie skok: klatka spadania 88, bez ciosu w dol), od
// nastepnej klatki; po profilu dalej +4 (emulator, poziom 2: 271 -> 236 -> 239 co do piksela)
const SPIKE_HOP = Object.assign([0, -4, -4, -4, -3, -3, -3, -2, -2, -2, -2, -1, -1, -1, -1, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 2, 2, 3, 3, 4, 4], {spike: true});   // spike: tez ponowienie (spikes)
function spikes() {
  if (spikeHit()) { pl.stomp = pl.jump = false; pl.chute = 0; }   // $2E676A: koniec skoku
  // $2F51A2 dziala w petli glownej (co takt) i zaczyna profil od nowa, tez gdy juz trwa (tez z UP / DOWN): na linie ze
  // stopami gleboko w kolcach w nastepnej klatce jeszcze dy starego profilu, nowy od kolejnej (emulator 4x, R3: 4 x -4)
  // trwajacy profil (podrzut, odbicie po ciosie w dol) tez od nowa; na linie tylko ze stopami juz w kafelku kolcow
  const again = pl.lift && (!pl.rope || attr(pl.x, pl.y + 1) & DEADLY);
  if (game.life > 0 && !pl.water && (!pl.climb || pl.rope) && (!pl.lift || again)) {
    // nowy profil od nastepnej klatki - w niej jeszcze dy starego (jeden wskaznik profilu, emulator 4x, R3: -3 z
    // wstrzymanego po skoku albo z odbicia, potem -4, -4, -4)
    const old = again ? [pl.lift, pl.liftI] : pl.liftResume ? pl.liftResume.p : null;
    pl.lift = old ? Object.assign([old[0][Math.min(old[1], old[0].length - 1)], ...SPIKE_HOP.slice(1)], {spike: true, hop: true}) : SPIKE_HOP;
    pl.liftI = 0; pl.hopStart = pl.lift[0] ? 1 : 2; pl.hopV = 1; pl.hopT = 6; pl.spikeJust = 2; pl.liftResume = pl.liftPaused = null; pl.jumpScript = false; if (!pl.rope) pl.vy = 0; pl.ground = false; pl.plat = null; pl.fallB = 128;   // na linie ruch DOWN trwa; jeden wskaznik profilu - nowy zastepuje wstrzymany
  }
}
function respawn() {
  const c = game.checkpoint;
  if (c) enterArea(c.area);
  Object.assign(pl, {x: c ? c.x : L.start[0], y: c ? c.y : L.start[1], fx: 0, fy: 0, vx: 0, vy: 0, climb: false, rope: false, ropeCool: 0, hang: 0, attack: 0, pose: 0, lockT: 0, lift: null, atDoor: null, fallB: 128, hopFall: null, chute: 0, crawl: false, wp: null, water: false, jumpReq: false, as: null, swimDir: 0, idleDone: false,
    // stan z poprzedniego zycia / poziomu nie przechodzi dalej (np. jump po smierci w skoku zmienial pierwsze spadanie)
    jump: false, jumpScript: false, stomp: false, crouch: false, st1Land: false, crawlSt: false, dieNext: 0, clamp: null, landedAir: false, airFace: 0, crouchSt: false, liftPaused: null, liftResume: null, liftEnd: false, jumpPose: false, relFrame: false, wallHold: false, upDead: false, chuteWin: 0, plat: null, liftI: 0, fallT: 0, vp: undefined, wasWater: false, surf: false,
    spin: 0, throwT: 0, wallStand: 0, crateBlock: false, landed: false, pickT: 0, cycle: null, latch: false, fireLatch: false, wt: 'norm', ground: false,
    anim: 0, face: 1, frame: 0, idle: 2400, seq: null}); game.crateGhost = 0; follow(true);
}

const approach = (v, t, a) => v < t ? Math.min(t, v + a) : Math.max(t, v - a);
// chod ($2E9086, wskaznik $9B88): w prawo -(a0), w lewo (a0)+, bez kierunku powrot do srodka; wartosc = dx w px/kl.
// (emulator: rozbieg 0,1,1,1,2,1,2,1,2,2, wybieg 2,1,2,1,2,1,1,1,0). Tablice w chip: zwykla $9BAC (srodek 10), sliska
// podloga - atrybut kafla $4000 ($2F1112, poziom 4) $9BF8 (srodek 40): dlugi rozbieg i poslizg
const SWIM_VT = [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, -1, 0, -1, 0, -1, 0, -1, -1, -1, -1];   // $9D5E
const WALK_T = {
  norm: {c: 10, t: [2, 2, 1, 2, 1, 2, 1, 1, 1, 0, 0, 0, -1, -1, -1, -2, -1, -2, -1, -2, -2]},
  water: {c: 30, t: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]},   // $9C9E, w wodzie ($2F137E): poslizg ok. 20 px po puszczeniu (emulator)
  crawl: {c: 4, t: [1, 1, 1, 1, 0, -1, -1, -1, -1]},   // $9D9C: czolganie (wybieg 2 px w prawo, 3 px w lewo)
  ice: {c: 40, t: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, -1, -1, -1, -1, -1, -2, -1, -2, -1, -2, -1, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2]}};
const SLIPPY = 0x4000;
function walkDx(dir, keep) {
  const T = WALK_T[pl.wt || 'norm'], t = T.t;
  let p = pl.wp ?? T.c, dx = 0;
  if (dir > 0) { p = Math.max(1, p); dx = t[p - 1]; if (p > 1) p--; }   // $2E92B8: -(a0), wskaznik na poczatku tablicy nie jest zapisywany
  else if (dir < 0) { dx = t[p]; if (p < t.length - 1) p++; }
  else if (keep) dx = t[p];                             // w pradzie bez wybiegu ($9DDC)
  else if (p < T.c) dx = t[++p];                        // $2E8D14: krok do srodka, potem odczyt
  else if (p > T.c) dx = t[--p];
  pl.wp = p; return dx;
}
// $2F1542: prad wodny przesuwa wskaznik |dx| + 1 razy w swoja strone; na koncu tablicy dx = predkosc pradu
function walkPush(c) {
  const T = WALK_T[pl.wt || 'norm'], t = T.t;
  let p = pl.wp ?? T.c, dx = 0;
  for (let i = 0; i <= Math.abs(c); i++) {
    if (c < 0) { if (p < t.length - 1) dx = t[p++]; else dx = c; }
    else { if (p > 1) dx = t[--p]; else dx = c; }
  }
  pl.wp = p; return dx;
}
// $2F125E: zmiana tablicy przy stanieciu na innej podlodze - ta sama predkosc, szukana od srodka
function walkTable(k) {
  if ((pl.wt || 'norm') === k) return;
  const O = WALK_T[pl.wt || 'norm'], v = O.t[pl.wp ?? O.c], N = WALK_T[k];
  let p = N.c;
  if (v > 0) while (p > 1 && N.t[p] !== v) p--;
  else if (v < 0) while (p < N.t.length - 1 && N.t[p] !== v) p++;
  pl.wt = k; pl.wp = p;
}
// stopy siegaja +-8 px (emulator: z polki konczacej sie na x=79 spada dopiero przy x=88)
// dno w wodzie ($2F4C50): kafel z bitem 0 bez bitu 8 w wierszu y pod srodkiem i krancami ramki
const ropeAt = (x = pl.x, y = pl.y) => attr(x, y - 22) & ROPE_T;   // $30B8DC: kafel liny na wysokosci rak
const waterFloor = (x, y) => { const b = playerBox(); return [b[0], 0, b[2]].some(d => { const t = attr(x + d, y); return t & FLOOR && !(t & 0x100); }); };
// ramka kolizji biezacej klatki gracza (naglowek klatki: x1, y1, x2, y2 wzgledem stop)
const playerBox = () => { const b = (L.player.frames[pl.frame] || {}).box; return b && b.length > 3 ? b : [-5, -26, 8, 0]; };
// $2F4B86: podloga pod srodkiem i pod krancami ramki kolizji biezacej klatki (naglowek BOB-a: x1, x2 - chod w prawo -5..8,
// w lewo -6..7, czolganie w lewo -6..11); bez klatki +-8
const floorAt = (x, y) => {
  const b = (L.player.frames[pl.frame] || {}).box, l = b && b.length > 2 ? b[0] : -8, r = b && b.length > 2 ? b[2] : 7;
  // w wodzie ($2F4C50) kafel z bitem 8 nie jest dnem - gracz przez niego nurkuje
  return y % TS === 0 && [l, 0, r].some(d => { const t = attr(x + d, y); return t & FLOOR && !(pl.water && t & 0x100); });   // $2F4B86: tylko bit 0, takze pod murem (emulator 4x, L2: skok przy krawedzi bloku - ladowanie x + 8)
};

// sciany ($2F4440, sondy z polozenia z poczatku klatki, $2F08C0): na ladzie x + 10 / x - 9 w wierszu stop i w wierszu
// y + y1 + 4 ramki klatki; w wodzie ($2F4EB2) krawedz ramki + dx w wierszach y - 1 + y2 i y - 1 + y1. Ruch blokowany
// w calosci (emulator: pod woda przy scianie od x 304 gracz staje na 292); $2E8EBC: wskaznik chodu na srodek, na ladzie
// (nie w spadaniu) poza postoju, choc kierunek dalej wcisniety
function wallBlocked(dx) {
  const b = playerBox(), s = Math.sign(dx);
  if (pl.water) {   // wpadniecie do wody w tej klatce: ramka juz z klatki plywania ($2EB1BC przed ruchem, emulator 4x, I4)
    const w = !pl.wasWater && (L.player.frames[pl.face > 0 ? 20 : 49] || {}).box, c = w && w.length > 3 ? w : b, x = pl.x + (s > 0 ? c[2] : c[0]) + dx;
    return [pl.y - 1 + c[3], pl.y - 1 + c[1]].some(y => attr(x, y) & WALL);
  }
  const x = pl.x + (s > 0 ? 10 : -9), crate = game.crateGhost > 0 && L.crates ? L.crates.tile : -1;
  return [pl.y, pl.y + b[1] + 4].some(y => attr(x, y) & WALL && L.map[(y >> 4) * L.w + (x >> 4)] !== crate);
}
function moveX(dx) {
  const s = Math.sign(dx);
  if (wallBlocked(dx) || Actors.gateDir(pl.x, pl.y, playerBox()) === s) {
    pl.vx = 0; pl.fx = 0; pl.wp = null; pl.hitRaw = s; pl.hitNow = true;
    const cx = pl.x + (s > 0 ? 10 : -9);                 // $2F4546: sciana-skrzynia ustawia $9F1C (FIRE ja podnosi), zwykla go nie zmienia
    if (L.crates && !pl.water && !pl.jump && !game.carry && L.map[(pl.y >> 4) * L.w + (cx >> 4)] === L.crates.tile) pl.crateBlock = true;
    // postoj klatke pozniej ($2F4554 przy ruchu nastepnej klatki): w tej klatce zwykla obsluga kierunku (chod dalej, po
    // ladowaniu chod od poczatku - emulator, poziom 2: 87 -> 39 -> 29)
    if (pl.wallSkip) pl.wallSkip = false;
    else if (!pl.water && (pl.ground || pl.jump || pl.lift && floorAt(pl.x, pl.y + 1))) { if (pl.wallStand !== s) pl.wallHold = true; pl.wallStand = pl.hitS = s; }   // podrzut z kolcow jeszcze na podlodze (emulator, L2: 10, 10, 0)
    return;
  }
  pl.crateBlock = false;                                 // $2F44FE: ruch bez sciany kasuje $9F1C
  for (let i = 0; i < Math.abs(dx); i++) {
    // niesiona skrzynia nie ma wlasnej sondy sciany (emulator, poziom 3: gracz idzie dalej, skrzynia nad schodami)
    pl.x += s; pl.hitRaw = 0;
    if (pl.wallStand) { pl.wallStand = 0; pl.cycle = null; }   // sciana sie skonczyla (np. po skoku): chod od poczatku (emulator, poziom 2)
  }
}
function moveY(dy, dropThrough, fx = pl.x, noFloor = false) {
  const s = Math.sign(dy);
  // skok w sufit (emulator, poziom 2 przy klatce): ruch w gore odrzucony w calosci, gdy ktorykolwiek piksel trafilby w
  // sufit; profil skoku przechodzi na opadanie (klatka 0, potem +1 x 4)
  // $2F4FC6: srodek i krance ramki biezacej klatki (x, x + $62, x + $66), wiersz y + gora ramki + dy (emulator 4x, L3: skok
  // przy bloku nad prawym krancem ramki x + 8)
  const bx = playerBox(), cx = [bx[0], 0, bx[2]];
  // wiersz glowa + dy (x sprzed ruchu poziomego - obiekt sprite'a); w tym samym wierszu kafla co glowa bez sufitu ($2F5084)
  // - emulator 4x, C2: skok pod blokiem nad prawym krancem ramki przechodzi, poki glowa w wierszu pod nim
  if (s < 0 && pl.jump && !pl.lift && !pl.water && !pl.climb) {
    const head = pl.y + bx[1], tgt = head + dy;
    if ((tgt & ~15) !== (head & ~15) && cx.some(d => attr(fx + d, tgt) & CEIL)) {
      if (cx.some(d => attr(fx + d, tgt) & DEADLY)) spikeHit();   // $2F500A: kolce w suficie
      pl.vy = 2; pl.fy = 0; return;
    }
  }
  // pod woda w gore ($2E8CDE -> $2F4FC6): sufit sondowany 4 px nad gora ramki biezacej klatki (x, x + lewa, x + prawa
  // krawedz); kafel $100 ponizej linii wody nie jest sufitem - ruch w calosci albo wcale (emulator, poziom 1: 346 -> 338)
  if (s < 0 && pl.water && !pl.climb) {
    const b = playerBox(), y = pl.y + b[1] - 4;
    const ts = [0, b[0], b[2]].map(d => attr(fx + d, y));   // x sprzed ruchu poziomego tej klatki (obiekt sprite'a, emulator 4x, L4)
    if (ts.some(t => t & CEIL && !(t & 0x100 && pl.y >= L.waterY))) { pl.vy = 0; pl.fy = 0; return; }
    if (ts.some(t => t & DEADLY)) spikeHit();             // $2F500A -> $2F50AA: kolce w suficie rania, ale nie blokuja
    pl.y += dy; return;
  }
  // profil w gore ($2F490E -> $2F4FC6): sufit w wierszu glowa + dy (srodek i krance ramki); w tym samym wierszu kafla co
  // glowa ruch w calosci, przy wejsciu w nowy wiersz glowa staje na dolnym pikselu kafla sufitu i profil $2F1D68 (opadanie)
  // - emulator 4x, L2: odbicie od wroga w sufit 204 -> 201, potem 0, 0, 0, +1...
  if (s < 0 && pl.lift && !pl.rope && !pl.climb) {
    const b = playerBox(), head = pl.y + b[1], tgt = head + dy;
    if ([0, b[0], b[2]].some(d => attr(fx + d, tgt) & CEIL) && (tgt & ~15) !== (head & ~15)) { dy = (tgt & ~15) + 15 - head; pl.lift = CEIL_FALL; pl.liftI = 0; }
    pl.y += dy; return;
  }
  for (let i = 0; i < Math.abs(dy); i++) {
    if (s > 0) {                                       // w dol: podloga tylko na gornej krawedzi kafla
      // schodzenie po drabinie przechodzi tylko przez podloge bedaca drabina (szczyt), nie przez podloge pod nia
      if (!noFloor && floorAt(fx, pl.y + 1) && !(dropThrough && attr(pl.x, pl.y + 1) & LADDER)) {
        // $2F4B86 przycina tylko ruch do podlogi (dy = kafel - y - 1); ladowanie dopiero, gdy w nastepnej klatce dy = 0 -
        // gdy gracz zdazy zejsc z krawedzi, spada dalej ta sama predkoscia (emulator, poziom 3: 253 -> 255 -> 259)
        if (i > 0 && !pl.climb && !pl.water) pl.clamp = {vy: pl.vy, fallT: pl.fallT};
        pl.vy = 0; pl.fy = 0; pl.ground = true; return;
      }
    } else if ([-P.HALF + 1, P.HALF - 1].some(d => attr(pl.x + d, pl.y - P.HEIGHT - 1) & CEIL)) {
      if ([-P.HALF + 1, P.HALF - 1].some(d => attr(pl.x + d, pl.y - P.HEIGHT - 1) & DEADLY)) spikeHit();   // $2F500A: kolce w suficie
      pl.vy = 0; pl.fy = 0; return;
    }
    pl.y += s;
  }
}
// ruch w cwiartkach piksela: akumulator ulamkow -> calkowite przesuniecia jak w oryginale
function step(v, f) { const t = v + f, d = Math.floor(t / Q); return [d, t - d * Q]; }

// smierc gracza ($2E67B2, ujecie emulatora): obrot x5 po 3 klatki (lad $2F19F8, woda $2F1A5A), klatka koncowa obrotu,
// 97..101 po 6 klatek, potem kupka 99 przesunieta o 11 px w dol ($0FF6 -> $9F1A). Na ladzie podskok z profilu $2F1E52
// (dy w gore na klatke) i spadek, w wodzie cialo opada zygzakiem (13 px w bok, ok. 18 px w dol na 68 klatek) na dno.
// Gra czeka na FIRE, ok. 61 klatek pozniej powrot w punkcie kontrolnym (utrata zycia)
const DEATH_SPIN = {land: [0, 85, 86, 84, 29, 58], water: [96, 95, 94, 93, 92, 91]};
const DEATH_HOP = [0, 3, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1];
// smierc od upadku ($2F0B2A / $2F0C84, emulator): zapas spadania $30CC4C = 128 maleje o predkosc (= piksele w dol);
// ladowanie z zapasem < 0 -> dzwiek (22,53), klatka 97 ($2F1B52), podskok z profilu $2F1C22 i spadek przez podlogi
// pod ekran; po 50 taktach petli glownej ($30CC22, 100 klatek) Life = 0 i zwykle czekanie na FIRE
// profil $2F1C22 (dy na klatke), potem $0FFB: +4 do konca (emulator, poziom 3: 383 -> 368 -> pod ekran)
const FALL_HOP = [-4, -3, -2, -2, -1, -1, -1, 0, -1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3];
const CEIL_FALL = [0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4];   // $2F1D68: opadanie po uderzeniu profilu w sufit, potem +4
const BOUNCE = [0, -3, -3, -2, -2, -2, -1, -1, -1, 0, -1, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4];   // $2F1E98
function fallDeath() {
  Sfx.play('falldie'); game.dying = {fall: true, t: 0, lift: 0, fy: 0, wait: 0, vy: 0};
  Object.assign(pl, {attack: 0, pose: 0, lockT: 0, vx: 0, vy: 0, climb: false, rope: false, lift: null, crouch: false, crawl: false, chute: 0, wp: null, atDoor: null}); pl.surf = false; game.hurt = 0;
}
function deathStep(fire) {
  const D = game.dying, spin = D.water ? DEATH_SPIN.water : DEATH_SPIN.land;
  D.t++; pl.flip = false;
  if (D.fall) {
    pl.frame = 97;
    // przez podlogi do dolu ekranu: ruch tylko do ok. 238 px pod kamera gry (A4; emulator 4x: L3 stop na 239 i 240, 235 i 236
    // jeszcze w dol); $2F0C26: po 50 taktach ($30CC22) gracz stoi ($30CC75)
    if (D.t <= 100 && pl.y - (Math.round(cam.y) - 48) <= 238) pl.y += D.lift < FALL_HOP.length ? FALL_HOP[D.lift++] : 4;
    if (D.t === 100) { game.life = 0; game.lives--; Music.jump(6, levelNo === 4 ? 25 : 11); }   // $30CC22 = 50 taktow petli glownej (25 Hz); $2DE5EC: zycie mniej ($1311A)
  }
  else if (D.t <= 90) pl.frame = spin[Math.floor((D.t - 1) / 3) % 6];
  else if (D.t <= 96) pl.frame = spin[5];
  else if (D.t <= 126) pl.frame = 97 + Math.floor((D.t - 97) / 6);
  else { pl.frame = 99; pl.dyOff = 11; }
  if (D.fall) { /* ruch wyzej */ }
  else if (!D.water) {
    if (D.lift < DEATH_HOP.length) moveY(-DEATH_HOP[D.lift++]);
    else if (!floorAt(pl.x, pl.y + 1)) { pl.vy = Math.min(P.FALL, pl.vy + P.GRAV); moveY(Math.max(1, Math.floor(pl.vy / Q))); }
  } else if (D.t > 126 && !(attr(pl.x, pl.y + 1) & FLOOR)) {
    const s = D.t - 126; D.fy += 18 / 68;
    const dy = Math.floor(D.fy); D.fy -= dy; if (dy) moveY(dy);
    pl.x = D.x0 + Math.round(6.5 * (1 - Math.cos(2 * Math.PI * s / 68)));
  }
  if (!fire) pl.fireLatch = false;
  const done = D.fall ? D.t > 100 : D.t > 126;          // upadek: FIRE dopiero po 50 taktach $30CC22 (emulator 4x: L3 FIRE przy t = 74..88 pominiety)
  if (!D.fall && D.t === 127) game.lives--;             // zycie mniej przy smierci, nie przy odrodzeniu (emulator: $1311A 1 -> 0 i GAME OVER)
  if (game.lives <= 0 && D.t >= (D.fall ? 100 : 127)) { game.dying = null; pl.dyOff = 0; gameOverStart(); return; }   // $2DE124: bez zyc od razu GAME OVER
  if (done && !D.wait && fire && !pl.fireLatch) { D.wait = game.respawnWait || 62; pl.fireLatch = true; }   // respawnWait: testy z nagraniami 4x (work/cmp_rnd.js)   // $2DE446: wygaszenie i etap od nowa - ok. 61 klatek na A500 (emulator: 61-63, z procesorem 4x 41)
  if (D.wait && D.wait <= (game.respawnBlank || 10)) pl.frame = 0;   // etap od nowa: obiekt gracza zerowany juz przed ustawieniem polozenia (emulator A500: 10 klatek, 4x: 6)
  if (D.wait && --D.wait === 0) {
    const cw = pl.chuteWin;
    game.dying = null; pl.dyOff = 0; game.exitWave = 0; game.life = game.maxLife; resetActors(false); respawn(); pl.chuteWin = cw;   // $2DDFF2
    game.state = 'reveal'; game.revealT = 86 - (game.respawnFrozen || 63); game.lifeFill = 0; game.revealRespawn = true;   // $2DE446 -> $2DCD3C: jak start etapu bez tekstu - czarna plansza, cegielki, Life od nowa; sterowanie 63 klatki po odrodzeniu (emulator A500, 4x: 46)
  }
}
function update() {
  waterTick(); flashTick(); if (pl.spikeJust) pl.spikeJust--;
  const LEFT = k('ArrowLeft', 'KeyA'), RIGHT = k('ArrowRight', 'KeyD');
  // $30CCCA: 16 klatek rozjasniania po przejsciu - obsluga UP pominieta ($2E945C: bez skoku, drzwi, drabiny)
  const upLock = game.upLock > 0; if (upLock) game.upLock--;
  const UP = upLock ? 0 : k('ArrowUp', 'KeyW', 'Space'), DOWN = k('ArrowDown', 'KeyS');
  const FIRE = k('ControlLeft', 'ControlRight', 'KeyX', 'KeyJ');
  if (game.dying) { deathStep(FIRE); enemies25(); return; }   // $2DE174: tylko FIRE ($BFE001 bit 7)
  if (game.exitWave) {                                   // pozegnanie przy wyjsciu, swiat stoi
    pl.frame = (game.exitWave >> 2) & 1 ? 28 : 27; pl.flip = false;
    if (--game.exitWave === 0) levelClear();
    return;
  }
  if (!FIRE) pl.fireLatch = false;
  // czolganie (stan 3, $2E9B0A): DOWN + kierunek na ziemi; 1 px/kl., klatki co 5. Pod niskim stropem ($2F0ADE: CEIL w rzedzie
  // nad cialem przy x-8 / x+8 -> $2EB217) nie da sie wstac ani skoczyc - samo LEFT/RIGHT czolga dalej, bez kierunku klatka 18/47
  // woda ($2F0F4C, w przerwaniu przed joystickiem - cala obsluga kierunkow widzi juz flage z tej pozycji): wejscie, gdy
  // y > linia + 2; flaga trwa na powierzchni, znika przy wyskoku (pl.jumpReq z poprzedniej klatki) albo gdy woda opadnie
  // pod gracza (y + 5 <= linia, $2F0E4A)
  // flaga wody $30CC7C znika tylko przy wyskoku (UP przy powierzchni, $2E9552) albo przy opadaniu linii wody, gdy y + 5 <=
  // linia ($2F0E4A) - wypornosc z DOWN moze wyniesc gracza nad linie, a on dalej plywa (emulator 4x, L1: 320 przy linii 325)
  const WA = L.areas && L.areas[L.areaId], lowering = !!WA && WA.waterT != null && WA.water != null && WA.waterT > WA.water;
  pl.water = !pl.jumpReq && (pl.y > L.waterY + 2 || !!pl.water && (pl.y + 5 > L.waterY || !lowering && !pl.climb));
  if (pl.water && pl.rope) pl.rope = pl.climb = false;   // zejscie po linie do wody: plywanie (emulator 4x, I4)
  // ladowanie bez ruchu w tej klatce (profil albo skok z dy > 0 tuz nad podloga): oryginal laduje przed obsluga joysticka
  // ($2F490E / $2F0CFC przed $2E8ADC), wiec DOWN kuca juz w klatce ladowania (emulator: odbicie -> 2 od razu)
  const landing0 = !pl.ground && !pl.water && !pl.climb && !pl.plat && !pl.stomp && floorAt(pl.x, pl.y + 1) && (pl.lift
    ? !pl.rope && pl.lift[Math.min(pl.liftI, pl.lift.length - 1)] > 0 : pl.jump && Math.floor(Math.min(P.FALL, pl.vy + P.GRAV) / Q) > 0);
  // podrzut z kolcow ze stopami na powierzchni bloku (start i przejscie w gore, x z poczatku klatki): joystick i klatka jak
  // na ziemi - DOWN kuca, bez poslizgu (emulator, L2: 88 -> 10 -> 88 w gorze, ladowanie z DOWN na kolcach -> 2, 2, 88)
  const hopFloor = pl.liftFloor = !!pl.lift?.spike && !pl.rope && !pl.jump && floorAt(pl.x, pl.y + 1);   // animate: klatka z ziemi; z flaga skoku ($30CC54 trwa przy nietykalnosci) to lot
  // podrzut z kolcow w powietrzu to spadanie ($2F0B22): predkosc $30CC28 od 1, licznik $30CC2A od 6, potem +1 co 3 klatki
  // do 4 - profil daje ruch, ale predkosc idzie w dy przy chwycie liny (emulator 4x, R3: chwyt z dy 1 / 3 / 4)
  if (pl.lift?.spike && !pl.rope && !hopFloor && --pl.hopT < 0) { pl.hopT = 2; pl.hopV = Math.min(4, pl.hopV + 1); }
  // zejscie z krawedzi w tej klatce ($2F0B22 przed joystickiem, x z poczatku klatki) to juz spadanie: DOWN bez kucania, FIRE
  // bez ciosu (emulator 4x, L2 / L3); w blokadzie ciosu ($30CC63) obsluga spadania nie dziala
  const walkOff = pl.ground && !pl.plat && !pl.climb && !pl.jumpReq && !(!pl.stomp && (pl.lockT > 0 || pl.throwT > 0)) && !floorAt(pl.x, pl.y + 1);
  const onFoot = (pl.ground && !walkOff || landing0 || hopFloor) && !pl.water && !pl.climb && !pl.dieNext, H0 = RIGHT - LEFT;   // ladowanie ze smiercia: flagi skoku / spadania zostaja (joystick w powietrzu)
  pl.push = H0 !== 0;
  pl.lowCeil = pl.crawl && [-8, 8].some(d => attr(pl.x + d, pl.y - 22) & CEIL);
  // $30CC63: cios / rzut na ziemi - dyspozytor joysticka ($2E8B16) pomija kierunki: bez ruchu, obrotu, skoku i kucania
  const lock0 = pl.lockT > 0 || pl.throwT > 0, lock = (pl.ground || !!pl.lift?.spike && !pl.rope) && !pl.stomp && lock0, attack0 = pl.attack > 0;   // cios na starcie podrzutu z kolcow: blokada trwa w powietrzu (emulator 4x, C2)
  const crawl0 = pl.crawl; pl.crawl = onFoot && (lock ? pl.crawl : DOWN && H0 !== 0 || pl.crawl && pl.lowCeil);
  // flagi chodu $2EB20D / $2EB20E (pl.swimDir): kierunek na ziemi je ustawia ($2E9150), w spadaniu kasuje tylko flage
  // swojego kierunku ($2E9110); kasuja je tez skok, kucniecie, czolganie, spadochron, obrot do drzwi i postoj (nizej) -
  // w wodzie kierunek z ustawiona flaga nie zmienia skryptu plywania (emulator 4x, L1)
  if (H0 && !pl.water && !pl.climb && !pl.rope && !pl.chute && !lock && !pl.jump && !pl.jumpReq) { if (onFoot) pl.swimDir = H0; else if (pl.swimDir === H0) pl.swimDir = 0; }   // w skoku ($30CC54) bez zmian
  if (pl.crawl && !pl.crawlSt) pl.swimDir = 0;           // $2E9B12: poczatek stanu czolgania
  // stan czolgania (3, $9DD4 / $30CC81) trwa w powietrzu (zsuniecie, podrzut z kolcow): po ladowaniu $2F1106 od razu
  // tablica czolgania (emulator 4x, L2: czolganie w kolce, podrzut, ladowanie z DOWN + RIGHT -> +1)
  const crawlSt0 = pl.crawlSt;
  // chwyt liny z czolgania: stan 3 trwa, puszczenie DOWN daje stan 0 ($2E8B78), nie 6 - cios z tablicy ziemi az do
  // wejscia w tryb wspinaczki (emulator 4x, R3)
  if (!pl.rope || pl.ropeClimb) pl.ropeSt0 = false; else if (crawlSt0 && !DOWN) pl.ropeSt0 = true;
  // stan 3 w powietrzu przy scianie: ruch (przed joystickiem) wchodzi w sciane i $2E8EBC przy $9DD4 ustawia skrypt
  // stojacego czolgania, koniec czolgania ($2E8B7E) zeruje $9DD4 dopiero potem; bez kierunku nic go nie zmienia
  // (spadanie pomija postoj) - klatka 18 / 47 w locie do kierunku albo ladowania (emulator 4x, rndbCoc 4827)
  if (H0 || onFoot || pl.water || pl.climb) pl.airCrawlStop = false; else if (crawlSt0 && !pl.crawl && pl.hitRaw) pl.airCrawlStop = true;
  if (pl.crawl) pl.crawlSt = game.crawled = true; else if (onFoot || pl.water || pl.climb || pl.jump || !DOWN) pl.crawlSt = false;   // puszczenie DOWN konczy go tez w powietrzu, sam kierunek nie (emulator 4x, L2: $9DD4 trwa z DOWN)
  // $2E9B26 w obsludze DOWN: pierwsza klatka o 1 dluzej (emulator: 6 przy opoznieniu 5); zaraz po ladowaniu ze spadania 5
  // po spadaniu: pierwsza klatka 5, gdy stan 1 / 3 trwal z ziemi przez spadanie, 6 przy DOWN wcisnietym w powietrzu (emulator 4x)
  pl.crawlNew = pl.crawl && !crawl0;
  if (pl.crawl && !crawl0) { pl.anim = pl.wasAir && !landing0 && !pl.landJump && (crawlSt0 || pl.crouchSt && !pl.hopSt) ? -1 : -2; pl.wallStand = 0; pl.wallSkip = !crawlSt0; }   // sciana dla kroku z tej klatki dopiero w ruchu nastepnej ($2F4554): pierwsza klatka czolgania jej nie liczy (emulator 4x, L2: 14, 14, 18)   // po ladowaniu ze spadania 5, ze skoku 6 (emulator, poziomy 2 i 4)
  // koniec czolgania ($2E8B7E) jest po obsludze kierunku: z kierunkiem w tej klatce jeszcze skrypt czolgania, chod od nastepnej
  // bez kierunku i DOWN tez klatka czolgania jeszcze raz, gdy wskaznik chodu poza srodkiem (krok do srodka, postoj $2E8D3A
  // dopiero w srodku - emulator 4x, L3: 47, potem 29); z samym DOWN od razu kucanie
  // stan 3 z lotu podrzutu ($9DD4 trwa w powietrzu): po ladowaniu z kierunkiem bez DOWN obsluga kierunku ustawia jeszcze
  // skrypt czolgania (emulator 4x, rndb2oc 2323); bez kierunku od razu postoj (rndbC2oc)
  pl.crawlEnd = (crawl0 || crawlSt0 && H0 !== 0) && !pl.crawl && onFoot && (H0 !== 0 || !DOWN && !UP && (pl.wp ?? WALK_T[pl.wt || 'norm'].c) !== WALK_T[pl.wt || 'norm'].c);
  pl.crouch = onFoot && !pl.crawl && (lock ? pl.crouch : !!DOWN);
  // spadochron ($2E945A, emulator): w powietrzu DOWN otwiera okno 10 klatek ($2EB13C), UP w nim = spadochron ($2EB20C):
  // dzwiek (55,0), klatka 6/35, od razu 2 px/kl. w dol, w bok tablica wodna (1 px/kl.), bez ciosu i bez smierci
  // od upadku; konczy go ziemia albo woda
  const inAir = (!pl.ground || walkOff) && !pl.water && !pl.climb && (!pl.lift || pl.jump || pl.lift.spike && !hopFloor) && !pl.plat && !landing0;   // odbicie ($30CC54) tez; podrzut z kolcow w powietrzu to spadanie ($2F0B22 dziala - emulator, L2: DOWN, potem UP = spadochron)
  const chuteWin0 = pl.chuteWin;                       // klatka smierci od upadku: joystick juz nie dziala (okno zostaje)
  if (DOWN && inAir) pl.chuteWin = 10; else if (pl.chuteWin > 0) pl.chuteWin--;
  // kucanie (stan 1, $30B8AE): DOWN na ziemi ze stanu innego niz 1 otwiera to samo okno ($2E9C3E), a UP w oknie poza
  // powietrzem nic nie robi ($2E946E -> $2E988C: bez skoku, drabiny, drzwi i wybiegu). Stan 0 przywraca chod, skok,
  // drabina / lina / woda i obsluga postoju po puszczeniu DOWN (wskaznik chodu w srodku, $2E8E8C)
  const WT0 = WALK_T[pl.wt || 'norm'].c;
  const crouchSt0 = pl.crouchSt;                       // stan 1 sprzed tej klatki (ladowanie w stanie 1)
  if (hopFloor && pl.liftI > (pl.hopStart ?? 2) && crouchSt0 && DOWN) pl.st1Land = true;   // podrzut przez powierzchnie bloku w stanie 1: DOWN bez skryptu kucania, jak po ladowaniu (emulator 4x, rndbC3oc 4096)
  if (pl.crouch && !(attr(pl.x, pl.y + 1) & LADDER)) { if (!pl.crouchSt) { pl.chuteWin = 10; pl.swimDir = 0; } pl.crouchSt = true; }   // $2E9C54
  const upDead = UP && pl.chuteWin > 0 && !inAir && !lock; pl.upDead = upDead;   // w blokadzie ciosu obsluga UP pominieta: wybieg trwa (emulator, L2: cios w kucki z UP+FIRE)
  const chuteGo = UP && inAir && pl.chuteWin > 0 && !pl.chute;   // wlaczany na koncu klatki (UP po ruchu tej klatki)
  // drabina, drzwi, klatka i kafel akcji tylko bez kierunku: obsluga UP pomija je, gdy kierunek juz ustawil d7 ($2E9592);
  // UP przed FIRE ($2E8B40): UP+FIRE przy drzwiach / kaflu akcji = obrot i akcja, bez ciosu (emulator 4x, I4)
  const doorUp = doorCheck(UP && !upDead && !H0 && !lock, landing0);
  if (doorUp) { pl.latch = true; pl.swimDir = 0; }   // $2E99B0; w blokadzie ciosu ($30CC63) obsluga UP pominieta - obrot dopiero po niej (emulator 4x, D4)                  // gora przy drzwiach = obrot do drzwi, nie skok
  if (FIRE && !pl.fireLatch && !pl.attack && !pl.climb && action(UP && !upDead && !H0, landing0)) pl.fireLatch = true;
  const crateDrop = game.carry && !FIRE;               // $2E8BA8 -> $2EA840: odstawienie po ruchu poziomym tej klatki
  if (game.crateGhost > 0) game.crateGhost--;
  // $2E44DE: przytrzymywana plytka puszcza, gdy gracz rusza, skacze albo puszcza UP lub FIRE: zestaw B, dzwiek (58,1)
  if (game.plateHold && (RIGHT - LEFT || !pl.ground || !UP || !FIRE)) { setTiles(game.plateHold, 'b'); Sfx.play('unmech'); game.plateHold = null; }
  // FIRE w skoku ($30CC54, $2E9EB2) = cios w dol: klatka 8/37 bez broni, trwa do puszczenia FIRE ($2E8BC4); przy zwyklym
  // spadaniu ($30CC59, $2E9D08) FIRE nic nie robi; bron tylko na ziemi i na drabinie
  const airborne = !pl.ground && !pl.climb && !pl.plat && !pl.water;
  const stompEnd = pl.stompEnd = !FIRE && pl.stomp;                  // $2E8BCC: koniec ciosu w dol ustawia skrypt skoku juz z nowym zwrotem
  if (stompEnd && !pl.jump) pl.jumpScript = true;     // tez w podrzucie z kolcow / odbiciu: klatka skoku do nowego skryptu (emulator 4x, R3)
  if (pl.ground || pl.climb || pl.water) pl.jumpScript = false;
  if (!FIRE) pl.stomp = false;
  // UP jest obslugiwane przed FIRE ($2E8B40 -> $2E9C82): UP i FIRE naraz na ziemi = skok i poza ciosu w powietrzu (emulator)
  // podloga jak przy samym skoku ($2E988E): czolganie poza krawedz z UP+FIRE to spadanie, bez ciosu (emulator 4x, rndb14oc)
  const upJump = UP && !upDead && !pl.latch && !pl.lowCeil && !lock && (pl.ground && (floorAt(pl.x, pl.y + 1) || pl.plat) || hopFloor) && !pl.water && !pl.climb && !pl.jumpReq && (H0 || !(attr(pl.x, pl.y - 8) & LADDER)
    && !(attr(pl.x, pl.y - 6) & ENTRANCE) && !cageAt() && !(L.actions && attr(pl.x, pl.y - 22) & ACTION)) && !ropeAt()
    || UP && !lock && !upDead && pl.water && pl.y <= L.waterY + 2   // wyskok z wody ($2E953E -> $2E9818) tez przed FIRE
    || UP && !lock0 && !upDead && pl.rope && (!ropeAt() || !pl.latch && H0 !== 0);   // koniec liny u gory / skok z liny z kierunkiem ($2E96E6 / $2E9628 -> $2E9818): FIRE w tej klatce to cios w dol (emulator 4x, rndbR4oc 1599)
  const stompNow = FIRE && !pl.fireLatch && (airborne && !landing0 && (pl.jump || pl.jumpScript) || pl.jumpReq || upJump) && !pl.chute;   // $2E9EC4: skrypt ciosu w dol juz z nowym zwrotem; $30CC54 juz od zgloszenia skoku (emulator 4x, L1: FIRE klatke po skoku ze szczytu drabiny)
  if (stompNow) { pl.fireLatch = pl.stomp = true; pl.attack = pl.pose = pl.lockT = 0; }
  if (FIRE && !pl.fireLatch && !pl.attack && !pl.water && !game.carry && !pl.chute && (!airborne && !walkOff || hopFloor || landing0)) {   // na drabinie tez (klatki 80/81); start podrzutu z kolcow to ziemia; ladowanie przed joystickiem (emulator 4x, C2)
    pl.fireLatch = true; pl.ropeAnim = false;          // cios / rzut z liny: skrypt wspinaczki konczy sie (dalej zawis 64/65)
    if (AMMO.has(game.weapon)) {                         // rzut ($2EA2F4/$2EA3EC/$2EA166): bez amunicji, w locie naraz
      const S = SHOT[game.weapon];                       // najwyzej 3 kule ($30CCD6) albo 1 ognista kula ($38(A4))
      if (game.shots.filter(s => !s.fire || s.t > FIRE_T - 24 && !s.side).length < S.max) {   // $30CC4F: nowa kula po 12 taktach ognia
        Sfx.play('swing'); pl.throwT = 9;                 // (37, 12) jak zamach; poza rzutu 89/90 przez 3 x 3 klatki ($2F1928)
        const [ox, oxl, oy] = (SHOT_AT[game.weapon] || SHOT_AT.balls)[pl.crouch || pl.crouchSt ? 1 : pl.climb ? 2 : 0];
        game.shots.push({x: pl.x + (pl.face > 0 ? ox : oxl), y: pl.y + oy, vx: pl.face * S.v, t: S.t, str: WEAPON[game.weapon], bob: game.ammoBob,
          kind: game.weapon, bounces: S.bounces, brain: S.brain && {vy: S.brain[0], acc: 0, cap: S.brain[1], iter: S.brain[2]}});
      }
    } else {
      pl.attack = pl.attackN = ATTACK_T[game.weapon] || ATTACK; Sfx.play(WEAPON_SFX[game.weapon] || 'swing'); pl.climbAtk0 = false;   // kolejny cios na drabinie: poza z drabiny
      // $30CC63 kasuje dopiero koniec animacji ciosu ($2F4602/$2F46CC, znaczniki $FF5/$FF8): emulator - start i miecz
      // (opoznienie 3) poza 6, kierunki od 10. klatki; szabla (5) 10 / 16, morgensztern (8) 16 / 25
      const d = ATTACK_D[game.weapon] || 3; pl.pose = 2 * d; pl.lockT = 3 * d + 1;
    }
  }
  // $2E9E9E: kazda obsluga FIRE (tez w wodzie, przy spadaniu, na spadochronie, z blokada) zapala $2EB203 - cios, rzut i
  // cios w dol tylko po ponownym wcisnieciu (emulator: FIRE w spadaniu, po ladowaniu bez ciosu)
  if (FIRE) pl.fireLatch = true;
  for (const sh of game.shots) {
    const pf = (SHOT[sh.kind] || {}).perFrame;
    if (sh.brain && (pf || (game.frame & 1) === 0)) {      // fizyka co takt (ognista co klatke)
      const r = Actors.physics(sh);
      if (r <= 0 && sh.kind === 'special_balls') { if (--sh.bounces <= 0) sh.t = 0; else { sh.brain.vy = -3; sh.brain.acc = 0; } }
      else if (r <= 0 && sh.kind === 'fireball') {     // ogien na ziemi ($2E0B60): dzwiek (26,0), plomien + 2 boczne ($2E0BF8 / $2E0C92)
        Object.assign(sh, {brain: null, vx: 0, fire: true, t: FIRE_T, str: 8, y: ((sh.y + 8) & ~15) - 1}); Sfx.play('fire');   // $2EA24A: na podlodze
        for (const side of [-1, 1]) game.shots.push({...sh, side, x0: sh.x, t: FIRE_T - 4});
      }
    }
    if (pf) sh.x += sh.vx; else if ((game.frame & 1) === 0) sh.x += 2 * sh.vx;   // kule co takt 6 px, ognista co klatke 2 px
    sh.t--;
    if (sh.side) sh.x = sh.x0 + sh.side * FIRE_DX[Math.min(7, (FIRE_T - 4 - sh.t) >> 1)];   // boczne: 12 px w 8 taktow ($2E0C62)
    // $2EA34A: kula zelazna w kaflu sciany - oblok (x, y - 4), kula stoi jeszcze 13 klatek bez trafien (sciezka $2E188A)
    if (sh.kind === 'iron_balls' && sh.vx && attr(sh.x, sh.y) & WALL) { Actors.spawnScript(0x2e176a, sh.x, sh.y - 4); Object.assign(sh, {vx: 0, t: 13, spent: true}); }
    else if (sh.vx && sh.kind !== 'iron_balls' && attr(sh.x + sh.vx * 2, sh.y) & WALL) sh.vx = -sh.vx;
    if (sh.t === 0 && !sh.fire && !sh.spent) Actors.spawnScript(0x2e176a, sh.x, sh.y - 4);   // $2EA39A / $2EA48C: oblok
    if (sh.x < cam.x - 16 || sh.x > cam.x + W + 16) sh.t = 0;
    for (const b of Actors.boxes()) if (sh.t > 0 && !sh.spent && sh.x >= b.l && sh.x <= b.l + b.w && sh.y >= b.t && sh.y <= b.t + b.h && Actors.hit(b.a, sh.str)) {
      if (sh.kind === 'iron_balls' || sh.kind === 'special_balls') { Actors.spawnScript(0x2e176a, sh.x, sh.y - 4); Object.assign(sh, {vx: 0, brain: null, t: 13, spent: true}); }   // jak sciana ($2EA39A)
      // ognista kula to obiekt broni gracza (A4+$38): trafia jak miecz i leci dalej
      if (b.a.dying) Sfx.play(b.a.kill || 'kill');
    }
  }
  game.shots = game.shots.filter(sh => sh.t > 0);
  // w kucki i przy ciosie na ziemi gracz stoi; kierunek zmienia sie tylko poza ciosem. FIRE ($2E9C82) jest obslugiwany po
  // kierunkach ($2E8B0C), wiec w klatce zamachu ruch i obrot jeszcze dzialaja (blokada od nastepnej)
  const dir = pl.crouch || lock ? 0 : RIGHT - LEFT;
  // w powietrzu kierunek ustawia skrypt skoku / spadania / spadochronu ze starym zwrotem ($2E8FF4 przed $2E9448: $2EB222),
  // nowy zwrot widac od nastepnej klatki z kierunkiem (emulator: obrot w skoku klatke pozniej)
  const air0 = (!pl.ground || pl.jumpReq) && !pl.water && !pl.climb && !pl.plat;   // skok zgloszony klatke wczesniej: skrypt skoku juz ze starym zwrotem (emulator 4x, L2)
  if (!air0 || stompEnd || stompNow) pl.airFace = 0; else if (RIGHT - LEFT) pl.airFace = pl.face;
  pl.face0 = pl.face;                                   // zwrot z poczatku klatki ($2EB222 przed obsluga kierunku)
  if (!attack0 && !lock && !(pl.climb && lock0) && RIGHT - LEFT) pl.face = RIGHT - LEFT;   // na linie / drabinie blokada $30CC63 po ciosie tez (emulator 4x, R3)
  const latch0 = pl.latch, down0 = pl.downPrev; if (!(pl.climb && lock0)) pl.downPrev = DOWN;   // $30CC8E / $2EB20B z poprzedniej klatki (obsluga kierunku na linie)
  if (!UP) pl.latch = false;                           // kolejny skok dopiero po puszczeniu (jak w oryginale)
  // UP w spadaniu ($30CC59, tez w profilu podrzutu - obsluga spadania dziala i wtedy) zapala blokade $30CC8E ($2E9588):
  // po ladowaniu z trzymanym UP bez skoku (emulator, poziom 2)
  if (UP && !pl.ground && !pl.jump && !pl.jumpReq && !pl.water && !pl.climb && !pl.plat && !floorAt(pl.x, pl.y + 1)) pl.latch = true;
  if (pl.atDoor && (dir || pl.crouch || !(pl.ground || landing0) || !UP || pl.atDoor.hold !== undefined && pl.atDoor.hold-- <= 0)) pl.atDoor = null;   // emulator: puszczenie UP konczy poze tylem (FIRE wtedy to cios)
  const JUMP = UP && !upDead && !pl.latch && !pl.lowCeil && !lock && !game.bonusWait;   // $2E9818: bez skoku w czasie odliczania do pokoju premii
  const jumpNow = pl.jumpReq; pl.jumpReq = false;
  // wyskok z wody ($2E953E): przed ruchem poziomym, od razu bez flagi wody (tablica chodu zwykla w tej klatce)
  if (pl.water && (JUMP || UP && !upDead && !lock && !game.bonusWait) && pl.y <= L.waterY + 2) { pl.jumpReq = pl.latch = true; pl.water = false; pl.idleDone = false; Sfx.play('jump'); }   // $2E953E: bez $30CC8E - trzymany UP tez (emulator 4x, l4)
  const onLadder = (attr(pl.x, pl.y - 8) | attr(pl.x, pl.y + 1)) & LADDER;
  // drabina ($2E9B3E, emulator): chwyt tylko z ziemi - UP z drabina na wysokosci ciala, DOWN ze szczytem pod stopami
  // (na szczycie UP = skok); x na srodek kafla ($2E9B80); w bok tylko obrot, zejscie wylacznie na koncach
  if (!pl.climb && !pl.water && !lock && pl.ground && (UP && !upDead && !H0 && !pl.lowCeil && attr(pl.x, pl.y - 8) & LADDER || DOWN && !pl.crawl && attr(pl.x, pl.y + 1) & LADDER)) {
    if (game.carry) crateUse(true);                     // $2E9B9A: chwyt drabiny odstawia skrzynie
    pl.climb = true; pl.vx = 0; pl.latch = true; pl.crouch = pl.crawl = false; pl.x = (pl.x & ~15) + 7;
    pl.climbAtk0 = pl.attack > 0 && !attack0;          // cios zaczety w klatce wejscia na drabine: poza z ziemi (emulator 4x, rndb26oc 536)
  }
  if (pl.climb && !pl.rope && !onLadder) pl.climb = false;
  // lina (stan 6, emulator): kafel liny na wysokosci rak ($30B8DC = x, y - 22); UP w gore, DOWN w dol po 2 px/kl., kierunek
  // tylko obraca ($2E9052); UP z kierunkiem bez trzymanego UP = skok z liny i 20 klatek bez chwytu ($2E9600, $2EB228), koniec
  // liny u gory z UP = skok ($2E96E6 -> $2E9818), u dolu z DOWN puszczenie ($2E9C22); chwyt sam przy dotyku ($2F1198, nizej)
  if (pl.ropeCool > 0) pl.ropeCool--;                   // $2E8AFC
  let ropeJump = false;                                 // skok z liny: w klatce zgloszenia bez ruchu w bok (na linie kierunek nie czyta tablicy chodu)
  if (pl.rope) {
    if (pl.lockT > 0 || pl.throwT > 0) pl.ropeHang = pl.face;   // po ciosie / rzucie zawis wg $2EB222
    const r = ropeAt();
    if (lock0) { /* cios / rzut z liny: joystick pominiety ($30CC63) - bez skoku i puszczenia (emulator 4x, R3) */ }
    else if (UP && !upDead && (!r || !pl.latch && dir)) { pl.rope = pl.climb = false; if (r) pl.ropeCool = 20; pl.jumpReq = pl.latch = ropeJump = true; pl.idleDone = false; Sfx.play('jump'); }
    else if (DOWN && !UP && !r) { pl.rope = pl.climb = false; pl.relFrame = true; pl.chuteWin = 10; pl.crawlSt = false; walkTable('norm'); }   // $2E9C22: w tej klatce poza postoju 2 / 31 ($2EB184), okno $2EB13C - UP w nim bez skoku (emulator 4x, R3)
    else if (dir && !UP && !DOWN && (latch0 || down0) && pl.ropeClimb) pl.ropeRun = pl.ropeAnim ? 1 : 2;   // $2E905C: kierunek po UP / DOWN klatke pozniej zmienia poze (skrypt wspinaczki biegnie dalej; bez niego zawis ze starym zwrotem)
    // tryb wspinaczki $2EB212: wejscie z UP ($2E9640) zatrzymuje profil ($2F1C20 - podrzut z kolcow pod lina), z DOWN ($2E9BDE)
    // nie; kierunek albo postoj na linie go konczy ($2E9070, $2E8E2E) (emulator 4x, R3)
    // skrypt wspinaczki ($2F1B9A z UP / $2F1BA4 z DOWN) tylko przy wejsciu w tryb: dalej biegnie tez bez ruchu i po zmianie
    // kierunku (emulator 4x, R3: UP 61, 62, 63, potem DOWN: 62, 61, 62, 63); cios konczy skrypt
    // w blokadzie ciosu ($30CC63) joystick pominiety; kierunek bez DOWN z poprzedniej klatki tez konczy tryb ($2E9070)
    const rd = DOWN ? 1 : UP && !upDead ? -1 : 0;
    if (pl.rope && !lock0) {
      if (dir && !latch0 && !down0) { pl.ropeClimb = pl.ropeAnim = false; pl.ropeHang = dir; }   // $2E9070: skrypt zawisu z nowym zwrotem
      // stop profilu przy wejsciu z UP; kolce w tym samym takcie (w porcie koniec poprzedniej klatki) zaczynaja go po nim od nowa
      if (rd && !pl.ropeClimb) { pl.ropeClimb = true; pl.ropeAnim = !(pl.lockT > 0 || pl.throwT > 0); pl.ropeAnimDir = rd; pl.anim = -1; if (rd < 0 && !pl.spikeJust) pl.lift = null; }   // UP+FIRE: skrypt ciosu po skrypcie wspinaczki
      else if (!UP && !DOWN && !(pl.lockT > 0 || pl.throwT > 0)) { pl.ropeClimb = pl.ropeAnim = false; pl.ropeHang = pl.face; }   // postoj $2E8E2E: zawis wg $2EB222   // cios zaczety w tej klatce: bez postoju ($2E8D4E) - tryb trwa (emulator 4x, R3)
      if (rd) pl.ropeDir = rd;
    }
  }
  // skok z ladu ($2E9818): zgloszenie przed ruchem (stan i dzwiek w tej klatce, ruch od nastepnej); zejscie z krawedzi
  // ($2F0B22 przed joystickiem, sonda z x z poczatku klatki) to juz spadanie - UP bez skoku (emulator, L2)
  if (!pl.water && !pl.climb && !jumpNow && (!pl.jump || landing0) && JUMP && (floorAt(pl.x, pl.y + 1) || pl.plat)) { pl.jumpReq = pl.latch = true; pl.idleDone = false; Sfx.play('jump'); }   // $2E988E: zeruje tez licznik postoju; w odbiciu ($30CC54) bez nowego skoku
  if (pl.jumpReq) pl.swimDir = 0;                     // $2E982E: start skoku kasuje flagi chodu

  // koniec stanu 1 po obsludze kierunkow, skoku i FIRE ($2E8C3E): postoj nie w czasie ciosu ($2E8D4E, cios zaczety w tej
  // klatce tez - cios w kucki po puszczeniu DOWN)
  // stan 1 trwa tez w powietrzu (postoj $2E8D3A tylko na ziemi): kucanie, zsuniecie z krawedzi z DOWN i ladowanie z DOWN
  // - po ladowaniu bez nowego skryptu kucania, poza postoju 0 / 29 (emulator 4x, L2)
  // kierunek w locie podrzutu ($30CC59) i na spadochronie ($2EB20C) wychodzi przed zmiana stanu: stan 1 trwa (rndb14oc, rndb2oc)
  if (!pl.crouch && (H0 && !lock && !(pl.lift?.spike && !hopFloor) && !pl.chute || pl.climb || pl.crawl || pl.water || pl.jump || pl.jumpReq || onFoot && !(pl.lockT > 0 || pl.throwT > 0) && (pl.wp ?? WT0) === WT0)) pl.crouchSt = false;
  if (!pl.crouchSt || !DOWN) pl.st1Land = false;
  if (!pl.crouchSt) pl.st1Chute = false;
  if (!pl.crouchSt || onFoot && !landing0 && !pl.lift) pl.hopSt = false; else if (pl.lift?.spike && !hopFloor) pl.hopSt = true;   // stan 1 przez lot podrzutu: czolganie po ladowaniu od nowa (6); na ziemi po klatce ladowania koniec
  // poziomo: start od razu 1 px/kl., potem +1/8 px/kl. do 2 px/kl. (emulator: 1,1,1,2,1,2,1,2,2...)
  const cur = currentAt();
  if (pl.water) walkTable('water');                      // $2F137E przy wejsciu do wody, $2F12CE przy wyjsciu
  // $2F1106: tablica wg kafla pod stopami (po ruchu z poprzedniej klatki): czolganie ($2F13F2), lod, zwykla; bez bitu
  // podlogi zostaje stara - czolganie zaczete tuz przed krawedzia idzie z predkoscia chodu (emulator, poziom 2)
  // w powietrzu tez (spadanie tuz obok kafla podlogi: wybieg czolgania urywa sie na tablicy zwyklej, emulator 4x, L1),
  // ale z tablicy wodnej tylko po czolganiu w tym poziomie ($30CC81) i nie w klatce wyskoku (zmiana po odczycie, nizej);
  // zwykla tablica po czolganiu albo z lodu kasuje spadochron ($2F1146) - gracz jak na ziemi, klatke pozniej zejscie
  else if ((pl.wt !== 'water' || pl.ground || hopFloor || landing0 || game.crawled && !pl.jumpReq) && attr(pl.x, pl.y + 1) & FLOOR) {
    if (pl.chute && !(attr(pl.x, pl.y + 1) & SLIPPY) && !crawlSt0 && (game.crawled || pl.wt === 'ice')) { pl.chute = 0; pl.chuteDrop = true; pl.vy = 2 * Q; pl.fallT = 0; }   // ruch tej klatki jeszcze 2 px (emulator 4x, I4)
    walkTable(attr(pl.x, pl.y + 1) & SLIPPY ? 'ice' : crawlSt0 ? 'crawl' : 'norm');   // czolganie na lodzie: tablica lodu ($2F1352 = $2F1326)   // stan z poprzedniej klatki
  }
  else if (pl.wt === 'water' && !pl.jumpReq && (!pl.chute || pl.ground)) walkTable('norm');   // koniec spadochronu na ziemi ($2F0F18) tez na krawedzi bez kafla pod srodkiem (emulator 4x, rndb22oc 283)
  // wskaznik z poczatku klatki, ale juz po zmianie tablicy (woda $2F0F4C / kafel $2F1106 sa w przerwaniu przed joystickiem):
  // wpadniecie do wody bez kierunku = postoj od razu (opoznienie 8 juz dla pierwszej klatki plywania)
  pl.wp0 = pl.wp; pl.wc0 = WALK_T[pl.wt || 'norm'].c;
  if (!pl.climb) {
    // $2E9A2A: klatka zgloszenia skoku bez kierunku - bez wybiegu; DOWN w skoku albo na spadochronie ($2E9AE0 -> d7) tez,
    let dx = pl.jumpReq && !dir || ropeJump || DOWN && !dir && !pl.water && ((pl.jump || jumpNow) && !landing0 || pl.chute) || (upDead || chuteGo || UP && pl.chute && !pl.water) && !dir || pl.atDoor && !dir || DOWN && !dir && pl.crawl && pl.lowCeil || doorUp && !dir ? 0 : walkDx(dir, cur && cur[4]);   // obrot do drzwi ($2E98A6, d7): bez wybiegu; samo DOWN pod niskim sufitem ($2E9A42, d7) i UP przy drzwiach ($2E988C) tez (emulator 4x, rndb19oc 852, rndb23oc 3752)
    if (pl.jumpReq && pl.wt === 'water') walkTable('norm');            // wyskok: tablica zwykla po odczycie ($2E9548)
    if (cur && cur[4]) dx = walkPush(cur[4]);
    else if (cur && pl.spin > 18) { const c = (cur[0] + cur[2]) >> 1; if (c !== pl.x) dx = c > pl.x ? 1 : -1; }   // $2F1640: do srodka pradu
    pl.vx = dx * Q; pl.fx = 0;
  } else {
    pl.wp = null; pl.vx = approach(pl.vx, 0, P.ACC);
  }
  // $2EB224: postoj obslugiwany raz (na ladzie poza skokiem i spadaniem, w wodzie opoznienie 8 - swimFrame) - zeruje go
  // kazdy kierunek i skok
  if (dir || doorUp) pl.idleDone = false;           // UP przy drzwiach / kaflu akcji ($2E988C) tez zeruje $2EB224
  else if ((pl.ground || landing0 || pl.lift?.spike && !pl.jump && !pl.rope && pl.liftI < (pl.hopStart ?? 2)) && !pl.water && !pl.jumpReq && (pl.wp0 ?? pl.wc0) === pl.wc0) { pl.idleDone = true; pl.swimDir = 0; }   // postoj ($2E8E46); start podrzutu z kolcow bez skoku: postoj tez (emulator 4x, C2)   // ladowanie bez ruchu: postoj juz w tej klatce
  const x0 = pl.x;
  let d; [d, pl.fx] = step(pl.vx, pl.fx); pl.hitNow = false; if (d) moveX(d);
  // sciana tylko przy probie ruchu ($2F4554 w ruchu nastepnej klatki): wskaznik na srodek, potem znow 0, 0, +-1 - stojac
  // przy scianie wskaznik krazy (emulator: z kucania LEFT pod sciana 39 x 3, potem 29; odejscie od sciany 0 x 1-3)
  // $2F43DC: ruch cofniety w calosci, gdy gracz bylby <= 64 albo > 352 px od kamery gry (A4 = cam.x - 48)
  const sx = pl.x - Math.round(cam.x) + 48;
  if (!game.treasure && (pl.x < x0 && sx <= 64 || pl.x > x0 && sx > 352)) pl.x = x0;
  if (crateDrop && game.carry) crateUse(true);

  // pionowo
  // platforma pod stopami: gracz jedzie z nia (dx bloku, wysokosc gory platformy)
  if (pl.plat && !pl.plat.a.dead) { pl.x += pl.plat.a.x - pl.platX; pl.platX = pl.plat.a.x; }
  // podloge sprawdza obiekt sprite'a z pozycja z poprzedniej klatki ($2F4B86: +$E obiektu), czyli x sprzed ruchu poziomego
  // w skoku ($30CC54) podloge sprawdza dopiero ruch w dol ($2F0D36): szczyt skoku tuz nad krawedzia polki (dy = 0) to
  // dalej lot, ladowanie przy pierwszym dy > 0 (emulator, poziom 4: 4 klatki skoku na polce, potem chod)
  const wasGround = pl.ground || !pl.jump && floorAt(x0, pl.y + 1) || !!pl.plat;
  const clamp = pl.clamp; pl.clamp = null;
  // w czasie blokady ciosu ($30CC63) obsluga spadania ($2F0B22) nie dziala - gracz stoi nad przepascia (wybieg trwa),
  // spada dopiero po koncu ciosu (emulator, poziom 4: cios przy krawedzi)
  const standLock = lock && pl.ground && !pl.plat && !pl.water && !pl.climb && !pl.lift;
  if (pl.ground && !pl.plat && !standLock && !jumpNow && !floorAt(x0, pl.y + 1) && pl.vy >= 0) {   // skok zgloszony klatke wczesniej ($30CC54): bez zejscia (emulator 4x, L2: skok z czolgania na krawedzi)
    if (RIGHT - LEFT) pl.airFace = pl.face0;           // $2F0B22 przed joystickiem: skrypt spadania ze starym zwrotem
    if (clamp) { pl.vy = clamp.vy; pl.fallT = clamp.fallT; if (clamp.fallB !== undefined) pl.fallB = clamp.fallB; }   // nie wyladowal - spada dalej
    else { pl.vy = Q; pl.hang = 4; pl.fallT = 0; }   // zejscie z krawedzi
  }
  pl.ground = false;
  const wasWater = pl.wasWater; pl.wasWater = pl.water;
  if (pl.water && pl.y <= L.waterY + 2) pl.surf = true;            // $30CC7D: na powierzchni
  else if (pl.water && pl.surf) { pl.surf = false; if (!game.bonusRun) Music.tune(14); }
  else if (!pl.water && pl.surf) { pl.surf = false; if (!game.bonusRun) Music.tune(game.rainFlag ? 25 : 11); }
  if (pl.water && !wasWater) { Sfx.play('splash'); Actors.spawnScript(0x2e1468, x0 - 16, L.waterY - 5); pl.bubT = 70; }   // $2F0FFE: plusk (sprawdzenie wody przed ruchem poziomym tej klatki: x0)
  else if (pl.y > L.waterY + 2 && --pl.bubT < 0) {      // $2F106C: pod woda co 100-299 klatek babelek (w klatce plusku bez odliczania)
    pl.bubT = 100 + Math.floor(Math.random() * 200); Actors.spawnScript(0x2e14bc, x0, pl.y - 10); Sfx.play('bubble');
  }
  // szczyt drabiny: UP bez drabiny w sondzie ($30B8D2, pozycja przed ruchem) = zejscie ($2E96B4, postoj) w klatce po
  // dojsciu, swiezo wcisniety (bez $30CC8E) = skok; bez UP gracz zostaje na drabinie (emulator 4x, L2)
  if (pl.climb && !pl.rope && UP && !upDead && !lock0 && !(attr(pl.x, pl.y) & LADDER) && floorAt(pl.x, pl.y + 1)) {
    pl.climb = false; pl.vy = 0; pl.fy = 0;
    if (!latch0) { pl.jumpReq = pl.latch = true; pl.idleDone = false; Sfx.play('jump'); }
    else pl.climbOff = true;                            // skrypt postoju w tej klatce, chod z kierunkiem od nastepnej (emulator 4x, rndb26oc 978)
  }
  // dol drabiny: DOWN bez drabiny pod stopami = kucniecie jak po puszczeniu liny ($2E9BB0 -> $2E9C22: okno $2EB13C)
  if (pl.climb && !pl.rope && DOWN && !UP && !lock0 && !(attr(pl.x, pl.y + 1) & LADDER) && floorAt(pl.x, pl.y + 1)) {
    pl.climb = false; pl.vy = 0; pl.fy = 0; pl.relFrame = true; pl.chuteWin = 10;
  }
  if (pl.climb) {
    const v = lock0 ? 0 :   // $30CC63: w czasie ciosu / rzutu z liny albo drabiny bez wspinaczki (emulator 4x, R3)
      (DOWN - (UP && !upDead && !(pl.rope && attr(pl.x, pl.y - 38) & CEIL))) * P.CLIMB;   // lina: sufit nad glowa ($30B8E4, x, y - 38); UP w oknie $2EB13C nic nie robi
    // drabina: ruszenie = blok animacji od poczatku; zmiana kierunku w ruchu - skrypt biegnie dalej (emulator 4x, L2)
    if (v && (!pl.vy || pl.face !== pl.face0) && !pl.rope) { pl.anim = -1; pl.ladderUp = v < 0; }   // obrot kasuje $2EB210 ($2E903C): skrypt od nowa
    if (v < 0 && !pl.rope) pl.latch = true;                // $2E9940: UP na drabinie ustawia $30CC8E
    if (v && !pl.rope) pl.ropeDir = v;
    pl.vy = v;
  } else if (pl.water) {
    // pion w wodzie ($2E8C76, wskaznik $9B98 w tablicy $9D5E, emulator): DOWN -(a0), bez DOWN (a0)+ ku koncowi (-1:
    // wypornosc, UP pod woda nic nie dodaje); wpadniecie -> poczatek (+1), na powierzchni postoj w indeksie 12
    const VT = SWIM_VT;
    if (!wasWater) pl.vp = 0;
    let dy = 0, p = pl.vp ?? 12;
    // $2E9A88: -(a0), wskaznik na poczatku tablicy nie zapisywany (min. 1); tuz po wpadnieciu (0) stoi, dy = 1 (emulator)
    if (DOWN) { if (p > 0) { dy = VT[p - 1]; if (p > 1) p--; } else dy = 1; }
    else if (pl.y < L.waterY + 2) p = 12;               // $2E8CFA: na powierzchni
    else { if (p < VT.length - 1) p++; dy = VT[p]; }
    // $2E9A9C / $2E8CC4: dno sprawdzane 7 px (DOWN) albo 5 px (bez DOWN) pod stopami - gracz zostaje nad dnem (emulator: 537
    // nad dnem 544), wskaznik na zera ($9D82)
    if (dy >= 0 && (DOWN || pl.y >= L.waterY + 2) && waterFloor(x0, pl.y + (DOWN ? 7 : 5))) { dy = 0; p = 18; }   // tez przy dy = 0 ($2E9A94)
    if (cur && cur[5]) for (let i = 0; i <= Math.abs(cur[5]); i++) {   // $2F15C4: prad pionowy przesuwa wskaznik
      if (cur[5] > 0) { if (p > 1) dy = VT[--p]; else dy = cur[5]; } else { if (p < VT.length - 1) dy = VT[++p]; else dy = cur[5]; }
    }
    if (cur && pl.spin > 18) {                          // porwany: poprzecznie 1 px/kl. do srodka pradu
      const [x1, y1, x2, y2, dx] = cur, c = (y1 + y2) >> 1;
      if (dx && c !== pl.y - 6) dy = c > pl.y - 6 ? 1 : -1;
    }
    pl.vy = dy * Q; pl.fy = 0;
    pl.vp = p;
  } else if (pl.jumpReq) {
    pl.vy = 0; pl.fy = 0;                              // skok zgloszony w tej klatce: gracz stoi
  } else if (jumpNow) {
    pl.vy = P.JUMP; pl.jump = true; pl.fallB = 128;     // zapas: $A4 ($2E9842), ale ta sama obsluga dalej wpisuje $80 ($2E9A16)
    // fizyka skoku ($30CC55, $2F049A) zamiast profilu: skok z kolcow to zwykly skok, a profil ($2F490E) stoi i rusza
    // dalej po ladowaniu (emulator, poziom 2: skok z kolcow, po ladowaniu caly podrzut)
    if (!pl.rope && pl.lift) { pl.liftPaused = [pl.lift, pl.liftI]; pl.lift = null; }
  } else if (pl.chute) {
    pl.vy = 2 * Q; pl.chute++; pl.fallB = 128;          // $2F0F0A: od pierwszej klatki 2 px/kl. w dol
  } else if (standLock) {
    pl.vy = 0; pl.fy = 0;                              // cios: bez spadania (wyzej)
  } else if (pl.hang > 0) {
    pl.hang--;                                         // emulator: po zejsciu z krawedzi 4 klatki po 1 px, potem spadanie
  } else if (!pl.jump) {                               // $2F0B2A: spadanie bez skoku od 1 px/kl., +1 co 3 klatki do 4
    if (pl.vy < Q) { pl.vy = Q; pl.fallT = 0; }
    if (++pl.fallT > 3) { pl.fallT = 1; pl.vy = Math.min(P.FALL, pl.vy + Q); }
  } else {
    pl.vy = Math.min(P.FALL, pl.vy + P.GRAV);
  }
  // w powietrzu cale piksele wg predkosci (emulator: 4,4,4,4,3,3,3,3,...), w wodzie/na drabinie ulamki
  if (pl.water || pl.climb) [d, pl.fy] = step(pl.vy, pl.fy); else { d = Math.floor(pl.vy / Q); pl.fy = 0; }
  let ropeMove = pl.rope && d !== 0;                    // lina (stan 6): UP / DOWN 2 px/kl. bez sprawdzania podlogi ($2E9C18)
  if (pl.liftResume && --pl.liftResume.wait < 0) {
    if (pl.jump) { pl.liftPaused = pl.liftResume.p; pl.liftResume = null; }   // nowy skok zaraz po ladowaniu: profil dalej wstrzymany (emulator 4x, R3)
    else { [pl.lift, pl.liftI] = pl.liftResume.p; pl.liftI ||= 1; pl.liftResume = null; pl.hopStart = pl.liftI + 1; }
  }   // wstrzymany przed pierwszym ruchem: od razu pierwsze dy (pozycja 0 to tylko klatka zwloki, emulator 4x, C2)   // po ladowaniu skoku: klatka przerwy; pierwszy ruch jeszcze z klatka z ziemi (emulator 4x, R3)
  const lifting = !!pl.lift && !pl.rope;                // profil trwa tez na samej podlodze (stopy na krawedzi kafla): to lot
  if (pl.lift) {                                         // wyrzut z trampoliny: dy na klatke z profilu ($2F48E0)
    if (pl.rope) {                                       // na linie profil dziala dalej (kolce pod lina): ruch liny ustawia dy po
      const v = pl.lift[Math.min(pl.liftI++, pl.lift.length - 1)];   // profilu ($2E9A3C po $2F490E), w zawisie zostaje profil
      if (!ropeMove) { d = v; pl.ground = false; }
      if (!ropeMove && d > 0 && floorAt(pl.x, pl.y + 1)) { d = 0; if (!(pl.lift.hop && pl.liftI === 1)) { pl.lift = null; pl.ground = true; } }   // stare dy ponowionego podrzutu nie konczy go (emulator 4x, R3)   // ladowanie na podlodze konczy profil
    } else {
      d = pl.lift[Math.min(pl.liftI++, pl.lift.length - 1)]; pl.vy = 0; pl.ground = false;   // indeks moze byc juz za koncem (profil z liny)
      if (pl.liftI >= pl.lift.length || pl.water || pl.climb) { pl.liftEnd = !pl.water && !pl.climb; pl.lift = null; pl.vy = Math.max(0, d) * Q; }   // profil konczy stale +d (w oryginale to dalej profil)
    }
  }
  // nie wyskakuj ponad powierzchnie ($2E8CFA); z DOWN ($2E9A88) bez sprawdzenia powierzchni - wypornosc wynosi gracza nawet
  // nad linie wody, poki flaga wody trwa (emulator, poziom 1: 325 -> 322)
  const top = L.waterY + 1;
  if (pl.water && pl.vy < 0 && !UP && !DOWN && pl.y + d < top) d = top - pl.y;
  const air = (!wasGround || lifting) && !pl.water && !pl.climb && !pl.plat, y0 = pl.y;
  pl.wasAir = air;
  if (pl.grabDrop) { if (pl.rope && !ropeMove && !floorAt(pl.x, pl.y + 1)) d = pl.grabDrop; pl.grabDrop = 0; }   // klatka po chwycie liny: dy = predkosc spadania $30CC28, nad podloga (kolce) przyciete do 0 (emulator 4x, R3)
  if (d) moveY(d, pl.climb && DOWN, x0, ropeMove);
  // przyciecie do podlogi pod x0, ale ladowanie rozstrzyga sonda nastepnej klatki z x po ruchu poziomym: gdy tam juz nie
  // ma podlogi, gracz spada / leci dalej bez ladowania (emulator, poziom 3: cios w dol tuz za krawedzia - bez odbicia)
  if (pl.ground && pl.clamp && !pl.lift && !floorAt(pl.x, pl.y + 1)) { pl.ground = false; pl.vy = pl.clamp.vy; pl.fallT = pl.clamp.fallT; pl.clamp = null; }
  // $2F4A48: ladowanie z profilu w skoku (odbicie, tez po jego koncu) - skrypt postoju od razu, nie klatka skoku w
  // poslizgu (emulator 4x, L2)
  // przyciecie do podlogi spod x0, a pod x po ruchu jej juz nie ma: profil leci dalej (emulator 4x, C2: podrzut przez krawedz)
  if (pl.lift && d > 0 && pl.ground && pl.clamp && !floorAt(pl.x, pl.y + 1)) { pl.ground = false; pl.clamp = null; }   // tylko po ruchu w dol w tej klatce (bez ruchu: stal juz na podlodze - ladowanie, emulator 4x: rndb1/5/10oc)
  if (pl.lift && d > 0 && pl.ground && pl.jump && !pl.stomp) pl.jumpPose = false;
  if (pl.lift && d > 0 && pl.ground && !(pl.lift.hop && pl.liftI === 1)) pl.lift = null;    // profil w dol przerwany ladowaniem (stare dy na starcie ponowionego podrzutu nie - emulator 4x, R3)
  if (pl.water && d > 0 && pl.y < y0 + d) pl.vp = 18;    // $2E8CD0: dno - wskaznik na zera
  else if (pl.water && d < 0 && pl.y > y0 + d) pl.vp = 12;   // $2E8CE8: sufit
  // podrzut z kolcow w powietrzu: dziala tez procedura spadania $2F0B22 - na pierwszej klatce poza podloga zapas $80,
  // predkosc $30CC28 = 1 z opoznieniem 6, potem +1 co 3 klatki do 4; zapas maleje o dy profilu i o te predkosc az do
  // ladowania (tez po koncu profilu), wiec dlugi lot po podrzucie zabija przy ladowaniu, tez na kolcach (emulator 4x, rndb22oc 3552)
  if (pl.lift?.spike && !pl.rope && !pl.liftFloor && !pl.chute && !pl.jump && !pl.hopFall) { pl.hopFall = {s: 1, d: 6}; pl.fallB = 128; }
  if (air && !pl.chute) pl.fallB -= d;                  // $2F0BD0 / $2F0D16: zapas maleje o predkosc (dy przed przycieciem do podlogi; wznoszenie w skoku go oddaje)
  if (pl.hopFall && air && !pl.chute) { const h = pl.hopFall; if (h.s < 4 && !h.d) { h.s++; h.d = 3; } h.d--; pl.fallB -= h.s; }
  // $2F1170 (co klatke, po ruchu): chwyt liny przy dotyku rekami, tez w skoku i bez wcisniecia; nie w wodzie ani na
  // powierzchni, nie na spadochronie, 20 klatek po skoku z liny, x - A4 > 68
  if (!pl.rope && !pl.water && !(pl.y > L.waterY + 2) && !pl.surf && !(pl.ropeCool > 0) && !(pl.chute && !floorAt(pl.x, pl.y + 1)) && !chuteGo && ropeAt() && pl.x - Math.round(cam.x) + 48 > 68) {
    const jr = pl.jumpReq, cr = pl.crawl, hopAir = !!pl.lift?.spike && !pl.jump && !pl.jumpScript && pl.liftI > (pl.hopStart ?? 2);   // skok zgloszony w tej klatce (np. wyskok z wody): klatka skoku (emulator 4x, I4)
    Object.assign(pl, {rope: true, climb: true, ropeHang: pl.face0 ?? pl.face, x: (pl.x & ~15) + 7, vx: 0, vy: 0, fx: 0, fy: 0, jump: false, jumpReq: false, lift: null, liftPaused: null, liftResume: null, ropeClimb: false, ropeAnim: false, wp: null, hang: 0, crouch: false, crawl: false, anim: -1, landed: true, regrab: true, grabDrop: pl.jump || pl.jumpScript ? 0 : pl.lift?.spike ? pl.hopV : pl.vy > 0 ? Math.max(1, pl.vy / Q | 0) : 1});   // profil $2F1C20 (stop)   // w locie klatka sprzed chwytu jeszcze raz
    if (pl.frame === 87 || pl.frame === 88) pl.frame = pl.face > 0 ? 88 : 87;   // spadanie: zwrot z tej klatki (skrypt chwytu $2EB16C, emulator 4x, R3)
    else if (pl.frame === 4 || pl.frame === 33) pl.frame = (pl.face0 ?? pl.face) > 0 ? 4 : 33;
    else if (pl.stompEnd && (pl.frame === 8 || pl.frame === 37)) pl.frame = pl.face > 0 ? 4 : 33;   // koniec ciosu w dol w tej klatce: skrypt skoku (emulator 4x, rndbR4oc 2935)
    if (pl.stomp) pl.frame = pl.face > 0 ? 8 : 37;     // cios w dol zaczety w tej klatce (FIRE przed chwytem $2F1170, emulator 4x, rndbR4oc 4356)   // skok: zwrot sprzed kierunku tej klatki (emulator 4x, R3)
    if (hopAir) pl.frame = pl.face > 0 ? 88 : 87;      // podrzut z kolcow juz w powietrzu: klatka spadania, nie ze startu (emulator 4x, rndbR4oc 855)
    if (wasGround) pl.frame = cr ? (pl.face > 0 ? ANIM.crawlR : ANIM.crawlL)[0] : RIGHT - LEFT ? (pl.face > 0 ? ANIM.walkR : ANIM.walkL)[0] : pl.face > 0 ? 0 : 29;   // z ziemi: klatka z obslugi joysticka tej klatki (emulator 4x, R3: 4 -> 10 -> 65)
    if (jr) pl.frame = pl.face > 0 ? 4 : 33;
  }
  const fallV = pl.vy;
  // tuz nad podloga po ruchu: oryginal sprawdzi ja w nastepnej klatce sonda z pozycja po ruchu poziomym tej klatki
  // ($2F4B86: +$E obiektu) - stad x po ruchu, nie x0 (emulator, poziom 3: skok obok krawedzi bloku przelatuje dalej)
  if (standLock || !pl.water && !pl.climb && !pl.lift && pl.vy >= 0 && (d > 0 || !pl.jump) && floorAt(pl.x, pl.y + 1)) { pl.ground = true; pl.vy = 0; pl.fy = 0; }
  const plat = !pl.water && !pl.climb && !pl.lift && pl.vy >= 0 ? Actors.platformUnder(pl.x, pl.y) : null;
  if (plat) { pl.y = plat.top; pl.vy = 0; pl.fy = 0; pl.ground = true; if (pl.plat?.a !== plat.a) pl.platX = plat.a.x; }
  pl.plat = plat;
  if (air && pl.ground) {                                // ladowanie ($2F0BDC): za dlugi upadek zabija, szybkie - dzwiek (24,0)
    if (pl.liftPaused) { pl.liftResume = {p: pl.liftPaused, wait: 1}; pl.liftPaused = null; }
    pl.landJump = pl.jump || !!pl.jumpScript;
    if (pl.liftEnd && pl.jump && !pl.stomp) pl.jumpPose = false;   // po koncu profilu (stale +d) to dalej ladowanie z profilu
    if (crouchSt0) pl.st1Land = true;                 // stan 1 z powietrza: DOWN po ladowaniu nie ustawia skryptu kucania ($2E9C34)
    pl.st1Chute = crouchSt0 && !!pl.chute;            // spadochron w stanie 1: po ladowaniu postoj tez bez DOWN (emulator 4x, rndb18oc 3122)
    const wsAir = pl.wallStand;
    pl.wallStand = 0;                                    // po ladowaniu chod od nowa, sciana znow klatke pozniej (emulator: 33 -> 39 -> 29)
    if (wsAir && wsAir === H0 && pl.hitNow && pl.y === y0) { pl.wallStand = wsAir; pl.wallHold = true; }   // zderzenie w klatce ladowania (ruch przed ladowaniem) zostaje: postoj w nastepnej (emulator 4x, rndb18oc 1000, rndbR3oc 2995)
    pl.landedAir = pl.y !== y0 && !pl.grabDrop;                             // klatka skoku/spadania zostaje jeszcze w klatce ladowania (emulator); bez ruchu w tej klatce
                                                         // (oryginal tez laduje teraz, dy = 0) - nie
    if (pl.fallB < (pl.jump ? 1 : 0) && !game.treasure) pl.dieNext = game.frame + 1;   // skok: <= 0 ($2F0D40), spadanie: < 0 ($2F0BDC) - od nastepnej klatki
    else if (fallV > 2 * Q) Sfx.play('land');            // smierc omija dzwiek ladowania i odbicie ciosu w dol ($2F0D48 -> $2F0E06)
  }
  if (pl.ground || pl.lift || pl.water || pl.climb) pl.liftEnd = false;
  if (pl.clamp && pl.clamp.fallB === undefined) pl.clamp.fallB = pl.fallB;   // zapas upadku sprzed przyciecia
  if (pl.ground || pl.water || pl.climb || pl.plat || pl.chute || pl.jump) pl.hopFall = null;   // skok liczy zapas swoja procedura ($2F0D16)
  if (pl.ground || pl.water || pl.climb || pl.lift && !pl.hopFall || pl.plat) { pl.fallB = 128; pl.chute = 0; pl.fallT = 0; }
  if (chuteGo && !pl.water && !pl.climb && !pl.plat) {   // $2E948A: od nastepnej klatki; tez gdy gracz laduje w tej klatce (joystick przed ruchem:
    // klatka 35, w nastepnej koniec $2F0F18 i tablica zwykla od predkosci z wodnej - emulator, L2: +2, +1, 0, 0, 0, -1)
    pl.chute = 1; pl.chuteWin = 0; pl.airFace = pl.face; pl.lift = pl.liftPaused = pl.liftResume = null; pl.stomp = pl.jump = false; pl.attack = pl.pose = pl.lockT = 0; pl.latch = true; Sfx.play('spark');   // otwarcie konczy podrzut z kolcow (emulator 4x, L2)
    pl.dieNext = 0; pl.fallB = 128; pl.swimDir = 0;      // $2E9496; profil $2F1C20 ($2F48E0) ustawia zapas $80: spadochron w klatce ladowania ratuje (emulator 4x, L3)
    walkTable('water');                                  // $2E94B4 -> $2F1418: w bok tablica wodna (najwyzej 1 px/kl., poslizg)
  }
  if (pl.ground || pl.climb || pl.plat || pl.water && pl.vy >= 0) pl.jump = false;
  if (plat && plat.a.f[0x72] === 0x2e63d4 && !plat.a.spring) plat.a.spring = {t: 0};   // trampolina ($2E63D4, sciezka $B52E)
  if (plat) Actors.stood(plat.a);
  springs();
  // ruch przyciety do 0 juz w tej klatce: ladowanie jak w oryginale przed joystickiem - puszczenie FIRE w tej klatce nie
  // zatrzymuje odbicia (emulator 4x, L4)
  if (air && pl.ground && (pl.stomp || stompEnd && pl.y === y0) && !pl.dieNext && !pl.rope && !(pl.lift?.spike && pl.liftI <= 1)) {   // chwyt liny w tej klatce: profil stop ($2F1C20), bez odbicia (emulator 4x, R3)   // podrzut z kolcow z tego taktu wygrywa (emulator 4x, R3)   // $2F0D52 / $2F4A00: ladowanie z ciosem w dol - odbicie (profil $2F1E98)
    crumble(); pl.liftResume = null; pl.lift = BOUNCE; pl.liftI = lifting && !pl.clamp || pl.y === y0 ? 1 : 0; pl.ground = false; pl.plat = null; pl.jump = true;   // emulator: klatka przerwy (z profilu ladowanie jest juz klatke pozniej, jak $2F49D2); ruch przyciety do 0 juz w tej klatce (stopy na podlodze) - bez przerwy (emulator 4x, L4)
  }
  if (pl.ground && !pl.jumpReq && !(pl.lift?.spike && pl.liftI <= 1) || pl.water || pl.climb) pl.stomp = false;   // cios w dol trwa w podrzucie z kolcow z ladowania (emulator 4x, R3)
  // $2F51A2 w petli glownej (25 Hz): kolce sprawdzane tylko w takcie petli (game.frame parzyste - jak enemies25 nizej);
  // emulator z procesorem 4x (bez zgubionych taktow): rnd2oc, seq16oc zgodne, podrzut 1 klatke po ladowaniu albo 2
  if (!game.loopHold && game.frame % 2 === 0 && (attr(pl.x, pl.y - 6) | attr(pl.x, pl.y + 1)) & DEADLY) spikes();
  if (pl.chuteDrop) { pl.chuteDrop = false; if (!pl.ground && !pl.lift && !pl.water && !pl.climb) { pl.ground = true; pl.vy = 0; } }   // bez flag skoku i spadania: w tej klatce chod, w nastepnej zejscie ($2F0B22)
  // $2F0BE4 / $2F0D30 / $2F0EFA: gracz > $CA px pod kamera gry (spadl pod plansze) -> smierc od upadku
  if (!pl.water && !pl.climb && !pl.ground && !pl.plat && pl.y - cam.y > 154 && !game.treasure) { fallDeath(); return; }
  if (pl.y > L.h * TS) respawn();

  animate(dir);
  // smierc od upadku: flaga $30CC77 z przerwania obsluguje petla glowna ($2DD5BE) w takcie, a klatka 97 i profil sa w klatce
  // po takcie (game.frame nieparzyste) - 1 albo 2 klatki po ladowaniu, ruch w bok jeszcze trwa (emulator 4x: seq14, rnd3, rnd11)
  if (pl.dieNext && !game.loopHold && game.frame >= pl.dieNext && game.frame % 2 === 1) { pl.dieNext = 0; pl.chuteWin = chuteWin0; fallDeath(); pl.frame = 97; pl.flip = false; }
  if (pl.attack > 0) {                                 // trafienia mieczem (prostokat sprite'a miecza)
    const G = weaponGfx() || {x: pl.x, y: pl.y - 14, f: [0, 0, 0, 0]}, l = G.x, t = G.y, ww = G.f[2], wh = G.f[3];
    const str = AMMO.has(game.weapon) ? 1 : WEAPON[game.weapon];   // bron reczna: sila $A0 (WEAPON)
    if (!game.treasure) for (const b of Actors.boxes()) if (l < b.l + b.w && l + ww > b.l && t < b.t + b.h && t + wh > b.t && Actors.hit(b.a, str) && b.a.dying) Sfx.play(b.a.kill || 'kill');
    for (const o of L.objs.objects) {
      const g = L.objs.gfx[o.type];
      if (o.taken || o.off || !POTS.has(o.type) || !g || pl.attack !== pl.attackN) continue;
      if (l < o.x - g.ax + g.w && l + ww > o.x - g.ax && t < o.y - g.ay + g.h && t + wh > o.y - g.ay && (o.hits = (o.hits || 0) + 1) >= 2) {
        o.taken = true;                                  // $2E6990: owoc (albo zgnily) z tabeli $2E84A2
        Actors.spawnScript(0x2e12c8, o.x, o.y - 8); Sfx.play('smash');
        L.objs.objects.push({x: o.x, y: o.y, type: POT_ITEM[POT_TABLE[Math.floor(Math.random() * 28)]],
          brain: {vy: -5, acc: 0, cap: 6, iter: 3}, life: 100});
      }
    }
    pl.attack--;
  }
  if (pl.pose > 0) pl.pose--;
  if (game.toolLock > 0) game.toolLock--;
  if (pl.lockT > 0) pl.lockT--;
  if (game.treasure) return;                             // bieg po skarb: tylko gracz (treasureStep)
  pickups();
  questPickups();
  qblockTick();
  timedTick();
  bombsTick();
  cratesFall();
  enemies25();
  hits();
  if (game.treasureWait > 0 && (game.frame & 1) === 0 && --game.treasureWait === 0) treasureStart();   // $30CC3C: 4 petle (ok. 7 klatek)
}

// prady wodne (level.json currents, $2F14D0): w wodzie ramka gracza w prostokacie -> predkosc dazy do (dx, dy) px/kl.
// (kursor tablicy predkosci przesuwany o |d|+1 krokow na klatke, na koncu tablicy = d); silny prad (|d| > 2) porywa:
// obrot $2F1C04/$2F1C12 co 3 klatki, dzwiek, gracz sciagany do osi pradu; po wyjsciu jeszcze 20 klatek ($9DDE)
function currentAt() {
  if (pl.spin > 0) pl.spin--;
  if (!pl.water || !L.currents) return null;
  const c = L.currents.find(([x1, y1, x2, y2]) => x1 <= pl.x + P.HALF && x2 >= pl.x - P.HALF && y1 <= pl.y && y2 >= pl.y - P.HEIGHT);
  if (!c) return null;
  if (Math.abs(c[4]) > 2 || Math.abs(c[5]) > 2) { if (!(pl.spin > 18)) Sfx.play('whirl'); pl.spin = 20; }
  return c;
}

// klatki z banku gry (work/export_player.py); brakujace kierunki = odbicie lustrzane
// drabina: blok $2F1B6C, 6 klatek co 4 (w gore 72..77, w dol odwrotnie)
// chod $2F189C / $2F1960 co 4
const ANIM = {walkR: [10, 11, 12, 13, 12, 11, 10, 9], walkL: [39, 40, 41, 42, 41, 40, 39, 38], swimL: [49, 50, 51, 52, 53, 54], swimR: [20, 21, 22, 23, 24, 25],
  climb: [72, 73, 74, 75, 76, 77], climbDn: [77, 76, 75, 74, 73, 72],
  crawlR: [14, 15, 16, 17, 18, 17, 16, 15], crawlL: [43, 44, 45, 46, 47, 46, 45, 44],   // $2F18AE / $2F1972 co 5
  ropeUp: [61, 62, 63, 62], ropeDn: [63, 62, 61, 62], spinR: [95, 94, 93, 92, 91, 96], spinL: [93, 94, 95, 96, 91, 92]};   // lina: stan 6, bloki $2F1B9A / $2F1BA4 co 6; wir $2EB1C4 (R $2F1C12, L $2F1C04)
// bezczynnosc ($2F0548): licznik $9DE6 = 2400 przy ruchu, -1 na klatke, przy 0 -> 2000; progi uruchamiaja sekwencje
// gracza ($2F1788: klatki co d, 's' = $2EE17C wiwat, 'y' = $2EE18C ziewniecie; bez petli zostaje ostatnia klatka)
const CHEER = [58, 58, 58, 58, 105, 105, 's', 106, 105, 's', 106, 105, 105, 58];
const TAP = [7, [102, 103, 104, 103], true], YAWN = [22, [58, 58, 107, 'y', 107, 107, 107, 58]];
const IDLE_SEQ = {1700: [10, CHEER], 1200: [10, [...CHEER.slice(0, 11), 's', 106, 105, 105, 58]], 1000: TAP, 650: YAWN, 250: YAWN, 50: TAP};
function idleFrame() {
  if (--pl.idle <= 0) pl.idle = 2000;
  const s = IDLE_SEQ[pl.idle];
  if (s) pl.seq = {d: s[0], f: s[1], loop: s[2], i: 0, t: 0};
  const q = pl.seq;
  if (!q) return null;
  if (++q.t >= q.d) { q.t = 0; if (q.i + 1 < q.f.length) q.i++; else if (q.loop) q.i = 0; }
  while (typeof q.f[q.i] === 'string') { Sfx.play(q.f[q.i] === 's' ? 'cheer' : 'yawn'); q.i++; }
  return q.f[q.i];
}
// plywanie: skrypty klatek jak w oryginale ($2F3EFC ustawia: pierwsza klatka od razu, $2F459C co 'd' klatek nastepny wpis;
// 'D' = poczatek petli ($FFD), 'E' = skok do petli ($FFE)). Wpadniecie: $2EB1BC z opoznieniem 5 ($2F1038); kierunek,
// gdy flaga chodu ($2EB20D/$2EB20E) jest inna: plywanie, a przy zmianie strony zwrot $2EB1CC, opoznienie 4 ($2E91A2);
// bez kierunku po wyhamowaniu do srodka tablicy opoznienie 8 ($2E8D84). Flage kasuje spadanie (nie skok)
const SWIM_SEQ = {1: [20, 21, 22, 23, 24, 25, 'E'], [-1]: [49, 50, 51, 52, 53, 54, 'E']};
const TURN_SEQ = {1: [92, 91, 96, 'D', 20, 21, 22, 23, 24, 25, 'E'], [-1]: [96, 91, 92, 'D', 49, 50, 51, 52, 53, 54, 'E']};
function animSet(seq, d) { pl.as = {seq, i: 0, loop: 0, d, c: 1, f: seq[0]}; }
function animTick() {
  const A = pl.as;
  if (--A.c > 0) return A.f;
  A.c = A.d;
  for (let n = 0; n < A.seq.length + 2; n++) {
    const v = A.seq[A.i];
    if (v === 'D') A.loop = ++A.i; else if (v === 'E') A.i = A.loop; else { if (v !== undefined) { A.f = v; A.i++; } break; }
  }
  return A.f;
}
function swimFrame(dir) {
  // wpadniecie ($2EB1BC): skrypt ze zwrotem sprzed obslugi kierunku tej klatki - kierunek przeciwny od razu daje zwrot
  if (!pl.as || !pl.as.swim) { const f = (pl.face0 ?? pl.face) > 0 ? 1 : -1; animSet(SWIM_SEQ[f], 5); pl.as.swim = true; pl.swimFace = f; }
  if (dir && pl.swimDir !== dir) {
    // zwrot wg $2EB222 sprzed obslugi kierunku (face0: ustawia go kazdy kierunek, tez w powietrzu i w wodzie przy
    // ustawionej fladze - sonda w emulatorze, rndb13oc), nie wg skryptu plywania
    animSet(((pl.face0 ?? pl.swimFace) === dir ? SWIM_SEQ : TURN_SEQ)[dir], 4); pl.as.swim = true;
    pl.swimDir = pl.swimFace = dir;
  } else if (dir) pl.as.d = 4;                          // $2E9368: kierunek w wodzie co klatke ustawia opoznienie 4 (po postoju 8)
  else if (!dir && !pl.idleDone && (pl.wp0 ?? pl.wc0) === pl.wc0) { pl.as.d = 8; pl.idleDone = true; }   // wskaznik ze startu klatki (srodek tamtej tablicy)
  return animTick();
}
function animate(dir) {
  pl.wallSkip = false;
  pl.anim++; if (pl.throwT > 0) pl.throwT--;
  const climbOff = pl.climbOff; pl.climbOff = false;
  if (pl.climbAtk0 && (!pl.climb || !(pl.lockT > 0) && (pl.vy || dir))) pl.climbAtk0 = false;   // vy w klatce chwytu (podciagniecie) nie konczy
  const wall0 = pl.wallStand; if (dir !== pl.wallStand && !(pl.crawl && pl.lowCeil && pl.downPrev && !dir)) pl.wallStand = 0;   // samo DOWN pod niskim sufitem ($2E9A3C przy $2EB217) zostawia flagi chodu i skrypt (emulator 4x, rndb19oc 809)
  // sciana w czolganiu ($2E8EBC przy $9DD4): skrypt stojacy $2F18C0 bez wzgledu na kierunek ruchu - tez przy cofaniu ze
  // zwrotu, od nastepnej klatki; trwa w ruchu, az obsluga kierunku ustawi skrypt czolgania od nowa (emulator 4x, rndb15oc)
  if (pl.crawlStop === 1) pl.crawlStop = true;
  if (!(pl.crawl || pl.crawlEnd) || !dir) pl.crawlStop = false; else if (pl.hitS === -dir && !pl.crawlStop) pl.crawlStop = 1;   // zderzenie z ruchu tej klatki
  pl.hitS = 0;
  const wallHold = pl.wallHold; pl.wallHold = false;
  if (pl.pickT > 0) { pl.pickT--; pl.walking = false; if (pl.face !== pl.face0) pl.frame = (pl.face > 0 ? ANIM.walkR : ANIM.walkL)[0]; return; }   // obrot w tej klatce: start chodu
  if (pl.relFrame) { pl.relFrame = pl.landed = pl.landedAir = false; pl.walking = false; pl.frame = pl.face > 0 ? 2 : 31; return; }   // puszczenie liny ($2EB184), tez z chwytem w tej klatce
  if (pl.landed) { pl.landed = false; if (!pl.pose && !pl.lockT) return; }
  // ladowanie w klatce ruchu: w oryginale to jeszcze lot (dy = 0 dopiero w nastepnej) - klatka skoku / spadania, takze
  // z obrotem ustawionym w tej klatce (emulator, poziom 4: 33 -> 4 w klatce ladowania)
  if (pl.landedAir) {
    pl.landedAir = false;
    if (pl.chute) { pl.frame = pl.face > 0 ? 6 : 35; pl.flip = pl.jumpPose = false; return; }   // spadochron otwarty w klatce ladowania: klatka 6/35 ze zwrotem z tej klatki (emulator, L2)
    if (!pl.pose && !pl.lockT) {
      const ra = pl.airFace && !pl.jumpReq ? pl.airFace > 0 : pl.face > 0;
      if (pl.stomp) { pl.frame = ra ? 8 : 37; pl.flip = false; }   // cios w dol zaczety w klatce ladowania (emulator 4x, L4)
      else if (pl.jumpReq) { pl.frame = ra ? 4 : 33; pl.flip = false; }   // skok z liny w klatce zejscia na podloge: skrypt skoku ($2E9818, emulator 4x, rndbR4oc 1874, rndbR3oc 4959)
      else if ([4, 33, 88, 87].includes(pl.frame) || pl.stompEnd && (pl.frame === 8 || pl.frame === 37)) {   // koniec ciosu w dol w klatce ladowania: skrypt skoku
        if (pl.frame === 8 || pl.frame === 37) pl.jumpPose = pl.landJump;   // trwa w poslizgu do postoju (emulator 4x, L4)
        pl.frame = pl.landJump ? (ra ? 4 : 33) : (ra ? 88 : 87); pl.flip = false;
      }
      else if (pl.frame === 6 || pl.frame === 35) pl.frame = ra ? 6 : 35;   // spadochron: zwrot z tej klatki (emulator 4x, C2)
      return;
    }
  }
  if (pl.dieNext) return;                                // smierc od upadku: flagi skoku / spadania zostaja ($2F0D48) - klatka z lotu
  if (pl.upDead && !dir && !pl.water && !pl.pose && !pl.throwT && !pl.rope && !(pl.frame === 87 || pl.frame === 88)) {   // skrypt czolgania biegnie dalej (emulator 4x, D4)
    if (pl.cycle) pl.frame = pl.cycle[Math.max(0, Math.floor(pl.anim / pl.cycleD)) % pl.cycle.length];
    return;
  }   // po ladowaniu ze spadania juz postoj, klatka skoku zostaje (emulator 4x, L4 / L2)          // UP w oknie $2EB13C: bez postoju ($2E988C d7), klatka zostaje (kucanie); skrypt w wodzie biegnie dalej
  if (!pl.water && pl.as) pl.as.swim = false;
  const wasWalk = pl.walking; pl.walking = false;
  const cyc = (a, sp = 4) => a[Math.max(0, Math.floor(pl.anim / sp)) % a.length];
  let f, flip = false, stand = false;
  const R = pl.face > 0, rope = pl.rope, ropeRun = pl.ropeRun, regrab = pl.regrab; pl.ropeRun = pl.regrab = false;
  const RA = pl.airFace && !pl.jumpReq ? pl.airFace > 0 : R;   // klatki w powietrzu: zwrot z ostatniego ustawienia skryptu
  // chod/czolganie bez kierunku trwa w poslizgu, az obsluga postoju ($2E8D3A, pl.idleDone) ustawi postoj
  const slide = !dir && (pl.ground || pl.liftFloor) && !pl.idleDone && !pl.crouch && !pl.crouchSt && !pl.jumpReq && !(wall0 && !wallHold) && !pl.atDoor && pl.cycle;   // po postoju przy scianie bez chodu   // skok z poslizgu: klatka skoku od razu
  // zwrot w czolganiu: obsluga kierunku ustawia skrypt czolgania od nowa ($2E938E, opoznienie 5: pierwsza klatka 6)
  // (tez odejscie od sciany w czolganiu: skrypt od poczatku - emulator 4x, L2: 47 -> 14)
  if ((pl.crawl || pl.crawlEnd) && dir && pl.cycle !== (R ? ANIM.crawlR : ANIM.crawlL) && (pl.cycle === ANIM.crawlR || pl.cycle === ANIM.crawlL || pl.crawl && !pl.crawlNew || pl.crawlEnd)) { pl.anim = pl.crawl ? 0 : -1; if (pl.crawlStop === true) pl.crawlStop = false; }   // zderzenie w tej klatce (ruch po obsludze kierunku) zostaje   // zwrot w trwajacym czolganiu: pierwsza klatka 5 (emulator 4x, L1)
  // start podrzutu z kolcow (profil z ta klatka, liftI <= 2) to jeszcze ziemia; koniec czolgania z ciosem w tej klatce: cios
  // z postawy ($2E8B7E przed FIRE $2E9C82 - emulator 4x, L4: 1, nie 19)
  const hopG = !!pl.lift?.spike && !pl.rope && pl.liftI <= (pl.hopStart ?? 2);   // ze starym dy na starcie ruch klatke wczesniej
  if (climbOff && !pl.pose && !(pl.throwT > 0)) f = R ? 0 : 29;
  else if ((pl.crawl || pl.crawlEnd && !pl.jumpReq && !(pl.pose > 0)) && (pl.ground || pl.liftFloor || hopG) && !slide) f = pl.pose > 0 || pl.throwT > 0 ? (R ? 19 : 48) : dir && !(pl.wallStand === dir && !wallHold) && pl.crawlStop !== true ? cyc(pl.cycle = R ? ANIM.crawlR : ANIM.crawlL, pl.cycleD = 5) : R ? 18 : 47;
  else if (slide && !pl.pose && !pl.throwT) { f = cyc(pl.cycle, pl.cycleD); pl.walking = true; }
  else if (pl.chute) f = RA ? 6 : 35;                    // spadochron ($2F1890 / $2F1954)
  else if (pl.stomp) f = RA ? 8 : 37;                     // cios w dol ($2EB1B4)
  else if (pl.pose > 0 && (pl.crouch || pl.crouchSt)) f = R ? 3 : 32;   // stan 1 trwa po puszczeniu DOWN do postoju: cios w kucki
  else if (pl.throwT > 0 && pl.ground) f = pl.crouch || pl.crouchSt ? (R ? 3 : 32) : (R ? 89 : 90);
  else if (pl.pose > 0) f = rope && !pl.ropeSt0 ? (R ? 67 : 66) : pl.climb && !rope && !pl.climbAtk0 ? (R ? 81 : 80) : R ? 1 : 30;   // cios z liny 66/67 ($2F1BAE), z drabiny 80/81
  else if ((pl.st1Land || pl.st1Chute) && (pl.ground || pl.plat || pl.liftFloor || hopG)) f = R ? 0 : 29;   // tez na starcie podrzutu z kolcow (emulator 4x, C2)
  else if ((pl.crouch || pl.crouchSt && !dir) && (pl.ground || pl.plat || pl.liftFloor || hopG)) f = R ? 2 : 31;   // zsuniecie z krawedzi w kucki: od razu klatka spadania
  else if (rope && pl.ropeSt0 && pl.lockT > 0) f = R ? 0 : 29;   // skrypt ciosu z ziemi trwa w blokadzie
  else if (pl.climbAtk0) f = R ? 0 : 29;               // po nim skrypt postoju az do kierunku po blokadzie albo ruchu po drabinie
  else if (pl.climb && !rope && pl.lockT > 1) f = R ? 81 : 80;   // drabina: klatka ciosu do konca blokady (lockT maleje po animate; emulator 4x, L2)
  else if (rope) f = pl.ropeAnim || ropeRun === 1 ? cyc((pl.ropeAnim ? pl.ropeAnimDir : pl.ropeDir) < 0 ? ANIM.ropeUp : ANIM.ropeDn, 6) : (regrab || ropeRun ? (pl.face0 ?? pl.face) > 0 : (pl.ropeHang || pl.face) > 0) ? 65 : 64;   // zawis: zwrot ostatniego skryptu (kierunek z DOWN / UP z poprzedniej klatki zmienia tylko $2EB222 - emulator 4x, rndbR2oc 4369)   // lina: zawis 64/65 ($2F1B92)   // po puszczeniu i chwycie: chwyt ($2EB16C) w przerwaniu miedzy skryptem a zapisem zwrotu obslugi kierunku - stary zwrot (emulator 4x, R3)
  else if (pl.climb) f = pl.vy ? cyc(pl.ladderUp ? ANIM.climb : ANIM.climbDn) : R ? 79 : 78;   // drabina: zawis 79/78
  else if (pl.water && pl.spin > 0) f = cyc(pl.face > 0 ? ANIM.spinR : ANIM.spinL, 3);   // porwany przez prad
  else if (pl.water && pl.y > L.waterY - 8) f = swimFrame(dir);

  else if (pl.atDoor) f = doorPose();   // tylem do drzwi
  else if (pl.airCrawlStop && !pl.ground) f = R ? 18 : 47;
  else if (pl.lockT > 0 && pl.lift?.spike) f = pl.crouchSt ? (R ? 2 : 31) : R ? 0 : 29;   // cios na starcie podrzutu: do konca blokady $30CC63 obsluga spadania stoi - poza postoju (emulator 4x, L2); po ciosie w kucki kucanie (rndbR4oc)
  else if (!pl.ground && !((hopG || pl.liftFloor) && !pl.jump) || pl.jumpReq) f = pl.jump || pl.jumpReq || pl.jumpScript ? (RA ? 4 : 33) : (RA ? 88 : 87);   // przerwa przed podrzutem z kolcow: jeszcze na ziemi   // caly skok 4/33 ($2EB174, od klatki wcisniecia), spadanie 88/87 ($2EB1DC)
  else if (pl.jumpPose && !dir && (pl.ground || hopG) && !pl.idleDone) f = R ? 4 : 33;   // po skoku bez kierunku klatka skoku zostaje w poslizgu, az postoj ($2E8D3A) ja zmieni (emulator)
  else if (dir && pl.wallStand === dir && !wallHold) { pl.walking = true; f = R ? 0 : 29; }   // pchanie sciany: poza postoju ($2E8F38)
  else if (dir) {                                        // chod od poczatku sekwencji; na sliskiej podlodze co 3 ($2E9414)
    const c = pl.face > 0 ? ANIM.walkR : ANIM.walkL;     // tempo tylko przy starcie (wejscie na lod w marszu zostawia co 4), nowy
    if (!wasWalk || pl.cycle !== c) { pl.anim = 0; pl.cycleD = pl.wt === 'ice' ? 3 : 4; }   // kierunek w poslizgu = start (flagi $2EB20D/E)
    pl.walking = true; f = cyc(pl.cycle = c, pl.cycleD);
  }
  else { stand = true; f = idleFrame(); if (f === null) f = R ? 0 : 29; }   // postoj $2EB1A4: 0 / 29 (wlasna klatka w lewo)
  if (!stand) { pl.idle = 2400; pl.seq = null; }       // ruch, skok, cios: licznik od nowa
  if (!pl.walking && !(pl.crawl && dir)) pl.cycle = null;
  pl.frame = f; pl.flip = flip; pl.jumpPose = f === 4 || f === 33;
  if (pl.crawlEnd) pl.wallStand = 0;                   // po czolganiu chod od nowa: sciana znow dopiero przy probie ruchu
}

// --- kamera ---
const cam = {x: 0, y: 160};
// kamera ($2E528C, emulator): w poziomie rusza 1:1 z dx gracza, gdy ten wyjdzie poza 96..224 px ekranu; w pionie trzyma
// go 88..92 px od gory planszy, ale tylko gdy sie rusza w pionie (start etapu: 95 px); na drabinie / linie dosuwa sie
// 1 px/kl. tak, by gracz byl 132 px od lewej ($2E52DC)
function follow(snap, c = cam) {   // c: kopia kamery do podgladu (enemies25)
  if (snap) { c.x = pl.x - W / 2; c.y = pl.y - 95; c.px = pl.x; c.py = pl.y; }
  // $2F42F8 -> $2E528C: kamera (A4 = cam - 48) przesuwa sie o ruch gracza, gdy ten wyjdzie poza okno 96..224 / 88..92 px;
  // w lewo / w gore tylko przy A4 - 4 > min, w prawo / w dol przy A4 < max (min/max obszaru = rog - 16), w dol nie
  // w czasie smierci od upadku ($30CC22). Dosuwanie na drabinie ($2E52DC) wylacza $30BC40 = 1 (wszystkie poziomy)
  const A = L.areas && L.areas[L.areaId], [x0, y0, x1, y1] = A ? A.cam : [-1e9, -1e9, 1e9, 1e9];
  const dx = pl.x - (c.px ?? pl.x), dy = pl.y - (c.py ?? pl.y); c.px = pl.x; c.py = pl.y;
  if (dx > 0 && pl.x - c.x > 224 && c.x < x1 + 32 || dx < 0 && pl.x - c.x < 96 && c.x > x0 + 36) c.x += dx;
  if (dy > 0 && pl.y - c.y > 92 && c.y < y1 + 32 && !game.dying || dy < 0 && pl.y - c.y < 88 && c.y > y0 + 36) c.y += dy;
  // oryginal nie pokazuje 2 skrajnych kolumn mapy (start poziomu 1: kamera x=32, y=176 z dopasowania obrazu)
  c.x = Math.max(2 * TS, Math.min(c.x, L.w * TS - W - 2 * TS));
  c.y = Math.max(0, Math.min(c.y, L.h * TS - H));
  // granice obszaru: zmienna kamery gry (lewy gorny rog - 48), start poziomu ma kamere 16 px przed minimum
  const a = L.areas && L.areas[L.areaId];
  if (a) {
    const [x0, y0, x1, y1] = a.cam;
    // stala kamera (min = max): A4 = rog - 16 (emulator: drzwi poziomu 4 do obszaru 10268, pokoj premii)
    c.x = x0 === x1 ? x0 + 32 : Math.max(x0 + 32, Math.min(c.x, x1 + 48));
    c.y = y0 === y1 ? y0 + 32 : Math.max(y0 + 32, Math.min(c.y, y1 + 48));
  }
}
// lewa krawedz rysowanej planszy: na szerokim ekranie OX przed kamera oryginalu, ale nie poza 2 skrajne kolumny mapy
const viewX = () => Math.max(2 * TS, Math.min(Math.round(cam.x) - OX, L.w * TS - VW - 2 * TS));

// --- bieg po skarb ($2DD69E): 6 kawalkow mapy -> czarny ekran 'CONGRATULATIONS ! TREASURE MAP COMPLETE !' (zdarzenie 4),
// wiersze 36-47 w miejsce 0-11 (jak pokoj premii), gracz w (x, y) z tablicy +$72, kamera (gra -16 = u nas +48 -> 32)
// jedzie 1 px/klatke w prawo i pcha gracza; przedmioty z listy pojawiaja sie, gdy x <= kamera + 298 (w y - 576),
// diament za lewa krawedzia (x <= kamera - 48) przepada ($2E37D8); typ 0/1/2 = 100/500/1000 pkt, typ 3/4 = zycie.
// Koniec: wszystkie zebrane lub stracone, albo gracz spadnie w chmury. Wynik ($2DEF3C): procent, ocena, zloto. ---
const TR_PTS = [100, 500, 1000], TR_COL = 'rgb(0,119,221)';
function treasureStart() {
  const T = L.treasure;
  game.treasure = {phase: 'intro', t: 0, ret: {area: L.areaId, x: pl.x, y: pl.y}, next: 0, live: [], got: 0, missed: 0, heart: false,
    total: T.items.filter(i => i[2] !== 3).length, scr: {x: pl.x - viewX(), y: pl.y - Math.round(cam.y)}};
  game.state = 'treasure'; Music.jump(4); pl.vx = pl.vy = 0; pl.wp = null;
}
function treasureStep(press) {
  const G = game.treasure, T = L.treasure;
  G.t++;
  // emulator (poziom 1, klatki od $30CC6C): plansza gasnie cegielkami 9..49, w 58. gracz w obszarze skarbu (x ekranu jak przed,
  // y z tablicy) i sam idzie 2 px/kl. do x z tablicy; napisy od 129 i 169; w 475 scena rozjasnia sie (14 klatek) i gracz jest
  // juz sterowalny, kamera rusza 1 px/kl. w 695 i nie puszcza gracza dalej w lewo niz A4 + 62
  if (G.phase === 'intro') {
    if (G.t === 58) {
      const sx = pl.x - (Math.round(cam.x) - 48);
      swapBonusRows();
      L.areas.treasure = {cam: T.cam, water: null, doors: []}; enterArea('treasure');
      cam.x = 32; cam.y = 32;
      Object.assign(pl, {x: sx - 16, y: T.y, vx: 0, vy: 0, fx: 0, fy: 0, climb: false, rope: false, lift: null, attack: 0, pose: 0, lockT: 0, ground: true, jump: false});
    }
    if (G.t > 58) {
      const d = T.x - pl.x;
      if (d) { pl.face = Math.sign(d); pl.x += Math.sign(d) * Math.min(2, Math.abs(d)); }
      animate(d ? pl.face : 0);
    }
    if (G.t < 475) return;
    G.phase = 'run'; G.t = 0; G.hold = 220; Music.play('extra3');
  }
  if (G.phase === 'run') {
    update();
    const moving = !(G.hold > 0);
    if (G.hold > 0) G.hold--; else cam.x = Math.min(T.cam[2] + 48, cam.x + 1);   // kamera pcha gracza
    cam.y = 32;
    pl.x = Math.max(cam.x + 14, Math.min(cam.x + W - 8, pl.x));
    // $2E3786: tylko gdy kamera jedzie (emulator: pierwszy w klatce ruszenia), x <= A4 + 345 (szeroki ekran: przy prawej krawedzi widoku)
    while (moving && G.next < T.items.length && T.items[G.next][0] <= cam.x + 297 + OX) {
      const [x, y, k] = T.items[G.next++];
      G.live.push({x, y: y - 576, k, age: 0, f: 0, wait: 5 + Math.floor(Math.random() * 15)});
    }
    for (const d of G.live) {
      d.age++;
      if (d.wait > 0) d.wait--; else if (++d.f >= 16) { d.f = 0; d.wait = 5 + Math.floor(Math.random() * 15); }   // $2F35CC
      if (d.age > 28 && Math.abs(d.x - pl.x) < 12 && pl.y > d.y - 6 && pl.y - P.HEIGHT < d.y + 4) {      // dotyk po pojawieniu sie
        d.gone = true;
        if (d.k < 3) { G.got++; game.score += TR_PTS[d.k]; game.popups.push({x: d.x, y: d.y - 12, v: TR_PTS[d.k], t: 40}); Sfx.play('dia' + d.k); }
        else { if (d.k === 4) { G.got++; G.heart = true; } game.lives = Math.min(9, game.lives + 1); Sfx.play('heart'); }
      } else if (d.x <= cam.x - 48 - OX) { d.gone = true; if (d.k !== 3 && d.k !== 4) G.missed++; }
    }
    G.live = G.live.filter(d => !d.gone);
    for (const p of game.popups) p.t--; game.popups = game.popups.filter(p => p.t > 0);
    if (cam.x >= T.cam[2] + 48) G.endT = (G.endT || 0) + 1;          // koniec trasy: ostatnie serce czeka 10 s
    if (G.got + G.missed >= G.total || pl.y > 210 || G.endT > 500) {   // $2DD87C: koniec trasy albo upadek ($30CC75)
      G.phase = 'outro'; G.t = 0; G.fell = pl.y > 210;
      if (G.fell) Music.seek(18);                        // $2DE926: melodia 19 z wyciszeniem
    }
    return;
  }
  if (G.phase === 'outro') {
    // sukces ($2DEEA6): 10 klatek, melodia 18 od razu, 200 klatek, wygaszenie; upadek: 195 klatek, wolne wygaszenie
    // (krok co 3 klatki, $2DFC70), 100 klatek czerni. Potem wyniki ($2DEF3C) rozjasniaja sie
    if (!G.fell && G.t === 10) Music.seek(17, true);
    const show = () => { G.phase = 'results'; G.t = 0; treasureResults(); pfFade(false); };
    if (!G.fell && G.t === 210) pfFade(true, show);
    if (G.fell && G.t === 343) show();
    return;
  }
  if (G.phase === 'results') {
    if (G.t > 400 || (press && G.t > 50)) pfFade(true, treasureEnd);   // $2DE94A: wygaszenie, powrot, rozjasnienie
  }
}
function treasureResults() {
  const G = game.treasure, dia = G.got - (G.heart ? 1 : 0), all = Math.max(1, G.total - 1);
  const pct = Math.min(100, Math.round(dia * 100 / all)), R = tr('rating');
  G.res = {dia, missed: all - dia, pct, rate: R[pct >= 100 ? 5 : pct >= 90 ? 4 : pct >= 80 ? 3 : pct >= 50 ? 2 : pct >= 25 ? 1 : 0].trim(),
    bonus: pct >= 100 ? 1000 : pct >= 90 ? 750 : pct >= 80 ? 500 : pct >= 50 ? 250 : 0};
  game.gold += G.res.bonus; Sfx.play('tick');
}
function treasureEnd() {
  const G = game.treasure;
  swapBonusRows(); enterArea(G.ret.area);
  Object.assign(pl, {x: G.ret.x, y: G.ret.y, vx: 0, vy: 0, fx: 0, fy: 0, lift: null}); follow(true);
  game.treasure = null; game.state = null; pl.latch = pl.fireLatch = pl.doorLatch = true; Music.play('level' + levelNo); pfFade(false);
}
function treasureDraw() {
  const G = game.treasure;
  hud();
  cx.save(); cx.beginPath(); cx.rect(-OX, PFY, VW, H); cx.clip(); cx.translate(0, PFY);
  cx.fillStyle = '#000'; cx.fillRect(-OX, 0, VW, H);
  const camX = viewX(), camY = Math.round(cam.y);
  if (G.phase === 'intro' && G.t <= 48) {                // plansza gasnie cegielkami ($2DE65C)
    cx.restore(); draw(); bricks(Math.max(0, 6 - Math.floor(Math.max(0, G.t - 4) * 6 / 40))); return;
  }
  if (G.phase === 'intro') {                            // czarny ekran z graczem, potem napisy
    cx.save(); cx.translate(-OX, 0); player(L.player.surface, G.t < 58 ? pl.x - G.scr.x : camX, G.t < 58 ? pl.y - G.scr.y : camY, false); cx.restore();
    if (G.t >= 129) center(tr('congratulations'), 24, TR_COL);
    if (G.t >= 169) center(tr('map_complete'), 38, TR_COL);
  } else if (G.phase === 'run' || G.phase === 'outro') {
    cx.translate(-OX, 0);
    const sky = L.treasureMap.sky[(levelNo - 1) % 4];  // copper: wpis co 4 linie od linii 6, wzor [k, k-1, k, k]
    for (let y = 0; y < H; y++) {
      const k = y < 6 ? 0 : Math.min(sky.length - 1, (y - 2) >> 2), j = y < 6 ? 0 : (y - 2) & 3;
      cx.fillStyle = sky[j === 1 ? Math.max(0, k - 1) : k]; cx.fillRect(0, y, VW, 1);
    }
    tiles(L.surface, camX, camY);
    const TM = L.treasureMap;
    for (const d of G.live) {
      if (d.age < 14) continue;                         // pojawia sie po iskrze ($2F35E4: 2 + 12 krokow)
      const fr = TM.frames[d.k < 3 ? TM.diamond[d.k][d.wait > 0 ? 0 : (d.f >> 1)] : TM.heart];
      const bob = [0, -1, -1, -2, -2, -2, -1, -1][(d.age >> 2) & 7];   // kolysanie (sciezka $2F35E4)
      cx.drawImage(L.treasureImg, fr[0], fr[1], fr[2], fr[3], d.x - fr[4] - camX, d.y - fr[5] + bob - camY, fr[2], fr[3]);
    }
    player(L.player.surface, camX, camY, false);
    for (const p of game.popups) number(p.v, p.x - camX + 3 * String(p.v).length - 3, p.y - camY);
    if (G.phase === 'run') palFade(220 - G.hold, false);   // rozjasnianie ($2DFD14)
    if (G.phase === 'outro' && G.fell && G.t > 195) palFade(Math.ceil((G.t - 195) / 3), true);   // wolne wygaszanie $2DFC70 (krok co 3 klatki)
  } else {                                              // wyniki ($2DEF3C)
    const r = G.res, row = (l, v, y) => { text(l, 64, y, TR_COL); text(String(v), 254 - String(v).length * 8, y, TR_COL); };
    center(r.rate, 24, TR_COL);
    row(tr('collected_diamonds'), r.dia, 69); row(tr('missed_diamonds'), r.missed, 84); row(tr('complete'), r.pct + ' %', 99);
    center(r.bonus ? tr('bonus_none').replace(/NONE|BRAK/, r.bonus) : tr('bonus_none'), 124, TR_COL);
  }
  cx.restore();
}
// --- rysowanie ---
// niebo: gradient z coppera przesuwa sie z polowa predkosci kamery (paralaksa), ponizej lustra woda
// blyskawice (poziom 4, tablica $301088 -> $30BC4B): co 0..449 klatek ($2F0734) jedna z 4 sekwencji $30BC66.. dodaje
// po wpisie na klatke do kanalow RGB nieba (4 bity, obciecie do $F; $2E550C)
const FLASH = [[0x111, 0x555, 0x999, 0xddd, 0xfff, 0xeee, 0xddd, 0xccc, 0xbbb, 0xaaa, 0x999, 0xddd, 0xeee, 0xddd, 0xccc, 0xbbb, 0xaaa, 0x999, 0xfff, 0x888, 0x777, 0x666, 0x555, 0x444, 0x333, 0x222, 0x111],
  [0x111, 0x333, 0x444, 0x555, 0x555, 0x555, 0x444, 0x666, 0x555, 0x444, 0x666, 0x666, 0x555, 0x444, 0x333, 0x222, 0x111],
  [0x111, 0x555, 0x999, 0xddd, 0xfff, 0xfff, 0xfff, 0xfff, 0xfff, 0xeee, 0xddd, 0xfff, 0xfff, 0xeee, 0xddd, 0xccc, 0xbbb, 0xaaa, 0x999, 0x888, 0x777, 0x666, 0x555, 0x444, 0x333, 0x222, 0x111],
  [0x111, 0x333, 0x555, 0x777, 0x888, 0x777, 0x666, 0xaaa, 0x999, 0x888, 0x777, 0x666, 0x555, 0x444, 0x333, 0x222, 0x555, 0x555, 0x555, 0x444, 0x333, 0x222, 0x111]];
function flashTick() {
  if (levelNo !== 4 || game.treasure) { game.flash = null; return; }
  const F = game.flash;
  if (F) { if (++F.i >= F.s.length) game.flash = null; return; }
  if (game.flashT > 0) game.flashT--;
  else { game.flash = {s: FLASH[Math.floor(Math.random() * 4)], i: 0}; game.flashT = Math.floor(Math.random() * 450); }
}
const flashCol = (c, v) => '#' + [1, 3, 5].map((k, j) => Math.min(15, parseInt(c[k], 16) + (v >> (8 - 4 * j) & 15)).toString(16).repeat(2)).join('');
function background(camY) {
  const g0 = L.skyRow0 - Math.floor(camY / 2), fv = game.flash && game.flash.s[game.flash.i];
  for (let y = 0; y < H; y++) {
    const i = y - g0, sky = i < 0 ? L.skyTop : L.sky[Math.min(i, L.sky.length - 1)];
    cx.fillStyle = camY + y >= L.waterY ? L.waterColor : fv ? flashCol(sky, fv) : sky;
    cx.fillRect(0, y, VW, 1);
  }
}
function tiles(atlas, camX, camY) {
  const x0 = Math.floor(camX / TS), y0 = Math.max(0, Math.floor(camY / TS));
  const x1 = Math.min(L.w - 1, x0 + Math.ceil(VW / TS) + 1), y1 = Math.min(L.h - 1, y0 + Math.ceil(H / TS) + 1);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const v = L.map[ty * L.w + tx];
    if (v) cx.drawImage(atlas, (v & 15) * TS, (v >> 4) * TS, TS, TS, tx * TS - camX, ty * TS - camY, TS, TS);
  }
}
function player(sheet, camX, camY, water) {
  const pose = game.msgPose || 59, fr = game.state === 'msg' && !pl.water && !pl.climb ? pose : pl.frame, flip = fr === pose ? false : pl.flip;   // czytanie: klatka 59 ($2F1C00), triumf 58 ($2F1AD4)
  const m = L.player, f = m.frames[fr];
  if (!f || (game.hurt > 0 && game.hurt & 1)) return;   // miganie po trafieniu: co druga klatka puste sprite'y ($2F05FA, $2F182C)
  const G = weaponGfx();
  if (G) cx.drawImage(water ? L.weapons.water : L.weapons.surface, G.f[0], G.f[1], G.f[2], G.f[3], G.x - camX, G.y - camY, G.f[2], G.f[3]);
  const [cw, ch] = m.cell, sx = (fr % m.cols) * cw, sy = Math.floor(fr / m.cols) * ch;
  const top = pl.y - f.ay - camY + (pl.dyOff || 0);
  if (flip) {
    cx.save(); cx.scale(-1, 1);
    cx.drawImage(sheet, sx, sy, cw, f.h, -(pl.x + f.ax + 1 - camX), top, cw, f.h);
    cx.restore();
  } else cx.drawImage(sheet, sx, sy, cw, f.h, pl.x - f.ax - camX, top, cw, f.h);
}
// obiekty: BOB-y z banku gry (work/export_objects.py), kotwica z naglowka BOB-a
function objects(atlas, camX, camY) {   // blok '?' podskakuje po uderzeniu (o.bump)
  const O = L.objs, c = O.cell;
  const one = (type, x, y) => {
    const g = O.gfx[type];
    if (!g || x - camX < -c || x - camX > VW + c || y - camY < -c || y - camY > H + c) return;
    // petla klatek ze skryptu (monety $2F26C2: 0 1 2 3 2 1), 'delay' w taktach 25 Hz
    const [cell, w, h, ax, ay] = g.anim ? g.anim[Math.floor(game.frame / (2 * g.delay)) % g.anim.length] : [g.cell, g.w, g.h, g.ax, g.ay];
    cx.drawImage(atlas, cell % 16 * c, Math.floor(cell / 16) * c, w, h, x - ax - camX, y - ay - camY, w, h);
  };
  for (const o of O.objects) if (o.off) continue; else if (o.type === CAGE && !o.taken && O.gfx[CAGE].frames) cage(o, atlas, camX, camY);
  else if (!o.taken && !o.actor && !(o.life < 40 && o.life & 2)) one(o.type, o.x, o.y - (o.bump > 0 ? [0, 2, 4, 6, 6, 4, 2, 1, 0][o.bump] : 0));   // aktorow rysuje actors.js
}
// klatka z wiezniem ($2F301A): klatki 0 0 1 co 8 taktow, potem 1 przez 2-6 krokow; na poczatku cyklu dymek HELP
// ($2F3072, BOB $4B02): wznosi sie o 7 px przez 8 taktow, po 10 znika. Czas w taktach 25 Hz z game.frame.
const HELP_DY = [0, 2, 3, 4, 5, 5, 6, 6, 7];
function cage(o, atlas, camX, camY) {
  const g = L.objs.gfx[CAGE], c = L.objs.cell, t = game.frame >> 1;
  if (!o.cyc || t >= o.cyc.end || t < o.cyc.t0) o.cyc = {t0: t, end: t + 24 + 8 * (2 + Math.floor(Math.random() * 4))};
  const k = t - o.cyc.t0, [cell, w, h, ax, ay] = g.frames[k < 16 ? 0 : 1];
  if (o.x - camX < -c || o.x - camX > VW + c || o.y - camY < -c || o.y - camY > H + c) return;
  cx.drawImage(atlas, cell % 16 * c, Math.floor(cell / 16) * c, w, h, o.x - ax - camX, o.y - ay - camY, w, h);
  if (k < 18) {
    const [hc, hw, hh, hax, hay] = g.help;
    cx.drawImage(atlas, hc % 16 * c, Math.floor(hc / 16) * c, hw, hh, o.x - hax - camX, o.y - HELP_DY[Math.min(8, k)] - hay - camY, hw, hh);
  }
}
const scene = (water, camX, camY) => {
  tiles(water ? L.water : L.surface, camX, camY);
  objects(water ? L.objs.water : L.objs.surface, camX, camY);
  Actors.flashColor = water ? ['#ddddff', '#ffffff', '#ffffff', '#aaffff'][(levelNo - 1) & 3] : '#ffffff';   // kolor 22 palety
  Actors.draw(cx, water ? L.actors.water : L.actors.surface, camX, camY, VW, H);
  for (const sh of game.shots) {                        // kule: BOB-y $F7F2 / $F870 (work/export_shots.py), kotwica (5, 9)
    if (sh.kind !== 'fireball') { cx.drawImage(L.shotsImg, sh.kind === 'iron_balls' ? 0 : 10, 10 * ((levelNo - 1) & 3), 10, 10, sh.x - 5 - camX, sh.y - 5 - camY, 10, 10); continue; }
    // ognista kula: ogien z banku przedmiotow ($2E0B60: baza $4FD4, klatki 0 1 2 3 2 3 ... co takt)
    const e = (FIRE_T - (sh.side ? 4 : 0) - sh.t) >> 1, n = sh.side ? 24 : 26;   // klatki 0 1, potem 2 3 ..., na koncu 0 1
    const k = sh.fire ? (e < 2 ? e : e >= n - 2 ? e - n + 2 : 2 + (e & 1)) : Math.floor(game.frame / 2) % 4;
    const f = Actors.bob({base: (L.actors.banks['30cd58'] || 0) + 0x4fd4, frame: k});
    if (f) cx.drawImage(water ? L.actors.water : L.actors.surface, f[0], f[1], f[2], f[3], sh.x - f[4] - camX, sh.y + 6 - f[5] - camY, f[2], f[3]);
  }
  player(water ? L.player.water : L.player.surface, camX, camY, water);
  for (const b of game.bombs) {                         // bomba (ikona ze sklepu), potem blysk wybuchu
    const f = Actors.bob({base: (L.actors.banks['30cd58'] || 0) + 0x3b20, frame: b.k ? 0 : 1});   // $2E101C: blok $2E1048 (1, 0)
    if (f) cx.drawImage(water ? L.actors.water : L.actors.surface, f[0], f[1], f[2], f[3], b.x - f[4] - camX, b.y - f[5] - camY, f[2], f[3]);
  }
  if (game.carry) {                                     // niesiona skrzynia przy stopach przed graczem
    const v = L.crates.tile, atlas = water ? L.water : L.surface;
    cx.drawImage(atlas, (v & 15) * TS, (v >> 4) * TS, TS, TS, pl.x + carryX() - 8 - camX, pl.y - 15 - camY, TS, TS);
  }
};

// liczba cyframi z HUD gry (5x6, rozstaw 6), wyrownana do prawej: ostatnia cyfra od x
function number(n, x, y) {
  const s = String(Math.max(0, Math.floor(n)));
  for (let i = 0; i < s.length; i++) cx.drawImage(L.digits, +s[s.length - 1 - i] * 6, 0, 5, 6, x - 6 * i, y, 5, 6);
}
function draw() {
  hud();
  const sh = game.shake && game.shake.length ? game.shake.shift() : 0;
  cx.save(); cx.beginPath(); cx.rect(-OX, PFY, VW, H); cx.clip(); cx.translate(-OX, PFY + sh);
  playfield();
  const camX = viewX(), camY = Math.round(cam.y);
  for (const p of game.popups) number(p.v, p.x - camX + 3 * String(p.v).length - 3, p.y - camY);
  cx.restore();
  if (game.msg && game.msg.t > 0) { game.msg.t--; center(game.msg.text, PFY + 24, '#fff'); }   // komunikat (sklep, napisy)
}
function hud() {
  if (OX) for (const [x, sx] of [[-OX, 0], [W, W - OX]]) {   // szeroki ekran: boki HUD-u jak tlo opcji - marmur z paska Life, lina z panelu
    const T = L.hudTop, B = L.hudBottom, y0 = PFY + H;
    for (let i = 0; i < OX; i += 94) {
      const w = Math.min(94, OX - i);
      cx.drawImage(T, 104, 0, w, 12, x + i, 0, w, 12);
      for (let y = 4; y < 36; y += 8) {                 // co drugi rzad marmuru odbity
        cx.save(); if ((y >> 3) & 1) { cx.translate(0, 2 * (y0 + y) + 8); cx.scale(1, -1); }
        cx.drawImage(T, 104, 2, w, 8, x + i, y0 + y, w, 8); cx.restore();
      }
    }
    cx.drawImage(T, 0, 0, 3, 12, x, 0, 3, 12); cx.drawImage(T, 317, 0, 3, 12, x + OX - 3, 0, 3, 12);
    cx.drawImage(B, sx, 0, OX, 4, x, y0, OX, 4); cx.drawImage(B, sx, 36, OX, 4, x, y0 + 36, OX, 4);
    cx.drawImage(B, sx ? 316 : 0, 4, 4, 32, sx ? x + OX - 4 : x, y0 + 4, 4, 32);
  }
  cx.drawImage(L.hudTop, 0, 0); cx.drawImage(L.hudBottom, 0, PFY + H);   // HUD z obrazu emulatora
  number(game.score, 185, PFY + H + 12); number(game.gold, 185, PFY + H + 24);
  for (let i = 5; i < game.maxLife; i++) cx.drawImage(L.hudTop, 51, 2, 9, 7, 51 + 11 * i, 2, 9, 7);   // apteczka: dodatkowe pola
  for (let i = Math.min(game.life, game.lifeFill ?? 99); i < game.maxLife; i++) cx.drawImage(L.lifeEmpty, 51 + 11 * i, 2);   // puste pola Life
  cx.fillStyle = '#330044'; cx.fillRect(11, 2, 6, 6); number(Math.max(0, game.lives), 11, 2);   // serca
  const vw = Math.min(61, game.vitShow);                  // pasek witamin: sylwetki owocow koloruja sie 1 px na punkt (zrzut gry)
  if (vw) cx.drawImage(L.hudTopVit, 256, 0, vw, 12, 256, 0, vw, 12);
  for (let i = 0; i < game.pieces; i++) {                                                        // kawalki mapy 2x3
    const x = 251 + 8 * (i & 1), y = PFY + H + 12 + 6 * (i >> 1);
    cx.fillStyle = '#a63'; cx.fillRect(x, y, 7, 5); cx.fillStyle = '#ec9'; cx.fillRect(x + 1, y + 1, 5, 3);
  }
  cx.fillStyle = 'rgb(51,0,68)'; cx.fillRect(124, PFY + H + 29, 13, 6);                            // CREW (2 cyfry)
  number(game.crew % 10, 131, PFY + H + 29); number(Math.floor(game.crew / 10), 125, PFY + H + 29);
  if (game.weaponBob && game.weapon !== 'start') {                        // ikona kupionej broni w polu WEAPON
    const f = L.shopFrames[game.weaponBob];
    cx.fillStyle = 'rgb(51,0,68)'; cx.fillRect(13, PFY + H + 12, 29, 23);   // wnetrze ramki x 13..41, y 12..34
    if (f) cx.drawImage(L.shopAtlas, f[0], f[1], f[2], f[3], 27 - (f[2] >> 1), PFY + H + 23 - (f[3] >> 1), f[2], f[3]);
    cx.fillStyle = 'rgb(51,0,68)';
  }
  if (game.tool) {                                                         // wybrane narzedzie i liczba w polu TOOL
    const i = TOOL_ICON[game.tool], f = L.shopFrames[game.toolBob[game.tool]];
    cx.fillStyle = 'rgb(51,0,68)'; cx.fillRect(52, PFY + H + 12, 22, 23);   // wnetrze ramki (dopasowane do HUD-u z gry)
    if (i !== undefined) cx.drawImage(L.toolIcons, 16 * i, 0, 16, 15, 54, PFY + H + 11, 16, 15);
    else if (f) cx.drawImage(L.shopAtlas, f[0], f[1], f[2], f[3], 64 - (Math.min(f[2], 24) >> 1), PFY + H + 20 - (Math.min(f[3], 18) >> 1), Math.min(f[2], 24), Math.min(f[3], 18));
    number(game.inv[game.tool] % 10, 63, PFY + H + 27); number(Math.floor(game.inv[game.tool] / 10), 57, PFY + H + 27);   // zawsze 2 cyfry ('01')
  }
  if (game.compass) {                                                     // igla kompasu w kole panelu ($308FF4, kotwica 100/24)
    const f = L.compass.frames[game.compassF || 0];
    cx.drawImage(L.compassImg, f[0], f[1], f[2], f[3], L.compass.anchor[0] - f[4], PFY + H + L.compass.anchor[1] - f[5], f[2], f[3]);
  }
  const sec = Math.ceil((game.timer || game.timeShow || 0) / 50);         // TIME m:ss
  cx.fillStyle = 'rgb(51,0,68)'; cx.fillRect(286, PFY + H + 19, 20, 6); cx.fillRect(301, PFY + H + 19, 5, 6);
  number(Math.floor(sec / 60) % 10, 287, PFY + H + 19); number(Math.floor(sec % 60 / 10), 295, PFY + H + 19); number(sec % 10, 301, PFY + H + 19);
  cx.fillStyle = '#eee'; cx.fillRect(293, PFY + H + 21, 1, 1); cx.fillRect(293, PFY + H + 23, 1, 1);
  cx.fillStyle = 'rgb(51,0,68)';
  game.keys.forEach((n, i) => { if (n) { cx.fillRect(202 + 10 * i, PFY + H + 28, 5, 6); number(n % 10, 202 + 10 * i, PFY + H + 28); } });
}
function playfield() {
  const camX = viewX(), camY = Math.round(cam.y);
  background(camY);
  scene(false, camX, camY);
  const wl = L.waterY - camY;                          // pod linia wody paleta podwodna (copper w oryginale)
  if (wl < H) {
    cx.save(); cx.beginPath(); cx.rect(0, Math.max(0, wl), VW, H); cx.clip();
    cx.fillStyle = L.waterColor; cx.fillRect(0, Math.max(0, wl), VW, H);
    scene(true, camX, camY);
    cx.restore();
    L.surfaceLine.forEach((c, i) => { cx.fillStyle = c; cx.fillRect(0, wl + i, VW, 1); });
    if (L.surfaceLine.length) {                          // emulator: pierwszy wiersz migocze - paski po 2 px jasniejszego
      cx.fillStyle = surfLight(L.surfaceLine[0]);        // koloru (L1 #002FCF / #004FEF), faza co 7 klatek
      for (let x = (Math.floor(game.frame / 7) & 1) * 2; x < VW; x += 4) cx.fillRect(x, wl, 2, 1);
    }
  }
}
const surfLight = c => '#' + [1, 3, 5].map(k => Math.min(255, parseInt(c.substr(k, 2), 16) + (k > 1 ? 0x20 : 0)).toString(16).padStart(2, '0')).join('');

// poziomy: game/assets/level<n>.* (work/export_level.py, export_objects.py, export_actors.py); ?level=n
const LEVEL_COUNT = 4;
let levelNo = Math.min(LEVEL_COUNT, Math.max(1, +new URLSearchParams(location.search).get('level') || 1));
async function startLevel(n) {
  game.state = 'loading';
  levelNo = n; L = await load('level' + n); enterArea(L.area); game.plateHold = null; game.phase = 5; game.hurt = 0;   // $2DD1C2
  Music.play('level' + n); Sfx.load(n).catch(e => console.warn('efekty:', e)); Music.loadJingles(n).catch(e => console.warn('dzingle:', e));
  Actors.player = pl; Actors.playerBox = playerBox; Actors.onSound = name => Sfx.play(name); Actors.onMusic = ev => Music.jump(ev); Actors.onShake = () => { game.shake = SHAKE.slice(); };
  // lup z wroga ($2E70D2): los 0..77 z $2E8454, wartosc v -> opis $2E84C2[v-1] (zgnily, owoce 1-4, klejnot, moneta, sakwa 25);
  // skacze jak owoc z dzbana ($2EEFA0: vy -5, odbicia z dzwiekiem (62,30), sakwa (39,0))
  Actors.onLoot = (x, y) => {
    const v = LOOT_TABLE[Math.floor(Math.random() * 78)], type = v && LOOT_ITEM[v - 1];
    if (type) L.objs.objects.push({x, y, type, life: 100, brain: {vy: -5, acc: 0, cap: v === 12 ? 4 : 6, iter: 3, clink: v >= 10 ? (v === 12 ? 'sack' : true) : 0}});
  };
  Actors.onDrop = (x, y) => L.objs.objects.push({x, y, type: PIECE, brain: {vy: -5, acc: 0, cap: 4, iter: 3}});   // $2E6F08: kawalek mapy z wroga
  game.checkpoint = null;                                // punkt kontrolny poprzedniego poziomu nie moze ustawic startu
  Actors.spawn(); respawn();
  for (const o of L.objs.objects) { const p = FALL_ITEM[o.type]; if (p) o.brain = {vy: 0, acc: 0, cap: p[0], iter: p[1], clink: p[2]}; }
  game.crew = countCrew(); game.tools = 0; game.keys = [0, 0, 0, 0]; game.timer = 0; game.timeShow = 0; game.compass = false; game.compassSpin = game.compassF = 0; game.fruits = game.pieces = 0; game.checkpoint = null; game.bombs = []; game.bombWalls = 0; game.toolLock = 0; game.rainFlag = false; game.rainGen = null; game.bonusRun = null; game.bonusWait = 0; game.lit = {}; game.bell = null;
  game.treasure = null; game.treasureWait = 0; game.chest = null; game.dying = null; pl.dyOff = 0; game.crawled = false; game.upLock = 0;   // $30CC81, $30CCCA
  game.pages = [tr('msg.logbook') + '^' + tr('msg.captain')]; game.page = 0; game.inv.book = 1; if (!game.tool) game.tool = 'book';   // $2DCBD0
  game.flags = {}; Actors.flags = game.flags; game.combos = {}; game.timed = null; game.carry = null; game.plateHold = null;
  game.state = 'intro'; game.anyLatch = true;
}
const directLevel = new URLSearchParams(location.search).has('level');
assetsReady.then(() => Promise.all([startLevel(levelNo), initLang()])).then(() => {
  if (!directLevel) { game.state = 'splash'; game.splashT = performance.now(); Music.play('title'); }   // ?level=n pomija tytul i mape
  let acc = 0, last = performance.now();
  (function frame(now) {
    acc = Math.min(acc + now - last, 250); last = now;
    while (acc >= STEP) {
      // przycisk (spacja/enter/miecz) dopiero po puszczeniu poprzedniego
      const BTN = ['Space', 'Enter', 'KeyX', 'ControlLeft', 'ControlRight'], btn = k(...BTN);
      const hit = new Set(pressed); pressed.clear();
      const press = (btn || BTN.some(c => hit.has(c))) && !game.anyLatch; if (!btn) game.anyLatch = false; if (btn) game.anyLatch = true;
      const k1 = (...c) => c.some(x => hit.has(x));
      if (eggKey(hit, press)) { /* ekran autora portu */ }
      else if (game.pfFade) pfFadeTick();
      else if (game.state === 'clear' && game.bonus && game.bonus.steps.length) {   // naliczanie premii; przycisk: od razu calosc
        const B = game.bonus;
        const take = () => { const [f, v, ds] = B.steps.shift(); B[f] += v; game.score += v; B.sec -= ds; };
        if (press) { while (B.steps.length) take(); }
        else if (B.wait > 0) B.wait--;
        else if (game.frame % 2 === 0) { take(); Sfx.play('tick'); }
      }
      else if (game.state === 'clear') {
        if (press && levelNo === LEVEL_COUNT) { game.state = 'ending'; game.frame = 0; Music.play('extra2'); }   // po twierdzy: zakonczenie (SEG2, muzyka $C5C34)
        else if (press) { levelNo = levelNo % LEVEL_COUNT + 1; game.state = 'map'; Music.play('map'); }
      }
      else if (game.state === 'ending') { if (press && game.frame > 100) gameOver(); }
      else if (game.state === 'title') {
        if (k1('KeyC') && saveInfo('auto')) loadGame('auto');
        else if (press) menuOpen();
      }
      else if (game.state === 'map') { mapTick(); if (press) { game.mapOn = false; startLevel(levelNo); } }
      else if (game.state === 'intro') { if (press) readyStart(); }
      else if (game.state === 'reveal') revealTick();
      else if (game.state === 'bonus') bonusStep();
      else if (game.state === 'gameover') gameOverInput(press);
      else if (game.state === 'options') optionsInput(press, k1);
      else if (game.state === 'photo') photoInput(k1);
      else if (game.state === 'mapview') mapViewStep(press);
      else if (game.state === 'pause') pauseInput(press, k1);
      else if (game.state === 'shop') {
        shopInput(press, k1);
        if (game.state !== 'shop') pl.latch = pl.fireLatch = pl.doorLatch = true;
      }
      else if (game.state === 'dark') darkInput(press, k1);
      else if (game.state === 'hof') hofInput(press, k1, hit);
      else if (game.state === 'credits' || game.state === 'story') { if (press) menuOpen(); }
      else if (game.state === 'menu') menuInput(press, k1);
      else if (game.state === 'splash') { if (press) { game.state = 'title'; game.titleT = 0; } }
      else if (game.state === 'msg') msgInput(press);
      else if (!game.state) { update(); follow(); if (game.fadeIn > 0) game.fadeIn--; }
      else if (game.state === 'treasure') treasureStep(press);
      acc -= STEP;
    }
    if (!['title', 'story', 'ending', 'menu', 'intro', 'ready'].includes(game.state)) screenSize(VW, SH);
    const ox = cv.width === VW && cv.height === SH ? OX : 0;   // szeroki ekran: ekrany 320 px na srodku, boki czarne
    if (ox) { cx.fillStyle = '#000'; cx.fillRect(0, 0, ox, SH); cx.fillRect(ox + W, 0, ox, SH); }
    cx.save(); cx.translate(ox, 0);
    if (game.state === 'clear') clearScreen(); else if (game.state === 'intro') introScreen(); else if (game.state === 'ending') endingScreen();
    else if (game.state === 'ready') readyScreen(); else if (game.state === 'gameover') gameOverScreen(); else if (game.state === 'author') unfold(authorScreen); else if (game.state === 'reveal') { draw(); revealMask(); } else if (game.state === 'bonus') { draw(); bonusMask(); }
    else if (game.state === 'title') titleScreen(); else if (game.state === 'map') mapScreen();
    else if (game.state === 'menu') unfold(menuScreen);
    else if (game.state === 'msg') { draw(); messageBox(); } else if (game.state === 'shop') shopScreen();
    else if (!game.state) { draw(); if (game.fadeIn > 0) palFade(16 - game.fadeIn, false); const D = game.dying, f = D && D.wait > 0 ? D.wait : game.exitWave; if (f > 0 && f <= 16) palFade(17 - f, true); }   // $2DFBCA: wygaszanie przed powrotem
    else if (game.state === 'options') optionsScreen(); else if (game.state === 'photo') photoDraw(); else if (game.state === 'mapview') mapViewDraw();
    else if (game.state === 'pause') pauseScreen(); else if (game.state === 'dark') darkScreen(); else if (game.state === 'hof') unfold(hofScreen); else if (game.state === 'credits') unfold(creditsScreen); else if (game.state === 'story') storyScreen(); else if (game.state === 'splash') splashScreen(); else if (game.state === 'treasure') treasureDraw();
    pfFadeDraw();
    cx.restore();
    info.textContent = `${LANG._name} - ${levelNo}: ${(tr('level')[levelNo - 1] || '')} - x ${pl.x} y ${pl.y} - ${tr('controls')}`;
    requestAnimationFrame(frame);
  })(last);
}).catch(e => { info.textContent = 'Blad wczytywania: ' + e.message; });
