import { PortableGame } from './PortableGame.js';
import { Monetization } from '../platform/Monetization.js';
import { MONETIZATION_CONFIG } from '../platform/config.js';

const canvas=wx.createCanvas();
const storage={getItem:key=>wx.getStorageSync(key)||null,setItem:(key,value)=>wx.setStorageSync(key,value)};
const info=()=>typeof wx.getWindowInfo==='function'?wx.getWindowInfo():wx.getSystemInfoSync();
const windowInfo=info();
const commerce=new Monetization({...MONETIZATION_CONFIG,wx});
const game=new PortableGame({canvas,width:windowInfo.windowWidth,height:windowInfo.windowHeight,pixelRatio:windowInfo.pixelRatio,
  topInset:Math.max(32,windowInfo.safeArea?.top||0),bottomInset:16,storage,commerce,vibrate:()=>wx.vibrateShort?.({type:'light'})});
const touch=(event,method)=>{for(const t of event.changedTouches||[])game[method](t.clientX??t.pageX,t.clientY??t.pageY,t.identifier);};
wx.onTouchStart(e=>touch(e,'pointerDown'));wx.onTouchMove(e=>touch(e,'pointerMove'));wx.onTouchEnd(e=>touch(e,'pointerUp'));wx.onTouchCancel(()=>game.release());
wx.onHide(()=>game.setHidden(true));wx.onShow(()=>game.setHidden(false));
wx.onWindowResize?.(()=>{const i=info();game.resize(i.windowWidth,i.windowHeight,i.pixelRatio,Math.max(32,i.safeArea?.top||0),16);});
wx.setKeepScreenOn?.({keepScreenOn:true});
let last=Date.now();
const raf=typeof requestAnimationFrame==='function'?requestAnimationFrame:canvas.requestAnimationFrame.bind(canvas);
function frame(){const now=Date.now();game.update((now-last)/1000);last=now;game.draw();raf(frame);}
raf(frame);
