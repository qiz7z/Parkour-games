// 世界：地面分段（含深坑）、障碍、金币的程序化生成 + 碰撞检测
// 坐标约定：世界坐标向右增长，scroll 为已滚动距离，屏幕 x = 世界 x - scroll
const util = require('./util');

class World {
  constructor(W, H, groundY) {
    this.W = W;
    this.H = H;
    this.groundY = groundY;
    this.reset();
  }

  reset() {
    this.scroll = 0;
    this.segments = [];
    this.pits = [];
    this.obstacles = [];
    this.coins = [];
    this.items = [];
    this.cursor = 0;
    this.currentSeg = { x: 0, w: 0 };
    this.segments.push(this.currentSeg);
    // 开局安全跑道：至少覆盖整个视野（横屏逻辑宽度更大），保证菜单/起跑脚下有地
    this.advance(Math.max(1000, this.W + 200));
    this.patternCount = 0;
  }

  // 光标前进 dx，并把当前地面段延伸到光标处
  advance(dx) {
    this.cursor += dx;
    this.currentSeg.w = this.cursor - this.currentSeg.x;
  }

  // 挖一个坑：封住当前地面段，坑后开启新段
  startPit(width) {
    this.pits.push({ x: this.cursor, w: width });
    const seg = { x: this.cursor + width, w: 0 };
    this.segments.push(seg);
    this.currentSeg = seg;
    this.cursor += width;
  }

  coinArc(cx, peakY, n, spread) {
    const baseY = this.groundY - 42;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5; // -0.5 .. 0.5
      const y = peakY + (2 * t) * (2 * t) * (baseY - peakY);
      this.coins.push({ x: cx + t * spread * 2, y, r: 11, taken: false, phase: Math.random() * 6.28 });
    }
  }

  coinLine(x, n, y) {
    for (let i = 0; i < n; i++) {
      this.coins.push({ x: x + i * 34, y, r: 11, taken: false, phase: Math.random() * 6.28 });
    }
  }

  // 按难度生成下一组障碍/坑/金币
  spawnPattern(speed, diff) {
    this.patternCount++;
    const early = this.patternCount <= 3;
    let kind = 'spikes';
    const r = Math.random();
    if (r < 0.26) kind = 'spikes';
    else if (r < 0.44) kind = 'crate';
    else if (r < 0.54 && diff > 0.1 && this.patternCount > 5) kind = 'plat';
    else if (r < 0.62 && diff > 0.12) kind = 'stack';
    else if (r < 0.7 && diff > 0.15 && this.patternCount > 8) kind = 'sign';
    else if (r < 0.78 && diff > 0.22 && this.patternCount > 10) kind = 'bird';
    else if (r < 0.88 && diff > 0.08) kind = 'pit';
    else kind = 'coinLine';
    if (early) kind = 'spikes';
    if (kind === 'stack' || kind === 'pit') {
      if (diff < 0.1) kind = 'spikes';
    }

    if (kind === 'spikes') {
      const n = early ? 1 : (diff > 0.5 && Math.random() < 0.4 ? 2 : 1);
      for (let i = 0; i < n; i++) {
        this.obstacles.push({ type: 'spike', x: this.cursor + i * 24, w: 24, h: 30 });
      }
      if (Math.random() < 0.5) {
        this.coinArc(this.cursor + n * 12, this.groundY - 125, 5, 110);
      }
      this.advance(n * 24);
    } else if (kind === 'crate') {
      this.obstacles.push({ type: 'crate', x: this.cursor, w: 38, h: 38 });
      if (Math.random() < 0.5) {
        this.coinArc(this.cursor + 19, this.groundY - 120, 3, 60);
      }
      this.advance(38);
    } else if (kind === 'stack') {
      this.obstacles.push({ type: 'crate', x: this.cursor, w: 38, h: 76 });
      this.coinArc(this.cursor + 19, this.groundY - 150, 3, 60);
      this.advance(38);
    } else if (kind === 'plat') {
      // 平台箱：从上方落下可站（绿色 + 上箭头），顶上放金币奖励
      this.obstacles.push({ type: 'plat', x: this.cursor, w: 46, h: 46 });
      this.coinLine(this.cursor + 7, 3, this.groundY - 46 - 28);
      this.advance(46);
    } else if (kind === 'sign') {
      // 无人机广告牌：低空悬停，必须滑铲通过
      this.obstacles.push({ type: 'sign', x: this.cursor, w: 90, h: 160, gap: 30 });
      this.advance(90);
    } else if (kind === 'bird') {
      // 低空飞鸟：滑铲从下方通过，或看准时机跳过
      this.obstacles.push({ type: 'bird', x: this.cursor, w: 34, h: 95, gap: 30 });
      this.advance(34);
    } else if (kind === 'pit') {
      const width = Math.min(160, 70 + 45 * diff + util.rand(0, 30));
      if (Math.random() < 0.7) {
        this.coinArc(this.cursor + width / 2, this.groundY - 135, 5, width / 2 + 40);
      }
      this.startPit(width);
    } else { // coinLine
      this.coinLine(this.cursor + 10, 4, this.groundY - 48);
      this.advance(4 * 34 + 10);
    }

    // 模式之间的间隔：保证玩家有反应时间
    let gap = speed * (0.62 - 0.18 * diff) * util.rand(0.9, 1.25) + 50;
    if (kind === 'pit') gap += 60;
    // 间隔中偶尔放一个道具（护盾/磁铁）
    if (!early && Math.random() < 0.09) {
      this.items.push({
        type: Math.random() < 0.5 ? 'shield' : 'magnet',
        x: this.cursor + gap * 0.55,
        y: this.groundY - (Math.random() < 0.5 ? 44 : 100),
        taken: false,
        phase: Math.random() * 6.28,
      });
    }
    this.advance(gap);
  }

  fillAhead(speed, diff) {
    const need = this.scroll + this.W + 800;
    while (this.cursor < need) {
      this.spawnPattern(speed, diff);
    }
  }

  update(scroll, speed, diff) {
    this.scroll = scroll;
    this.fillAhead(speed, diff);
    // 清理滚出屏幕左侧的对象
    this.segments = this.segments.filter(s => s.x + s.w > scroll - 80);
    this.pits = this.pits.filter(p => p.x + p.w > scroll - 80);
    this.obstacles = this.obstacles.filter(o => o.x + o.w > scroll - 120);
    this.coins = this.coins.filter(c => !c.taken && c.x > scroll - 80);
    this.items = this.items.filter(it => !it.taken && it.x > scroll - 80);
  }

  pitAt(worldX) {
    for (const p of this.pits) {
      if (worldX > p.x && worldX < p.x + p.w) return p;
    }
    return null;
  }

  overGround(worldX) {
    return worldX > 0 && !this.pitAt(worldX);
  }

  // 玩家碰撞检测：hit 为命中的障碍，coins/items 为本帧吃到的金币/道具
  collide(player) {
    const res = { hit: null, coins: [], items: [] };
    const sliding = player.slide > 0;
    let bx = player.x - 12;
    let by = sliding ? player.y - 16 : player.y - 40;
    const bw = 24;
    let bh = sliding ? 14 : 38;
    // 骑乘碰撞规则：站立时坐骑身体（鞍座到接触面）延伸碰撞盒——尖刺/木箱/广告牌都命中坐骑；
    // 滑铲时用贴地低盒——可从广告牌下钻过（与步行滑铲一致）
    if (player.mountBody && player.mountBodyH) {
      if (sliding) {
        const surface = player.y + player.mountBodyH;
        by = surface - 16;
        bh = 14;
      } else {
        const extend = player.y + player.mountBodyH - (by + bh);
        if (extend > 0) bh += extend;
      }
    }
    for (const o of this.obstacles) {
      const sx = o.x - this.scroll;
      if (sx > player.x + 80) continue; // 还在玩家右侧远处
      let ox;
      let oy;
      let ow;
      let oh;
      if (o.type === 'spike') {
        // 三角形障碍判定盒收窄，手感更公平
        ox = sx + 5;
        ow = o.w - 10;
        oh = o.h * 0.75;
        oy = this.groundY - oh;
      } else {
        // gap = 底部通行空间（滑铲从下方通过）
        ox = sx + (o.type === 'crate' ? 3 : 0);
        ow = o.w - (o.type === 'crate' ? 6 : 0);
        oy = this.groundY - o.h;
        oh = o.h - (o.gap || 0);
      }
      if (util.aabb(bx, by, bw, bh, ox, oy, ow, oh)) {
        res.hit = o;
        break;
      }
    }
    for (const c of this.coins) {
      if (c.taken) continue;
      const sx = c.x - this.scroll;
      if (sx < player.x - 40 || sx > player.x + 40) continue;
      const dx = sx - player.x;
      const dy = c.y - (player.y - 22);
      if (dx * dx + dy * dy < 900) {
        c.taken = true;
        res.coins.push(c);
      }
    }
    for (const it of this.items) {
      if (it.taken) continue;
      const sx = it.x - this.scroll;
      if (sx < player.x - 40 || sx > player.x + 40) continue;
      const dx = sx - player.x;
      const dy = it.y - (player.y - 22);
      if (dx * dx + dy * dy < 34 * 34) {
        it.taken = true;
        res.items.push(it);
      }
    }
    return res;
  }

  // 站立状态下头顶是否有广告牌压着（滑铲结束前需要保持低姿）
  signBlocking(player) {
    const bx = player.x - 12;
    const by = player.y - 40;
    for (const o of this.obstacles) {
      if (o.type !== 'sign') continue;
      const sx = o.x - this.scroll;
      if (sx > player.x + 80 || sx + o.w < player.x - 20) continue;
      if (util.aabb(bx, by, 24, 38, sx, this.groundY - o.h, o.w, o.h - (o.gap || 0))) return true;
    }
    return false;
  }

  draw(ctx, theme, time) {
    const scroll = this.scroll;
    const gy = this.groundY;

    // 深坑：深色渐变表现纵深
    for (const p of this.pits) {
      const sx = p.x - scroll;
      if (sx > this.W || sx + p.w < 0) continue;
      const grad = ctx.createLinearGradient(0, gy, 0, this.H);
      grad.addColorStop(0, 'rgba(38,28,22,0.95)');
      grad.addColorStop(1, 'rgba(14,10,8,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(sx, gy, p.w, this.H - gy);
    }

    // 土层渐变（主题量化后整帧复用一份）
    const gkey = theme.dirt.join(',') + '|' + this.H;
    if (!this._gg || this._gg.key !== gkey) {
      const dg = ctx.createLinearGradient(0, gy, 0, this.H);
      dg.addColorStop(0, util.rgbStr(util.lerpColor(theme.dirt, [255, 255, 255], 0.22)));
      dg.addColorStop(0.45, util.rgbStr(theme.dirt));
      dg.addColorStop(1, util.rgbStr(util.lerpColor(theme.dirt, [92, 58, 40], 0.4)));
      this._gg = { key: gkey, dg };
    }
    ctx.fillStyle = this._gg.dg;

    // 草皮带渐变（缓存）
    const grassKey = theme.grass.join(',') + theme.grassDark.join(',');
    if (!this._grass || this._grass.key !== grassKey) {
      const gg2 = ctx.createLinearGradient(0, gy, 0, gy + 15);
      gg2.addColorStop(0, util.rgbStr(util.lerpColor(theme.grass, [255, 255, 255], 0.24)));
      gg2.addColorStop(1, util.rgbStr(theme.grass));
      this._grass = { key: grassKey, g: gg2 };
    }

    // 地面分段
    for (const seg of this.segments) {
      const sx = seg.x - scroll;
      // 裁剪到可见区间（长分段会从屏幕左侧很远处开始）
      const drawX = Math.max(sx, 0);
      const drawEnd = Math.min(sx + seg.w, this.W);
      if (drawEnd <= drawX) continue;
      const w = drawEnd - drawX;
      // 土层（渐变已在循环外构建）
      ctx.fillRect(drawX, gy, w, this.H - gy);
      // 沉积纹
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(drawX, gy + (this.H - gy) * 0.38, w, 3);
      ctx.fillRect(drawX, gy + (this.H - gy) * 0.68, w, 4);
      // 草皮斑（浅色椭圆，打破大色块）
      let pStart = Math.max(seg.x, scroll - 60);
      pStart = Math.ceil(pStart / 90) * 90;
      for (let pw = pStart; pw < seg.x + seg.w && pw - scroll < this.W + 60; pw += 90) {
        const ppx = pw - scroll;
        const pyy = gy + 30 + util.hash(pw) * (this.H - gy) * 0.5;
        ctx.beginPath();
        ctx.ellipse(ppx, pyy, 24 + util.hash(pw + 1) * 14, 5.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.fill();
      }
      // 草皮（渐变）
      ctx.fillStyle = this._grass.g;
      ctx.fillRect(drawX, gy, w, 12);
      ctx.fillStyle = util.rgbStr(theme.grassDark);
      ctx.fillRect(drawX, gy + 12, w, 3);
      // 草皮边缘的小圆齿（让边缘不那么生硬）
      ctx.fillStyle = util.rgbStr(util.lerpColor(theme.grass, [255, 255, 255], 0.14));
      const cStart = Math.max(seg.x, scroll - 20);
      let wx2 = Math.ceil(cStart / 24) * 24;
      for (; wx2 < seg.x + seg.w && wx2 - scroll < this.W + 24; wx2 += 24) {
        const px = wx2 - scroll;
        ctx.beginPath();
        ctx.arc(px, gy + 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // 草丛（确定性分布，随世界滚动）
      ctx.strokeStyle = util.rgbStr(util.lerpColor(theme.grassDark, [20, 60, 30], 0.3));
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      let wx = Math.max(seg.x, scroll - 46);
      wx = Math.ceil(wx / 34) * 34;
      for (; wx < seg.x + seg.w && wx - scroll < this.W + 46; wx += 34) {
        const px = wx - scroll;
        const n = 2 + Math.floor(util.hash(wx) * 2);
        for (let b = 0; b < n; b++) {
          const h = 4 + util.hash(wx + b) * 4;
          const lean = (b - (n - 1) / 2) * 2.4;
          ctx.beginPath();
          ctx.moveTo(px + lean, gy + 1);
          ctx.quadraticCurveTo(px + lean * 1.6, gy - h * 0.6, px + lean * 2.1, gy - h);
          ctx.stroke();
        }
      }
      // 土中小石子（确定性分布，只画可见范围）
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      const segEndWx = seg.x + seg.w;
      let px2 = Math.max(seg.x, scroll - 46);
      px2 = Math.ceil(px2 / 46) * 46;
      for (; px2 < segEndWx && px2 - scroll < this.W + 46; px2 += 46) {
        const px = px2 - scroll;
        const row = Math.abs(px2 / 46) % 3;
        ctx.fillRect(px, gy + 34 + row * 26, 7, 4);
      }
      // 坑边缘加深，提示危险
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      if (seg.x > 0) ctx.fillRect(drawX, gy, 3, this.H - gy);
      ctx.fillRect(drawX + w - 3, gy, 3, this.H - gy);
    }

    // 障碍接触阴影（贴地柔影，先画阴影再画障碍）
    ctx.fillStyle = 'rgba(35,30,22,0.16)';
    for (const o of this.obstacles) {
      const sx = o.x - scroll;
      if (sx > this.W + 40 || sx + o.w < -40) continue;
      if (o.type === 'bird') continue;
      ctx.beginPath();
      ctx.ellipse(sx + o.w / 2, gy + 3, o.w * 0.6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 障碍
    for (const o of this.obstacles) {
      const sx = o.x - scroll;
      if (sx > this.W + 40 || sx + o.w < -40) continue;
      if (o.type === 'spike') {
        this.drawSpike(ctx, sx, o.w, o.h);
      } else if (o.type === 'sign') {
        this.drawSign(ctx, sx, time);
      } else if (o.type === 'bird') {
        this.drawBird(ctx, sx, time);
      } else if (o.type === 'plat') {
        this.drawPlat(ctx, sx, o.w, o.h);
      } else {
        const stack = o.h > 50;
        if (stack) this.drawCrate(ctx, sx, this.groundY - 38, o.w, 38);
        this.drawCrate(ctx, sx, this.groundY - o.h + (stack ? 38 : 0), o.w, 38);
      }
    }

    // 金币
    for (const c of this.coins) {
      if (c.taken) continue;
      const sx = c.x - scroll;
      if (sx > this.W + 20 || sx < -20) continue;
      const sy = c.y + Math.sin(time * 3 + c.phase) * 3;
      const wob = Math.abs(Math.cos(time * 4 + c.phase));
      if (!this._coin) {
        const cg = ctx.createRadialGradient(-4, -4, 2, 0, 0, c.r + 2);
        cg.addColorStop(0, '#FFE08A');
        cg.addColorStop(0.6, '#FFC93C');
        cg.addColorStop(1, '#E8A62A');
        this._coin = cg;
      }
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(Math.max(0.18, wob), 1);
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fillStyle = this._coin;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#C98A1B';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, c.r * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(sx - 3 * wob, sy - 3, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 道具
    for (const it of this.items) {
      if (it.taken) continue;
      const sx = it.x - scroll;
      if (sx > this.W + 30 || sx < -30) continue;
      this.drawItem(ctx, it, it.x - scroll, it.y + Math.sin(time * 3 + it.phase) * 3);
    }
  }

  drawItem(ctx, it, sx, sy) {
    ctx.save();
    ctx.translate(sx, sy);
    if (it.type === 'shield') {
      // 蓝色盾牌
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(11, -9);
      ctx.lineTo(11, 2);
      ctx.quadraticCurveTo(11, 10, 0, 14);
      ctx.quadraticCurveTo(-11, 10, -11, 2);
      ctx.lineTo(-11, -9);
      ctx.closePath();
      ctx.fillStyle = '#5CA8FF';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#3B78C3';
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(-1, 5);
      ctx.lineTo(6, -5);
      ctx.stroke();
    } else {
      // 红色 U 型磁铁
      ctx.rotate(0.5);
      ctx.strokeStyle = '#FF5964';
      ctx.lineWidth = 8;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.arc(0, 0, 10, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-14, -2, 8, 7);
      ctx.fillRect(6, -2, 8, 7);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#C33844';
      ctx.strokeRect(-14, -2, 8, 7);
      ctx.strokeRect(6, -2, 8, 7);
    }
    ctx.restore();
  }

  drawSpike(ctx, sx, w, h) {
    // 底座小土台
    ctx.fillStyle = '#5A5A6A';
    ctx.beginPath();
    ctx.moveTo(sx - 2, this.groundY);
    ctx.lineTo(sx + w + 2, this.groundY);
    ctx.lineTo(sx + w, this.groundY - 4);
    ctx.lineTo(sx + 2, this.groundY - 4);
    ctx.closePath();
    ctx.fill();
    // 主体
    ctx.beginPath();
    ctx.moveTo(sx, this.groundY - 2);
    ctx.lineTo(sx + w / 2, this.groundY - h);
    ctx.lineTo(sx + w, this.groundY - 2);
    ctx.closePath();
    ctx.fillStyle = '#4A4A58';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#33333F';
    ctx.stroke();
    // 左侧亮面
    ctx.beginPath();
    ctx.moveTo(sx + 2, this.groundY - 3);
    ctx.lineTo(sx + w / 2, this.groundY - h + 3);
    ctx.lineTo(sx + w / 2, this.groundY - 3);
    ctx.closePath();
    ctx.fillStyle = '#63637A';
    ctx.fill();
    // 尖端高光
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(sx + w / 2, this.groundY - h + 4, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCrate(ctx, sx, sy, w, h) {
    util.roundRectPath(ctx, sx, sy, w, h, 5);
    ctx.fillStyle = '#D99A4E';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#8A5A28';
    ctx.stroke();
    // 顶部受光面 + 左上受光边、右下背光边（体积感）
    roundFill(ctx, sx + 4, sy + 3.5, w - 8, 4, 2, 'rgba(255,235,200,0.45)', null);
    ctx.strokeStyle = 'rgba(255,235,200,0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sx + 3, sy + h - 3);
    ctx.lineTo(sx + 3, sy + 3);
    ctx.lineTo(sx + w - 3, sy + 3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(70,40,20,0.45)';
    ctx.beginPath();
    ctx.moveTo(sx + w - 2, sy + 3);
    ctx.lineTo(sx + w - 2, sy + h - 2);
    ctx.lineTo(sx + 3, sy + h - 2);
    ctx.stroke();
    // 斜撑
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8A5A28';
    ctx.beginPath();
    ctx.moveTo(sx + 5, sy + 5);
    ctx.lineTo(sx + w - 5, sy + h - 5);
    ctx.moveTo(sx + w - 5, sy + 5);
    ctx.lineTo(sx + 5, sy + h - 5);
    ctx.stroke();
    // 四角铆钉
    ctx.fillStyle = '#6B4423';
    for (const p of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]]) {
      ctx.beginPath();
      ctx.arc(sx + p[0], sy + p[1], 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 平台箱：绿色 + 上箭头，一眼看出"可以踩"
  drawPlat(ctx, sx, w, h) {
    const gy = this.groundY;
    roundFill(ctx, sx, gy - h, w, h, 6, '#3E9E5C', '#2C7A44');
    // 顶面受光 + 右下背光边
    roundFill(ctx, sx + 3, gy - h + 3, w - 6, 7, 3, '#7CC98F', null);
    ctx.strokeStyle = 'rgba(20,60,35,0.4)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sx + w - 2, gy - h + 2);
    ctx.lineTo(sx + w - 2, gy - 2);
    ctx.lineTo(sx + 2, gy - 2);
    ctx.stroke();
    // 草皮点缀
    ctx.fillStyle = '#8FD9A0';
    ctx.fillRect(sx + 3, gy - h + 9, w - 6, 2);
    // 上箭头（白色）
    const cx = sx + w / 2;
    const cy = gy - h / 2 + 4;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 6);
    ctx.lineTo(cx + 8, cy + 6);
    ctx.lineTo(cx, cy - 7);
    ctx.closePath();
    ctx.fill();
    // 四角铆钉
    ctx.fillStyle = '#2C7A44';
    for (const p of [[5, 5], [w - 5, 5], [5, h - 5], [w - 5, h - 5]]) {
      ctx.beginPath();
      ctx.arc(sx + p[0], gy - h + p[1], 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 无人机广告牌：吊着广告牌低空悬停，必须滑铲通过
  drawSign(ctx, sx, time) {
    const gy = this.groundY;
    const bob = Math.sin(time * 2.6) * 2.5;
    // 吊索
    ctx.strokeStyle = '#78909C';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sx + 22, gy - 168 + bob);
    ctx.lineTo(sx + 28, gy - 156 + bob);
    ctx.moveTo(sx + 68, gy - 168 + bob);
    ctx.lineTo(sx + 62, gy - 156 + bob);
    ctx.stroke();
    // 无人机（旋翼旋转）
    roundFill(ctx, sx + 32, gy - 192 + bob, 26, 14, 6, '#546E7A', '#37474F');
    ctx.strokeStyle = '#B0BEC5';
    ctx.lineWidth = 2;
    const rot = time * 24;
    for (const rx of [sx + 36, sx + 54]) {
      ctx.beginPath();
      ctx.moveTo(rx - 9 * Math.cos(rot), gy - 192 + bob - 9 * Math.sin(rot));
      ctx.lineTo(rx + 9 * Math.cos(rot), gy - 192 + bob + 9 * Math.sin(rot));
      ctx.stroke();
    }
    // 广告牌（底部与判定盒对齐）
    roundFill(ctx, sx + 7, gy - 158 + bob, 76, 127, 8, '#2E3A46', '#FFC46B');
    // 下压箭头 ▼
    ctx.fillStyle = '#FFC46B';
    for (const ay of [gy - 140 + bob, gy - 108 + bob, gy - 76 + bob]) {
      ctx.beginPath();
      ctx.moveTo(sx + 37, ay + 12);
      ctx.lineTo(sx + 53, ay + 12);
      ctx.lineTo(sx + 45, ay + 26);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 低空飞鸟：扇翅悬飞
  drawBird(ctx, sx, time) {
    const gy = this.groundY;
    const cy = gy - 58 + Math.sin(time * 3.2) * 3;
    // 尾羽
    ctx.beginPath();
    ctx.moveTo(sx + 6, cy);
    ctx.lineTo(sx - 6, cy - 6);
    ctx.lineTo(sx - 6, cy + 6);
    ctx.closePath();
    ctx.fillStyle = '#78909C';
    ctx.fill();
    // 身体
    ctx.beginPath();
    ctx.ellipse(sx + 17, cy, 16, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#78909C';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#546E7A';
    ctx.stroke();
    // 腹部
    ctx.beginPath();
    ctx.ellipse(sx + 15, cy + 4, 10, 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#B0BEC5';
    ctx.fill();
    // 翅膀（扇动）
    ctx.save();
    ctx.translate(sx + 13, cy - 5);
    ctx.rotate(Math.sin(time * 15) * 0.75 - 0.2);
    ctx.beginPath();
    ctx.ellipse(0, -8, 5.5, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#90A4AE';
    ctx.fill();
    ctx.restore();
    // 喙 + 眼
    ctx.beginPath();
    ctx.moveTo(sx + 31, cy - 3);
    ctx.lineTo(sx + 40, cy);
    ctx.lineTo(sx + 31, cy + 3);
    ctx.closePath();
    ctx.fillStyle = '#FF8A65';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(sx + 24, cy - 4, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.arc(sx + 25, cy - 4, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
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

module.exports = World;
