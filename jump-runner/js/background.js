// 视差滚动背景：天空渐变、日月星辰、云、远山、近丘
// 提供 4 套配色（正午/黄昏/深夜/清晨），按里程循环过渡
const util = require('./util');

const THEMES = [
  { // 正午
    skyTop: [64, 164, 255], skyBot: [173, 224, 252], sun: [255, 238, 150],
    moon: 0, cloud: 1, star: 0,
    m1: [116, 196, 166], m2: [82, 170, 132],
    grass: [106, 200, 106], grassDark: [80, 170, 84], dirt: [214, 176, 132],
  },
  { // 黄昏
    skyTop: [64, 77, 140], skyBot: [255, 160, 102], sun: [255, 196, 120],
    moon: 0.3, cloud: 0.7, star: 0.3,
    m1: [142, 110, 150], m2: [100, 80, 120],
    grass: [150, 160, 90], grassDark: [120, 132, 72], dirt: [180, 140, 110],
  },
  { // 深夜
    skyTop: [10, 16, 44], skyBot: [42, 60, 100], sun: [240, 240, 220],
    moon: 1, cloud: 0.25, star: 1,
    m1: [52, 64, 96], m2: [36, 46, 72],
    grass: [70, 96, 80], grassDark: [54, 76, 64], dirt: [110, 96, 88],
  },
  { // 清晨
    skyTop: [120, 170, 230], skyBot: [255, 214, 170], sun: [255, 230, 160],
    moon: 0.15, cloud: 0.85, star: 0.1,
    m1: [140, 180, 170], m2: [104, 152, 136],
    grass: [120, 190, 110], grassDark: [94, 162, 88], dirt: [206, 170, 130],
  },
];

// 按里程(米)混合配色，每 300 米进入下一时段
function getTheme(score) {
  const pos = (score / 300) % THEMES.length;
  const q = Math.round(pos * 20) / 20; // 量化到 20 步：同一步内颜色不变，渐变可按 key 缓存
  const i = Math.floor(q);
  const t = q - i;
  const a = THEMES[i % THEMES.length];
  const b = THEMES[(i + 1) % THEMES.length];
  const out = {};
  for (const k in a) {
    out[k] = Array.isArray(a[k]) ? util.lerpColor(a[k], b[k], t) : util.lerp(a[k], b[k], t);
  }
  return out;
}

class Background {
  constructor(W, H, groundY) {
    this.W = W;
    this.H = H;
    this.groundY = groundY;
    // 云和星星数量随视野宽度增减（横屏逻辑宽度更大）
    const spread = Math.max(1, W / 390);
    this.clouds = [];
    for (let i = 0; i < Math.round(6 * spread); i++) {
      this.clouds.push({
        x: Math.random() * W,
        y: H * 0.06 + Math.random() * H * 0.24,
        s: 0.6 + Math.random() * 0.8,
        v: 8 + Math.random() * 14,
      });
    }
    this.stars = [];
    for (let i = 0; i < Math.round(42 * spread); i++) {
      this.stars.push({
        x: util.hash(i) * W,
        y: util.hash(i + 100) * H * 0.5,
        r: 0.6 + util.hash(i + 200) * 1.4,
        tw: Math.random() * 6.28,
      });
    }
  }

  update(dt, speed) {
    for (const c of this.clouds) {
      c.x -= (c.v + speed * 0.08) * dt;
      if (c.x < -60 * c.s) {
        c.x = this.W + 60 * c.s;
        c.y = this.H * 0.06 + Math.random() * this.H * 0.24;
      }
    }
  }

  draw(ctx, scroll, theme, time) {
    const W = this.W;
    const gy = this.groundY;

    // 天空（铺满全屏；主题量化后按 key 缓存渐变，避免每帧重建）
    const skyKey = this.H + '|' + theme.skyTop.join(',') + theme.skyBot.join(',');
    if (!this._sky || this._sky.key !== skyKey) {
      const g = ctx.createLinearGradient(0, 0, 0, this.H);
      g.addColorStop(0, util.rgbStr(util.lerpColor(theme.skyTop, [10, 14, 40], 0.16)));
      g.addColorStop(0.55, util.rgbStr(theme.skyTop));
      g.addColorStop(1, util.rgbStr(theme.skyBot));
      this._sky = { key: skyKey, g };
    }
    ctx.fillStyle = this._sky.g;
    ctx.fillRect(0, 0, W, this.H);

    // 星星
    if (theme.star > 0.03) {
      ctx.fillStyle = '#FFFFFF';
      for (const s of this.stars) {
        ctx.globalAlpha = theme.star * (0.4 + 0.6 * Math.abs(Math.sin(time * 1.6 + s.tw)));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 太阳（带缓慢旋转的光芒）/ 月亮 —— 错开位置，避免昼夜交替时叠成"日食"
    const sunX = W * 0.68;
    const moonX = W * 0.84;
    if (theme.moon < 0.75) {
      const a = 1 - theme.moon;
      const sx = sunX;
      const sy = this.H * 0.15;
      // 光芒
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(time * 0.06);
      ctx.fillStyle = util.rgbStr(theme.sun, 0.09 * a);
      for (let i = 0; i < 10; i++) {
        ctx.rotate((Math.PI * 2) / 10);
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.arc(0, 0, 58, -0.13, 0.13);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // 大范围柔光晕（缓存径向渐变）
      const bloomKey = theme.sun.join(',') + '|' + sx + '|' + sy;
      if (!this._bloom || this._bloom.key !== bloomKey) {
        const bl = ctx.createRadialGradient(sx, sy, 6, sx, sy, 150);
        bl.addColorStop(0, util.rgbStr(theme.sun, 0.4));
        bl.addColorStop(0.5, util.rgbStr(theme.sun, 0.12));
        bl.addColorStop(1, util.rgbStr(theme.sun, 0));
        this._bloom = { key: bloomKey, g: bl };
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = this._bloom.g;
      ctx.beginPath();
      ctx.arc(sx, sy, 150, 0, Math.PI * 2);
      ctx.fill();
      // 本体：径向渐变（中心偏白 → 边缘主题色，无硬边贴纸感）
      const bodyKey = 'sun|' + theme.sun.join(',');
      if (!this._sunBody || this._sunBody.key !== bodyKey) {
        const sb = ctx.createRadialGradient(sx - 6, sy - 6, 3, sx, sy, 26);
        sb.addColorStop(0, util.rgbStr(util.lerpColor(theme.sun, [255, 253, 240], 0.75)));
        sb.addColorStop(0.65, util.rgbStr(util.lerpColor(theme.sun, [255, 250, 225], 0.35)));
        sb.addColorStop(1, util.rgbStr(theme.sun));
        this._sunBody = { key: bodyKey, g: sb };
      }
      ctx.fillStyle = this._sunBody.g;
      ctx.beginPath();
      ctx.arc(sx, sy, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (theme.moon > 0.25) {
      ctx.globalAlpha = theme.moon;
      ctx.fillStyle = '#F6F3D5';
      ctx.beginPath();
      ctx.arc(moonX, this.H * 0.13, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = util.rgbStr(theme.skyTop);
      ctx.beginPath();
      ctx.arc(moonX + 9, this.H * 0.13 - 5, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 积云：上圆下平（圆团顶部 + 平直云底）+ 底部灰蓝阴影 + 顶部暖受光
    for (const c of this.clouds) {
      ctx.globalAlpha = 0.9 * theme.cloud;
      const cloudShade = util.rgbStr(util.lerpColor(theme.skyBot, [96, 116, 152], 0.55), 0.85);
      // 三圆鼓包 + 平底的云形
      const bumps = (ox, oy, k) => {
        ctx.beginPath();
        ctx.arc(ox - 13 * c.s, oy + 1 * c.s, 9.5 * c.s * k, Math.PI, Math.PI * 1.95);
        ctx.arc(ox - 1 * c.s, oy - 5 * c.s, 12 * c.s * k, Math.PI * 1.02, Math.PI * 1.85);
        ctx.arc(ox + 12 * c.s, oy + 0.5 * c.s, 8.5 * c.s * k, Math.PI * 1.1, Math.PI * 1.98);
        ctx.closePath();
        ctx.fill();
      };
      // 阴影层（平底略低，露出云底阴影）
      ctx.fillStyle = cloudShade;
      bumps(c.x, c.y + 2.5 * c.s, 1);
      ctx.fillRect(c.x - 20 * c.s, c.y + 2 * c.s, 40 * c.s, 5 * c.s);
      // 白色主体（略上移缩小，底部留出阴影条）
      ctx.fillStyle = '#FFFFFF';
      bumps(c.x, c.y, 0.94);
      ctx.fillRect(c.x - 18.5 * c.s, c.y - 0.5 * c.s, 37 * c.s, 4.2 * c.s);
      // 顶部暖受光弧
      ctx.strokeStyle = 'rgba(255,250,232,0.6)';
      ctx.lineWidth = 2.2 * c.s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(c.x - 1 * c.s, c.y - 4 * c.s, 9.4 * c.s, Math.PI * 1.22, Math.PI * 1.62);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 远处雁群（约 80 秒飘过一群，天空的氛围感）
    const flockX = this.W + 160 - ((time * 14) % (this.W + 340));
    const flockY = this.H * 0.15;
    ctx.strokeStyle = util.rgbStr(util.lerpColor([72, 92, 112], theme.skyTop, 0.4), 0.65);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const bxp = flockX + (i % 2) * 15 - i * 11;
      const byp = flockY + i * 7.5;
      const flap = Math.sin(time * 7 + i * 1.3) * 2.6;
      ctx.beginPath();
      ctx.moveTo(bxp - 5, byp);
      ctx.quadraticCurveTo(bxp - 2.2, byp - 2.6 - flap, bxp, byp);
      ctx.quadraticCurveTo(bxp + 2.2, byp - 2.6 - flap, bxp + 5, byp);
      ctx.stroke();
    }

    // 远山（三角 + 雪顶）—— 颜色向天空退色，做出空气透视
    this.drawRange(
      ctx, scroll * 0.25, 320, 70, 130,
      util.rgbStr(util.lerpColor(theme.m1, theme.skyBot, 0.28)),
      util.rgbStr(util.lerpColor(util.lerpColor(theme.m1, theme.skyBot, 0.28), [255, 250, 235], 0.2))
    );
    // 近丘（圆弧）+ 松树
    this.drawHills(
      ctx, scroll * 0.5, 240, 34, 72,
      util.rgbStr(util.lerpColor(theme.m2, theme.skyBot, 0.12)), theme,
      util.rgbStr(util.lerpColor(util.lerpColor(theme.m2, theme.skyBot, 0.12), [255, 252, 240], 0.28))
    );
    // 地平线雾气带（山脚与地面衔接处，远处朦胧；同样缓存）
    const fogKey = gy + '|' + theme.skyBot.join(',');
    if (!this._fog || this._fog.key !== fogKey) {
      const fog = ctx.createLinearGradient(0, gy - 66, 0, gy + 2);
      fog.addColorStop(0, util.rgbStr(theme.skyBot, 0));
      fog.addColorStop(1, util.rgbStr(theme.skyBot, 0.5));
      this._fog = { key: fogKey, g: fog };
    }
    ctx.fillStyle = this._fog.g;
    ctx.fillRect(0, gy - 66, W, 68);
    // 前景草（比地面更快的视差，压在画面最底边）
    this.drawForeground(ctx, scroll, theme);
  }

  drawRange(ctx, world, period, minH, maxH, color, lightColor) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const peaks = [];
    const base = Math.floor((world - period) / period);
    const count = Math.ceil((this.W + period * 2) / period) + 1;
    for (let i = 0; i < count; i++) {
      const idx = base + i;
      const sx = idx * period - world;
      const h = minH + util.hash(idx) * (maxH - minH);
      const bw = period * 0.62;
      const shoulder = (util.hash(idx + 3) - 0.5) * 8; // 主峰两侧不对称的肩部
      // 曲线山脊：左坡微凹上扬 → 圆润主峰 → 次峰肩 → 右坡下降（不是折纸直线三角）
      ctx.moveTo(sx - bw, this.groundY + 4);
      ctx.quadraticCurveTo(sx - bw * 0.42, this.groundY + 4 - h * 0.52, sx - bw * 0.16 + shoulder, this.groundY + 4 - h * 0.86);
      ctx.quadraticCurveTo(sx - bw * 0.05, this.groundY - h - 2, sx + bw * 0.07, this.groundY + 4 - h * 0.9);
      ctx.quadraticCurveTo(sx + bw * 0.34 + shoulder, this.groundY + 4 - h * 0.42, sx + bw * 0.6, this.groundY + 4 - h * 0.18);
      ctx.quadraticCurveTo(sx + bw * 0.78, this.groundY + 4 - h * 0.06, sx + bw, this.groundY + 4);
      peaks.push({ x: sx, y: this.groundY - h - 2, h, w: bw });
    }
    ctx.fill();
    // 朝阳亮面（山体右侧受光，双色调体积感）
    if (lightColor) {
      ctx.fillStyle = lightColor;
      ctx.beginPath();
      for (const p of peaks) {
        ctx.moveTo(p.x + 2, p.y + 4);
        ctx.quadraticCurveTo(p.x + p.w * 0.42, this.groundY + 4 - p.h * 0.34, p.x + p.w * 0.66, this.groundY + 4);
        ctx.lineTo(p.x + p.w * 0.1, this.groundY + 4);
        ctx.closePath();
      }
      ctx.fill();
    }
    // 雪顶（只给高山，白天更明显）
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const p of peaks) {
      if (p.h < 90) continue;
      const cw = 12 + p.h * 0.12;
      const ch = 10 + p.h * 0.1;
      ctx.beginPath();
      ctx.moveTo(p.x - cw, p.y + ch);
      ctx.lineTo(p.x - cw * 0.4, p.y + ch * 0.55);
      ctx.lineTo(p.x, p.y + ch);
      ctx.lineTo(p.x + cw * 0.4, p.y + ch * 0.5);
      ctx.lineTo(p.x + cw, p.y + ch);
      ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawHills(ctx, world, period, minR, maxR, color, theme, rimColor) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const base = Math.floor((world - period) / period);
    const count = Math.ceil((this.W + period * 2) / period) + 1;
    const hills = [];
    for (let i = 0; i < count; i++) {
      const idx = base + i;
      const cx = idx * period - world;
      const r = minR + util.hash(idx + 50) * (maxR - minR);
      ctx.moveTo(cx - r, this.groundY + 2);
      ctx.arc(cx, this.groundY + 2, r, Math.PI, 0);
      hills.push({ cx, r, idx });
    }
    ctx.fill();
    // 顶部轮廓光（受光边）
    if (rimColor) {
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = 2.2;
      for (const hl of hills) {
        ctx.beginPath();
        ctx.arc(hl.cx, this.groundY + 2, hl.r - 1, Math.PI * 1.2, Math.PI * 1.8);
        ctx.stroke();
      }
    }
    // 丘上的松树（确定性分布）
    if (!theme) return;
    const dark = util.rgbStr(util.lerpColor(theme.m2, [16, 42, 30], 0.45));
    ctx.fillStyle = dark;
    for (const hl of hills) {
      const n = util.hash(hl.idx + 7) > 0.4 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const rx = hl.cx + (util.hash(hl.idx * 3 + k) - 0.5) * hl.r * 1.1;
        if (rx < -20 || rx > this.W + 20) continue;
        const th = 16 + util.hash(hl.idx + k) * 14;
        ctx.beginPath();
        ctx.moveTo(rx - 4.5, this.groundY + 2);
        ctx.lineTo(rx, this.groundY + 2 - th);
        ctx.lineTo(rx + 4.5, this.groundY + 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(rx - 1, this.groundY - 2, 2, 5);
      }
    }
  }

  // 前景草：屏幕最底边的深色草影，滚动速度 1.18 倍，增强纵深
  drawForeground(ctx, scroll, theme) {
    const world = scroll * 1.18;
    const period = 88;
    const base = Math.floor((world - period) / period);
    const count = Math.ceil((this.W + period * 2) / period) + 1;
    ctx.fillStyle = util.rgbStr(util.lerpColor(theme.grass, [18, 56, 40], 0.5));
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const idx = base + i;
      const cx = idx * period - world;
      const r = 26 + util.hash(idx + 11) * 22;
      ctx.moveTo(cx - r, this.H + 2);
      ctx.arc(cx, this.H + 2, r, Math.PI, 0);
    }
    ctx.fill();
  }
}

module.exports = { Background, getTheme, THEMES };
