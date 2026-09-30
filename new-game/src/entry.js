import './homebound/entry.css';

// The front door stays usable even on browsers without a WebGPU device.
const query = new URLSearchParams(location.search);
if (query.has('play')) {
  import('./main.js').catch(showImportError);
} else {
  const front = document.createElement('main');
  front.className = 'voyage-front';
  front.innerHTML = `<div class="voyage-shade"></div><header><span class="voyage-mark">潮 / 途</span><span>一竿一程，向海而生</span><span>中文改造版 · v0.1</span></header>
  <section class="voyage-intro"><p class="voyage-kicker">TIDEWATER · HOMEBOUND</p><h1>潮汐归途<span>把每一次咬钩，<br>变成回家的希望。</span></h1><p class="voyage-description">风暴过后，你在陌生的沙滩醒来。<br>握紧旧鱼竿，与岛民交换物资，修好小船。<br>从漂木湾到风暴礁，家的灯火始终在远方。</p>
  <div class="voyage-choices"><button id="voyage-3d"><span>01 / 沉浸探索</span><b>进入 3D 海岛 <i>↗</i></b><small>真实海浪 · 自由行走 · 驾船垂钓</small></button><a href="./portable.html"><span>02 / 随时开钓</span><b>轻量触屏版 <i>→</i></b><small>手机操作 · 微信小游戏玩法 · 快速进入</small></a></div>
  <div class="voyage-quality"><label>3D 画质 <select id="voyage-quality"><option value="balanced">均衡</option><option value="high">高画质</option><option value="low">流畅</option></select></label><p id="voyage-support">正在检查浏览器图形支持…</p></div></section>
  <footer><div><span>01 钓鱼与交易</span><span>02 修船与挑战</span><span>03 逐岛归航</span></div><p>广告与内购均为演示，不扣款。进度自动保存在当前设备。<br>基于 Daniel Greenheck / DRG Software Solutions LLC 的 Tidewater，保留 MIT 及素材许可。</p></footer>`;
  document.body.append(front);
  document.querySelector('#fps')?.setAttribute('hidden','');
  document.querySelector('#loader')?.setAttribute('hidden','');
  const start = front.querySelector('#voyage-3d'), status = front.querySelector('#voyage-support');
  let gpuReady = false;
  start.disabled = true;
  if (navigator.gpu) {
    try { gpuReady = !!await navigator.gpu.requestAdapter(); } catch (_) { /* show portable route */ }
  }
  start.disabled = !gpuReady;
  status.textContent = gpuReady ? '支持 3D · 首次准备光影可能需要 1～2 分钟' : '当前浏览器无法运行 3D，请选择轻量触屏版';
  start.onclick = () => {
    const quality = front.querySelector('#voyage-quality').value;
    const params = new URLSearchParams({play:'1'});
    if (quality === 'balanced') params.set('scale','.7');
    if (quality === 'low') { params.set('scale','.5'); params.set('noClouds',''); params.set('noHaze',''); params.set('noCaustics',''); }
    location.search = params.toString();
  };
}

function showImportError(error) {
  const note = document.querySelector('.loader-status');
  if (note) note.textContent = '3D 资源未能载入：' + error.message;
  const link = document.createElement('a'); link.href='./portable.html'; link.textContent='进入轻量触屏版';
  link.style.cssText='position:fixed;bottom:30px;right:30px;z-index:99999;padding:16px;background:#edcd8a;color:#123;';
  document.body.append(link);
}
