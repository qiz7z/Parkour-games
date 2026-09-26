// 本地静态服务器：供浏览器预览小游戏（node dev-preview/server.js 后访问 http://localhost:8791）
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = 8791;

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/dev-preview/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('not found: ' + p);
    }
    const mime = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.md': 'text/plain',
    }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime + '; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(data);
  });
}).listen(port, () => {
  console.log('预览地址: http://localhost:' + port);
});
