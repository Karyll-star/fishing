import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(project, 'dist');
const port = Number(process.env.PORT || 5191);
const url = `http://127.0.0.1:${port}/`;
const openOnReady = process.argv.includes('--open');
function openGame() {
  if (!openOnReady) return;
  const opener = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${url}"`], { windowsHide: true, stdio: 'ignore' })
    : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
  opener.on('error', error => console.error(`请手动打开 ${url}：${error.message}`));
  opener.unref();
}
if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('请先运行 npm install 和 npm run build，或下载包含 dist 的浏览器版本。');
  process.exit(1);
}
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ogg':'audio/ogg','.wasm':'application/wasm','.glb':'model/gltf-binary','.bin':'application/octet-stream','.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400);res.end('Bad request');return; }
  if (pathname === '/__homebound/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ app: 'tidewater-homebound' }));
    return;
  }
  const target = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403);res.end('Forbidden');return; }
  fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404);res.end('Not found');return; }
    res.writeHead(200, {'Content-Type':mime[path.extname(target)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});
    fs.createReadStream(target).pipe(res);
  });
});
server.on('error', error => {
  if (error.code !== 'EADDRINUSE') {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const request = http.get(`${url}__homebound/health`, response => {
    let body = '';
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => {
      if (body === JSON.stringify({ app: 'tidewater-homebound' })) {
        console.log(`游戏已在运行：${url}`);
        openGame();
      } else {
        console.error(`端口 ${port} 被其他程序占用，请设置 PORT 后重新启动。`);
        process.exitCode = 1;
      }
    });
  });
  request.setTimeout(2000, () => request.destroy(new Error('检查现有游戏服务超时')));
  request.on('error', error => { console.error(error.message); process.exitCode = 1; });
});
server.listen(port, '127.0.0.1', () => {
  console.log(`潮汐归途已启动：${url}\n关闭此窗口或按 Ctrl+C 停止本地服务。`);
  openGame();
});
