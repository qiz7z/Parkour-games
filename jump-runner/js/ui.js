// 界面：主菜单、个性商店（角色/坐骑）、排行榜、HUD、结算面板
// 视觉风格：电竞深色 HUD —— 深藏青底、霓虹紫主色、玫瑰红 CTA、切角面板、大字重数字
// 布局函数（getMenuButtons/getShopLayout/getRankLayout/getOverButtons）同时供绘制与点击判定使用
const util = require('./util');
const skins = require('./skins');
const mounts = require('./mounts');
const Player = require('./player');
const sound = require('./sound');
const F = require('./font');

// ---- 设计变量（Neon Purple + Rose on Deep Navy） ----
const BG = 'rgba(15,15,35,0.92)';        // 面板底
const CARD = '#1E1C35';                  // 卡片
const CARD_LIFT = '#272546';             // 卡片悬停/按下
const PRIMARY = '#7C3AED';               // 霓虹紫
const PRIMARY_L = '#A78BFA';             // 亮紫
const ACCENT = '#F43F5E';                // 玫瑰红 CTA
const TEXT = '#E2E8F0';                  // 主文字
const MUTED = '#94A3B8';                 // 次级文字
const FAINT = 'rgba(148,163,184,0.45)';  // 弱文字
const BORDER = 'rgba(124,58,237,0.55)';  // 紫描边
const BORDER_SOFT = 'rgba(167,139,250,0.22)';

function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function roundFill(ctx, x, y, w, h, r, fill, stroke) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// 切角矩形（对角切 10px，电竞 HUD 语言）
function chamfer(ctx, x, y, w, h, c, fill, stroke, lw) {
  const k = Math.min(c, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.lineTo(x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.lineTo(x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.lineTo(x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw || 1.5;
    ctx.stroke();
  }
}

// HUD 按钮：切角深底 + 紫描边；accent 玫瑰红；pressed 微沉 + 提亮
function hudButton(ctx, r, opts) {
  opts = opts || {};
  const pressed = !!opts.pressed;
  const base = opts.accent ? 'rgba(244,63,94,0.16)' : 'rgba(30,28,53,0.92)';
  const border = opts.accent
    ? (pressed ? '#FF7A93' : ACCENT)
    : (pressed ? PRIMARY_L : BORDER);
  chamfer(ctx, r.x + (pressed ? 1.5 : 0), r.y + (pressed ? 1.5 : 0), r.w, r.h, 9, base, border, opts.accent ? 1.8 : 1.5);
  if (pressed) {
    chamfer(ctx, r.x + 1.5, r.y + 1.5, r.w, r.h, 9, 'rgba(255,255,255,0.06)', null);
  }
  if (opts.label) {
    if (opts.icon) {
      opts.icon(ctx, r.x + 24, r.y + r.h / 2);
    }
    ctx.fillStyle = opts.labelColor || TEXT;
    ctx.font = F.b(opts.fontSize || 18);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.label, r.x + r.w / 2 + (opts.icon ? 10 : 0), r.y + r.h / 2 + 0.5);
  }
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rr;
    const py = cy + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawCoinIcon(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD24A';
  ctx.fill();
  ctx.lineWidth = Math.max(1.6, r * 0.25);
  ctx.strokeStyle = '#C98A1B';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function spacedText(ctx, str, x, y, spacing) {
  let total = 0;
  for (const ch of str) total += ctx.measureText(ch).width + spacing;
  total -= spacing;
  let cx = x - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of str) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = prevAlign;
}

function drawAvatar(ctx, skin, cx, cy, scale) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  Player.drawChibi(ctx, skin, { run: 0, grounded: true, vy: 0, riding: false, t: 1.23 });
  ctx.restore();
}

function drawMountThumb(ctx, id, cx, bottomY, scale, time) {
  ctx.save();
  ctx.translate(cx, bottomY);
  ctx.scale(scale, scale);
  mounts.draw(ctx, id, 0, 0, time, { run: time * 4, grounded: true });
  ctx.restore();
}

// ---------------- 主菜单 ----------------

function getMenuButtons(game) {
  const H = game.H;
  return {
    mute: { x: 14, y: 14, w: 46, h: 34, r: 8 },
    start: { x: game.W / 2 - 110, y: H * 0.545, w: 220, h: 56, r: 10 },
    shop: { x: game.W / 2 - 148, y: H * 0.655, w: 142, h: 46, r: 9 },
    rank: { x: game.W / 2 + 6, y: H * 0.655, w: 142, h: 46, r: 9 },
  };
}

function drawMenu(ctx, W, H, game) {
  const t = game.time;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 标题：白字 + 紫玫瑰渐变装饰条 + 字距英文
  const ty = H * 0.21;
  ctx.font = F.b(54);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('跳跳酷跑', W / 2, ty);
  ctx.restore();
  // 渐变装饰条（紫→玫）
  const ug = ctx.createLinearGradient(W / 2 - 100, 0, W / 2 + 100, 0);
  ug.addColorStop(0, PRIMARY);
  ug.addColorStop(1, ACCENT);
  roundFill(ctx, W / 2 - 100, ty + 28, 200, 3.5, 1.75, ug, null);
  ctx.font = F.r(12.5);
  ctx.fillStyle = FAINT;
  spacedText(ctx, 'JUMP DASH RUNNER', W / 2, ty + 44, 3);
  ctx.font = F.r(15);
  ctx.fillStyle = 'rgba(226,232,240,0.85)';
  ctx.fillText('右半屏点按跳跃 · 左半屏按住铲行 · 空中可二段跳', W / 2, ty + 68);

  // 最佳成绩 / 金币（切角深底）
  if (game.profile.best > 0) {
    ctx.font = F.b(16.5);
    const label = '最佳 ' + game.profile.best + ' m';
    const tw = ctx.measureText(label).width;
    const bw = tw + 42;
    chamfer(ctx, W / 2 - bw / 2, ty + 88, bw, 30, 8, 'rgba(15,15,35,0.65)', BORDER, 1.2);
    drawStar(ctx, W / 2 - bw / 2 + 18, ty + 103, 7.5, PRIMARY_L);
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'left';
    ctx.fillText(label, W / 2 - bw / 2 + 32, ty + 104);
    ctx.textAlign = 'center';
  }
  drawCoinChip(ctx, W, game);

  // 静音按钮
  const mb = getMenuButtons(game).mute;
  chamfer(ctx, mb.x, mb.y, mb.w, mb.h, 8, 'rgba(15,15,35,0.65)', BORDER, 1.2);
  const mx = mb.x + 23;
  const my = mb.y + 17;
  ctx.fillStyle = sound.isMuted() ? FAINT : TEXT;
  ctx.beginPath();
  ctx.moveTo(mx - 8, my - 3.5);
  ctx.lineTo(mx - 3.5, my - 3.5);
  ctx.lineTo(mx + 1, my - 8);
  ctx.lineTo(mx + 1, my + 8);
  ctx.lineTo(mx - 3.5, my + 3.5);
  ctx.lineTo(mx - 8, my + 3.5);
  ctx.closePath();
  ctx.fill();
  if (sound.isMuted()) {
    ctx.strokeStyle = '#FF7A93';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(mx + 4, my - 5);
    ctx.lineTo(mx + 12, my + 5);
    ctx.stroke();
  } else {
    ctx.strokeStyle = TEXT;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(mx + 2.5, my, 5, -0.95, 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx + 2.5, my, 8.2, -0.85, 0.85);
    ctx.stroke();
  }

  // 开始按钮（玫瑰红 CTA）
  const btn = getMenuButtons(game);
  const pulse = 1 + 0.015 * Math.sin(t * 2.2);
  ctx.save();
  ctx.translate(btn.start.x + btn.start.w / 2, btn.start.y + btn.start.h / 2);
  ctx.scale(pulse, pulse);
  ctx.translate(-(btn.start.x + btn.start.w / 2), -(btn.start.y + btn.start.h / 2));
  hudButton(ctx, btn.start, {
    label: '开始游戏',
    fontSize: 19,
    accent: true,
    pressed: isPressed(game, 'menu_start'),
  });
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  const px = btn.start.x + btn.start.w / 2 - 60;
  const py = btn.start.y + btn.start.h / 2;
  ctx.moveTo(px - 4, py - 7);
  ctx.lineTo(px + 7, py);
  ctx.lineTo(px - 4, py + 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 个性商店（紫）
  hudButton(ctx, btn.shop, {
    label: '个性商店',
    fontSize: 15,
    pressed: isPressed(game, 'menu_shop'),
    icon: (c, x, y) => {
      chamfer(c, x - 8, y - 8, 16, 16, 4, 'rgba(124,58,237,0.25)', PRIMARY_L, 1.2);
      drawStar(c, x, y, 5, PRIMARY_L);
    },
  });
  // 排行榜（紫）
  hudButton(ctx, btn.rank, {
    label: '排行榜',
    fontSize: 15,
    pressed: isPressed(game, 'menu_rank'),
    icon: (c, x, y) => {
      c.strokeStyle = PRIMARY_L;
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(x - 5, y - 7);
      c.lineTo(x + 5, y - 7);
      c.lineTo(x + 3.5, y - 1);
      c.lineTo(x - 3.5, y - 1);
      c.closePath();
      c.stroke();
      c.beginPath();
      c.moveTo(x - 5, y - 6);
      c.quadraticCurveTo(x - 9, y - 4, x - 4.5, y - 1);
      c.moveTo(x + 5, y - 6);
      c.quadraticCurveTo(x + 9, y - 4, x + 4.5, y - 1);
      c.stroke();
      c.beginPath();
      c.moveTo(x - 3, y + 6);
      c.lineTo(x + 3, y + 6);
      c.moveTo(x, y - 1);
      c.lineTo(x, y + 6);
      c.stroke();
    },
  });
}

function drawCoinChip(ctx, W, game) {
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = F.b(19);
  const label = String(game.profile.coins);
  const tw = ctx.measureText(label).width;
  const w = tw + 44;
  const x = W - 20 - w;
  chamfer(ctx, x, 14, w, 32, 8, 'rgba(15,15,35,0.65)', BORDER, 1.2);
  drawCoinIcon(ctx, x + 18, 30, 8.5);
  ctx.fillStyle = TEXT;
  ctx.fillText(label, W - 20 - 10, 31);
  ctx.textAlign = 'center';
}

// ---------------- 个性商店（角色 / 坐骑） ----------------

function getShopLayout(game) {
  const W = game.W;
  const H = game.H;
  const pw = Math.min(560, W - 36);
  const ph = Math.min(620, H - 90);
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  const tabW = 110;
  const tabH = 32;
  const tabs = {
    skin: { x: W / 2 - tabW - 5, y: py + 44, w: tabW, h: tabH },
    mount: { x: W / 2 + 5, y: py + 44, w: tabW, h: tabH },
  };
  const tab = game.shopTab === 'mount' ? mounts.MOUNTS : skins.SKINS;
  const cellGap = 12;
  const cellW = (pw - 24 - cellGap) / 2;
  const cellH = (ph - 90 - 14 - cellGap * 2) / 3;
  const cells = tab.map((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    return {
      id: s.id,
      rect: {
        x: px + 12 + col * (cellW + cellGap),
        y: py + 90 + row * (cellH + cellGap),
        w: cellW,
        h: cellH,
      },
    };
  });
  return {
    panel: { x: px, y: py, w: pw, h: ph },
    back: { x: px + 10, y: py + 10, w: 78, h: 30, r: 8 },
    tabs,
    cells,
  };
}

function panelBase(ctx, p) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 10;
  chamfer(ctx, p.x, p.y, p.w, p.h, 14, 'rgba(15,15,35,0.94)', null);
  ctx.restore();
  chamfer(ctx, p.x, p.y, p.w, p.h, 14, null, 'rgba(167,139,250,0.28)', 1);
  // 顶部霓虹条
  const hg = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
  hg.addColorStop(0, PRIMARY);
  hg.addColorStop(1, ACCENT);
  ctx.save();
  chamfer(ctx, p.x, p.y, p.w, p.h, 14, null, null);
  ctx.clip();
  ctx.fillStyle = hg;
  ctx.fillRect(p.x + 24, p.y, p.w - 48, 2.5);
  ctx.restore();
}

function drawShop(ctx, W, H, game) {
  const L = getShopLayout(game);
  const prof = game.profile;
  const isMountTab = game.shopTab === 'mount';

  ctx.fillStyle = 'rgba(8,10,22,0.62)';
  ctx.fillRect(0, 0, W, H);
  panelBase(ctx, L.panel);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.font = F.b(24);
  ctx.fillText('个性商店', W / 2, L.panel.y + 26);

  // 返回
  hudButton(ctx, L.back, { label: '‹ 返回', fontSize: 13, pressed: isPressed(game, 'shop_back') });

  // 金币余额
  ctx.font = F.b(18);
  const balance = String(prof.coins);
  const bw = ctx.measureText(balance).width;
  const bx = L.panel.x + L.panel.w - 22 - bw - 30;
  chamfer(ctx, bx, L.panel.y + 10, bw + 34, 30, 8, 'rgba(30,28,53,0.9)', BORDER, 1.2);
  drawCoinIcon(ctx, bx + 18, L.panel.y + 25, 8);
  ctx.textAlign = 'left';
  ctx.fillStyle = TEXT;
  ctx.fillText(balance, bx + 32, L.panel.y + 26);
  ctx.textAlign = 'center';

  // 标签
  drawTab(ctx, L.tabs.skin, '角色', !isMountTab, isPressed(game, 'tab_skin'));
  drawTab(ctx, L.tabs.mount, '坐骑', isMountTab, isPressed(game, 'tab_mount'));

  for (const cell of L.cells) {
    if (isMountTab) drawMountCell(ctx, cell.rect, mounts.get(cell.id), prof, game.time);
    else drawSkinCell(ctx, cell.rect, skins.get(cell.id), prof);
  }

  if (game.shopMsgTimer > 0 && game.shopMsg) {
    ctx.globalAlpha = Math.min(1, game.shopMsgTimer * 2);
    ctx.font = F.b(16);
    ctx.fillStyle = game.shopMsgOk ? PRIMARY_L : '#FF7A93';
    ctx.fillText(game.shopMsg, W / 2, L.panel.y + L.panel.h - 12);
    ctx.globalAlpha = 1;
  } else if (isMountTab) {
    ctx.font = F.r(14);
    ctx.fillStyle = FAINT;
    ctx.fillText('所有坐骑都能替你挡一次撞击', W / 2, L.panel.y + L.panel.h - 12);
  }
}

function drawTab(ctx, rect, label, active, pressed) {
  const off = pressed && !active ? 1 : 0;
  if (active) {
    chamfer(ctx, rect.x, rect.y + off, rect.w, rect.h, 8, 'rgba(124,58,237,0.3)', PRIMARY, 1.6);
    ctx.fillStyle = TEXT;
    ctx.font = F.b(16.5);
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + off + rect.h / 2);
    roundFill(ctx, rect.x + rect.w / 2 - 16, rect.y + rect.h - 3.5, 32, 2.5, 1.25, ACCENT, null);
  } else {
    chamfer(ctx, rect.x, rect.y + off, rect.w, rect.h, 8, 'rgba(30,28,53,0.5)', 'rgba(124,58,237,0.3)', 1.2);
    ctx.fillStyle = MUTED;
    ctx.font = F.b(16.5);
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + off + rect.h / 2);
  }
}

function drawCellBase(ctx, r, using) {
  chamfer(ctx, r.x, r.y, r.w, r.h, 10, using ? 'rgba(124,58,237,0.16)' : CARD, using ? PRIMARY : 'rgba(124,58,237,0.25)', using ? 1.8 : 1.2);
  if (using) {
    chamfer(ctx, r.x, r.y, r.w, r.h, 10, null, 'rgba(244,63,94,0.35)', 1);
  }
}

function drawSkinCell(ctx, r, sk, prof) {
  const owned = prof.owned.indexOf(sk.id) >= 0;
  const using = prof.skin === sk.id;
  drawCellBase(ctx, r, using);
  drawAvatar(ctx, sk, r.x + r.w / 2, r.y + 66, 0.85);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.font = F.b(16);
  ctx.fillText(sk.name, r.x + r.w / 2, r.y + r.h - 28);
  drawStatusOrPrice(ctx, r, using, owned, sk.price, prof, -10, '使用中', '点击使用');
}

function drawMountCell(ctx, r, m, prof, time) {
  const owned = prof.ownedMounts.indexOf(m.id) >= 0;
  const using = prof.mount === m.id;
  drawCellBase(ctx, r, using);
  if (m.id === 'none') {
    drawAvatar(ctx, skins.get(prof.skin), r.x + r.w / 2, r.y + 68, 0.7);
  } else {
    drawMountThumb(ctx, m.id, r.x + r.w / 2, r.y + 76, 0.8, time);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.font = F.b(16);
  ctx.fillText(m.name, r.x + r.w / 2, r.y + r.h - 40);
  drawStatusOrPrice(ctx, r, using, owned, m.price, prof, -26, '骑乘中', '点击骑乘');
  ctx.fillStyle = FAINT;
  ctx.font = F.r(12.5);
  ctx.fillText(m.perk, r.x + r.w / 2, r.y + r.h - 7);
}

function drawStatusOrPrice(ctx, r, using, owned, price, prof, offsetY, usingText, ownedText) {
  const y = r.y + r.h + offsetY;
  if (using) {
    ctx.fillStyle = PRIMARY_L;
    ctx.font = F.b(14);
    ctx.fillText(usingText, r.x + r.w / 2, y);
  } else if (owned) {
    ctx.fillStyle = MUTED;
    ctx.font = F.r(14);
    ctx.fillText(ownedText, r.x + r.w / 2, y);
  } else {
    const afford = prof.coins >= price;
    ctx.font = F.b(14);
    const label = String(price);
    const tw = ctx.measureText(label).width;
    const pw = tw + 26;
    const px = r.x + r.w / 2 - pw / 2;
    chamfer(ctx, px, y - 11, pw, 22, 6, 'rgba(30,28,53,0.9)', afford ? BORDER : 'rgba(148,163,184,0.25)', 1.2);
    drawCoinIcon(ctx, px + 12, y, 6.5);
    ctx.fillStyle = afford ? TEXT : FAINT;
    ctx.textAlign = 'left';
    ctx.fillText(label, px + 22, y + 0.5);
    ctx.textAlign = 'center';
  }
}

// ---------------- 排行榜 ----------------

function getRankLayout(game) {
  const W = game.W;
  const H = game.H;
  const pw = Math.min(560, W - 36);
  const ph = Math.min(560, H - 80);
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  const boxW = (pw - 40) / 2;
  const boxH = ph - 108;
  return {
    panel: { x: px, y: py, w: pw, h: ph },
    back: { x: px + 10, y: py + 10, w: 78, h: 30, r: 8 },
    friend: { x: px + 20, y: py + 78, w: boxW, h: boxH },
    local: { x: px + 20 + boxW + 20, y: py + 78, w: boxW, h: boxH },
  };
}

function drawRank(ctx, W, H, game) {
  const L = getRankLayout(game);

  ctx.fillStyle = 'rgba(8,10,22,0.62)';
  ctx.fillRect(0, 0, W, H);
  panelBase(ctx, L.panel);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.font = F.b(24);
  ctx.fillText('排行榜', W / 2, L.panel.y + 26);

  hudButton(ctx, L.back, { label: '‹ 返回', fontSize: 13, pressed: isPressed(game, 'rank_back') });

  drawSectionBox(ctx, L.friend, '好友排行');
  if (game.odc && game.odc.canvas) {
    ctx.drawImage(game.odc.canvas, L.friend.x + 2, L.friend.y + 26, L.friend.w - 4, L.friend.h - 30);
  }

  drawSectionBox(ctx, L.local, '本地记录');
  const list = game.profile.history || [];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if (list.length === 0) {
    ctx.fillStyle = FAINT;
    ctx.font = F.r(15);
    ctx.textAlign = 'center';
    ctx.fillText('还没有记录，跑一局吧！', L.local.x + L.local.w / 2, L.local.y + L.local.h / 2);
  } else {
    list.forEach((rec, i) => {
      const y = L.local.y + 34 + i * ((L.local.h - 48) / Math.max(list.length, 5));
      if (y > L.local.y + L.local.h - 8) return;
      ctx.fillStyle = i === 0 ? PRIMARY_L : MUTED;
      ctx.font = F.b(14.5);
      ctx.fillText(String(i + 1).padStart(2, '0'), L.local.x + 16, y);
      ctx.fillStyle = TEXT;
      ctx.font = F.b(16.5);
      ctx.fillText(rec.s + ' m', L.local.x + 40, y);
      ctx.fillStyle = FAINT;
      ctx.font = F.r(13.5);
      ctx.textAlign = 'right';
      ctx.fillText(rec.d || '', L.local.x + L.local.w - 12, y + 0.5);
    });
  }
  ctx.textAlign = 'center';
  ctx.font = F.r(13.5);
  ctx.fillStyle = FAINT;
  ctx.fillText('好友榜需在微信开发者工具或真机中查看', W / 2, L.panel.y + L.panel.h - 12);
}

function drawSectionBox(ctx, r, title) {
  chamfer(ctx, r.x, r.y, r.w, r.h, 8, 'rgba(30,28,53,0.6)', 'rgba(124,58,237,0.3)', 1.2);
  ctx.fillStyle = MUTED;
  ctx.font = F.b(14.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, r.x + r.w / 2, r.y + 16);
  ctx.strokeStyle = 'rgba(124,58,237,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.x + 10, r.y + 30);
  ctx.lineTo(r.x + r.w - 10, r.y + 30);
  ctx.stroke();
}

// ---------------- HUD ----------------

function drawHUD(ctx, W, H, game) {
  // 里程
  chamfer(ctx, W / 2 - 74, 8, 148, 46, 9, 'rgba(15,15,35,0.55)', BORDER, 1.2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = F.b(40);
  ctx.fillStyle = TEXT;
  ctx.fillText(game.score + ' m', W / 2, 16);

  // 金币
  const cy = 31;
  ctx.font = F.b(19);
  const cn = String(game.coinCount);
  const cw = ctx.measureText(cn).width;
  chamfer(ctx, W - 30 - cw - 32, 14, cw + 44, 32, 8, 'rgba(15,15,35,0.55)', BORDER, 1.2);
  drawCoinIcon(ctx, W - 46 - cw, 30, 8.5);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.fillText(cn, W - 32 - cw, 31);

  // 双区操作提示（开局前几秒显示在左右下角）
  if (game.zoneHintT > 0) {
    const a = Math.min(1, game.zoneHintT) * 0.55;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const z of [{ x: game.W * 0.25, label: '按住铲行', arrow: '▼' }, { x: game.W * 0.75, label: '点按跳跃', arrow: '▲' }]) {
      chamfer(ctx, z.x - 62, H - 52, 124, 36, 9, 'rgba(15,15,35,0.55)', BORDER, 1.2);
      ctx.fillStyle = z.x < game.W / 2 ? ACCENT : PRIMARY_L;
      ctx.font = F.b(15);
      ctx.fillText(z.arrow + ' ' + z.label, z.x, H - 34);
    }
    ctx.globalAlpha = 1;
  }

  // 磁铁剩余时间
  if (game.magnetTimer > 0) {
    const frac = Math.max(0, game.magnetTimer / game.magnetMax);
    const bx = 12;
    const by = 14;
    chamfer(ctx, bx, by, 86, 30, 8, 'rgba(15,15,35,0.55)', BORDER, 1.2);
    ctx.save();
    ctx.translate(bx + 16, by + 15);
    ctx.rotate(0.5);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 5;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.arc(0, 0, 6, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx + 28, by + 12, 54, 6);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(bx + 28, by + 12, 54 * frac, 6);
  }
}

// ---------------- 结算 ----------------

function getOverButtons(game) {
  const pw = Math.min(420, game.W - 56);
  const ph = 360;
  const px = (game.W - pw) / 2;
  const py = game.H * 0.5 - ph / 2 - 16;
  return {
    home: { x: px + 12, y: py + 12, w: 72, h: 30, r: 8 },
    restart: { x: (game.W - 210) / 2, y: py + ph - 64, w: 210, h: 46, r: 9 },
  };
}

function drawGameOver(ctx, W, H, game) {
  const fade = Math.min(1, game.deathTimer * 2.5);
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(8,10,22,0.6)';
  ctx.fillRect(0, 0, W, H);

  const pw = Math.min(420, W - 56);
  const ph = 360;
  const px = (W - pw) / 2;
  const py = H * 0.5 - ph / 2 - 16;
  panelBase(ctx, { x: px, y: py, w: pw, h: ph });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.font = F.b(25);
  ctx.fillText('游戏结束', W / 2, py + 36);

  // 主页
  hudButton(ctx, getOverButtons(game).home, {
    label: '‹ 主页',
    fontSize: 12.5,
    pressed: isPressed(game, 'over_home'),
  });

  // 奖牌
  const my = py + 96;
  let medal = null;
  if (game.score >= 200) medal = '#FFD54F';
  else if (game.score >= 80) medal = '#CFD8DC';
  else if (game.score >= 20) medal = '#FFAB91';
  if (medal) {
    if (medal === '#FFD54F') {
      ctx.globalAlpha = fade * (0.3 + 0.12 * Math.sin(game.time * 3));
      ctx.beginPath();
      ctx.arc(W / 2, my, 33, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,213,79,0.4)';
      ctx.fill();
      ctx.globalAlpha = fade;
    }
    ctx.beginPath();
    ctx.arc(W / 2, my, 26, 0, Math.PI * 2);
    ctx.fillStyle = medal;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
    drawStar(ctx, W / 2, my, 13, 'rgba(255,255,255,0.9)');
  } else {
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(148,163,184,0.4)';
    ctx.arc(W / 2, my, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = FAINT;
    ctx.font = F.r(13.5);
    ctx.fillText('跑过 20m 解锁奖牌', W / 2, my);
  }

  // 成绩
  ctx.fillStyle = MUTED;
  ctx.font = F.r(15);
  ctx.fillText('本次成绩', W / 2, py + 150);
  ctx.fillStyle = TEXT;
  ctx.font = F.b(46);
  ctx.fillText(game.score + ' m', W / 2, py + 188);
  ctx.fillStyle = MUTED;
  ctx.font = F.r(16);
  ctx.fillText('金币 ' + game.coinCount + ' · 最佳 ' + game.profile.best + ' m', W / 2, py + 226);
  if (game.newBest) {
    ctx.fillStyle = ACCENT;
    ctx.font = F.b(16.5);
    spacedText(ctx, 'NEW RECORD', W / 2, py + 254, 3);
  }

  // 再来一局
  const rb = getOverButtons(game).restart;
  if (game.deathTimer <= 0.6) {
    ctx.globalAlpha = fade * 0.45;
  }
  hudButton(ctx, rb, { label: '再来一局', fontSize: 18, accent: true, pressed: isPressed(game, 'over_restart') });
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  const rx = rb.x + rb.w / 2 - 60;
  const ry = rb.y + rb.h / 2;
  ctx.moveTo(rx - 4, ry - 6);
  ctx.lineTo(rx + 6, ry);
  ctx.lineTo(rx - 4, ry + 6);
  ctx.closePath();
  ctx.fill();
  if (game.deathTimer <= 0.6) {
    ctx.globalAlpha = fade;
    ctx.font = F.r(13);
    ctx.fillStyle = FAINT;
    ctx.fillText('稍等片刻…', W / 2, py + ph - 6);
  }
  ctx.globalAlpha = 1;
}

function isPressed(game, key) {
  if (game.pressedKey === key) return true;
  return !!(game.pressFlash && game.pressFlash.key === key && game.pressFlash.t > 0);
}

function navButtonAt(game, x, y) {
  if (game.state === 'menu') {
    const b = getMenuButtons(game);
    if (inRect(x, y, b.shop)) return 'menu_shop';
    if (inRect(x, y, b.start)) return 'menu_start';
    if (inRect(x, y, b.rank)) return 'menu_rank';
    if (inRect(x, y, b.mute)) return 'menu_mute';
  } else if (game.state === 'shop') {
    const L = getShopLayout(game);
    if (inRect(x, y, L.back)) return 'shop_back';
    if (inRect(x, y, L.tabs.skin)) return 'tab_skin';
    if (inRect(x, y, L.tabs.mount)) return 'tab_mount';
  } else if (game.state === 'rank') {
    const L = getRankLayout(game);
    if (inRect(x, y, L.back)) return 'rank_back';
  } else if (game.state === 'over') {
    if (game.time - game.overAt > 0.6) {
      const b = getOverButtons(game);
      if (inRect(x, y, b.home)) return 'over_home';
      if (inRect(x, y, b.restart)) return 'over_restart';
    }
  }
  return null;
}

module.exports = {
  drawMenu,
  drawShop,
  drawRank,
  drawHUD,
  drawGameOver,
  getMenuButtons,
  getShopLayout,
  getRankLayout,
  getOverButtons,
  navButtonAt,
  inRect,
};
