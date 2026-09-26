// 角色精灵渲染：Kenney Platformer Characters（CC0 免费商用）
// 素材朝左、帧高 110px、脚底贴帧底；绘制时水平翻转使角色朝右。
// 素材未加载完成时 ready() 返回 false，角色回退到程序化绘制。
const POSES = ['walk1', 'walk2', 'jump', 'fall', 'slide', 'hurt', 'idle', 'duck', 'hold1'];
const FRAME_W = 80;
const FRAME_H = 110;

const images = {};
let pending = 0;
let loadedCount = 0;
let started = false;
// 微信包内根目录即 jump-runner；浏览器预览根目录是仓库根，需要加前缀
const BASE = (typeof wx !== 'undefined') ? 'assets/characters/' : 'jump-runner/assets/characters/';

function makeImage(src) {
  let img = null;
  try {
    if (typeof wx !== 'undefined' && typeof wx.createImage === 'function') {
      img = wx.createImage();
    } else if (typeof Image !== 'undefined') {
      img = new Image();
    }
  } catch (e) {
    return null;
  }
  if (!img) return null;
  pending++;
  img.onload = () => { loadedCount++; };
  img.onerror = () => {
    // 主路径失败时自动换另一条前缀重试一次（微信包内 / 浏览器预览的根目录不同）
    if (!img.__retried) {
      img.__retried = true;
      img.src = src.indexOf('jump-runner/') === 0 ? src.replace('jump-runner/', '') : 'jump-runner/' + src;
    } else {
      loadedCount++;
    }
  };
  img.src = src;
  return img;
}

// 启动加载（重复调用安全）
function load() {
  if (started) return;
  started = true;
  const chars = ['player', 'female', 'adventurer', 'soldier', 'zombie'];
  for (const c of chars) {
    for (const p of POSES) {
      const img = makeImage(BASE + c + '/' + c + '_' + p + '.png');
      if (img) images[c + '/' + p] = img;
    }
  }
}

// 全部素材就绪
function ready() {
  return started && pending > 0 && loadedCount === pending;
}

// 绘制单帧：底部中心锚点 (x,y)，h 为帧高（逻辑 px），flip=true 朝右
// 返回 false 表示该帧不可用（调用方回退程序化绘制）
function draw(ctx, charId, pose, x, y, h, flip) {
  const img = images[charId + '/' + pose];
  if (!img || !img.width) return false;
  const s = h / FRAME_H;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, (-FRAME_W / 2) * s, -FRAME_H * s, FRAME_W * s, FRAME_H * s);
  ctx.restore();
  return true;
}

if (typeof window !== 'undefined') window.__Sprites = { ready, images, pending: () => pending, loadedCount: () => loadedCount, started: () => started };

module.exports = { load, ready, draw, POSES, FRAME_H };
