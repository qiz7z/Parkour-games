// 粒子与飘字特效
const util = require('./util');
const F = require('./font');

class Particles {
  constructor() {
    this.list = [];
    this.texts = [];
  }

  emit(x, y, n, opt) {
    const spread = opt.spread === undefined ? 1 : opt.spread;
    for (let i = 0; i < n; i++) {
      const a = opt.angle + util.rand(-spread, spread);
      const sp = util.rand(opt.speed * 0.4, opt.speed);
      this.list.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        age: 0,
        life: util.rand(opt.life * 0.6, opt.life),
        size: util.rand(opt.size * 0.6, opt.size),
        color: opt.color,
        grav: opt.grav || 0,
        world: !!opt.world,
        puffy: !!opt.puffy,
        star: !!opt.star,
        seed: Math.random() * 6.28,
      });
    }
  }

  // 落地/起跳扬尘（跟随世界滚动，蓬松烟团）
  dust(x, y, n) {
    this.emit(x, y, n || 6, {
      angle: -Math.PI / 2, spread: 1.1, speed: 130,
      size: 7, life: 0.55, color: 'rgba(125,112,100,0.42)', grav: 260, world: true, puffy: true,
    });
  }

  // 金币火花（四角星闪烁）
  sparkle(x, y) {
    this.emit(x, y, 9, {
      angle: 0, spread: Math.PI * 2, speed: 180,
      size: 5, life: 0.5, color: '#FFD54F', grav: 80, world: true, star: true,
    });
  }

  // 死亡爆裂
  burst(x, y) {
    this.emit(x, y, 16, { angle: 0, spread: Math.PI * 2, speed: 300, size: 6, life: 0.85, color: '#FF6F5B', grav: 620 });
    this.emit(x, y, 10, { angle: 0, spread: Math.PI * 2, speed: 230, size: 5, life: 0.7, color: '#FFFFFF', grav: 520 });
    this.emit(x, y, 8, { angle: 0, spread: Math.PI * 2, speed: 210, size: 5, life: 0.7, color: '#4A4A58', grav: 520 });
  }

  text(x, y, str, color) {
    this.texts.push({ x, y, str, color: color || '#FB8C00', age: 0, life: 0.8 });
  }

  update(dt, scrollSpeed) {
    const sp = scrollSpeed || 0;
    for (const p of this.list) {
      p.age += dt;
      p.x += (p.vx - (p.world ? sp : 0)) * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
    }
    this.list = this.list.filter(p => p.age < p.life);
    for (const t of this.texts) {
      t.age += dt;
      t.x -= sp * dt * 0.6;
      t.y -= 46 * dt;
    }
    this.texts = this.texts.filter(t => t.age < t.life);
  }

  draw(ctx) {
    for (const p of this.list) {
      const k = p.age / p.life;
      ctx.globalAlpha = 1 - k;
      const s = p.size * (1 - 0.5 * k);
      if (p.puffy) {
        // 蓬松烟团：主团 + 侧团，随时间膨胀变淡
        const r = Math.max(1, s / 2) * (1 + k * 0.9);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = (1 - k) * 0.6;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(p.seed) * r * 0.8, p.y + Math.sin(p.seed) * r * 0.5, r * 0.62, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.star) {
        // 四角星（菱形闪光，随时间收缩）
        const r = Math.max(1, s * (1 - k * 0.6));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - r);
        ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + r);
        ctx.quadraticCurveTo(p.x, p.y, p.x - r, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - r);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, s / 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      ctx.globalAlpha = 1 - t.age / t.life;
      ctx.fillStyle = t.color;
      ctx.font = F.b(17);
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.list.length = 0;
    this.texts.length = 0;
  }
}

module.exports = Particles;
