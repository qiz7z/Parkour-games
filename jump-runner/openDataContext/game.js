// 开放数据域：好友排行榜（在微信/开发者工具中由小游戏主域拉起）
// 主域通过 postMessage({type:'score'}) 通知刷新；渲染结果画在共享画布上，由主域绘制到排行榜弹层
const sharedCanvas = wx.getSharedCanvas();
const ctx = sharedCanvas.getContext('2d');
sharedCanvas.width = 400;
sharedCanvas.height = 560;

const RANK_COLORS = ['#FFB300', '#B0BEC5', '#CD7F32'];

function safe(fn) {
  try {
    fn();
  } catch (e) { /* 开放数据域内任何异常都不影响主游戏 */ }
}

function drawEmpty(msg) {
  safe(() => {
    ctx.fillStyle = '#F5F7FA';
    ctx.fillRect(0, 0, sharedCanvas.width, sharedCanvas.height);
    ctx.fillStyle = '#B0BEC5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('好友排行', 200, 60);
    ctx.font = '15px sans-serif';
    ctx.fillText(msg || '暂无好友数据', 200, 260);
    ctx.fillText('去微信里和小伙伴比一比吧', 200, 290);
  });
}

function drawList(users) {
  safe(() => {
    ctx.fillStyle = '#F5F7FA';
    ctx.fillRect(0, 0, sharedCanvas.width, sharedCanvas.height);
    ctx.fillStyle = '#37474F';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('好友排行 · 最佳成绩', 200, 42);

    users.forEach((u, i) => {
      const y = 92 + i * 46;
      // 名次徽章
      ctx.beginPath();
      ctx.arc(40, y, 15, 0, Math.PI * 2);
      ctx.fillStyle = i < 3 ? RANK_COLORS[i] : '#CFD8DC';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(String(i + 1), 40, y + 1);
      // 昵称（最多 8 字）
      ctx.fillStyle = '#37474F';
      ctx.textAlign = 'left';
      ctx.font = '16px sans-serif';
      const name = u.name.length > 8 ? u.name.slice(0, 8) + '…' : u.name;
      ctx.fillText(name, 70, y);
      // 成绩
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FB8C00';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(u.score + ' m', 370, y);
    });
  });
}

function fetchRank() {
  safe(() => {
    if (typeof wx.getFriendCloudStorage !== 'function') {
      drawEmpty('当前环境不支持好友数据');
      return;
    }
    wx.getFriendCloudStorage({
      keyList: ['bestScore'],
      success: (res) => {
        const users = (res.data || [])
          .map((u) => {
            let score = 0;
            (u.KVDataList || []).forEach((kv) => {
              if (kv.key === 'bestScore') {
                const v = parseInt(kv.value, 10);
                if (!isNaN(v) && v > score) score = v;
              }
            });
            return { name: u.nickname || '好友', score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 9);
        if (users.length === 0) drawEmpty();
        else drawList(users);
      },
      fail: () => drawEmpty(),
    });
  });
}

wx.onMessage((msg) => {
  if (msg && msg.type === 'score') fetchRank();
});

fetchRank();
