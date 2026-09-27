// 玩家：物理、跳跃（含二段跳）、Q 版小人绘制（赛璐璐分层上色）、骑乘姿态、滑铲
const util = require('./util');
const skins = require('./skins');
const Mounts = require('./mounts');
const Sprites = require('./sprites');

const SKIN_TONE = '#FFE3C9';     // 肤色
const SKIN_EDGE = 'rgba(160,96,62,0.45)'; // 脸部轮廓
const LINE = '#4A342E';          // 统一暖深描边

function mixc(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
// 阴影色：向蓝紫偏移（比压黑更通透）
function shadeOf(c) {
  return skins.rgb(mixc(c, [44, 48, 82], 0.3));
}
function liteOf(c) {
  return skins.rgb(mixc(c, [255, 255, 245], 0.42));
}

class Player {
  constructor(W, groundY) {
    this.W = W;
    this.groundY = groundY;
    this.x = Math.round(W * 0.24);
    this.jumpMult = 1; // 坐骑特权：跳跃高度倍率
    this.reset();
  }

  reset() {
    this.y = this.groundY; // y 为脚底位置（骑乘时是鞍座面）
    this.vy = 0;
    this.grounded = true;
    this.jumps = 0; // 已跳次数（0 在地面，1 空中可再跳一次）
    this.run = 0;
    this.sx = 1;
    this.sy = 1;
    this.dead = false;
    this.slide = 0;       // 剩余滑铲时间
    this.slideQueued = false; // 空中下压：落地后接滑铲
  }

  // 返回 'jump' | 'double' | null（滑铲中跳跃会取消铲行）
  jump() {
    this.slide = 0;
    if (this.grounded) {
      this.vy = -900 * this.jumpMult;
      this.grounded = false;
      this.jumps = 1;
      this.sy = 1.22;
      this.sx = 0.82;
      return 'jump';
    }
    if (this.jumps === 1) {
      this.vy = -780 * this.jumpMult;
      this.jumps = 2;
      this.sy = 1.18;
      this.sx = 0.85;
      return 'double';
    }
    return null;
  }

  // 滑铲：地面直接铲；空中下压 → 急坠并在落地后接铲
  doSlide() {
    if (this.slide > 0) return null;
    if (this.grounded) {
      this.slide = 0.62;
      this.sy = 0.7;
      this.sx = 1.15;
      return 'slide';
    }
    this.vy = Math.max(this.vy, 1400);
    this.slideQueued = true;
    return 'dive';
  }

  land() {
    this.grounded = true;
    this.vy = 0;
    this.jumps = 0;
    this.sy = 0.76;
    this.sx = 1.24;
  }

  update(dt, speed) {
    this.vy += 2500 * dt;
    this.y += this.vy * dt;
    if (this.grounded) {
      this.run += dt * speed * 0.045;
    }
    // 挤压拉伸缓慢恢复
    this.sx += (1 - this.sx) * Math.min(1, dt * 12);
    this.sy += (1 - this.sy) * Math.min(1, dt * 12);
  }

  // opts: { skin, shield, invincible, mount: 坐骑id|null }
  draw(ctx, time, overGround, opts) {
    opts = opts || {};
    const skin = opts.skin || skins.get('classic');
    const mountId = opts.mount && opts.mount !== 'none' ? opts.mount : null;
    const rideH = mountId ? Mounts.get(mountId).h : 0;
    const x = this.x;
    const y = this.y;

    // 地面投影（骑乘时更宽）
    if (overGround || y <= this.groundY) {
      const h = util.clamp((this.groundY - y) / 160, 0, 1);
      ctx.globalAlpha = util.lerp(0.28, 0.08, h);
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.ellipse(x, this.groundY + 6, util.lerp(30, 15, h) + (mountId ? 12 : 0), 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 无敌闪烁：隔帧隐藏本体
    const blinkHide = opts.invincible > 0 && Math.floor(time * 14) % 2 === 0;

    // 姿势量化键：连续动作量化为离散姿势帧（供超采样缓存）
    const PI2L = Math.PI * 2;
    let poseKey;
    let qRun = this.run;
    let qVy = this.vy;
    if (mountId) {
      const thq = Math.floor(((this.run * 1.5) / PI2L) * 8) % 8;
      qRun = (thq / 8) * PI2L / 1.5;
      poseKey = 'ride' + thq + (this.slide > 0 ? 's' : '');
    } else if (this.slide > 0) {
      poseKey = 'slide';
    } else if (!this.grounded) {
      const lvl = Math.round(util.clamp(this.vy / 700, -1, 1) * 2 + 2); // 0..4
      qVy = (lvl - 2) * 350;
      poseKey = 'air' + lvl;
    } else {
      const ph = Math.floor((this.run / PI2L) * 8) % 8;
      qRun = (ph / 8) * PI2L;
      poseKey = 'run' + ph;
    }

    const chibiOpts = {
      run: qRun,
      grounded: this.grounded,
      vy: qVy,
      riding: !!mountId,
      sliding: this.slide > 0,
      mount: mountId,
      t: 1.23, // 固定值：缓存帧不眨眼
    };

    if (!blinkHide) {
      if (mountId) {
        // 骑乘分层合成：远腿画布 → 坐骑（程序化，车轮转动）→ 近腿+身体画布
        if (!Sprites.ready()) {
          const farC = poseCanvas(skin, poseKey + '#far', (pc) =>
            Player.drawChibi(pc, skin, Object.assign({ pass: 'far' }, chibiOpts)));
          ctx.drawImage(farC, x - POSE_OX, y - POSE_OY, POSE_BOX_W, POSE_BOX_H);
          Mounts.draw(ctx, mountId, x, y + rideH, time, {
            run: this.run,
            grounded: this.grounded,
            squash: this.slide > 0,
          });
          const nearC = poseCanvas(skin, poseKey + '#near', (pc) =>
            Player.drawChibi(pc, skin, Object.assign({ pass: 'near' }, chibiOpts)));
          ctx.drawImage(nearC, x - POSE_OX, y - POSE_OY, POSE_BOX_W, POSE_BOX_H);
        } else {
          Mounts.draw(ctx, mountId, x, y + rideH, time, {
            run: this.run,
            grounded: this.grounded,
            squash: this.slide > 0,
          });
          Sprites.draw(ctx, skin.sprite, this.slide > 0 ? 'duck' : 'hold1', x, y, 63, true);
        }
      } else {
        // 步行/滑铲/空中：超采样姿势画布（落地挤压拉伸作用于贴图）
        const bodyC = poseCanvas(skin, poseKey, (pc) => Player.drawChibi(pc, skin, chibiOpts));
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(this.sx, this.sy);
        ctx.drawImage(bodyC, -POSE_OX, -POSE_OY, POSE_BOX_W, POSE_BOX_H);
        ctx.restore();
      }
    }

    // 护盾气泡
    if (opts.shield) {
      ctx.save();
      ctx.translate(x, y - 26);
      ctx.globalAlpha = 0.16 + 0.06 * Math.sin(time * 5);
      ctx.fillStyle = '#5CA8FF';
      ctx.beginPath();
      ctx.arc(0, 0, 33, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#5CA8FF';
      ctx.beginPath();
      ctx.arc(0, 0, 33, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
}

// ---- Q 版小人绘制 v3（静态方法，商店头像复用） ----
// 三头身 + 赛璐璐分层上色（每块形状：基色/阴影/高光）+ 统一暖深描边
// 坐标系：原点在脚底中心；o = { run, grounded, vy, riding, sliding, t }
function drawChibi(ctx, skin, o) {
  o = o || {};
  const run = o.run || 0;
  const grounded = o.grounded !== false;
  const vy = o.vy || 0;
  const riding = !!o.riding;
  const sliding = !!o.sliding;
  const t = o.t || 0;

  const outfit = skins.rgb(skin.fill);
  const outfitDark = skins.rgb(skin.dark);
  const outfitShade = shadeOf(skin.fill);
  const outfitLite = liteOf(skin.fill);
  const hairC = skins.rgb(skin.hair);
  const hairShade = shadeOf(skin.hair);
  const hairLite = liteOf(skin.hair);
  const cloth = skins.rgb(skin.cloth);
  const clothShade = shadeOf(skin.cloth);
  const eyeMain = skins.rgb(skin.eye || [70, 55, 48]);
  const eyeDeep = skins.rgb(mixc(skin.eye || [70, 55, 48], [28, 24, 42], 0.55));
  const kind = skin.kind;
  const PI2 = Math.PI * 2;
  const HX = 1;      // 头中心 x（略朝前）
  const HY = -41;    // 头中心 y
  const FACE_R = 13; // 脸半径

  // 坐骑参数与渲染分层（骑乘时远腿在坐骑后、近腿+身体在坐骑前）
  const mountId = o.mount || null;
  const pass = o.pass || 'full';

  ctx.save();
  let lying = false; // 步行铲行：上身绕髋后仰的贴地滑行
  if (sliding && riding) {
    // 骑乘铲行：贴车俯冲——整体缩小+下移贴架+前倾（紧凑低矮的过弯球）
    ctx.scale(0.88, 0.88);
    ctx.translate(5, 10);
    ctx.rotate(0.45);
  } else if (sliding) {
    lying = true;
  }

  // 姿态关键点（骑乘：脚踩踏板/脚蹬、身体前倾、随节奏起伏）
  let f1;
  let f2;
  let h1;
  let h2;
  let rideLean = 0;
  let rideBob = 0;
  let hipSway = 0;
  if (sliding && riding) {
    // 骑乘铲行：蜷缩在车上（脚收向踏板、手压住车把）
    f1 = { x: 5, y: -2 };
    f2 = { x: 9, y: -3 };
    h1 = { x: 16, y: -14 };
    h2 = { x: 19, y: -13 };
  } else if (lying) {
    // 天天酷跑式滑铲：低头前扑贴地——双手越过头顶前伸，双脚拖在身后
    f1 = { x: -10, y: -1.5 };
    f2 = { x: -3, y: -1 };
    h1 = { x: 9, y: -42 };
    h2 = { x: 12, y: -38 };
  } else if (riding) {
    const th = run * 1.5; // 与自行车曲柄/坐骑步频同相
    if (mountId === 'bicycle') {
      // 鹈鹕骑车式：躯干稳定前倾、臀随踏板微移、腿大幅画圆、头不晃
      rideLean = 0.15;
      hipSway = Math.sin(th) * 1.6;
      f1 = { x: 3 + Math.cos(th) * 12, y: 23 + Math.sin(th) * 12 };
      f2 = { x: 3 + Math.cos(th + Math.PI) * 12, y: 23 + Math.sin(th + Math.PI) * 12 };
      h1 = { x: 30, y: -4.5 };
      h2 = { x: 32, y: -2.5 };
      rideBob = Math.sin(th * 2) * 1.2;
    } else if (mountId === 'moto') {
      // 驾驶姿势：深前倾、头压低贴近油箱 + 引擎微振
      rideLean = 0.26;
      f1 = { x: 7, y: -2 };
      f2 = { x: 12, y: -3.5 };
      h1 = { x: 20, y: -11 };
      h2 = { x: 23, y: -12.5 };
      rideBob = grounded ? Math.sin(run * 12) * 0.7 : 0;
    } else {
      // 小马驹 / 小恐龙：随步态起伏，手握缰绳
      rideLean = 0.06 + Math.sin(run * 0.9) * 0.035;
      f1 = { x: 5, y: -3 };
      f2 = { x: 11, y: -5 };
      h1 = { x: 12.5, y: -11 + Math.sin(run * 0.9) * 1.6 };
      h2 = { x: 15.5, y: -8 };
      rideBob = grounded ? -Math.abs(Math.sin(run * 0.9)) * 2.2 : -1.5;
    }
  } else if (grounded) {
    const s = Math.sin(run);
    const c = Math.cos(run);
    f1 = { x: 2 + s * 11, y: -1.5 - Math.max(0, c) * 8 };
    f2 = { x: 2 - s * 11, y: -1.5 - Math.max(0, -c) * 3 };
    h1 = { x: -9 - s * 7.5, y: -13.5 - Math.max(0, c) * 2.5 };  // 手臂与同侧腿反相
    h2 = { x: 9 + s * 7.5, y: -13.5 - Math.max(0, -c) * 2.5 };
  } else {
    // 空中：上升收腿举臂，下落展腿压臂（按垂直速度插值）
    const k = util.clamp(vy / 700, -1, 1);
    const fall = (k + 1) / 2;
    f1 = { x: util.lerp(-3, -6, fall), y: util.lerp(-13, -4, fall) };
    f2 = { x: util.lerp(8, 6, fall), y: util.lerp(-11, -2, fall) };
    h1 = { x: util.lerp(-12, -16, fall), y: util.lerp(-30, -22, fall) };
    h2 = { x: util.lerp(15, 17, fall), y: util.lerp(-28, -20, fall) };
  }
  // （滑铲不再整体旋转：上半身单独后仰变换，见下方上半身块）
  // 上半身起伏（脚保持与踏板/地面接触）
  const upperBob = riding ? rideBob : (lying ? 0 : (grounded ? -Math.abs(Math.sin(run)) * 3 : 0));

  // 身体随骑乘节奏前倾
  if (riding) ctx.rotate(rideLean);

  // ---- 腿 + 鞋（骑乘时分层：远腿在坐骑后、近腿在坐骑前，腿跨在坐骑上） ----
  const drawShoe = (fx, fy) => {
    roundFill(ctx, fx - 2.5, fy - 5.2, 9.5, 5, 2.4, outfit, LINE);
    roundFill(ctx, fx - 3.2, fy - 2.2, 10.5, 2.6, 1.3, LINE, null);
    roundFill(ctx, fx - 1.2, fy - 4.4, 3.2, 1.4, 0.7, outfitLite, null);
  };
  if (riding) {
    // 骑乘：髋部锚定鞍座（自行车随踏板微移）
    const hp1 = mountId === 'bicycle' ? { x: -10 + hipSway, y: -5 } : { x: -4, y: -13 };
    const hp2 = mountId === 'bicycle' ? { x: -6 + hipSway, y: -5 } : { x: 4, y: -13 };
    if (pass !== 'near') limbIK(ctx, hp1.x, hp1.y, f1.x, f1.y - 2, 0.24, 0.9, -0.45, 6, 4.8, 'rgba(200,130,98,0.9)');
    if (pass !== 'far') {
      limbIK(ctx, hp2.x, hp2.y, f2.x, f2.y - 2, 0.24, 0.9, -0.45, 6, 4.8, SKIN_TONE);
      drawShoe(f2.x, f2.y);
    }
    if (pass !== 'near') drawShoe(f1.x, f1.y);
  } else if (sliding) {
    // 铲行：双腿从髋部向后拖（膝盖微拱），髋部已随前扑前移到 8,-5 / 4,-5
    limbIK(ctx, 8, -5, f1.x, f1.y - 2, 0.24, -0.6, -0.8, 6, 4.8, 'rgba(214,141,105,0.9)');
    limbIK(ctx, 4, -5, f2.x, f2.y - 2, 0.24, -0.6, -0.8, 6, 4.8, SKIN_TONE);
    drawShoe(f1.x, f1.y);
    drawShoe(f2.x, f2.y);
  } else if (grounded) {
    // 跑步：膝盖朝前泵动（远腿暗、近腿亮，拉开层次）
    limbIK(ctx, -4, -13, f1.x, f1.y - 2, 0.24, 1, -0.45, 6, 4.8, 'rgba(214,141,105,0.9)');
    limbIK(ctx, 4, -13, f2.x, f2.y - 2, 0.24, 1, -0.45, 6, 4.8, SKIN_TONE);
    drawShoe(f1.x, f1.y);
    drawShoe(f2.x, f2.y);
  } else {
    // 空中：收腿/展腿
    limbIK(ctx, -4, -13, f1.x, f1.y - 2, 0.24, 0.9, -0.4, 6, 4.8, 'rgba(214,141,105,0.9)');
    limbIK(ctx, 4, -13, f2.x, f2.y - 2, 0.24, 0.9, -0.4, 6, 4.8, SKIN_TONE);
    drawShoe(f1.x, f1.y);
    drawShoe(f2.x, f2.y);
  }

  // ---- 上半身（随骑乘节奏起伏；脚不参与；far 层到此为止） ----
  if (pass === 'far') {
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(0, upperBob);
  if (lying) {
    // 滑铲：上身绕髋前扑约 66°——头朝前方、身体平行贴地（天天酷跑式）
    ctx.translate(-12, 1);
    ctx.rotate(1.15);
  }
  if (riding) ctx.scale(1.14, 1.14); // 骑乘时上半身放大：大坐骑上人物比例更协调

  // ---- 脑后发型（带阴影色） ----
  if (kind === 'girl_twintails') {
    const sway = Math.sin(run * 1.2) * 0.14 - (riding ? 0.32 : 0) - util.clamp(vy * 0.0003, -0.3, 0.3);
    for (const s of [{ x: -13.5, r: -0.38 + sway }, { x: 15.5, r: 0.38 + sway }]) {
      ctx.save();
      ctx.translate(s.x, HY + 1);
      ctx.rotate(s.r);
      ctx.beginPath();
      ctx.ellipse(0, 9, 5.6, 14, 0, 0, PI2);
      ctx.fillStyle = hairC;
      ctx.fill();
      // 发丝阴影 + 高光
      ctx.beginPath();
      ctx.ellipse(2, 10, 2.6, 9, 0, 0, PI2);
      ctx.fillStyle = hairShade;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-1.6, 4, 1.4, 6, 0, 0, PI2);
      ctx.fillStyle = hairLite;
      ctx.fill();
      ctx.restore();
    }
  } else if (kind === 'girl_ponytail') {
    const sway = Math.sin(run * 1.2) * 0.17 - util.clamp(vy * 0.0004, -0.38, 0.38);
    ctx.save();
    ctx.translate(-10.5, HY - 6);
    ctx.rotate(-0.62 + sway);
    ctx.beginPath();
    ctx.ellipse(-6, 12, 6.5, 15.5, 0, 0, PI2);
    ctx.fillStyle = hairC;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-2.5, 13, 2.8, 10, 0, 0, PI2);
    ctx.fillStyle = hairShade;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-8, 6, 1.8, 6.5, 0, 0, PI2);
    ctx.fillStyle = hairLite;
    ctx.fill();
    ctx.restore();
  } else if (kind === 'girl_buns') {
    for (const b of [{ x: -8.5 }, { x: 10.5 }]) {
      ctx.beginPath();
      ctx.arc(b.x, HY - 14.5, 6.6, 0, PI2);
      ctx.fillStyle = hairC;
      ctx.fill();
      // 丸子阴影 + 高光卷
      ctx.beginPath();
      ctx.arc(b.x + 1.8, HY - 13, 4, 0, PI2);
      ctx.fillStyle = hairShade;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x - 1.5, HY - 16.2, 2.2, 0, PI2);
      ctx.fillStyle = hairLite;
      ctx.fill();
    }
  } else if (kind === 'boy_hood') {
    ctx.fillStyle = shadeOf(skin.fill);
    ctx.beginPath();
    ctx.arc(HX, HY, 17.5, 0, PI2);
    ctx.fill();
  } else if (kind === 'boy_spiky') {
    ctx.beginPath();
    ctx.arc(HX, HY, FACE_R + 3.4, 0, PI2);
    ctx.fillStyle = hairC;
    ctx.fill();
    for (const sa of [-2.75, -2.35, -0.75, -0.35]) {
      hairSpike(ctx, HX, HY, FACE_R + 2, sa, 9, hairC);
    }
  }

  // ---- 身体（上衣+短裤 / 连衣裙）+ 阴影 + 服装细节 ----
  const isDress = kind === 'girl_ponytail' || kind === 'girl_buns';
  if (isDress) {
    ctx.beginPath();
    ctx.moveTo(-8.5, -27.5);
    ctx.quadraticCurveTo(0, -30, 8.5, -27.5);
    ctx.lineTo(14, -10);
    ctx.quadraticCurveTo(0, -7.5, -13.5, -10);
    ctx.closePath();
    const dressKey = skin.id + '|dress';
    if (!torsoGradCache[dressKey]) {
      const dg2 = ctx.createLinearGradient(0, -28, 0, -9);
      dg2.addColorStop(0, skins.rgb(mixc(skin.fill, [255, 252, 240], 0.2)));
      dg2.addColorStop(1, skins.rgb(skin.fill));
      torsoGradCache[dressKey] = dg2;
    }
    ctx.fillStyle = torsoGradCache[dressKey];
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // 右侧裙身阴影 + 裙褶
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(30,34,60,0.14)';
    ctx.fillRect(4, -32, 12, 24);
    ctx.strokeStyle = 'rgba(30,34,60,0.18)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-4, -24);
    ctx.lineTo(-7, -10);
    ctx.moveTo(4, -24);
    ctx.lineTo(7, -10);
    ctx.stroke();
    ctx.restore();
    roundFill(ctx, -6, -29.5, 12, 4.8, 2.4, cloth, null); // 白领口
  } else {
    const torsoKey = skin.id + '|' + kind;
    if (!torsoGradCache[torsoKey]) {
      const base = kind === 'boy_cap' ? skin.cloth : skin.fill;
      const tg = ctx.createLinearGradient(0, -29, 0, -11);
      tg.addColorStop(0, skins.rgb(mixc(base, [255, 252, 240], 0.22)));
      tg.addColorStop(1, skins.rgb(skin.fill));
      torsoGradCache[torsoKey] = tg;
    }
    roundFill(ctx, -13, -29, 26, 18, 8, torsoGradCache[torsoKey], null);
    // 衣身右侧轮廓光
    ctx.strokeStyle = 'rgba(255,246,230,0.4)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(11.6, -26);
    ctx.quadraticCurveTo(13.2, -20, 11.4, -13);
    ctx.stroke();
    // 右侧衣身阴影
    ctx.save();
    roundFill(ctx, -13, -29, 26, 18, 8, null, null);
    ctx.clip();
    ctx.fillStyle = 'rgba(30,34,60,0.14)';
    ctx.fillRect(4, -31, 12, 24);
    ctx.restore();
    // 颈部落影（头部在躯干上的环境光遮蔽）
    ctx.fillStyle = 'rgba(120,75,55,0.16)';
    ctx.beginPath();
    ctx.ellipse(HX - 1, HY + 16.5, 7.5, 3, 0, 0, PI2);
    ctx.fill();
    if (kind === 'boy_cap') {
      roundFill(ctx, -8.5, -27.5, 17, 11.5, 4.5, outfit, null); // 珊瑚背心
      ctx.fillStyle = LINE; // 背带扣
      ctx.beginPath();
      ctx.arc(-3.5, -25, 1.1, 0, PI2);
      ctx.arc(4, -25, 1.1, 0, PI2);
      ctx.fill();
    }
    if (kind === 'boy_hood') {
      ctx.strokeStyle = cloth; // 帽绳
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-2.5, -25.5);
      ctx.lineTo(-3.2, -20.5);
      ctx.moveTo(5, -25.5);
      ctx.lineTo(5.6, -20.5);
      ctx.stroke();
      ctx.fillStyle = cloth;
      ctx.beginPath();
      ctx.arc(-3.2, -20, 1, 0, PI2);
      ctx.arc(5.6, -20, 1, 0, PI2);
      ctx.fill();
    }
    if (kind === 'girl_twintails') {
      roundFill(ctx, -13, -14.5, 26, 3.4, 1.7, cloth, null); // 裙摆白边
    }
    roundFill(ctx, -10, -13.5, 20, 7, 3.5, darkOf(skin), null); // 短裤
  }

  // ---- 手臂（远臂暗、近臂亮；肘部后弯） ----
  if (riding) {
    limbIK(ctx, -9.5, -23.5, h1.x, h1.y, 0.2, -0.3, 1, 6, 4.6, shadeOf(skin.fill));
    limbIK(ctx, 9.5, -23.5, h2.x, h2.y, 0.2, -0.3, 1, 6, 4.6, outfit);
  } else if (sliding) {
    limbIK(ctx, -9.5, -23.5, h1.x, h1.y, 0.18, -1, 0.15, 6, 4.6, shadeOf(skin.fill));
    limbIK(ctx, 9.5, -23.5, h2.x, h2.y, 0.18, -0.5, 1, 6, 4.6, outfit);
  } else if (grounded) {
    limbIK(ctx, -9.5, -23.5, h1.x, h1.y, 0.26, -1, 0.35, 6, 4.6, shadeOf(skin.fill));
    limbIK(ctx, 9.5, -23.5, h2.x, h2.y, 0.26, -1, 0.35, 6, 4.6, outfit);
  } else {
    limbIK(ctx, -9.5, -23.5, h1.x, h1.y, 0.22, -1, 0.3, 6, 4.6, shadeOf(skin.fill));
    limbIK(ctx, 9.5, -23.5, h2.x, h2.y, 0.22, -1, 0.3, 6, 4.6, outfit);
  }
  // 手
  ctx.fillStyle = SKIN_TONE;
  ctx.beginPath();
  ctx.arc(h1.x, h1.y, 3.2, 0, PI2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(h2.x, h2.y, 3.2, 0, PI2);
  ctx.fill();

  // ---- 头 + 脸部体块阴影 ----
  ctx.beginPath();
  if (kind === 'boy_hood') {
    ctx.arc(HX, HY + 0.5, FACE_R - 0.5, 0, PI2);
  } else {
    ctx.arc(HX, HY + 2.5, FACE_R, 0, PI2);
  }
  ctx.fillStyle = SKIN_TONE;
  ctx.fill();
  ctx.strokeStyle = SKIN_EDGE;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // 头部轮廓光（右上受光边，超采样下可见的细线）
  ctx.strokeStyle = 'rgba(255,246,230,0.55)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(HX, HY + 2.2, FACE_R - 1, Math.PI * 1.42, Math.PI * 1.86);
  ctx.stroke();
  // 左下脸颊阴影（受光自右上）
  ctx.fillStyle = 'rgba(214,141,105,0.22)';
  ctx.beginPath();
  ctx.ellipse(HX - 4, HY + 6, FACE_R * 0.85, FACE_R * 0.55, 0.2, 0, PI2);
  ctx.fill();
  // 左耳
  ctx.beginPath();
  ctx.ellipse(HX - 12.4, HY + 1.5, 2.6, 3.8, 0.1, 0, PI2);
  ctx.fillStyle = SKIN_TONE;
  ctx.fill();
  ctx.strokeStyle = SKIN_EDGE;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // ---- 前层发型 / 帽子 / 兜帽 ----
  if (kind === 'boy_spiky') {
    // 冠部发刺扇（向上炸开的多缕尖刺）
    const fan = [-2.62, -2.28, -1.94, -0.86, -0.52, -0.2];
    fan.forEach((sa, i) => {
      hairSpike(ctx, HX, HY, FACE_R + 0.5, sa, 8 + (i % 2) * 3.5, hairC);
    });
    hairSpike(ctx, HX, HY, FACE_R + 0.5, -1.57, 11.5, hairC);
    // 齿状刘海 + 光泽带
    bangSpikes(ctx, HX, HY + 1, FACE_R - 1.5, hairC, hairLite);
    // 侧发（框脸两缕长刺）
    hairSpike(ctx, HX, HY + 1, FACE_R - 1, Math.PI * 0.92, 13, hairC);
    hairSpike(ctx, HX, HY + 1, FACE_R - 1, Math.PI * 0.08, 13, hairC);
  } else if (kind === 'boy_hood') {
    // 兜帽沿 + 深色刘海
    ctx.strokeStyle = outfit;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(HX, HY + 0.5, FACE_R - 0.5 + 1.8, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();
    zigzag(ctx, HX, HY - 5, FACE_R - 1.5, hairC, 3, 3);
  } else {
    // 女生：尖齿刘海（四缕）+ 光泽带 + 鬓发
    ctx.beginPath();
    ctx.moveTo(HX - FACE_R - 1, HY - 5);
    ctx.lineTo(HX - 9.5, HY - 7.5);
    ctx.quadraticCurveTo(HX - 8, HY - 2.5, HX - 5.5, HY - 4.5);
    ctx.quadraticCurveTo(HX - 4, HY - 1.5, HX - 1.5, HY - 4.5);
    ctx.quadraticCurveTo(HX + 0.5, HY - 1, HX + 3, HY - 4.2);
    ctx.quadraticCurveTo(HX + 4.5, HY - 1.8, HX + 7, HY - 4.5);
    ctx.quadraticCurveTo(HX + 9, HY - 2, HX + 11, HY - 5);
    ctx.lineTo(HX + FACE_R + 1, HY - 5.5);
    ctx.arc(HX, HY, FACE_R + 3, Math.PI * 2.06, Math.PI * 0.94, true);
    ctx.closePath();
    ctx.fillStyle = hairC;
    ctx.fill();
    // 光泽带
    ctx.strokeStyle = hairLite;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(HX, HY + 1, FACE_R + 0.6, Math.PI * 1.28, Math.PI * 1.72);
    ctx.stroke();
    // 鬓发（左长右短）
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.ellipse(-12.6, HY + 4, 2.7, 6.2, 0.1, 0, PI2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(14.2, HY + 4, 2.7, 6.2, -0.1, 0, PI2);
    ctx.fill();
    if (kind === 'girl_ponytail') {
      // 发绳蝴蝶结
      ctx.fillStyle = cloth;
      ctx.beginPath();
      ctx.moveTo(-9.5, HY - 6.5);
      ctx.lineTo(-14, HY - 8.5);
      ctx.lineTo(-13, HY - 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-9.5, HY - 6.5);
      ctx.lineTo(-6, HY - 9);
      ctx.lineTo(-6.5, HY - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = liteOf(skin.cloth);
      ctx.beginPath();
      ctx.arc(-9.5, HY - 6.5, 1.6, 0, PI2);
      ctx.fill();
    }
    if (kind === 'girl_buns') {
      ctx.fillStyle = cloth; // 丸子发饰
      ctx.beginPath();
      ctx.arc(-8.5, HY - 14.5, 2.1, 0, PI2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(10.5, HY - 14.5, 2.1, 0, PI2);
      ctx.fill();
    }
    if (kind === 'girl_twintails') {
      // 双马尾画在前层：高位扎发、明显外扬
      const sway = Math.sin(run * 1.2) * 0.14 - (riding ? 0.3 : 0) - util.clamp(vy * 0.0003, -0.3, 0.3);
      for (const s of [{ x: -17, r: -0.55 + sway }, { x: 19, r: 0.55 + sway }]) {
        ctx.save();
        ctx.translate(s.x, HY - 5);
        ctx.rotate(s.r);
        ctx.beginPath();
        ctx.ellipse(0, 9.5, 5.2, 13, 0, 0, PI2);
        ctx.fillStyle = hairC;
        ctx.fill();
        ctx.strokeStyle = hairShade;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = cloth; // 发绳
        ctx.beginPath();
        ctx.arc(s.x * 0.94, HY - 4, 2.4, 0, PI2);
        ctx.fill();
      }
    }
  }

  // ---- 脸（精致五官） ----
  const look = util.clamp(vy / 900, -1, 1) * 1.4;
  const blink = (t % 3.7) < 0.13;
  const ey = HY + 2.5;

  // 眉毛
  ctx.strokeStyle = hairShade;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(HX - 7, HY - 5.8);
  ctx.quadraticCurveTo(HX - 4.5, HY - 6.8, HX - 2.2, HY - 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(HX + 4.4, HY - 6);
  ctx.quadraticCurveTo(HX + 6.8, HY - 6.6, HX + 9, HY - 5.6);
  ctx.stroke();

  // 眼睛（睫毛线 + 双色虹膜 + 双高光）
  for (const ex of [HX - 4.7, HX + 6.2]) {
    if (blink) {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey - 1, 3.2, Math.PI * 0.14, Math.PI * 0.86);
      ctx.stroke();
      continue;
    }
    // 眼白（竖椭圆）
    ctx.beginPath();
    ctx.ellipse(ex, ey, 3.0, 4.2, 0, 0, PI2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    // 虹膜：垂直渐变（上深下亮，动漫眼核心特征）
    const ig = ctx.createLinearGradient(0, ey - 3.2, 0, ey + 3.6);
    ig.addColorStop(0, eyeDeep);
    ig.addColorStop(0.5, eyeMain);
    ig.addColorStop(1, skins.rgb(mixc(skin.eye || [70, 55, 48], [255, 255, 230], 0.45)));
    ctx.beginPath();
    ctx.ellipse(ex + 0.4, ey + 0.4, 2.55, 3.3, 0, 0, PI2);
    ctx.fillStyle = ig;
    ctx.fill();
    // 瞳孔
    ctx.beginPath();
    ctx.arc(ex + 0.6, ey + 0.6, 1.35, 0, PI2);
    ctx.fillStyle = '#241C18';
    ctx.fill();
    // 瞳孔底缘反光
    ctx.beginPath();
    ctx.arc(ex + 0.6, ey + 1.7, 0.9, 0, PI2);
    ctx.fillStyle = 'rgba(255,255,240,0.35)';
    ctx.fill();
    // 双高光（大上 + 小下）
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - 0.7, ey - 1.2, 1.2, 0, PI2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + 1.6, ey + 0.7, 0.62, 0, PI2);
    ctx.fill();
    // 上睫毛：填充楔形（外眼角加厚上挑）
    ctx.fillStyle = LINE;
    ctx.beginPath();
    ctx.moveTo(ex - 3.1, ey - 2.5);
    ctx.quadraticCurveTo(ex, ey - 5.4, ex + 3.1, ey - 2.3);
    ctx.lineTo(ex + 3.9, ey - 3.9);
    ctx.quadraticCurveTo(ex + 0.4, ey - 6.4, ex - 3.5, ey - 3.8);
    ctx.closePath();
    ctx.fill();
    // 下眼睑（极淡）
    ctx.strokeStyle = 'rgba(139,90,60,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ex, ey - 0.5, 3.6, Math.PI * 0.3, Math.PI * 0.7);
    ctx.stroke();
  }

  // 鼻尖（一个小点）
  ctx.fillStyle = 'rgba(190,115,75,0.75)';
  ctx.beginPath();
  ctx.arc(HX + 3.4, HY + 3.2, 0.9, 0, PI2);
  ctx.fill();

  // 开心的小嘴（开口 + 舌头）
  ctx.beginPath();
  ctx.arc(HX + 3.2, HY + 6.8, 2.7, Math.PI * 0.1, Math.PI * 0.9);
  ctx.closePath();
  ctx.fillStyle = '#B8483A';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(HX + 3.2, HY + 8, 1.7, Math.PI, PI2);
  ctx.closePath();
  ctx.fillStyle = '#E8836B';
  ctx.fill();

  // 腮红（柔边径向渐变，超采样下自然过渡）
  for (const bx of [HX - 9, HX + 10.5]) {
    const bl = ctx.createRadialGradient(bx, HY + 6, 0.4, bx, HY + 6, 3.8);
    bl.addColorStop(0, 'rgba(255,120,110,0.38)');
    bl.addColorStop(1, 'rgba(255,120,110,0)');
    ctx.fillStyle = bl;
    ctx.beginPath();
    ctx.arc(bx, HY + 6, 3.8, 0, PI2);
    ctx.fill();
  }

  ctx.restore(); // 上半身起伏

  ctx.restore(); // 铲行压缩
}

// 动漫发刺：从头皮沿角度 a 长出的弯曲尖刺（一缕头发）
function hairSpike(ctx, cx, cy, r, a, len, color) {
  const tx = cx + Math.cos(a) * (r + len);
  const ty = cy + Math.sin(a) * (r + len);
  const b1x = cx + Math.cos(a - 0.3) * (r - 2);
  const b1y = cy + Math.sin(a - 0.3) * (r - 2);
  const b2x = cx + Math.cos(a + 0.3) * (r - 2);
  const b2y = cy + Math.sin(a + 0.3) * (r - 2);
  ctx.beginPath();
  ctx.moveTo(b1x, b1y);
  ctx.quadraticCurveTo(
    cx + Math.cos(a - 0.1) * (r + len * 0.62),
    cy + Math.sin(a - 0.1) * (r + len * 0.62),
    tx, ty
  );
  ctx.quadraticCurveTo(
    cx + Math.cos(a + 0.12) * (r + len * 0.55),
    cy + Math.sin(a + 0.12) * (r + len * 0.55),
    b2x, b2y
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// 齿状刘海：额头上一排向下弯尖（动漫刘海）
function bangSpikes(ctx, cx, cy, r, color, lite) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - r - 1.5, cy - 3);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const x0 = cx - r + (i * 2 * r) / n;
    const x1 = cx - r + ((i + 1) * 2 * r) / n;
    ctx.quadraticCurveTo((x0 + x1) / 2, cy + 7.5 + (i % 2) * 2.2, x1, cy - 1.5);
  }
  ctx.lineTo(cx + r + 1.5, cy - 4);
  ctx.arc(cx, cy - 5, r + 1.4, 0, Math.PI, true);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = lite;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy - 4, r + 0.2, Math.PI * 1.25, Math.PI * 1.62);
  ctx.stroke();
}

// 刘海锯齿（帽檐/兜帽下露出的碎发）
function zigzag(ctx, cx, cy, r, color, n, drop) {
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  const step = (r * 2) / (n * 2 - 1);
  for (let i = 1; i <= n * 2 - 1; i++) {
    const x = cx - r + step * i;
    ctx.lineTo(x, i % 2 === 1 ? cy + drop : cy);
  }
  ctx.lineTo(cx + r, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function darkOf(skin) {
  return skins.rgb(skin.dark);
}

// 躯干渐变缓存（按 皮肤id+款式 键控；同一画布上复用）
const torsoGradCache = {};

// ---- 姿势超采样缓存：每个（皮肤,姿势）预渲染到 3 倍分辨率离屏画布 ----
// 主循环只做 drawImage 缩放贴图：边缘平滑、细节精致、渲染成本反而更低
const POSE_SCALE = 3;
const POSE_BOX_W = 44;  // 精灵框宽（骑乘踏板下探到 +35，故框比站立人物大）
const POSE_BOX_H = 104; // 精灵框高（原点上方 64、下方 40）
const POSE_OX = 22;     // 原点（脚底/鞍座）在框内 x
const POSE_OY = 64;     // 原点在框内 y
const poseCache = new Map();
if (typeof window !== 'undefined') window.__poseCache = poseCache; // 调试用

function poseCanvas(skin, key, drawFn) {
  const id = skin.id + '|' + key;
  let c = poseCache.get(id);
  if (!c) {
    c = (typeof wx !== 'undefined' && wx.createCanvas)
      ? wx.createCanvas()
      : document.createElement('canvas');
    c.width = POSE_BOX_W * POSE_SCALE;
    c.height = POSE_BOX_H * POSE_SCALE;
    const pctx = c.getContext('2d');
    pctx.scale(POSE_SCALE, POSE_SCALE);
    pctx.translate(POSE_OX, POSE_OY);
    drawFn(pctx);
    poseCache.set(id, c);
  }
  return c;
}

// 两段式胶囊肢体：根→关节→端点；近端粗、远端细、关节圆平滑过渡
function limbIK(ctx, x0, y0, x1, y1, bend, bdx, bdy, wNear, wFar, color) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d = Math.max(6, Math.sqrt(dx * dx + dy * dy));
  const mx = (x0 + x1) / 2 + bdx * bend * d;
  const my = (y0 + y1) / 2 + bdy * bend * d;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = wNear;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(mx, my);
  ctx.stroke();
  ctx.lineWidth = wFar;
  ctx.beginPath();
  ctx.moveTo(mx, my);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(mx, my, wNear * 0.46, 0, Math.PI * 2);
  ctx.fill();
}

// 圆角矩形填充/描边小工具
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

Player.drawChibi = drawChibi;

module.exports = Player;
