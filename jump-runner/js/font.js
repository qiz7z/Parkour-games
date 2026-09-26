// 字体加载：优先「得意黑 Smiley Sans」（免费可商用，运动斜体气质），
// 加载失败自动回退系统字体。所有 UI 文字请通过 b()/r() 获取字体字符串。
//
// 浏览器预览：注入 npm 分片字体 CSS（按需加载 woff2）
// 微信小游戏：
//   方案 A（推荐发布用）：把 SmileySans-Oblique.ttf 放入代码包 fonts/ 目录
//         （官方下载：https://github.com/atelier-anchor/smiley-sans/releases）
//   方案 B：开发调试时也可用 wx.downloadFile + loadFont 走网络字体（需配置下载域名）
const FAMILY = 'Smiley Sans Oblique';
const CSS_URL = 'https://cdn.jsdelivr.net/npm/cn-fontsource-smiley-sans-oblique-regular/font.css';
const PKG_FONT = '/fonts/SmileySans-Oblique.ttf';

let family = null;

function browserSetup() {
  try {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
    family = FAMILY;
  } catch (e) {
    family = null;
  }
}

function wechatSetup() {
  try {
    if (typeof wx.loadFont === 'function') {
      const f = wx.loadFont(PKG_FONT);
      if (f) family = f;
    }
  } catch (e) {
    family = null;
  }
}

function init() {
  try {
    if (typeof document !== 'undefined') browserSetup();
    else if (typeof wx !== 'undefined') wechatSetup();
  } catch (e) {
    family = null;
  }
  return family;
}

function fam() {
  return family || 'sans-serif';
}

// 粗体（标题/数字/按钮）
function b(size) {
  return 'bold ' + size + 'px "' + fam() + '"';
}

// 常规（正文/说明）
function r(size) {
  return size + 'px "' + fam() + '"';
}

init();

module.exports = { init, fam, b, r };
