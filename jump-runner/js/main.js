// 主控制器：游戏状态机（菜单/商店/游戏中/结算）、主循环、输入、渲染编排
const util = require('./util');
const Player = require('./player');
const World = require('./world');
const Particles = require('./particles');
const sound = require('./sound');
const ui = require('./ui');
const skins = require('./skins');
const Mounts = require('./mounts');
const storage = require('./storage');
const Sprites = require('./sprites');
const bgModule = require('./background');

const BASE_SPEED = 280;   // 初速度 px/s
const SPEED_GROW = 7;     // 每秒加速度
const MAX_SPEED = 540;
const SCORE_DIV = 55;     // 多少 px 折算 1 米
const MAGNET_SECONDS = 6; // 磁铁持续时长

function createGame(canvas, ctx, W, H, opts) {
  opts = opts || {};
  const profile = opts.profile || storage.load();
  const saveProfile = opts.saveProfile || function (p) { storage.save(p); };

  const groundY = Math.round(H * 0.72);

  const game = {
    canvas,
    ctx,
    W,
    H,
    groundY,
    profile,
    state: 'menu', // menu | shop | play | over
    time: 0,
    scroll: 0,
    menuScroll: 0,
    speed: BASE_SPEED,
    score: 0,
    coinCount: 0,
    newBest: false,
    overAt: 0,
    deathTimer: 0,
    // 道具状态
    shield: false,
    invincible: 0,
    magnetTimer: 0,
    magnetMax: MAGNET_SECONDS,
    // 坐骑状态（startRun 时按存档装备）
    mountId: null,
    riding: false,
    // 商店
    shopTab: 'skin',
    shopMsg: '',
    shopMsgOk: false,
    shopMsgTimer: 0,
    // 按钮按压反馈
    pressedKey: null,
    pressFlash: null,
    // 打磨：震屏 / 死亡顿帧 / 金币飞行 / 里程碑 / 转场淡入 / 暗角
    shake: null,
    deathFxPending: false,
    deathPos: null,
    flyCoins: [],
    coinPulse: 0,
    milestone: null,
    lastMilestone: 0,
    fadeT: 0,
    zoneHintT: 0,
    combo: 0,
    comboTimer: 0,
    // 好友排行（真机为开放数据域上下文；预览环境为桩）
    odc: null,
  };

  game.bg = new bgModule.Background(W, H, groundY);
  game.player = new Player(W, groundY);
  game.world = new World(W, H, groundY);
  game.fx = new Particles();

  function diff() {
    return util.clamp(game.score / 350, 0, 1);
  }

  function startRun() {
    game.world.reset();
    game.player.reset();
    game.fx.clear();
    game.scroll = 0;
    game.speed = BASE_SPEED;
    game.score = 0;
    game.coinCount = 0;
    game.newBest = false;
    game.shield = false;
    game.invincible = 0;
    game.magnetTimer = 0;
    game.flyCoins = [];
    game.milestone = null;
    game.lastMilestone = 0;
    game.shake = null;
    game.deathFxPending = false;
    game.pressedKey = null;
    game.fadeT = 0.18; // 开局淡入
    game.zoneHintT = 3.5; // 双区操作提示
    game.combo = 0;
    game.comboTimer = 0;
    // 装备坐骑（存档已保证 owned 合法）
    const m = Mounts.get(profile.mount);
    game.mountId = m.id === 'none' ? null : m.id;
    game.riding = !!game.mountId;
    game.magnetMax = MAGNET_SECONDS * (game.mountId === 'bicycle' ? 1.5 : 1);
    game.player.jumpMult = game.mountId === 'pony' ? 1.08 : 1;
    if (game.mountId === 'dino') game.shield = true;
    game.state = 'play';
    sound.start();
    if (!profile.mute) sound.startBgm();
  }

  function shopAction(kind, id) {
    const isMount = kind === 'mount';
    const def = isMount ? Mounts.get(id) : skins.get(id);
    const prof = game.profile;
    const owned = isMount ? prof.ownedMounts : prof.owned;
    if (owned.indexOf(id) >= 0) {
      if (isMount) prof.mount = id;
      else prof.skin = id;
      saveProfile(prof);
      game.shopMsg = isMount ? '骑上「' + def.name + '」！' : '已换上「' + def.name + '」';
      game.shopMsgOk = true;
      game.shopMsgTimer = 1.4;
      sound.tap();
      return;
    }
    if (prof.coins >= def.price) {
      prof.coins -= def.price;
      owned.push(id);
      if (isMount) prof.mount = id;
      else prof.skin = id;
      saveProfile(prof);
      game.shopMsg = '解锁成功！';
      game.shopMsgOk = true;
      game.shopMsgTimer = 1.4;
      sound.buy();
    } else {
      game.shopMsg = '金币不足，去跑几圈吧～';
      game.shopMsgOk = false;
      game.shopMsgTimer = 1.4;
      sound.tap();
    }
  }

  function onLand() {
    game.player.land();
    game.fx.dust(game.player.x, groundY, 6);
  }

  function die(cause) {
    if (game.state !== 'play') return;
    game.state = 'over';
    game.overAt = game.time;
    game.deathTimer = 0;
    game.deathCause = cause;
    game.player.dead = true;
    game.player.deadVy = -620;   // 尸体弹飞初速
    game.player.deadRot = 0;
    sound.stopBgm();
    // 死亡演出：弹飞翻滚 0.55s → 落点爆裂 + 震屏（打击感）
    game.deathFxPending = true;
    game.deathPos = { x: game.player.x, y: Math.max(Math.min(game.player.y, H - 30), 60) };
    // 结算入档：飞行中的金币直接到账
    game.coinCount += game.flyCoins.length;
    game.flyCoins = [];
    const prof = game.profile;
    prof.coins += game.coinCount;
    if (game.score > prof.best) {
      prof.best = game.score;
      game.newBest = true;
    }
    const d = new Date();
    prof.history = (prof.history || []);
    prof.history.push({ s: game.score, d: (d.getMonth() + 1) + '-' + d.getDate() });
    prof.history.sort((a, b) => b.s - a.s);
    prof.history = prof.history.slice(0, 8);
    saveProfile(prof);
    // 好友榜：把最佳成绩写入微信云存储并通知开放数据域刷新
    if (typeof wx !== 'undefined' && typeof wx.setUserCloudStorage === 'function') {
      try {
        wx.setUserCloudStorage({
          KVDataList: [{ key: 'bestScore', value: String(prof.best) }],
        });
      } catch (e) { /* 云存储失败不影响游戏 */ }
    }
    if (game.odc) {
      try {
        game.odc.postMessage({ type: 'score', score: game.score, best: prof.best });
      } catch (e) { /* 忽略 */ }
    }
  }

  game.doSlide = function doSlide() {
    if (game.state !== 'play') return;
    const r = game.player.doSlide();
    if (r === 'slide') {
      game.fx.dust(game.player.x, groundY, 4);
      sound.slide();
    } else if (r === 'dive') {
      sound.slide();
    }
  };

  game.onTap = function onTap(x, y) {
    if (game.state === 'menu') {
      if (ui.inRect(x, y, ui.getMenuButtons(game).mute)) {
        // 静音开关（按下即切换）
        profile.mute = !sound.isMuted();
        sound.setMuted(profile.mute);
        if (!profile.mute) sound.tap();
        saveProfile(profile);
        return;
      }
      if (ui.inRect(x, y, ui.getMenuButtons(game).rank)) {
        game.state = 'rank';
        sound.tap();
        return;
      }
      if (ui.inRect(x, y, ui.getMenuButtons(game).shop)) {
        game.state = 'shop';
        game.shopMsgTimer = 0;
        sound.tap();
        return;
      }
      startRun();
      return;
    }
    if (game.state === 'rank') {
      // 弹层内只有「返回」一个动作（导航按钮在松手时触发走到这里）
      const L = ui.getRankLayout(game);
      if (ui.inRect(x, y, L.back)) {
        game.state = 'menu';
        sound.tap();
      }
      return;
    }
    if (game.state === 'shop') {
      const L = ui.getShopLayout(game);
      if (ui.inRect(x, y, L.back)) {
        game.state = 'menu';
        sound.tap();
        return;
      }
      if (ui.inRect(x, y, L.tabs.skin) && game.shopTab !== 'skin') {
        game.shopTab = 'skin';
        sound.tap();
        return;
      }
      if (ui.inRect(x, y, L.tabs.mount) && game.shopTab !== 'mount') {
        game.shopTab = 'mount';
        sound.tap();
        return;
      }
      for (const cell of L.cells) {
        if (ui.inRect(x, y, cell.rect)) {
          shopAction(game.shopTab, cell.id);
          return;
        }
      }
      return;
    }
    if (game.state === 'play') {
      const r = game.player.jump();
      if (r === 'jump') {
        game.fx.dust(game.player.x, groundY, 5);
        sound.jump();
      } else if (r === 'double') {
        game.fx.sparkle(game.player.x, game.player.y - 20);
        sound.doubleJump();
      }
      return;
    }
    // 离开游戏场景时停掉背景音乐
    sound.stopBgm();
    // over：结算后短暂锁定输入，防止误触
    if (game.state === 'over' && game.time - game.overAt > 0.6) {
      if (ui.inRect(x, y, ui.getOverButtons(game).home)) {
        game.state = 'menu';
        return;
      }
      startRun();
    }
  };

  game.update = function update(dt) {
    game.time += dt;
    if (game.pressFlash) {
      game.pressFlash.t -= dt;
      if (game.pressFlash.t <= 0) game.pressFlash = null;
    }
    if (game.fadeT > 0) game.fadeT -= dt;
    if (game.zoneHintT > 0) game.zoneHintT -= dt;
    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) game.combo = 0;
    }
    if (game.coinPulse > 0) game.coinPulse -= dt;
    if (game.shake) {
      game.shake.t -= dt;
      if (game.shake.t <= 0) game.shake = null;
    }
    game.bg.update(dt, game.state === 'play' ? game.speed : 40);

    if (game.state === 'menu' || game.state === 'shop' || game.state === 'rank') {
      // 菜单/商店/排行榜：原地小跑展示（装备坐骑时骑在鞍座上）
      const menuRideH = profile.mount !== 'none' ? Mounts.get(profile.mount).h : 0;
      game.menuScroll += 40 * dt;
      game.player.run += dt * 9;
      game.player.y = (groundY - menuRideH) - Math.abs(Math.sin(game.time * 6)) * 4;
      game.player.sx += (1 - game.player.sx) * Math.min(1, dt * 12);
      game.player.sy += (1 - game.player.sy) * Math.min(1, dt * 12);
      if (game.shopMsgTimer > 0) game.shopMsgTimer -= dt;
      game.fx.update(dt, 0);
      return;
    }

    if (game.state === 'over') {
      game.deathTimer += dt;
      // 尸体弹飞：翻滚着飞出去，0.55s 后在落点爆裂 + 震屏
      if (game.deathFxPending) {
        if (game.deathTimer < 0.55) {
          const p = game.player;
          p.deadVy += 2400 * dt;
          p.y += p.deadVy * dt;
          p.x += 42 * dt;
          p.deadRot += 8.5 * dt;
        } else {
          game.deathFxPending = false;
          game.fx.burst(Math.min(game.player.x, W - 10), Math.max(Math.min(game.player.y, H - 20), 40));
          game.shake = { t: 0.32, dur: 0.32, power: 9 };
          sound.hit();
        }
      }
      game.fx.update(dt, 0);
      return;
    }

    // ---- 游戏中 ----
    game.speed = Math.min(MAX_SPEED, game.speed + SPEED_GROW * dt);
    // 小摩托特权：实际速度上浮 8%
    const effSpeed = game.speed * (game.riding && game.mountId === 'moto' ? 1.08 : 1);
    game.scroll += effSpeed * dt;
    game.score = Math.floor(game.scroll / SCORE_DIV);
    game.world.update(game.scroll, effSpeed, diff());

    // 里程碑：每 100 米弹横幅
    const m100 = Math.floor(game.score / 100);
    if (m100 > game.lastMilestone && m100 > 0) {
      game.lastMilestone = m100;
      game.milestone = { v: m100 * 100, t: 1.6 };
      sound.milestone();
    }
    if (game.milestone) {
      game.milestone.t -= dt;
      if (game.milestone.t <= 0) game.milestone = null;
    }

    // 金币飞向计数器
    for (const fc of game.flyCoins) {
      fc.t += dt / 0.42;
    }
    while (game.flyCoins.length && game.flyCoins[0].t >= 1) {
      const fc = game.flyCoins.shift();
      game.coinCount += fc.bonus || 1; // 连击奖励金币多颗到账
      game.coinPulse = 0.3;
    }

    const p = game.player;
    // 骑乘鞍座高度（滑铲时压低）——平台落点计算要用
    const rideHOf = (sl) => (game.riding
      ? (sl ? Math.max(8, Math.round(Mounts.get(game.mountId).h * 0.6)) : Mounts.get(game.mountId).h)
      : 0);
    const prevFeet = p.y + rideHOf(p.slide > 0);
    p.update(dt, effSpeed);

    // 滑铲计时：头顶被广告牌压着时保持低姿直到通过
    if (p.slide > 0) {
      p.slide -= dt;
      if (p.slide <= 0) {
        p.slide = game.world.signBlocking(p) ? 0.1 : 0;
      }
      if (p.grounded && Math.random() < dt * 18) {
        game.fx.dust(p.x - 14, groundY - 2, 1);
      }
    }

    // 骑乘时角色落在鞍座面上（铲行时坐骑一并压低）
    const rideH = rideHOf(p.slide > 0);
    const rideGroundY = groundY - rideH;
    // 坐骑身体参与碰撞：从鞍座延伸到接触面（骑乘时尖刺/木箱同样会命中坐骑）
    p.mountBody = game.riding;
    p.mountBodyH = rideH;

    // 无敌 / 磁铁 计时
    if (game.invincible > 0) game.invincible -= dt;
    if (game.magnetTimer > 0) {
      game.magnetTimer -= dt;
      // 吸附范围内的金币飞向玩家
      const tx = game.scroll + p.x;
      const ty = p.y - 22;
      for (const c of game.world.coins) {
        if (c.taken) continue;
        const dx = c.x - tx;
        const dy = c.y - ty;
        if (dx * dx + dy * dy < 170 * 170) {
          const k = Math.min(1, dt * 9);
          c.x -= dx * k;
          c.y -= dy * k;
        }
      }
    }

    // 地面判定：脚下有没有地（坑）、是否落地、是否跑出坑边
    const over = game.world.overGround(game.scroll + p.x);
    if (over && p.y >= rideGroundY && p.vy >= 0) {
      if (!p.grounded) onLand();
      p.y = rideGroundY;
      p.vy = 0; // 落地吸附时清零，防止重力速度无限累积
      p.grounded = true;
      p.jumps = 0;
      // 空中下压：落地后接滑铲
      if (p.slideQueued) {
        p.slide = 0.45;
        p.slideQueued = false;
        game.fx.dust(p.x, groundY, 5);
      }
    } else if (!over && p.grounded) {
      // 跑出坑边开始下落，仍保留一次空中跳机会
      p.grounded = false;
      p.jumps = 1;
    }

    // 平台箱：单向地面（从上方落下可站；侧面撞上走碰撞受伤；走出边缘即下落）
    let onPlat = false;
    const rideHNow = rideHOf(p.slide > 0);
    const feetNow = p.y + rideHNow;
    for (const o of game.world.obstacles) {
      if (o.type !== 'plat') continue;
      const top = groundY - o.h;
      const sx = o.x - game.scroll;
      if (p.x + 9 <= sx || p.x - 9 >= sx + o.w) continue;
      if (prevFeet <= top + 2 && feetNow >= top && p.vy >= 0) {
        p.y = top - rideHNow;
        if (!p.grounded) onLand();
        p.grounded = true;
        p.vy = 0;
        p.jumps = 0;
        if (p.slideQueued) {
          p.slide = 0.45;
          p.slideQueued = false;
          game.fx.dust(p.x, top, 5);
        }
      }
      if (p.grounded && Math.abs(p.y + rideHNow - top) < 1.5) onPlat = true;
    }
    // 从平台边缘走出 → 开始下落（保留一次空中跳机会）
    if (p.grounded && !onPlat && p.y < rideGroundY - 1.5 && p.vy >= 0) {
      p.grounded = false;
      p.jumps = 1;
    }

    // 坠坑（护盾和坐骑都救不了坑）
    if (p.y > H + 60) {
      die('fell');
      return;
    }

    // 障碍碰撞：无敌期间穿过；优先消耗护盾气泡，其次坐骑替你挡下（坐骑逃跑）
    const res = game.world.collide(p);
    if (res.hit && game.invincible <= 0) {
      if (game.shield) {
        game.shield = false;
        game.invincible = 1.2;
        game.fx.emit(p.x, p.y - 22, 12, {
          angle: 0, spread: Math.PI * 2, speed: 230, size: 5, life: 0.6,
          color: '#5CA8FF', grav: 0,
        });
        game.fx.text(p.x, p.y - 60, '护盾抵消!', '#5CA8FF');
        sound.shieldSave();
      } else if (game.riding) {
        game.riding = false;
        game.invincible = 1.2;
        game.player.jumpMult = 1;
        game.fx.emit(p.x, p.y, 14, {
          angle: 0, spread: Math.PI * 2, speed: 260, size: 6, life: 0.8,
          color: '#CFD8DC', grav: 500,
        });
        game.fx.text(p.x, p.y - 60, Mounts.get(game.mountId).name + '逃跑了！', '#78909C');
        sound.shieldSave();
      } else {
        die('hit');
        return;
      }
    }
    for (const c of res.coins) {
      const sx = c.x - game.scroll;
      game.fx.sparkle(sx, c.y);
      game.fx.text(sx, c.y - 16, '+1');
      sound.coin();
      game.flyCoins.push({ x0: sx, y0: c.y, t: 0 });
      // 连击：1 秒内连续拾取累积，每 5 连击奖励 3 金币
      game.combo++;
      game.comboTimer = 1.0;
      if (game.combo > 0 && game.combo % 5 === 0) {
        game.comboBonus = 3;
        game.flyCoins.push({ x0: sx, y0: c.y - 24, t: 0, bonus: 3 });
        game.fx.text(sx, c.y - 34, '连击x' + game.combo, '#FF7043');
      }
    }
    for (const it of res.items) {
      const sx = it.x - game.scroll;
      game.fx.sparkle(sx, it.y);
      if (it.type === 'shield') {
        game.shield = true;
        game.fx.text(sx, it.y - 18, '护盾 +1', '#5CA8FF');
        sound.shieldGet();
      } else {
        game.magnetTimer = game.magnetMax;
        game.fx.text(sx, it.y - 18, '磁铁!', '#FF5964');
        sound.magnet();
      }
    }

    // 疾跑扬尘（骑乘时落在蹄下/轮下）+ 小摩托尾气
    if (p.grounded && Math.random() < dt * 8) {
      game.fx.dust(p.x - 14, groundY - 2, 1);
    }
    if (game.riding && game.mountId === 'moto' && p.grounded && Math.random() < dt * 6) {
      game.fx.emit(p.x - 26, rideGroundY - 8, 1, {
        angle: Math.PI, spread: 0.6, speed: 60, size: 5, life: 0.7,
        color: 'rgba(170,170,170,0.55)', grav: -30, world: true,
      });
    }

    game.fx.update(dt, effSpeed);
  };

  game.render = function render() {
    const ctx2 = game.ctx;
    const inMenuLike = game.state === 'menu' || game.state === 'shop' || game.state === 'rank';
    const theme = bgModule.getTheme(inMenuLike ? 0 : game.score);

    // 震屏只作用于场景层（HUD/面板稳定）
    ctx2.save();
    if (game.shake) {
      const k = game.shake.t / game.shake.dur;
      ctx2.translate(
        (Math.random() * 2 - 1) * game.shake.power * k,
        (Math.random() * 2 - 1) * game.shake.power * k
      );
    }

    game.bg.draw(ctx2, inMenuLike ? game.menuScroll : game.scroll, theme, game.time);
    game.world.draw(ctx2, theme, game.time);
    // 高速时的速度线（ conveying 速度感，画在世界层之上、角色之下）
    if (game.state === 'play' && game.speed > 380) {
      const k = (game.speed - 380) / (MAX_SPEED - 380);
      ctx2.globalAlpha = 0.10 + 0.16 * k;
      ctx2.fillStyle = '#FFFFFF';
      for (let i = 0; i < 5; i++) {
        const span = game.W + 260;
        const lx = span - ((game.time * (620 + i * 150) + i * 457) % span) - 130;
        const ly = 60 + ((i * 97) % Math.max(1, Math.round(groundY - 150)));
        const ll = 44 + (i % 3) * 26;
        ctx2.fillRect(lx, ly, ll, 3);
      }
      ctx2.globalAlpha = 1;
    }
    // 死亡顿帧期间角色保持可见，爆粒子后才隐藏
    if (game.state !== 'over' || game.deathFxPending) {
      const over = game.world.overGround(game.scroll + game.player.x);
      // 菜单展示存档里的坐骑；游戏中以实际骑乘状态为准
      const mountOpt = inMenuLike
        ? (profile.mount !== 'none' ? profile.mount : null)
        : (game.riding ? game.mountId : null);
      game.player.draw(ctx2, game.time, over, {
        skin: skins.get(game.profile.skin),
        shield: game.shield,
        invincible: game.invincible,
        mount: mountOpt,
        deadCorpse: game.deathFxPending,
      });
    }
    game.fx.draw(ctx2);
    ctx2.restore(); // 震屏结束

    // 飞行中的金币（从拾取点飞向右上角计数器）
    if (game.flyCoins.length) {
      const tx = game.W - 60;
      const ty = 30;
      for (const fc of game.flyCoins) {
        const t = Math.min(1, fc.t);
        const cx = (fc.x0 + tx) / 2;
        const cy = fc.y0 - 80;
        const x = util.lerp(util.lerp(fc.x0, cx, t), util.lerp(cx, tx, t), t);
        const y = util.lerp(util.lerp(fc.y0, cy, t), util.lerp(cy, ty, t), t);
        ctx2.beginPath();
        ctx2.arc(x, y, 6.5, 0, Math.PI * 2);
        ctx2.fillStyle = '#FFC93C';
        ctx2.fill();
        ctx2.lineWidth = 2;
        ctx2.strokeStyle = '#E0A32E';
        ctx2.stroke();
        ctx2.fillStyle = 'rgba(255,255,255,0.85)';
        ctx2.beginPath();
        ctx2.arc(x - 2, y - 2, 1.6, 0, Math.PI * 2);
        ctx2.fill();
      }
    }

    if (game.state === 'menu') {
      ui.drawMenu(ctx2, game.W, game.H, game);
    } else if (game.state === 'shop') {
      ui.drawShop(ctx2, game.W, game.H, game);
    } else if (game.state === 'rank') {
      ui.drawRank(ctx2, game.W, game.H, game);
    } else {
      ui.drawHUD(ctx2, game.W, game.H, game);
      if (game.state === 'over') {
        ui.drawGameOver(ctx2, game.W, game.H, game);
      }
    }

    // 暗角（一次性创建，随尺寸缓存）
    if (!game.vign || game.vignW !== game.W || game.vignH !== game.H) {
      game.vign = ctx2.createRadialGradient(
        game.W / 2, game.H * 0.45, Math.min(game.W, game.H) * 0.44,
        game.W / 2, game.H * 0.5, Math.max(game.W, game.H) * 0.72
      );
      game.vign.addColorStop(0, 'rgba(10,20,40,0)');
      game.vign.addColorStop(1, 'rgba(10,20,40,0.15)');
      game.vignW = game.W;
      game.vignH = game.H;
    }
    ctx2.fillStyle = game.vign;
    ctx2.fillRect(0, 0, game.W, game.H);

    // 转场淡入
    if (game.fadeT > 0) {
      ctx2.fillStyle = 'rgba(12,18,32,' + (util.clamp(game.fadeT / 0.18, 0, 1) * 0.5).toFixed(3) + ')';
      ctx2.fillRect(0, 0, game.W, game.H);
    }
  };

  return game;
}

// 微信小游戏入口：初始化画布、绑定触摸、启动主循环
// 采用"设计高度"等比缩放：所有游戏逻辑都运行在 高度=500 的逻辑坐标系里，
// 横屏/竖屏/不同分辨率的设备只改变可见逻辑宽度，物理手感与关卡难度保持一致。
// 设计高度越小，场景整体越大（角色/坐骑/障碍同步放大），可见视野越近。
const DESIGN_HEIGHT = 500;

const api = { createGame, start };

function start() {
  const info = typeof wx.getWindowInfo === 'function'
    ? wx.getWindowInfo()
    : wx.getSystemInfoSync();
  const rawW = info.windowWidth || 0;
  const rawH = info.windowHeight || 0;
  // 尺寸退化（面板折叠/启动瞬间）时延迟重试，避免建出 1px 画布
  if (rawW < 50 || rawH < 50) {
    setTimeout(start, 120);
    return;
  }
  const DPR = info.pixelRatio || 2;

  // 逻辑坐标换算：scale < 1 表示物理屏幕比设计高度矮（横屏），视野更宽
  const scale = Math.min(1, rawH / DESIGN_HEIGHT);
  const W = Math.round(rawW / scale);
  const H = DESIGN_HEIGHT;

  const canvas = wx.createCanvas();
  canvas.width = rawW * DPR;
  canvas.height = rawH * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR * scale, DPR * scale);

  const game = createGame(canvas, ctx, W, H, {
    profile: storage.load(),
    saveProfile: (p) => storage.save(p),
  });
  // 开放数据域（好友排行榜）；不支持的环境为 undefined，游戏自动降级
  if (typeof wx.getOpenDataContext === 'function') {
    try {
      game.odc = wx.getOpenDataContext();
    } catch (e) { /* 忽略 */ }
  }
  Sprites.load(); // 异步加载角色素材帧
  api.__game = game; // 测试/浏览器预览用
  sound.setMuted(!!game.profile.mute); // 同步静音状态
  if (typeof window !== 'undefined') {
    window.__game = game;
    window.__Player = Player;
    window.__skins = skins;
    window.__Mounts = Mounts;
  }

  // 导航按钮：按下高亮、松手触发（且松手时仍在按钮上才算数）；
  // 游戏中双区操作：左半屏铲行、右半屏跳跃（天天酷跑式两键）；
  // 下滑手势 = 铲行仍然保留；其余触摸按下即触发，保证手感
  let swipeStart = null;
  wx.onTouchStart((e) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const x = t.clientX / scale;
    const y = t.clientY / scale;
    swipeStart = { x, y };
    const key = ui.navButtonAt(game, x, y);
    if (key) {
      game.pressedKey = key;
      return;
    }
    if (game.state === 'play') {
      if (x < game.W / 2) game.doSlide();
      else game.onTap(x, y);
      return;
    }
    game.onTap(x, y);
  });
  if (wx.onTouchMove) {
    wx.onTouchMove((e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t || !swipeStart) return;
      if (t.clientY / scale - swipeStart.y > 42) {
        game.doSlide();
        swipeStart = null;
      }
    });
  }
  if (wx.onTouchEnd) {
    wx.onTouchEnd((e) => {
      const t = e.changedTouches && e.changedTouches[0];
      swipeStart = null;
      if (!t) return;
      if (game.pressedKey) {
        const x = t.clientX / scale;
        const y = t.clientY / scale;
        if (ui.navButtonAt(game, x, y) === game.pressedKey) {
          game.pressFlash = { key: game.pressedKey, t: 0.15 };
          game.onTap(x, y);
        }
        game.pressedKey = null;
      }
    });
  }
  if (wx.onTouchCancel) {
    wx.onTouchCancel(() => {
      game.pressedKey = null;
      swipeStart = null;
    });
  }

  let last = Date.now();
  if (wx.onShow) {
    wx.onShow(() => { last = Date.now(); }); // 从后台切回时不跳帧
  }

  function loop() {
    const now = Date.now();
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    // 浏览器预览调试：window.__pauseLoop = true 可冻结画面（不影响微信端）
    if (typeof window === 'undefined' || !window.__pauseLoop) {
      // 子步长积分，保证高速下碰撞稳定
      const n = Math.max(1, Math.ceil(dt / (1 / 60)));
      const step = dt / n;
      for (let i = 0; i < n; i++) game.update(step);
      game.render();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

module.exports = api;
