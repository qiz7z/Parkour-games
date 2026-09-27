// 浏览器环境的 wx 桩：把微信小游戏 API 映射到浏览器能力
(function () {
  const canvas = document.getElementById('game');
  const store = {};
  let audioCtx = null;
  let odc = null;

  function resize() {
    canvas.width = Math.round(innerWidth * devicePixelRatio);
    canvas.height = Math.round(innerHeight * devicePixelRatio);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  resize();
  // 游戏的缩放系数在启动时确定；开发预览里窗口尺寸真正变化时才刷新
  let lastW = innerWidth;
  let lastH = innerHeight;
  let resizeTimer = null;
  addEventListener('resize', () => {
    if (innerWidth < 50 || innerHeight < 50) return; // 面板折叠成退化尺寸时忽略
    if (innerWidth === lastW && innerHeight === lastH) return;
    lastW = innerWidth;
    lastH = innerHeight;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => location.reload(), 200);
  });

  let mainCanvasUsed = false;
  window.wx = {
    // 与真机一致：首次调用返回屏幕画布，后续调用返回离屏画布
    createCanvas: () => {
      if (!mainCanvasUsed) {
        mainCanvasUsed = true;
        return canvas;
      }
      return document.createElement('canvas');
    },
    getWindowInfo: () => ({
      windowWidth: Math.max(1, innerWidth),
      windowHeight: Math.max(1, innerHeight),
      pixelRatio: devicePixelRatio,
    }),
    onTouchStart: (h) => {
      canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        h({ changedTouches: [{ clientX: e.clientX, clientY: e.clientY }] });
      });
    },
    onTouchMove: (h) => {
      canvas.addEventListener('pointermove', (e) => {
        h({ changedTouches: [{ clientX: e.clientX, clientY: e.clientY }] });
      });
    },
    onTouchEnd: (h) => {
      canvas.addEventListener('pointerup', (e) => {
        h({ changedTouches: [{ clientX: e.clientX, clientY: e.clientY }] });
      });
    },
    onTouchCancel: (h) => {
      canvas.addEventListener('pointercancel', () => h({}));
    },
    getStorageSync: (k) => (k in store ? store[k] : ''),
    setStorageSync: (k, v) => { store[k] = v; },
    createWebAudioContext: () => (audioCtx = audioCtx || new AudioContext()),
    setUserCloudStorage() { /* 浏览器预览无云存储 */ },
    // 开放数据域桩：给一块带提示文字的画布，排行榜弹层里能看到降级效果
    getOpenDataContext: () => {
      if (!odc) {
        odc = document.createElement('canvas');
        odc.width = 400;
        odc.height = 560;
        const c = odc.getContext('2d');
        c.fillStyle = '#F5F7FA';
        c.fillRect(0, 0, 400, 560);
        c.fillStyle = '#B0BEC5';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = 'bold 20px sans-serif';
        c.fillText('好友排行', 200, 60);
        c.font = '15px sans-serif';
        c.fillText('需在微信开发者工具', 200, 260);
        c.fillText('或真机中查看', 200, 290);
      }
      return { canvas: odc, postMessage() {} };
    },
  };
})();
