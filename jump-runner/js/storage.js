// 本地存档：最高分 / 金币总额 / 皮肤 / 坐骑 / 历史记录
const KEY = 'jumpy_save_v1';

function normalizeHistory(h) {
  if (!Array.isArray(h)) return [];
  return h
    .filter((r) => r && typeof r.s === 'number' && !isNaN(r.s))
    .map((r) => ({ s: Math.max(0, r.s | 0), d: typeof r.d === 'string' ? r.d : '' }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8);
}

function normalize(d) {
  // 坐骑：必须是已拥有的坐骑，否则回退（初始赠送自行车）
  const ownedMounts = Array.isArray(d.ownedMounts) && d.ownedMounts.indexOf('none') >= 0
    ? d.ownedMounts
    : ['none', 'bicycle'];
  const mount = typeof d.mount === 'string' && ownedMounts.indexOf(d.mount) >= 0 ? d.mount : 'none';
  // 皮肤：必须是已拥有的皮肤，否则回退到经典款
  const owned = Array.isArray(d.owned) && d.owned.indexOf('classic') >= 0 ? d.owned : ['classic'];
  const skin = typeof d.skin === 'string' && owned.indexOf(d.skin) >= 0 ? d.skin : 'classic';
  return {
    best: Math.max(0, d.best | 0),
    coins: Math.max(0, d.coins | 0),
    skin,
    owned,
    mount,
    ownedMounts,
    history: normalizeHistory(d.history),
    mute: !!d.mute,
  };
}

function load() {
  try {
    const raw = wx.getStorageSync(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* 解析失败按新档处理 */ }
  // 兼容旧版仅存最高分的数据
  let best = 0;
  try {
    best = parseInt(wx.getStorageSync('jumpy_best'), 10) || 0;
  } catch (e) { /* 忽略 */ }
  return {
    best,
    coins: 0,
    skin: 'classic',
    owned: ['classic'],
    mount: 'bicycle',
    ownedMounts: ['none', 'bicycle'],
    history: [],
  };
}

function save(profile) {
  try {
    wx.setStorageSync(KEY, JSON.stringify(normalize(profile)));
  } catch (e) { /* 存储失败不影响游戏 */ }
}

module.exports = { load, save };
