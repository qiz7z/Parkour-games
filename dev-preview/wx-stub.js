// 浏览器环境的 wx 桩：把微信小游戏 API 映射到浏览器能力
(function () {
  const canvas = document.getElementById('game');
  // localStorage 持久化存档：刷新页面不丢失解锁/存档状态
  const store = {
    get(k) { try { return localStorage.getItem('jumpy_' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('jumpy_' + k, v); } catch (e) {} },
  };
  let audioCtx = null;
  let odc = null;

  // 预览固定 1:1 渲染：面板的 devicePixelRatio 会在加载过程中漂移（1.75 → 1.0），
  // 按 dpr 设置画布会导致画布尺寸与游戏坐标系错位（画面被裁切/错位）
  function resize() {
    canvas.width = Math.round(innerWidth);
    canvas.height = Math.round(innerHeight);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  resize();
  // 面板尺寸在页面加载后会短暂漂移（先 1200x700 再落定到真实尺寸），
  // 游戏按旧尺寸启动后画布被缩小 → 只画出左上角（画面错位）且自检会无限重载。
  // 方案：等尺寸落定后再校准一次，不匹配则重载（重载后尺寸已稳定，不会循环）。
  setTimeout(() => {
    if (innerWidth < 50 || innerHeight < 50) return;
    if (Math.abs(canvas.width - Math.round(innerWidth)) > 2 ||
        Math.abs(canvas.height - Math.round(innerHeight)) > 2) {
      resize();
      location.reload();
    }
  }, 400);
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

  // 遮挡/后台窗口里 setTimeout 会被 Chrome 节流到约 1 次/秒（游戏变成 1 FPS 幻灯片），
  // 原生 rAF 在遮挡时也可能不触发：改用 Web Worker 计时泵帧（Worker 不受页面可见性节流）
  const rafQueue = new Set();
  try {
    const workerSrc = 'setInterval(function(){ postMessage(0); }, 16);';
    const pump = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' })));
    pump.onmessage = () => {
      const now = Date.now();
      for (const cb of Array.from(rafQueue)) {
        rafQueue.delete(cb);
        cb(now);
      }
    };
    window.requestAnimationFrame = (cb) => {
      rafQueue.add(cb);
      return rafQueue.size;
    };
  } catch (e) {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  }

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
      pixelRatio: 1, // 预览固定 1:1（见 resize 注释）
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
    getStorageSync: (k) => store.get(k) ?? '',
    setStorageSync: (k, v) => { store.set(k, v); },
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
