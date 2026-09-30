import { PortableGame } from './PortableGame.js';
const canvas=document.getElementById('portable-game');
let storage;try{storage=localStorage;}catch{storage=null;}
const game=new PortableGame({canvas,width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio,storage,vibrate:()=>{try{navigator.vibrate?.(30);}catch{}}});
function position(e){const r=canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top,e.pointerId];}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);game.pointerDown(...position(e));});
canvas.addEventListener('pointermove',e=>game.pointerMove(...position(e)));
canvas.addEventListener('pointerup',e=>game.pointerUp(...position(e)));
canvas.addEventListener('pointercancel',()=>game.release());
canvas.addEventListener('lostpointercapture',()=>game.release());
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(game.panel){e.preventDefault();game.panelScroll=Math.max(0,Math.min(game.maxScroll,game.panelScroll+e.deltaY*.6));}},{passive:false});
window.addEventListener('resize',()=>game.resize(innerWidth,innerHeight,devicePixelRatio));
window.addEventListener('blur',()=>game.release());
document.addEventListener('visibilitychange',()=>game.setHidden(document.hidden));
window.addEventListener('pagehide',()=>game.state.save());
let last=performance.now();
function frame(now){game.update((now-last)/1000);last=now;game.draw();requestAnimationFrame(frame);}
requestAnimationFrame(frame);
