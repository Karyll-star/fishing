// Touch controls feed the same Input object used by the original mouse/keyboard game.
export class TouchControls {
  constructor(app) {
    if (!matchMedia('(pointer:coarse)').matches && !new URLSearchParams(location.search).has('touch')) return;
    this.app=app; const i=app.input;
    const root=document.createElement('div');root.className='hb-touch';root.style.display='flex';
    root.innerHTML=`<div class="hb-touch-pad"><button data-key="KeyW" aria-label="向前">↑</button><button data-key="KeyA" aria-label="向左">←</button><button data-key="KeyS" aria-label="后退">↓</button><button data-key="KeyD" aria-label="向右">→</button></div><div class="hb-touch-actions"><button data-key="KeyE">交互</button><button data-key="KeyR">鱼竿</button><button data-retrieve>收回</button><button class="hb-reel" data-reel>抛竿<small>按住蓄力</small></button></div>`;
    document.body.append(root);this.root=root;this.reel=root.querySelector('[data-reel]');
    const clear=()=>{i.mouseDown=false;i.rightDown=false;i.keys.clear();this.reel.classList.remove('is-down');};
    root.querySelectorAll('button').forEach(b=>{
      b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(!i.enabled)return;b.setPointerCapture(e.pointerId);if(b.dataset.key){i.keys.add(b.dataset.key);i.pressed.add(b.dataset.key);}if(b.hasAttribute('data-reel')){if(app.game.hud?.catchOpen){app.game.endLanding();return;}if(!app.game.rod.equipped)app.game.rod.equip(true);i.mouseDown=true;b.classList.add('is-down');}if(b.hasAttribute('data-retrieve'))i.rightDown=true;});
      const up=e=>{e.preventDefault();if(b.dataset.key)i.keys.delete(b.dataset.key);if(b.hasAttribute('data-reel')){i.mouseDown=false;b.classList.remove('is-down');}if(b.hasAttribute('data-retrieve'))i.rightDown=false;};
      b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
    });
    let look=null;
    app.engine.domElement.style.touchAction='none';
    app.engine.domElement.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;e.preventDefault();look={id:e.pointerId,x:e.clientX,y:e.clientY};app.engine.domElement.setPointerCapture(e.pointerId);});
    app.engine.domElement.addEventListener('pointermove',e=>{if(!look||look.id!==e.pointerId||!i.enabled)return;i.look.x+=(e.clientX-look.x)*.75;i.look.y+=(e.clientY-look.y)*.75;look.x=e.clientX;look.y=e.clientY;});
    app.engine.domElement.addEventListener('pointerup',()=>look=null);
    app.engine.domElement.addEventListener('pointercancel',()=>look=null);
    window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
    const tick=()=>{const g=app.game;this.root.hidden=!!g.homebound?.blocked||!!g.guide?.open||!!app.ui?.ui?._start;const st=g.rod.state;this.reel.innerHTML=g.fight?'收线<small>松手泄力</small>':g.bite?.phase==='take'?'提竿！':st==='floating'?'等咬钩':st==='windup'?'松开抛竿':g.hud?.catchOpen?'收好鱼获':'抛竿<small>按住蓄力</small>';requestAnimationFrame(tick);};requestAnimationFrame(tick);
  }
}
