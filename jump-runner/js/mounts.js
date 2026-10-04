// 坐骑定义与绘制：动物（小马驹/小恐龙）与载具（自行车/小摩托），全程序化绘制
// h 为"鞍座高度"——角色脚底相对地面的抬高量；绘制原点为坐腾正下方地面接触点

const MOUNTS = [
  { id: 'none',    name: '步行',   price: 0,   h: 0,  perk: '轻装上阵' },
  { id: 'pony',    name: '小马驹', price: 150, h: 38, perk: '跳跃高度 +8%' },
  { id: 'bicycle', name: '自行车', price: 150, h: 44, perk: '磁铁时间 +50%' },
  { id: 'moto',    name: '小摩托', price: 300, h: 30, perk: '速度 +8%' },
  { id: 'dino',    name: '小恐龙', price: 300, h: 36, perk: '开局自带护盾' },
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

// ---- 小马驹：对角小跑 + 身体起伏 + 点头（放大版，撑得起骑手） ----
function drawPony(ctx, run, grounded) {
  const body = '#C68B59';
  const dark = '#8A5A32';
  const hoof = '#5D3A1E';
  const mane = '#F2D0A4';
  const maneLite = '#FBF0DA';
  const blanket = '#D8302A';

  // 身体随步态起伏（与骑手 rideBob 同相），腿髋随身体、脚保持贴地
  const bob = grounded ? -Math.abs(Math.sin(run * 0.9)) * 1.8 : -1.2;
  ctx.save();
  ctx.translate(0, bob);

  // 四条腿：标准对角小跑（左前+右后同相，右前+左后同相）+ 深色马蹄
  strokeRound(ctx, dark, 6);
  const xs = [-25, -16, 13, 22];
  const phases = [0, Math.PI, Math.PI, 0];
  const feet = [];
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(xs[i], -18);
    let fx = xs[i] + 2;
    let fy = -11;
    if (grounded) {
      const s2 = Math.sin(run + phases[i]);
      fx = xs[i] + s2 * 9;
      fy = -1 - Math.max(0, Math.cos(run + phases[i])) * 4;
      ctx.lineTo(fx, fy - bob);
    } else {
      ctx.lineTo(fx, fy - bob);
    }
    ctx.stroke();
    feet.push([fx, fy]);
  }
  ctx.fillStyle = hoof;
  for (const f of feet) {
    roundFill(ctx, f[0] - 3.4, f[1] - 3.4 - bob, 6.8, 4.2, 2, hoof, null);
  }

  // 马尾（三缕 + 描边，随步伐轻摆）
  ctx.save();
  ctx.translate(-32, -30);
  ctx.rotate(Math.sin(run * 1.1) * 0.14);
  ctx.translate(32, 30);
  strokeRound(ctx, dark, 6.5);
  for (const dy of [-8, -3, 2]) {
    ctx.beginPath();
    ctx.moveTo(-32, -30);
    ctx.lineTo(-40, -30 + dy);
    ctx.stroke();
  }
  strokeRound(ctx, mane, 3.6);
  for (const dy of [-8, -3, 2]) {
    ctx.beginPath();
    ctx.moveTo(-32, -30);
    ctx.lineTo(-39.4, -30 + dy);
    ctx.stroke();
  }
  ctx.restore();

  // 身体 + 肚皮阴影 + 背部高光 + 鞍毯
  roundFill(ctx, -31, -37, 62, 27, 13, body, dark);
  ctx.save();
  roundFill(ctx, -31, -37, 62, 27, 13, null, null);
  ctx.clip();
  ctx.fillStyle = 'rgba(90,52,22,0.25)'; // 腹侧阴影
  ctx.beginPath();
  ctx.ellipse(-2, -14, 34, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,214,0.4)'; // 背部受光
  ctx.beginPath();
  ctx.ellipse(-2, -36, 30, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 红色鞍毯 + 描边 + 饰线
  roundFill(ctx, -15, -42, 29, 8, 3.8, blanket, dark);
  ctx.strokeStyle = 'rgba(255,235,200,0.75)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-12, -40.4);
  ctx.lineTo(11, -40.4);
  ctx.stroke();

  // 脖颈 + 头（随步伐轻微点头）
  ctx.save();
  ctx.translate(0, Math.sin(run * 0.9 + 0.6) * 1.1);
  ctx.beginPath();
  ctx.moveTo(13, -32);
  ctx.lineTo(25, -48);
  ctx.lineTo(32, -43);
  ctx.lineTo(21, -30);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(28, -50, 10.5, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // 口鼻 + 嘴线
  roundFill(ctx, 33, -53, 12, 9, 4, '#E8C39A', dark);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(38.5, -46.5, 2.4, Math.PI * 0.15, Math.PI * 0.75);
  ctx.stroke();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(41, -48.5, 1.4, 0, Math.PI * 2);
  ctx.fill();
  // 耳朵 + 耳内粉色
  ctx.beginPath();
  ctx.moveTo(18, -58);
  ctx.lineTo(24, -56);
  ctx.lineTo(20, -64);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(19.6, -58.4);
  ctx.lineTo(22, -57.4);
  ctx.lineTo(20.2, -61.4);
  ctx.closePath();
  ctx.fillStyle = '#E8A0A0';
  ctx.fill();
  // 眼睛 + 高光
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(29, -52, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(30, -52, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(29.2, -52.8, 0.8, 0, Math.PI * 2);
  ctx.fill();
  // 鬃毛（勾边 + 高光卷）
  for (const p of [[11, -39], [16, -46], [22, -53]]) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], 4.6, 0, Math.PI * 2);
    ctx.fillStyle = mane;
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p[0] - 1.2, p[1] - 1.4, 1.7, 0, Math.PI * 2);
    ctx.fillStyle = maneLite;
    ctx.fill();
  }
  ctx.restore(); // 点头组
  ctx.restore(); // 身体起伏组
}

// ---- 小恐龙：背刺 + 呆萌大头（放大版） ----
function drawDino(ctx, run, grounded) {
  const body = '#7CB342';
  const dark = '#558B2F';
  const belly = '#C5E1A5';
  const spike = '#33691E';

  // 身体组：小恐龙摇摆步（身体绕髋微转 + 起伏），腿保持贴地
  ctx.save();
  ctx.translate(0, -20);
  ctx.rotate(grounded ? Math.sin(run * 0.9) * 0.035 : 0);
  ctx.translate(0, 20);
  ctx.translate(0, grounded ? -Math.abs(Math.sin(run * 0.9)) * 1.4 : -0.8);

  // 尾巴 + 尾刺
  ctx.beginPath();
  ctx.moveTo(-27, -27);
  ctx.lineTo(-43, -19);
  ctx.lineTo(-27, -13);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = spike;
  ctx.beginPath();
  ctx.moveTo(-33, -25);
  ctx.lineTo(-28.5, -24);
  ctx.lineTo(-31.5, -29);
  ctx.closePath();
  ctx.fill();

  // 四条短腿 + 脚趾线
  const xs = [-23, -14, 12, 21];
  for (let i = 0; i < 4; i++) {
    const wob = grounded ? Math.sin(run + i * 1.6) * 2 : 0;
    roundFill(ctx, xs[i] - 4 + wob, -14, 8, 13, 4, dark, null);
    ctx.strokeStyle = 'rgba(38,58,16,0.55)';
    ctx.lineWidth = 1.1;
    const bx = xs[i] + wob;
    ctx.beginPath();
    ctx.moveTo(bx - 2.4, -2.2);
    ctx.lineTo(bx - 2.4, -0.6);
    ctx.moveTo(bx, -2.2);
    ctx.lineTo(bx, -0.6);
    ctx.moveTo(bx + 2.4, -2.2);
    ctx.lineTo(bx + 2.4, -0.6);
    ctx.stroke();
  }

  // 身体 + 肚皮 + 背部高光
  roundFill(ctx, -29, -34, 58, 27, 13, body, dark);
  roundFill(ctx, -17, -17, 34, 10, 5, belly, null);
  // 肚皮横纹（腹部体块感）
  ctx.strokeStyle = 'rgba(85,139,47,0.5)';
  ctx.lineWidth = 1.2;
  for (const lx of [-9, 0, 9]) {
    ctx.beginPath();
    ctx.moveTo(lx - 2.5, -16);
    ctx.quadraticCurveTo(lx, -13.5, lx - 2.5, -11);
    ctx.stroke();
  }
  ctx.save();
  roundFill(ctx, -29, -34, 58, 27, 13, null, null);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,250,214,0.35)'; // 背部受光
  ctx.beginPath();
  ctx.ellipse(-4, -33, 26, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 背刺（中间留出鞍座空位）+ 描边
  ctx.fillStyle = spike;
  for (const x of [-26, 15]) {
    ctx.beginPath();
    ctx.moveTo(x, -34);
    ctx.lineTo(x + 9, -34);
    ctx.lineTo(x + 4.5, -43);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = spike;
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // 头 + 背部高光
  roundFill(ctx, 13, -48, 25, 19, 8, body, dark);
  ctx.fillStyle = 'rgba(255,250,214,0.35)';
  ctx.beginPath();
  ctx.ellipse(22, -45.5, 8, 2.6, -0.12, 0, Math.PI * 2);
  ctx.fill();
  // 眼睛 + 高光
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(26, -41, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#33272A';
  ctx.beginPath();
  ctx.arc(27, -41, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(26.2, -41.8, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(33, -34, 1.3, 0, Math.PI * 2);
  ctx.fill();
  strokeRound(ctx, dark, 1.8);
  ctx.beginPath();
  ctx.moveTo(29, -31);
  ctx.lineTo(34, -31.5);
  ctx.stroke();
  ctx.restore(); // 摇摆组
}

// ---- 自行车：大车轮 + 车架（与骑手脚部踏板同相位） ----
function drawBicycle(ctx, run) {
  const frame = '#F06292';
  const frameDark = '#C2185B';
  const tire = '#37474F';
  const metal = '#B0BEC5';
  const metalDark = '#78909C';

  // 车轮（胎纹 + 轮圈 + 辐条 + 花鼓）
  for (const wx of [-25, 25]) {
    ctx.beginPath();
    ctx.arc(wx, -21, 21, 0, Math.PI * 2);
    ctx.strokeStyle = tire;
    ctx.lineWidth = 4.5;
    ctx.stroke();
    // 胎面细齿
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.4;
    for (let a = 0; a < 12; a++) {
      const ang = a * Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(ang) * 18.2, -21 + Math.sin(ang) * 18.2);
      ctx.lineTo(wx + Math.cos(ang) * 20, -21 + Math.sin(ang) * 20);
      ctx.stroke();
    }
    // 轮圈
    ctx.strokeStyle = metal;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(wx, -21, 17.5, 0, Math.PI * 2);
    ctx.stroke();
    const rot = run * 0.85; // 与地面滚动速度匹配（周长 132px），不空转
    ctx.strokeStyle = metalDark;
    ctx.lineWidth = 1.8;
    for (let a = 0; a < 3; a++) {
      const ang = rot + a * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(wx - Math.cos(ang) * 16.5, -21 - Math.sin(ang) * 16.5);
      ctx.lineTo(wx + Math.cos(ang) * 16.5, -21 + Math.sin(ang) * 16.5);
      ctx.stroke();
    }
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.arc(wx, -21, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = metalDark;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // 车架（深色描边管 + 亮色内芯，双层画出勾边感）
  const tube = (x1, y1, x2, y2) => {
    ctx.strokeStyle = frameDark;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = frame;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  tube(-12, -44, 3, -21);   // 座管
  tube(-12, -44, -25, -21); // 后叉
  tube(3, -21, 25, -21);    // 底位线
  tube(25, -21, 31, -49);   // 前叉（加高前伸）
  tube(-12, -42, 20, -43);  // 上管

  // 车座（骑手脚底位置）+ 描边 + 高光
  roundFill(ctx, -19, -48, 15, 5.5, 2.6, tire, metalDark);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-17, -46.8);
  ctx.lineTo(-7, -46.8);
  ctx.stroke();
  // 车把（金属横把 + 两端黑色握套 + 车铃）
  roundFill(ctx, 22, -46, 15, 5, 2.5, metal, tire);
  roundFill(ctx, 33.4, -45.6, 4.4, 4.2, 2, tire, null);
  roundFill(ctx, 21.6, -45.6, 4, 4.2, 2, tire, null);
  ctx.fillStyle = '#FFE082';
  ctx.beginPath();
  ctx.arc(23, -43.5, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = metalDark;
  ctx.lineWidth = 1;
  ctx.stroke();
  // 曲柄 + 踏板（骑手脚部与此同步）
  const ang = run * 1.5;
  ctx.strokeStyle = metalDark;
  ctx.lineWidth = 4.4;
  ctx.beginPath();
  ctx.moveTo(3, -21);
  ctx.lineTo(3 + Math.cos(ang) * 12, -21 + Math.sin(ang) * 12);
  ctx.stroke();
  ctx.strokeStyle = metal;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(3, -21);
  ctx.lineTo(3 + Math.cos(ang) * 12, -21 + Math.sin(ang) * 12);
  ctx.stroke();
  roundFill(ctx, 3 + Math.cos(ang) * 12 - 2.8, -21 + Math.sin(ang) * 12 - 2.8, 5.6, 5.6, 1.7, '#607D8B', metalDark);
}

// ---- 小摩托：车身 + 车灯 + 排气管 ----
function drawMoto(ctx, run) {
  const body = '#EF5350';
  const dark = '#B71C1C';
  const seat = '#37474F';
  const metal = '#B0BEC5';
  const metalDark = '#78909C';

  // 车轮（轮胎 + 滚动胎纹 + 轮毂）
  const wrot = run * 1.37; // 与地面滚动速度匹配（周长 82px）
  for (const wx of [-19, 19]) {
    ctx.beginPath();
    ctx.arc(wx, -13, 13, 0, Math.PI * 2);
    ctx.fillStyle = seat;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.3;
    for (let a = 0; a < 8; a++) {
      const ang = wrot + a * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(ang) * 10.5, -13 + Math.sin(ang) * 10.5);
      ctx.lineTo(wx + Math.cos(ang) * 12.2, -13 + Math.sin(ang) * 12.2);
      ctx.stroke();
    }
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.arc(wx, -13, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = metalDark;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 挡泥板
    ctx.beginPath();
    ctx.arc(wx, -13, 16, Math.PI * 1.1, Math.PI * 1.9);
    ctx.strokeStyle = body;
    ctx.lineWidth = 4.5;
    ctx.stroke();
  }

  // 车身 + 高光 + 前装饰板
  roundFill(ctx, -27, -29, 54, 17, 8, body, dark);
  ctx.save();
  roundFill(ctx, -27, -29, 54, 17, 8, null, null);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,244,224,0.35)'; // 顶部受光
  ctx.beginPath();
  ctx.ellipse(-4, -28, 30, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,14,14,0.3)'; // 底部阴影
  ctx.beginPath();
  ctx.ellipse(-4, -14.5, 32, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 前脸装饰条（奶白）
  roundFill(ctx, 14, -27, 12, 9, 4, '#FFF3E0', dark);
  // 发动机（深色体块）
  roundFill(ctx, -6, -16, 16, 9, 3.5, seat, metalDark);
  ctx.strokeStyle = metalDark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-2, -14);
  ctx.lineTo(6, -14);
  ctx.moveTo(-2, -11);
  ctx.lineTo(6, -11);
  ctx.stroke();
  // 车座 + 描边
  roundFill(ctx, -21, -34, 19, 6, 2.8, seat, metalDark);
  // 前立柱 + 车把（含握套）
  roundFill(ctx, 12, -41, 8, 15, 3.5, body, dark);
  ctx.strokeStyle = seat;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(11, -39);
  ctx.lineTo(23, -42);
  ctx.stroke();
  roundFill(ctx, 22.6, -43.8, 4.6, 4.4, 2.2, '#263238', null);
  // 车灯（灯罩 + 光环）
  ctx.beginPath();
  ctx.arc(25, -22, 3.6, 0, Math.PI * 2);
  ctx.fillStyle = '#FFE082';
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,224,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(25, -22, 2.1, 0, Math.PI * 2);
  ctx.stroke();
  // 排气管 + 管口
  roundFill(ctx, -33, -17, 11, 5, 2.4, metal, metalDark);
  roundFill(ctx, -34.4, -16.4, 3.2, 3.8, 1.6, metalDark, null);
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
