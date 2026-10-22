#!/usr/bin/env python3
"""Przebudowa HUD na układ z oryginału + nowe statystyki (Vitamins, Crew, Score)."""
p = 'remake/game.js'
s = open(p, encoding='utf-8').read()

# --- 1. paleta: purpura, kamień, złoto ---
old_pal = "  white: '#ddeedd', black: '#000000', red: '#cc0000', darkred: '#990000'\n};"
new_pal = ("  white: '#ddeedd', black: '#000000', red: '#cc0000', darkred: '#990000',\n"
           "  purple: '#4a2a6a', purple2: '#6a3a8a', purple3: '#2a1a3a',\n"
           "  gold3: '#e8c040', gold4: '#b8902a',\n"
           "  stoneA: '#6b7b8c', stoneB: '#4a5566', stoneC: '#9aa9b8', stoneD: '#2f3844',\n"
           "  green1: '#2f6b2f', green2: '#4a9a3a', green3: '#1e4a1e',\n"
           "  red2: '#e04040', red3: '#8a1010'\n};")
assert old_pal in s
s = s.replace(old_pal, new_pal)

# --- 2. reset(): nowe statystyki ---
old_reset = "this.time = L.time * 60; this.hp = 3; this.vy = 0; this.grounded = false;"
new_reset = ("this.time = L.time * 60; this.vitamins = 12; this.crew = 0; this.score = 0;"
             " this.tool = 1; this.vy = 0; this.grounded = false;")
assert old_reset in s
s = s.replace(old_reset, new_reset)

# --- 3. hurt(): vitamins zamiast hp ---
old_hurt = "  G.hp--; Sfx.hurt(); G.inv = 90; G.flash = 12;"
new_hurt = "  G.vitamins--; Sfx.hurt(); G.inv = 90; G.flash = 12;"
assert old_hurt in s
s = s.replace(old_hurt, new_hurt)
old_hurt2 = "  if (G.hp <= 0) { G.lives--; if (G.lives < 0) { state = 'gameover'; return; } G.reset(); }"
new_hurt2 = "  if (G.vitamins <= 0) { G.lives--; if (G.lives < 0) { state = 'gameover'; return; } G.reset(); }"
assert old_hurt2 in s
s = s.replace(old_hurt2, new_hurt2)

# --- 4. punkty / załoga ---
s = s.replace("Sfx.talk(); n.rescued = true; G.gold += 50;",
              "Sfx.talk(); n.rescued = true; G.crew++; G.score += 500; G.gold += 50;")
s = s.replace("setTile(tx, ty, '.'); G.diamonds++; G.diamGot++; Sfx.diamond();",
              "setTile(tx, ty, '.'); G.diamonds++; G.diamGot++; G.score += 25; Sfx.diamond();")
s = s.replace("e.dead = true; Sfx.hit(); G.gold += 25;",
              "e.dead = true; Sfx.hit(); G.gold += 25; G.score += 150;")

# --- 5. HUD w układzie oryginału ---
start = s.index("function drawHUD() {")
end = s.index("function drawHeart(")
new_hud = """function drawHUD() {
  /* ---- górny pasek: Life + Vitamins ---- */
  px(0, 0, W, 18, C.purple3);
  px(0, 0, W, 16, C.purple);
  px(0, 16, W, 2, C.k);
  px(0, 1, W, 1, C.gold2);
  drawHeart(4, 4);
  cx.font = 'bold 10px monospace'; cx.textAlign = 'left'; cx.fillStyle = C.w;
  cx.fillText(String(G.lives), 15, 13);
  cx.font = '8px monospace'; cx.fillStyle = C.gold2; cx.fillText('Life', 24, 11);
  // pasek vitamins
  const vx0 = 60, seg = 10, maxv = 12;
  px(vx0 - 1, 3, maxv * seg + 2, 10, C.k);
  for (let i = 0; i < maxv; i++) {
    const on = i < G.vitamins;
    const col = !on ? '#14201a' : (i < 4 ? C.red : (i < 8 ? C.gold : C.green2));
    px(vx0 + i * seg, 4, seg - 1, 8, col);
    if (on) px(vx0 + i * seg, 4, seg - 1, 1, C.w);
  }
  cx.font = '8px monospace'; cx.fillStyle = C.gold2; cx.textAlign = 'right';
  cx.fillText('Vitamins', W - 4, 11);

  /* ---- dolny panel ---- */
  const py0 = 196;
  px(0, py0, W, H - py0, C.purple3);
  px(0, py0 + 2, W, H - py0 - 2, C.purple);
  px(0, py0, W, 2, C.gold2);
  px(0, py0 + 2, W, 1, C.purple2);

  function slot(x, y, w, h) {
    px(x, y, w, h, C.k);
    px(x + 1, y + 1, w - 2, h - 2, C.purple3);
    cx.strokeStyle = C.gold4; cx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  cx.font = '8px monospace'; cx.textAlign = 'left';

  // WEAPON
  cx.fillStyle = C.gold2; cx.fillText('WEAPON', 5, py0 + 11);
  slot(5, py0 + 14, 24, 20);
  px(14, py0 + 17, 2, 12, C.steel);          // ostrze
  px(15, py0 + 16, 1, 2, C.w);
  px(11, py0 + 27, 8, 2, C.gold2);           // jelec
  px(14, py0 + 29, 2, 4, C.wood2);           // rękojeść
  cx.fillStyle = C.w; cx.fillText('0' + (G.weapon + 1), 6, py0 + 46);

  // TOOL
  cx.fillStyle = C.gold2; cx.fillText('TOOL', 34, py0 + 11);
  slot(34, py0 + 14, 24, 20);
  cx.drawImage(SPR.key, 39, py0 + 17);
  cx.fillStyle = C.w; cx.fillText('0' + G.tool, 35, py0 + 46);

  // CREW
  cx.fillStyle = C.gold2; cx.fillText('CREW', 63, py0 + 11);
  slot(63, py0 + 14, 24, 20);
  cx.drawImage(SPR.npc, 66, py0 + 15, 16, 16);
  cx.fillStyle = C.w; cx.fillText(String(G.crew).padStart(2, '0'), 64, py0 + 46);

  // SCORE
  cx.fillStyle = C.gold2; cx.fillText('SCORE', 94, py0 + 11);
  px(92, py0 + 14, 62, 12, C.k);
  cx.fillStyle = C.w; cx.textAlign = 'right';
  cx.fillText(String(G.score).padStart(5, '0'), 152, py0 + 23);

  // GOLD
  cx.fillStyle = C.gold2; cx.textAlign = 'left'; cx.fillText('GOLD', 94, py0 + 39);
  px(92, py0 + 42, 62, 12, C.k);
  cx.fillStyle = C.gold3; cx.textAlign = 'right';
  cx.fillText(String(G.gold), 152, py0 + 51);

  // sloty na klucze / przedmioty
  for (let i = 0; i < 5; i++) slot(160 + i * 15, py0 + 14, 13, 13);
  for (let i = 0; i < 5; i++) slot(160 + i * 15, py0 + 30, 13, 13);

  // TIME
  cx.fillStyle = C.gold2; cx.textAlign = 'left'; cx.fillText('TIME', 236, py0 + 11);
  px(234, py0 + 14, 82, 20, C.k);
  const t = Math.max(0, G.time / 60 | 0);
  cx.font = 'bold 15px monospace'; cx.fillStyle = C.w; cx.textAlign = 'center';
  cx.fillText((t / 60 | 0) + ':' + String(t % 60).padStart(2, '0'), 275, py0 + 30);

  // stopka
  cx.font = '8px monospace'; cx.textAlign = 'left'; cx.fillStyle = C.gold2;
  cx.fillText('DIAMONDS ' + G.diamonds + '/' + G.diamTotal, 5, py0 + 57);
  cx.textAlign = 'right'; cx.fillStyle = C.green2;
  cx.fillText(WEAPONS[G.weapon].n, W - 5, py0 + 57);
  // nazwa etapu
  if (tick < 160) {
    cx.globalAlpha = Math.min(1, (160 - tick) / 50);
    cx.textAlign = 'center'; cx.font = '10px monospace'; cx.fillStyle = C.w;
    px(W / 2 - 94, 24, 188, 14, 'rgba(0,0,0,0.6)');
    cx.fillText(LEVELS[G.lvl].name, W / 2, 34);
    cx.globalAlpha = 1;
  }
}
"""
s = s[:start] + new_hud + s[end:]

open(p, 'w', encoding='utf-8').write(s)
print("HUD + statystyki zaktualizowane")
