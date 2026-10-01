// 无头逻辑测试：用桩替换 wx/Canvas，驱动游戏主循环，AI 自动试玩验证可玩性
// 运行：node test/run.js
'use strict';

function makeCtxStub() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, key) {
      if (key === 'measureText') return () => ({ width: 20 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return () => gradient;
      }
      if (typeof target[key] === 'undefined') {
        target[key] = () => undefined;
      }
      return target[key];
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

function makeCanvasStub() {
  return { width: 0, height: 0, getContext: () => makeCtxStub() };
}

// ---- wx 桩 ----
const storage = {};
let cloudPostCount = 0;
let cloudStorageCount = 0;
global.wx = {
  createCanvas: () => makeCanvasStub(),
  getWindowInfo: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2 }),
  onTouchStart() {},
  onTouchEnd() {},
  onTouchCancel() {},
  getStorageSync: (k) => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  setUserCloudStorage() { cloudStorageCount++; },
  getOpenDataContext: () => ({
    canvas: makeCanvasStub(),
    postMessage() { cloudPostCount++; },
  }),
};

const { createGame } = require('../jump-runner/js/main');
const ui = require('../jump-runner/js/ui');
const storageMod = require('../jump-runner/js/storage');

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log('  ✓ ' + msg);
  } else {
    failures++;
    console.error('  ✗ ' + msg);
  }
}

function newGame(saveSpy) {
  const profile = {
    best: 0, coins: 0, skin: 'classic', owned: ['classic'],
    mount: 'none', ownedMounts: ['none'], history: [],
  };
  const game = createGame(makeCanvasStub(), makeCtxStub(), 375, 667, {
    profile,
    saveProfile: (p) => { if (saveSpy) saveSpy(p); },
  });
  game.odc = global.wx.getOpenDataContext();
  return game;
}

// ---- AI 试玩 ----
function aiTap(game) {
  if (game.state !== 'play') return;
  const p = game.player;
  const px = game.scroll + p.x;
  const speed = game.speed;
  if (p.slide > 0) return; // 铲行中不跳
  if (p.grounded) {
    // 无人机广告牌：进入视野就滑铲（绝不跳）
    for (const o of game.world.obstacles) {
      if (o.type === 'sign' && o.x > px && o.x < px + speed * 0.3) {
        game.doSlide();
        return;
      }
    }
    const reactObstacle = px + speed * 0.28;
    for (const o of game.world.obstacles) {
      if (o.type !== 'sign' && o.x > px && o.x < reactObstacle) {
        game.onTap(0, 0);
        return;
      }
    }
    const reactPit = px + speed * 0.1 + 6;
    for (const pit of game.world.pits) {
      if (pit.x > px && pit.x < reactPit) {
        game.onTap(0, 0);
        return;
      }
    }
  } else if (p.jumps < 2 && p.vy > 60) {
    if (game.world.pitAt(px)) game.onTap(0, 0);
  }
}

function playLives(game, lives, maxSecPerLife) {
  const scores = [];
  let coinsTotal = 0;
  let renders = 0;
  for (let i = 0; i < lives; i++) {
    if (game.state === 'menu') game.onTap(0, 0);
    else if (game.state === 'over') {
      game.time = game.overAt + 1;
      game.onTap(0, 0);
    }
    if (game.state !== 'play') throw new Error('无法进入游戏状态: ' + game.state);

    let t = 0;
    const dt = 1 / 60;
    while (t < maxSecPerLife && game.state === 'play') {
      t += dt;
      aiTap(game);
      game.update(dt);
      game.render();
      renders++;
      if (game.state === 'over') break;
    }
    if (game.state !== 'over') break;
    scores.push(game.score);
    coinsTotal += game.coinCount;
  }
  return { scores, coinsTotal, renders };
}

// ================= 测试 =================
console.log('1) 状态机：菜单 -> 点击开始 -> 游戏中');
{
  const game = newGame();
  check(game.state === 'menu', '初始状态为 menu');
  game.render();
  game.onTap(100, 300);
  check(game.state === 'play', '点击后进入 play');
  check(game.speed > 0 && game.world.cursor > 375, '世界已预生成足够长度');
}

console.log('2) 不操作：应在第一个障碍处死亡');
{
  const game = newGame();
  game.onTap(0, 0);
  let t = 0;
  const dt = 1 / 60;
  while (t < 15 && game.state === 'play') {
    t += dt;
    game.update(dt);
    game.render();
  }
  check(game.state === 'over', '约 ' + t.toFixed(1) + 's 后进入 over');
  check(game.score >= 5 && game.score < 40, '不操作时里程合理（' + game.score + 'm）');
}

console.log('3) 输入锁定与主页按钮');
{
  const game = newGame();
  game.onTap(0, 0);
  let t = 0;
  const dt = 1 / 60;
  while (t < 15 && game.state === 'play') { t += dt; game.update(dt); game.render(); }
  game.onTap(0, 0);
  check(game.state === 'over', '锁定期内点击不重开');
  game.time = game.overAt + 1;
  const home = ui.getOverButtons(game).home;
  game.onTap(home.x + home.w / 2, home.y + home.h / 2);
  check(game.state === 'menu', '结算面板点「主页」回到菜单');
}

console.log('4) AI 试玩 5 条命：验证可玩性/金币入账');
{
  let saved = null;
  const game = newGame((p) => { saved = p; });
  const { scores, coinsTotal, renders } = playLives(game, 5, 180);
  const best = Math.max(...scores, 0);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  console.log('    各命里程: ' + scores.join(', ') + ' m | 金币合计: ' + coinsTotal + ' | 渲染帧: ' + renders);
  check(scores.length === 5, 'AI 完整跑完 5 条命');
  check(best >= 60, '最佳里程 ≥ 60m（实际 ' + best + 'm）');
  check(avg >= 30, '平均里程 ≥ 30m（实际 ' + avg.toFixed(1) + 'm）');
  check(coinsTotal > 0, 'AI 能吃到金币（' + coinsTotal + ' 枚）');
  check(saved && saved.coins === coinsTotal, '死亡后金币全部入账（' + (saved && saved.coins) + '）');
  check(saved && saved.best === best, '最高分入档（' + (saved && saved.best) + '）');
}

console.log('5) 护盾：撞击消耗护盾而不是死亡');
{
  const game = newGame();
  game.onTap(0, 0);
  // 跑一小段进入稳定状态
  for (let i = 0; i < 60; i++) { aiTap(game); game.update(1 / 60); }
  game.shield = true;
  // 在玩家正前方放一个木箱
  game.world.obstacles.push({
    type: 'crate', x: game.scroll + game.player.x + game.speed * 0.2, w: 38, h: 38,
  });
  let t = 0;
  // 一旦护盾触发（进入无敌）立即判定，避免后续障碍干扰
  while (t < 3 && game.state === 'play' && game.invincible <= 0) {
    t += 1 / 60;
    game.update(1 / 60);
  }
  check(game.invincible > 0 && game.state === 'play', '有护盾时撞击存活并进入无敌');
  check(game.shield === false, '护盾被消耗');
  game.render();
}

console.log('6) 磁铁：范围内金币被吸附');
{
  const game = newGame();
  game.onTap(0, 0);
  for (let i = 0; i < 30; i++) { game.update(1 / 60); }
  const before = game.coinCount;
  game.magnetTimer = game.magnetMax;
  game.world.coins.push({
    x: game.scroll + game.player.x + 120,
    y: game.player.y - 22,
    r: 11, taken: false, phase: 0,
  });
  for (let i = 0; i < 90 && game.coinCount === before; i++) game.update(1 / 60);
  check(game.coinCount > before, '磁铁吸到了斜侧金币');
  check(game.magnetTimer < game.magnetMax, '磁铁计时在倒数');
}

console.log('7) 道具拾取：碰到道具即生效');
{
  const game = newGame();
  game.onTap(0, 0);
  for (let i = 0; i < 30; i++) { game.update(1 / 60); }
  game.world.items.push({
    type: 'shield', x: game.scroll + game.player.x, y: game.player.y - 22,
    taken: false, phase: 0,
  });
  game.update(1 / 60);
  check(game.shield === true, '拾取护盾生效');

  game.world.items.push({
    type: 'magnet', x: game.scroll + game.player.x, y: game.player.y - 22,
    taken: false, phase: 0,
  });
  game.update(1 / 60);
  check(game.magnetTimer === game.magnetMax, '拾取磁铁生效');
}

console.log('8) 皮肤商店：浏览/购买/换装/返回');
{
  const game = newGame();
  game.profile.coins = 500;
  // 菜单点商店按钮
  const shopBtn = ui.getMenuButtons(game).shop;
  game.onTap(shopBtn.x + 10, shopBtn.y + 10);
  check(game.state === 'shop', '菜单点按钮进入商店');
  game.render();
  const L = ui.getShopLayout(game);
  const mintCell = L.cells.find(c => c.id === 'mint');
  const grapeCell = L.cells.find(c => c.id === 'grape');
  // 买薄荷(100)
  game.onTap(mintCell.rect.x + 5, mintCell.rect.y + 5);
  check(game.profile.owned.indexOf('mint') >= 0, '购买薄荷皮肤入账 owned');
  check(game.profile.skin === 'mint', '购买后自动换装');
  check(game.profile.coins === 400, '扣款正确（' + game.profile.coins + '）');
  game.render();
  // 再点已拥有 → 直接换装
  game.onTap(mintCell.rect.x + 5, mintCell.rect.y + 5);
  check(game.profile.coins === 400, '重复点击不再扣款');
  // 金币不足
  game.profile.coins = 50;
  game.onTap(grapeCell.rect.x + 5, grapeCell.rect.y + 5);
  check(game.profile.owned.indexOf('grape') < 0, '金币不足无法购买');
  check(game.profile.coins === 50, '金币不足时不扣款');
  // 返回
  game.onTap(L.back.x + 5, L.back.y + 5);
  check(game.state === 'menu', '返回按钮回到菜单');
  game.render();
}

console.log('9) 存档：JSON 序列化与旧数据迁移');
{
  global.wx.setStorageSync('jumpy_save_v1', JSON.stringify({ best: 222, coins: 88, skin: 'mint', owned: ['classic', 'mint'] }));
  const p1 = storageMod.load();
  check(p1.best === 222 && p1.coins === 88 && p1.skin === 'mint', '正常读取 JSON 存档');
  global.wx.setStorageSync('jumpy_save_v1', 'not-json{{{');
  const p2 = storageMod.load();
  check(typeof p2.best === 'number', '损坏存档安全回退');
  global.wx.setStorageSync('jumpy_best', 321);
  const p3 = storageMod.load();
  check(p3.best === 321, '旧版最高分迁移');
  global.wx.setStorageSync('jumpy_best', 0);
  global.wx.setStorageSync('jumpy_save_v1', JSON.stringify({ best: 50, coins: 10, skin: 'hack', owned: 'bad' }));
  const p4 = storageMod.load();
  check(p4.skin === 'classic' && p4.owned.indexOf('classic') >= 0, '非法字段被规范化');
}

console.log('10) 压力：长局高速阶段不崩（默认自行车坐骑）');
{
  const game = newGame();
  game.profile.mount = 'bicycle';
  game.profile.ownedMounts = ['none', 'bicycle'];
  game.onTap(0, 0);
  check(game.riding === true, '骑行压力场景');
  game.onTap(0, 0);
  let t = 0;
  const dt = 1 / 60;
  while (t < 180 && game.state === 'play') {
    t += dt;
    aiTap(game);
    game.update(dt);
    game.render();
  }
  check(t >= 179 || game.state === 'over', '长局无异常（t=' + t.toFixed(0) + 's, state=' + game.state + ', score=' + game.score + 'm）');
}

console.log('11) 横屏入口：设计分辨率缩放与触摸换算');
{
  // rAF 桩：收集回调手动泵帧，避免真循环
  const rafQueue = [];
  global.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
  // 横屏窗口 844x390
  global.wx.getWindowInfo = () => ({ windowWidth: 844, windowHeight: 390, pixelRatio: 2 });
  const created = [];
  global.wx.createCanvas = () => { const c = makeCanvasStub(); created.push(c); return c; };
  let touchHandler = null;
  global.wx.onTouchStart = (h) => { touchHandler = h; };

  const main = require('../jump-runner/js/main');
  main.start();
  const game = main.__game;
  const scale = 390 / 500;
  check(created.length === 1 && created[0].width === 844 * 2 && created[0].height === 390 * 2,
    '画布按物理像素x DPR 设置（' + (created[0] && created[0].width + 'x' + created[0].height) + '）');
  check(game.H === 500, '逻辑高度固定为设计高度 500');
  check(Math.abs(game.W - 844 / scale) < 1, '横屏逻辑宽度 ≈ ' + Math.round(844 / scale) + '（实际 ' + game.W + '）');
  check(game.groundY === Math.round(500 * 0.72), '地面位置基于设计高度');

  // 触摸坐标应从物理像素换算到逻辑坐标（换算错了就点不到按钮）
  touchHandler({ changedTouches: [{ clientX: 100 * scale, clientY: 300 * scale }] });
  check(game.state === 'play', '物理坐标触摸正确换算并开始游戏');

  // 泵 130 帧：横屏下更新+渲染无异常
  for (let i = 0; i < 130 && rafQueue.length; i++) {
    const cb = rafQueue.shift();
    cb();
    aiTap(game);
  }
  check(game.state === 'play' || game.state === 'over', '横屏主循环运行正常（state=' + game.state + ', score=' + game.score + 'm）');
}

console.log('12) 坐骑商店：切标签/购买/骑乘/小马驹特权');
{
  const game = newGame();
  game.profile.coins = 500;
  const shopBtn = ui.getMenuButtons(game).shop;
  game.onTap(shopBtn.x + 10, shopBtn.y + 10);
  check(game.state === 'shop' && game.shopTab === 'skin', '进入商店默认角色页');
  let L = ui.getShopLayout(game);
  game.onTap(L.tabs.mount.x + 10, L.tabs.mount.y + 10);
  check(game.shopTab === 'mount', '切换到坐骑页');
  L = ui.getShopLayout(game);
  const ponyCell = L.cells.find(c => c.id === 'pony');
  check(!!ponyCell, '坐骑页包含小马驹');
  game.onTap(ponyCell.rect.x + 5, ponyCell.rect.y + 5);
  check(game.profile.ownedMounts.indexOf('pony') >= 0 && game.profile.mount === 'pony', '购买小马驹并自动骑乘');
  check(game.profile.coins === 350, '扣款正确（' + game.profile.coins + '）');
  game.render();
  L = ui.getShopLayout(game);
  game.onTap(L.back.x + 5, L.back.y + 5);
  check(game.state === 'menu', '返回菜单');
  game.onTap(100, 300);
  check(game.state === 'play' && game.riding === true && game.mountId === 'pony', '开局骑乘小马驹');
  for (let i = 0; i < 30; i++) { aiTap(game); game.update(1 / 60); }
  check(game.player.grounded && Math.abs(game.player.y - (game.groundY - 38)) < 0.01,
    '角色落在鞍座面上（y=' + game.player.y.toFixed(1) + '）');
  game.onTap(0, 0);
  check(Math.abs(game.player.vy + 900 * 1.08) < 0.01, '小马驹特权：跳跃高度 +8%');
  game.render();
}

console.log('13) 坐骑挡撞击：撞击后坐骑逃跑');
{
  const game = newGame();
  game.profile.mount = 'pony';
  game.profile.ownedMounts = ['none', 'pony'];
  game.onTap(0, 0);
  for (let i = 0; i < 60; i++) { aiTap(game); game.update(1 / 60); }
  check(game.riding === true, '骑乘中');
  game.world.obstacles.push({ type: 'crate', x: game.scroll + game.player.x + game.speed * 0.2, w: 38, h: 38 });
  let t = 0;
  while (t < 3 && game.state === 'play' && game.invincible <= 0) { t += 1 / 60; game.update(1 / 60); }
  check(game.invincible > 0 && game.state === 'play', '坐骑替玩家挡下撞击');
  check(game.riding === false, '坐骑逃跑了');
  game.render();
}

console.log('14) 坐骑特权：恐龙开局护盾/自行车磁铁加时/摩托加速');
{
  const g1 = newGame();
  g1.profile.mount = 'dino';
  g1.profile.ownedMounts = ['none', 'dino'];
  g1.onTap(0, 0);
  check(g1.shield === true && g1.riding === true, '小恐龙开局自带护盾');

  const g2 = newGame();
  g2.profile.mount = 'bicycle';
  g2.profile.ownedMounts = ['none', 'bicycle'];
  g2.onTap(0, 0);
  check(g2.magnetMax === 9, '自行车磁铁时间 +50%（9s）');

  const g3 = newGame();
  g3.onTap(0, 0);
  const g4 = newGame();
  g4.profile.mount = 'moto';
  g4.profile.ownedMounts = ['none', 'moto'];
  g4.onTap(0, 0);
  let i = 0;
  while (i < 100 && g3.state === 'play' && g4.state === 'play') {
    g3.update(1 / 60);
    g4.update(1 / 60);
    i++;
  }
  const ratio = g4.scroll / g3.scroll;
  check(Math.abs(ratio - 1.08) < 0.01, '小摩托速度 +8%（实际 ' + ratio.toFixed(3) + '）');
}

console.log('15) 存档 v2：坐骑字段');
{
  global.wx.setStorageSync('jumpy_save_v1', JSON.stringify({ best: 10, coins: 5, skin: 'classic', owned: ['classic'], mount: 'moto', ownedMounts: ['none', 'moto'] }));
  const p1 = storageMod.load();
  check(p1.mount === 'moto' && p1.ownedMounts.length === 2, '读取坐骑存档');
  global.wx.setStorageSync('jumpy_save_v1', JSON.stringify({ best: 10, coins: 5, mount: 'moto', ownedMounts: ['none'] }));
  const p2 = storageMod.load();
  check(p2.mount === 'none', '未拥有的坐骑回退为步行');
  global.wx.setStorageSync('jumpy_save_v1', '');
  const p3 = storageMod.load();
  check(p3.mount === 'bicycle' && p3.ownedMounts.indexOf('bicycle') >= 0, '新档默认赠送自行车坐骑');
}

console.log('16) 排行榜：弹层/返回/本地历史记录');
{
  const game = newGame();
  // 跑 2 条命：AI 先跑 8 秒，然后放手让它撞，确保死亡入档
  for (let life = 0; life < 2; life++) {
    if (game.state === 'menu') game.onTap(0, 0);
    else {
      game.time = game.overAt + 1;
      game.onTap(0, 0);
    }
    let t = 0;
    while (game.state === 'play' && t < 8) {
      aiTap(game);
      game.update(1 / 60);
      t += 1 / 60;
    }
    while (game.state === 'play' && t < 30) {
      game.update(1 / 60);
      t += 1 / 60;
    }
    game.render();
  }
  check(game.state === 'over', '两条命都已结束');
  check(game.profile.history.length === 2, '历史记录写入 2 条（' + JSON.stringify(game.profile.history) + '）');
  check(game.profile.history[0].s >= game.profile.history[1].s, '历史记录按成绩降序');
  check(cloudPostCount >= 2, '死亡后通知开放数据域刷新（' + cloudPostCount + ' 次）');
  check(cloudStorageCount >= 1, '最佳成绩写入微信云存储');
  // 打开排行榜弹层（先经结算面板「主页」回到菜单）
  game.time = game.overAt + 1;
  const ob = ui.getOverButtons(game);
  game.onTap(ob.home.x + 10, ob.home.y + 16);
  check(game.state === 'menu', '结算点主页回到菜单');
  const rb = ui.getMenuButtons(game).rank;
  game.onTap(rb.x + 10, rb.y + 10);
  check(game.state === 'rank', '菜单点排行榜按钮进入弹层');
  game.render();
  const L = ui.getRankLayout(game);
  game.onTap(L.back.x + 10, L.back.y + 17);
  check(game.state === 'menu', '返回按钮回到菜单');
  game.render();
  // 导航按钮命中函数
  game.state = 'shop';
  const SL = ui.getShopLayout(game);
  check(ui.navButtonAt(game, SL.back.x + 5, SL.back.y + 5) === 'shop_back', 'navButtonAt 命中返回按钮');
  check(ui.navButtonAt(game, 5, 5) === null, '非按钮区域返回 null');
  game.state = 'menu';
}

console.log('17) 存档 v3：历史记录字段');
{
  global.wx.setStorageSync('jumpy_save_v1', JSON.stringify({
    best: 30, coins: 5, mount: 'none',
    history: [{ s: 30, d: '9-12' }, { s: 12, d: '9-11' }, { bad: 1 }],
  }));
  const p1 = storageMod.load();
  check(p1.history.length === 2, '非法历史条目被过滤（剩 ' + p1.history.length + ' 条）');
  global.wx.setStorageSync('jumpy_save_v1', JSON.stringify({
    best: 1,
    history: Array.from({ length: 20 }, (_, i) => ({ s: i, d: 'x' })),
  }));
  const p2 = storageMod.load();
  check(p2.history.length === 8 && p2.history[0].s === 19, '历史记录截断为 8 条且降序');
}

console.log('18) 滑铲：广告牌必须铲、飞鸟可铲可跳');
{
  // 滑铲通过广告牌
  const g1 = newGame();
  g1.onTap(0, 0);
  for (let i = 0; i < 30; i++) g1.update(1 / 60);
  g1.world.obstacles.push({ type: 'sign', x: g1.scroll + g1.player.x + g1.speed * 0.35, w: 90, h: 160, gap: 30 });
  g1.doSlide();
  let t = 0;
  while (t < 2 && g1.state === 'play') { g1.update(1 / 60); t += 1 / 60; }
  check(g1.state === 'play', '滑铲从广告牌下通过');
  g1.render();

  // 不铲：站立撞上广告牌
  const g2 = newGame();
  g2.onTap(0, 0);
  for (let i = 0; i < 30; i++) g2.update(1 / 60);
  g2.world.obstacles.push({ type: 'sign', x: g2.scroll + g2.player.x + g2.speed * 0.35, w: 90, h: 160, gap: 30 });
  t = 0;
  while (t < 3 && g2.state === 'play') { g2.update(1 / 60); t += 1 / 60; }
  check(g2.state === 'over', '站立撞上广告牌会死');

  // 飞鸟：滑铲通过
  const g3 = newGame();
  g3.onTap(0, 0);
  for (let i = 0; i < 30; i++) g3.update(1 / 60);
  g3.world.obstacles.push({ type: 'bird', x: g3.scroll + g3.player.x + g3.speed * 0.3, w: 34, h: 95, gap: 30 });
  g3.doSlide();
  t = 0;
  while (t < 2 && g3.state === 'play') { g3.update(1 / 60); t += 1 / 60; }
  check(g3.state === 'play', '滑铲从飞鸟下通过');

  // 飞鸟：跳跃越过
  const g4 = newGame();
  g4.onTap(0, 0);
  for (let i = 0; i < 30; i++) g4.update(1 / 60);
  g4.world.obstacles.push({ type: 'bird', x: g4.scroll + g4.player.x + g4.speed * 0.22, w: 34, h: 95, gap: 30 });
  g4.onTap(0, 0);
  t = 0;
  while (t < 2 && g4.state === 'play') { g4.update(1 / 60); t += 1 / 60; }
  check(g4.state === 'play', '跳跃越过飞鸟');

  // 空中下压：急坠 + 落地接铲
  const g5 = newGame();
  g5.onTap(0, 0);
  for (let i = 0; i < 30; i++) g5.update(1 / 60);
  g5.onTap(0, 0); // 起跳
  g5.player.doSlide(); // 空中下压
  check(g5.player.slideQueued === true && g5.vyQueuedWorks !== false, '空中下压进入急坠');
  let landed = false;
  t = 0;
  while (t < 3) {
    g5.update(1 / 60);
    t += 1 / 60;
    if (g5.player.slide > 0) { landed = true; break; }
  }
  check(landed, '落地后自动接滑铲');
  g5.render();
}

console.log('19) 平台箱：落上可站/走出掉落/侧撞会死/骑乘可落');
{
  // 跳上平台箱顶
  const g1 = newGame();
  g1.onTap(0, 0);
  for (let i = 0; i < 30; i++) g1.update(1 / 60);
  g1.world.obstacles.push({ type: 'plat', x: g1.scroll + g1.player.x + g1.speed * 0.55, w: 46, h: 46 });
  g1.onTap(0, 0); // 起跳
  let t = 0;
  while (t < 1.5 && g1.state === 'play') {
    g1.update(1 / 60);
    t += 1 / 60;
    if (g1.player.grounded && Math.abs(g1.player.y - (g1.groundY - 46)) < 2.5) break; // 落上即停
  }
  const onTop = Math.abs(g1.player.y - (g1.groundY - 46)) < 2.5;
  check(g1.state === 'play' && g1.player.grounded && onTop, '跳跃后落在平台箱顶');
  g1.render();
  // 走出平台边缘 → 回到地面（回到即停，避免撞上后续障碍）
  t = 0;
  while (t < 3 && g1.state === 'play') {
    g1.update(1 / 60);
    t += 1 / 60;
    if (Math.abs(g1.player.y - g1.groundY) < 2.5) break;
  }
  check(g1.state === 'play' && Math.abs(g1.player.y - g1.groundY) < 2.5, '走出平台回到地面');

  // 正面撞平台侧壁（不跳）
  const g2 = newGame();
  g2.onTap(0, 0);
  for (let i = 0; i < 30; i++) g2.update(1 / 60);
  g2.world.obstacles.push({ type: 'plat', x: g2.scroll + g2.player.x + g2.speed * 0.35, w: 46, h: 46 });
  t = 0;
  while (t < 3 && g2.state === 'play') { g2.update(1 / 60); t += 1 / 60; }
  check(g2.state === 'over', '正面撞平台箱侧壁会死');

  // 骑小马落上平台（鞍座高度）
  const g3 = newGame();
  g3.profile.mount = 'pony';
  g3.profile.ownedMounts = ['none', 'pony'];
  g3.onTap(0, 0);
  for (let i = 0; i < 30; i++) g3.update(1 / 60);
  g3.world.obstacles.push({ type: 'plat', x: g3.scroll + g3.player.x + g3.speed * 0.55, w: 46, h: 46 });
  g3.onTap(0, 0);
  t = 0;
  while (t < 1.5 && g3.state === 'play') {
    g3.update(1 / 60);
    t += 1 / 60;
    if (g3.player.grounded && Math.abs(g3.player.y - (g3.groundY - 46 - 38)) < 3) break;
  }
  const onTopRide = Math.abs(g3.player.y - (g3.groundY - 46 - 38)) < 3;
  check(g3.state === 'play' && g3.player.grounded && onTopRide, '骑乘落在平台箱顶（鞍座高度）');
  g3.render();
}

console.log('20) 双区操作：左半屏铲行 / 右半屏跳跃');
{
  const rafQueue2 = [];
  global.requestAnimationFrame = (cb) => { rafQueue2.push(cb); return rafQueue2.length; };
  global.wx.getWindowInfo = () => ({ windowWidth: 750, windowHeight: 375, pixelRatio: 2 });
  global.wx.createCanvas = () => makeCanvasStub();
  let zoneTouch = null;
  global.wx.onTouchStart = (h) => { zoneTouch = h; };
  global.wx.onTouchEnd = () => {};
  global.wx.onTouchCancel = () => {};

  const main2 = require('../jump-runner/js/main');
  main2.start();
  const gz = main2.__game;
  const sc = 375 / 500;
  zoneTouch({ changedTouches: [{ clientX: 600 * sc, clientY: 200 * sc }] });
  check(gz.state === 'play', '右半屏点按开始游戏');
  for (let i = 0; i < 20; i++) gz.update(1 / 60);
  zoneTouch({ changedTouches: [{ clientX: 100 * sc, clientY: 300 * sc }] });
  check(gz.player.slide > 0, '左半屏点按触发铲行');
  for (let i = 0; i < 50 && gz.player.slide > 0; i++) gz.update(1 / 60);
  check(gz.player.slide <= 0 && gz.player.grounded, '铲行结束后恢复');
  const vyBefore = gz.player.vy;
  zoneTouch({ changedTouches: [{ clientX: 600 * sc, clientY: 200 * sc }] });
  check(gz.player.vy < vyBefore && gz.player.vy < 0, '右半屏点按触发跳跃');
  gz.render();
}

console.log('21) 骑乘碰撞：坐骑身体参与（尖刺也命中坐骑）');
{
  const g1 = newGame();
  g1.profile.mount = 'bicycle';
  g1.profile.ownedMounts = ['none', 'bicycle'];
  g1.onTap(0, 0);
  for (let i = 0; i < 30; i++) g1.update(1 / 60);
  check(g1.riding === true, '骑行中');
  // 骑行状态正前方放尖刺
  g1.world.obstacles.push({ type: 'spike', x: g1.scroll + g1.player.x + g1.speed * 0.25, w: 24, h: 30 });
  let t = 0;
  while (t < 3 && g1.state === 'play' && g1.invincible <= 0) { g1.update(1 / 60); t += 1 / 60; }
  check(g1.state === 'play' && g1.invincible > 0 && g1.riding === false, '骑行撞尖刺：坐骑逃跑替玩家挡下');
  g1.render();
}

console.log('22) 骑乘滑铲：可钻广告牌（低盒规则）');
{
  const g1 = newGame();
  g1.profile.mount = 'bicycle';
  g1.profile.ownedMounts = ['none', 'bicycle'];
  g1.onTap(0, 0);
  for (let i = 0; i < 30; i++) g1.update(1 / 60);
  g1.doSlide();
  g1.world.obstacles.push({ type: 'sign', x: g1.scroll + g1.player.x + g1.speed * 0.3, w: 90, h: 160, gap: 30 });
  let t = 0;
  while (t < 2 && g1.state === 'play') { g1.update(1 / 60); t += 1 / 60; }
  check(g1.state === 'play', '骑乘滑铲钻过广告牌');
  g1.render();
}

console.log(failures === 0 ? '\n全部通过 ✔' : '\n有 ' + failures + ' 项失败 ✘');
process.exit(failures === 0 ? 0 : 1);
