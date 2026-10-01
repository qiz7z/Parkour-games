// 坐骑定义与绘制：动物（小马驹/小恐龙）与载具（自行车/小摩托），全程序化绘制
// h 为"鞍座高度"——角色脚底相对地面的抬高量；绘制原点为坐腾正下方地面接触点

const MOUNTS = [
  { id: 'none',    name: '步行',   price: 0,   h: 0,  perk: '轻装上阵' },
  { id: 'pony',    name: '小马驹', price: 150, h: 28, perk: '跳跃高度 +8%' },
  { id: 'bicycle', name: '自行车', price: 150, h: 44, perk: '磁铁时间 +50%' },
  { id: 'moto',    name: '小摩托', price: 300, h: 30, perk: '速度 +8%' },
  { id: 'dino',    name: '小恐龙', price: 300, h: 28, perk: '开局自带护盾' },
];

function get(id) {
  for (const m of MOUNTS) if (m.id === id) return m;
  return MOUNTS[0];
}

function draw(ctx, id, cx, bottomY, time, opts) {
  if (id === 'none') return;
  opts = opts || {};
  const run = opts.run || 0;
  const grounded = opts.grounded !== false;
  ctx.save();
  ctx.translate(cx, bottomY);
  if (opts.squash) {
    // 铲行时坐骑轻微压低（保留车轮形状，避免"压扁贴图"感）
    ctx.scale(1, 0.6);
  }
  if (id === 'pony') drawPony(ctx, run, grounded);
  else if (id === 'dino') drawDino(ctx, run, grounded);
  else if (id === 'bicycle') drawBicycle(ctx, run);
  else if (id === 'moto') drawMoto(ctx, run);
  ctx.restore();
}

function strokeRound(ctx, color, w) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

// ---- 小马驹：四腿小跑 + 鬃毛 + 马尾 ----
function drawPony(ctx, run, grounded) {
  const body = '#C68B59';
  const dark = '#8A5A32';
  const mane = '#F2D0A4';

  // 四条腿（小跑摆动）
  strokeRound(ctx, dark, 5);
  const xs = [-18, -11, 10, 17];
  const phases = [0, 0.5, Math.PI, Math.PI + 0.5];
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(xs[i], -13);
    if (grounded) {
      const s = Math.sin(run + phases[i]);
      ctx.lineTo(xs[i] + s * 9, -1 - Math.max(0, Math.cos(run + phases[i])) * 4);
    } else {
      ctx.lineTo(xs[i] + 2, -8); // 空中收腿
    }
    ctx.stroke();
  }

  // 马尾
  strokeRound(ctx, mane, 3.5);
  for (const dy of [-6, -2, 2]) {
    ctx.beginPath();
    ctx.moveTo(-24, -22);
    ctx.lineTo(-30, -22 + dy);
    ctx.stroke();
  }

  // 身体 + 鞍
  roundFill(ctx, -24, -27, 48, 20, 10, body, dark);
  roundFill(ctx, -9, -30, 18, 5, 2, dark, null);

  // 脖颈 + 头
  ctx.beginPath();
  ctx.moveTo(10, -24);
  ctx.lineTo(19, -36);
  ctx.lineTo(24, -32);
  ctx.lineTo(16, -22);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(21, -37, 8, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.stroke();
  // 口鼻
  roundFill(ctx, 25, -39, 9, 7, 3, '#E8C39A', dark);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(31, -35.5, 1, 0, Math.PI * 2);
  ctx.fill();
  // 耳朵
  ctx.beginPath();
  ctx.moveTo(14, -43);
  ctx.lineTo(18, -42);
  ctx.lineTo(15, -48);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 眼睛
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(22, -39, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#33272A';
  ctx.beginPath();
  ctx.arc(23, -39, 1.4, 0, Math.PI * 2);
  ctx.fill();
  // 鬃毛
  ctx.fillStyle = mane;
  for (const p of [[9, -29], [13, -34], [17, -40]]) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- 小恐龙：背刺 + 呆萌大头 ----
function drawDino(ctx, run, grounded) {
  const body = '#7CB342';
  const dark = '#558B2F';
  const belly = '#C5E1A5';
  const spike = '#33691E';

  // 尾巴
  ctx.beginPath();
  ctx.moveTo(-22, -21);
  ctx.lineTo(-35, -15);
  ctx.lineTo(-22, -11);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 四条短腿
  ctx.fillStyle = dark;
  const xs = [-18, -11, 10, 17];
  for (let i = 0; i < 4; i++) {
    const wob = grounded ? Math.sin(run + i * 1.6) * 1.5 : 0;
    roundFill(ctx, xs[i] - 3 + wob, -10, 6, 10, 3, dark, null);
  }

  // 身体 + 肚皮
  roundFill(ctx, -24, -27, 48, 22, 11, body, dark);
  roundFill(ctx, -14, -13, 28, 8, 4, belly, null);

  // 背刺（中间留出鞍座空位）
  ctx.fillStyle = spike;
  for (const x of [-21, 12]) {
    ctx.beginPath();
    ctx.moveTo(x, -27);
    ctx.lineTo(x + 7, -27);
    ctx.lineTo(x + 3.5, -34);
    ctx.closePath();
    ctx.fill();
  }

  // 头
  roundFill(ctx, 10, -39, 20, 15, 7, body, dark);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(21, -33, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#33272A';
  ctx.beginPath();
  ctx.arc(22, -33, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(27, -28, 1, 0, Math.PI * 2);
  ctx.fill();
  strokeRound(ctx, dark, 1.5);
  ctx.beginPath();
  ctx.moveTo(24, -26);
  ctx.lineTo(28, -26.5);
  ctx.stroke();
}

// ---- 自行车：大车轮 + 车架（与骑手脚部踏板同相位） ----
function drawBicycle(ctx, run) {
  const frame = '#F06292';
  const tire = '#37474F';
  const metal = '#B0BEC5';

  // 车轮（直径略大于骑手头高，比例才协调）
  for (const wx of [-25, 25]) {
    ctx.beginPath();
    ctx.arc(wx, -21, 21, 0, Math.PI * 2);
    ctx.strokeStyle = tire;
    ctx.lineWidth = 4.5;
    ctx.stroke();
    const rot = run * 1.5;
    ctx.strokeStyle = metal;
    ctx.lineWidth = 2;
    for (let a = 0; a < 3; a++) {
      const ang = rot + a * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(wx - Math.cos(ang) * 17, -21 - Math.sin(ang) * 17);
      ctx.lineTo(wx + Math.cos(ang) * 17, -21 + Math.sin(ang) * 17);
      ctx.stroke();
    }
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.arc(wx, -21, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 车架
  ctx.strokeStyle = frame;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-12, -44); ctx.lineTo(3, -21);   // 座管
  ctx.moveTo(-12, -44); ctx.lineTo(-25, -21); // 后叉
  ctx.moveTo(3, -21); ctx.lineTo(25, -21);    // 底位线
  ctx.moveTo(25, -21); ctx.lineTo(31, -49);   // 前叉（加高前伸）
  ctx.moveTo(-12, -42); ctx.lineTo(20, -43);  // 上管
  ctx.stroke();

  // 车座（骑手脚底位置）
  roundFill(ctx, -19, -48, 15, 5.5, 2.6, tire, null);
  // 车把（金属横把，骑手双手握住的位置，明显可见）
  roundFill(ctx, 22, -46, 15, 5, 2.5, metal, tire);
  ctx.fillStyle = '#FFE082';
  ctx.beginPath();
  ctx.arc(23, -43.5, 1.6, 0, Math.PI * 2);
  ctx.fill();
  // 曲柄 + 踏板（骑手脚部与此同步）
  const ang = run * 1.5;
  ctx.strokeStyle = metal;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(3, -21);
  ctx.lineTo(3 + Math.cos(ang) * 12, -21 + Math.sin(ang) * 12);
  ctx.stroke();
  roundFill(ctx, 3 + Math.cos(ang) * 12 - 2.6, -21 + Math.sin(ang) * 12 - 2.6, 5.2, 5.2, 1.6, '#607D8B', null);
}

// ---- 小摩托：车身 + 车灯 + 排气管 ----
function drawMoto(ctx, run) {
  const body = '#EF5350';
  const dark = '#B71C1C';
  const seat = '#37474F';
  const metal = '#B0BEC5';

  // 车轮
  for (const wx of [-19, 19]) {
    ctx.beginPath();
    ctx.arc(wx, -13, 13, 0, Math.PI * 2);
    ctx.fillStyle = seat;
    ctx.fill();
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.arc(wx, -13, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // 挡泥板
    ctx.beginPath();
    ctx.arc(wx, -13, 16, Math.PI * 1.1, Math.PI * 1.9);
    ctx.strokeStyle = body;
    ctx.lineWidth = 4.5;
    ctx.stroke();
  }

  // 车身
  roundFill(ctx, -27, -29, 54, 17, 8, body, dark);
  // 车座
  roundFill(ctx, -21, -34, 19, 6, 2.8, seat, null);
  // 前立柱 + 车把
  roundFill(ctx, 12, -41, 8, 15, 3.5, body, dark);
  ctx.strokeStyle = seat;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(11, -39);
  ctx.lineTo(23, -42);
  ctx.stroke();
  // 车灯
  ctx.beginPath();
  ctx.arc(25, -22, 3.6, 0, Math.PI * 2);
  ctx.fillStyle = '#FFE082';
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // 排气管
  roundFill(ctx, -33, -17, 11, 5, 2.4, metal, null);
}

// 圆角矩形填充/描边小工具
function roundFill(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  const rr = Math.min(r, w / 2, h / 2);
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

module.exports = { MOUNTS, get, draw, roundFill };
