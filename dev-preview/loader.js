// 极简 CommonJS 加载器：在浏览器里以同步 require 语义加载小游戏源码模块。
// 做法：先并行预取全部模块源码，再按需同步求值（与 Node/微信运行时行为一致）。
const __codes = {}; // path -> 源码
const __mods = {};  // path -> module

// 模块清单
const MANIFEST = [
  'jump-runner/js/util.js',
  'jump-runner/js/sound.js',
  'jump-runner/js/font.js',
  'jump-runner/js/skins.js',
  'jump-runner/js/mounts.js',
  'jump-runner/js/storage.js',
  'jump-runner/js/particles.js',
  'jump-runner/js/player.js',
  'jump-runner/js/background.js',
  'jump-runner/js/world.js',
  'jump-runner/js/ui.js',
  'jump-runner/js/main.js',
];

function resolve(base, name) {
  const parts = (base ? base.split('/').slice(0, -1) : [])
    .concat(name.replace(/^\.\//, '').split('/'));
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  const joined = out.join('/');
  return joined.endsWith('.js') ? joined : joined + '.js';
}

function requireSync(from, name) {
  const path = resolve(from, name);
  if (__mods[path]) return __mods[path].exports;
  const code = __codes[path];
  if (code === undefined) throw new Error('模块未预加载: ' + path);
  const mod = { exports: {} };
  __mods[path] = mod; // 先注册，容忍循环引用
  const fn = new Function('module', 'exports', 'require', 'wx', code + '\n//# sourceURL=' + path);
  fn(mod, mod.exports, (n) => requireSync(path, n), window.wx);
  return mod.exports;
}

async function startGame(entry) {
  await Promise.all(MANIFEST.map(async (p) => {
    const res = await fetch(p);
    if (!res.ok) throw new Error('加载失败: ' + p + ' (' + res.status + ')');
    __codes[p] = await res.text();
  }));
  return requireSync('', entry);
}

window.startGame = startGame;
