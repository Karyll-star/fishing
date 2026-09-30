import { CHAPTERS } from './Expedition.js';
import { UPGRADES, nextLevel } from '../game/Gear.js';
import { FISH } from '../game/FishTable.js';
import { Monetization } from '../platform/Monetization.js';
import { CATALOG } from '../platform/config.js';

const el = (tag, cls, html = '') => {
  const node = document.createElement(tag); node.className = cls; node.innerHTML = html; return node;
};
const materialName = { wood: '漂流木', rope: '绳索', metal: '金属' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (action, label, disabled = false, kind = '') => `<button class="hb-button ${kind}" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;

export class HomeboundUI {
  constructor(game) {
    this.game = game; this.exp = game.expedition; this.s = game.state;
    this.pay = new Monetization(); this.panel = null; this.busy = false; this.rescue=this.exp.rescueCandidate;
    this.root = el('div', 'hb-root');
    this.root.innerHTML = `<aside class="hb-quest"></aside><nav class="hb-nav" aria-label="冒险菜单">
      <button data-action="fish">码头钓鱼</button><button data-action="journey">航海日志 <kbd>J</kbd></button>
      <button data-action="camp">营地交易</button><button data-action="gear">装备</button><button data-action="supply">漂流补给</button>
      </nav><div class="hb-boss" hidden></div><div class="hb-modal" hidden></div><div class="hb-ad" hidden></div>`;
    document.body.append(this.root);
    this.quest = this.root.querySelector('.hb-quest'); this.modal = this.root.querySelector('.hb-modal');
    this.ad = this.root.querySelector('.hb-ad'); this.boss = this.root.querySelector('.hb-boss');
    this.root.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (b && !b.disabled) this.action(b.dataset.action); });
    for (const type of ['mousedown','pointerdown','touchstart','wheel']) this.root.addEventListener(type, e => e.stopPropagation(), {passive: true});
    window.addEventListener('keydown', e => {
      if (e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.code === 'KeyJ') { e.preventDefault(); this.panel ? this.close() : this.open('journey'); }
      if (e.code === 'Escape' && !this.busy) this.close();
    });
    document.addEventListener('visibilitychange', () => this.clearInput());
    this.s.onChange(() => { this.refresh(); if (this.panel && !this.busy) this.render(); });
    this.configureWeather(); this.refresh();
  }
  get blocked() { return !!this.panel || this.busy || document.hidden; }
  clearInput() { const i=this.game.app.input; i.keys.clear(); i.pressed.clear(); i.mouseDown=false; i.rightDown=false; i.look.x=i.look.y=0; }
  configureWeather() {
    const app=this.game.app, n=this.exp.chapter;
    this.game.stand.vendor.name=`${this.exp.current.npc} · 鱼获与物资`;
    app.settings.timeOfDay=[10.2,6.4,17.7][n]; app.settings.timeSpeed=0.008;
    if (app.clouds) app.clouds.coverage.value=[0.32,0.7,0.9][n];
    if (app.haze) app.haze.density.value=[0.65,2.5,1.3][n];
    app.fft.swell.scale=[0.35,0.48,0.75][n]; app.fft.updateSpectrumUniforms();
  }
  refresh() {
    this.root.classList.toggle('hb-harbor',this.exp.data.harborSkin);
    const c=this.exp.current, tasks=this.exp.objectives.filter(t=>!t.done), task=tasks[0];
    this.quest.innerHTML=`<span class="hb-eyebrow">潮汐归途 · 第 ${this.exp.chapter+1} 站</span><h1>${esc(c.name)}</h1>
      <p>${this.exp.finished ? '远处的灯塔亮了。你终于找到了回家的航线。' : task ? `${esc(task.label)} <b>${task.current}/${task.target}</b>` : '航线已经畅通，打开日志扬帆出发。'}</p>
      <div class="hb-materials">${Object.entries(this.exp.materials).map(([k,v])=>`<span>${materialName[k]||esc(k)} <b>${v}</b></span>`).join('')}</div>`;
  }
  update() {
    const g=this.game;
    g.app.input.enabled=!this.blocked && !g.guide?.open;
    const hidden=!!g.app.ui?.ui?._start || !!g.guide?.open;
    this.root.classList.toggle('hb-hidden', hidden);
    const f=g.fight;
    this.boss.hidden=!g._bossToken;
    if (g._bossToken && f) this.boss.innerHTML=`<span>海域首领</span><strong>${esc(this.exp.current.boss.name)}</strong><div><i style="width:${f.stamina*100}%"></i></div><small>${f.surge>.55 ? '正在冲刺 · 松手泄力' : '保持绿色张力 · 按住收线'}</small>`;
  }
  open(panel) {
    const g=this.game;
    if (g.fight || g.bite || ['windup','flying','flick','retrieving'].includes(g.rod.state)) return g.toast('先完成这次钓鱼，或用鼠标右键收回鱼线');
    g.endLanding(); g.hud.toggleInventory(false); g.hud.closeStand();
    this.panel=panel; this.clearInput(); document.exitPointerLock?.(); this.modal.hidden=false;
    this.render(); this.modal.querySelector('button')?.focus();
  }
  close() { if (this.busy) return; this.panel=null; this.modal.hidden=true; this.clearInput(); this.game.app.input.enabled=true; }
  result(r) { if (r?.message) this.game.toast(r.message,3500); this.refresh(); if(this.panel)this.render(); }
  moveToPier() {
    const g=this.game,p=g.app.player;
    if(g.fight) return false;
    g.cancelLine(true); g.endLanding(); g.app.setFreeCam(false);
    g.app.boatCtl.driven=false; p.mode='walk'; p.position.set(55,2.3,36);
    p.velocity.set(0,0,0); p.yaw=Math.PI; p.pitch=-.08; p._camY=null; p.waterMean=null;
    g.rod.equip(true); return true;
  }
  async action(a) {
    if(this.busy) return;
    if(a==='close') return this.close();
    if(['journey','camp','gear','supply','store','help'].includes(a)) return this.open(a);
    if(a==='fish') { if(this.moveToPier()) {this.close();this.game.toast('面对海面，按住鼠标左键蓄力，松开抛竿',4200);this.game.app.input.requestLock();} return; }
    if(a==='repair') return this.result(this.exp.repair());
    if(a==='boss') { this.close(); this.moveToPier(); this.game.startBoss(); this.game.app.input.requestLock(); return; }
    if(a==='sail') {
      const r=this.exp.sail(); this.result(r);
      if(r.ok && !this.exp.finished) {this.modal.innerHTML='<section class="hb-dialog hb-voyage"><span class="hb-eyebrow">新的海风正在靠近</span><h2>收好鱼竿，扬帆出航。</h2><p>正在驶向下一座岛屿…</p></section>';setTimeout(()=>location.reload(),1800);}
      return;
    }
    if(a.startsWith('barter:')) return this.result(this.exp.barter(a.split(':')[1]));
    if(a.startsWith('gear:')) {const r=this.game.buy(a.split(':')[1]);if(!r)this.game.toast('贝币不足，去钓几条鱼吧');return;}
    if(a==='sell') return this.game.sellAll();
    if(a.startsWith('sell:')) return this.game.sell([Number(a.split(':')[1])]);
    if(a==='fuel') return this.game.refuel();
    if(a.startsWith('reward:')) return this.reward(a.split(':')[1]);
    if(a.startsWith('buy:')) return this.purchase(a.slice(4));
    if(a==='home') location.href='./';
  }
  render() {
    if(!this.panel)return;
    const c=this.exp.current,s=this.s;
    const titles={journey:'一段一段，驶向家的方向',camp:`${esc(c.npc)}的交换小铺`,gear:'罗叔的修船棚',supply:'海浪送来一只补给箱',store:'潮途 · 远行商店',help:'在海风里，学会钓鱼'};
    let content='';
    if(this.panel==='journey') {
      content=`<div class="hb-route">${CHAPTERS.map((ch,i)=>`<div class="${i===this.exp.chapter?'active':''} ${i<this.exp.chapter?'done':''}"><span>0${i+1}</span><b>${esc(ch.name)}</b><small>${i<this.exp.chapter?'已通航':i===this.exp.chapter?'当前位置':'等待解锁'}</small></div>`).join('')}</div>
        <p class="hb-story">${this.exp.finished?'你把航海日志合上。灯塔、炊烟和熟悉的港口就在前方。一路上换来的物资、修好的船，终于带你回到了家。你也可以留在海上，继续收集鱼类。':esc(c.story)}</p>
        <div class="hb-objectives">${this.exp.objectives.map(t=>`<div class="${t.done?'done':''}"><span>${t.done?'✓':'○'} ${esc(t.label)}</span><b>${t.current}/${t.target}</b></div>`).join('')}</div>
        <div class="hb-repair">修船物资：${Object.entries(c.repairCost).map(([k,v])=>`${materialName[k]} ${v}`).join(' · ')}</div>
        <div class="hb-actions">${button('repair',this.exp.repaired?'船已修好':'交付物资 · 修船',this.exp.repaired)}${button('boss',`挑战 ${esc(c.boss.name)}`,!this.exp.canChallenge())}${button('sail',this.exp.chapter===2?'驶向家乡':'前往下一座岛',!this.exp.bossDefeated||this.exp.finished)}</div>
        <p class="hb-note">首领挑战失败可以免费重试。购买装备、收集材料都能通过钓鱼完成。</p>`;
    } else if(this.panel==='camp') {
      content=`<div class="hb-quote">“鱼留下，修船的东西你拿走。等风小一点，我们一起出发。”<span>— ${esc(c.npc)}</span></div>
        <div class="hb-grid">${['wood','rope','metal'].map(k=>`<article><span class="hb-card-symbol">${{wood:'▤',rope:'∞',metal:'⬡'}[k]}</span><h3>${materialName[k]}</h3><p>任意 1 条鱼 → 1 份材料</p>${button('barter:'+k,'用鱼交换',!s.inventory.length)}</article>`).join('')}</div>
        <div class="hb-section-title"><h3>今日鱼获 <small>${s.inventory.length} 条 · ${s.holdKg.toFixed(1)} kg</small></h3>${button('sell',`全部出售 · ${s.holdValue} 贝币`,!s.inventory.length,'secondary')}</div>
        <p class="hb-note">交换优先使用价值最低的鱼。先留好修船的份额，再出售换装备。</p>
        <div class="hb-fish-list">${s.inventory.map(f=>`<div><span>${esc(FISH[f.species].name)} <small>${f.kg.toFixed(2)} kg</small></span>${button('sell:'+f.id,`${f.value} 贝币` ,false,'secondary')}</div>`).join('')||'<p class="hb-empty">鱼箱空空的。去码头抛出第一竿吧。</p>'}</div>`;
    } else if(this.panel==='gear') {
      content=`<p class="hb-story">更强的鱼线、更顺滑的卷线器，会让你在首领冲刺时多一分把握。</p><div class="hb-shop-list">${Object.entries(UPGRADES).map(([k,u])=>{const n=nextLevel(s.upgrades,k);return `<article><div><h3>${esc(u.name)}</h3><small>已装备：${esc(u.levels[s.upgrades[k]]?.label)}</small><p>${n?esc(n.label):'已经升到最高级'}</p></div>${button('gear:'+k,n?`${n.cost} 贝币`:'已满级',!n||n.cost>s.money)}</article>`;}).join('')}</div><div class="hb-actions">${button('fuel',`补充燃油 · 约 ${s.refuelCost()} 贝币`,s.fuelL>=s.stats.fuelL)}</div>`;
    } else if(this.panel==='supply') {
      const remaining=this.exp.dailyAdsRemaining;
      content=`<div class="hb-crate"><span>潮途</span><strong>海上补给站</strong><small>合作品牌展示位 · 当前为虚构品牌演示</small></div>
        <p class="hb-story">需要一点帮助时再打开它。今日还可领取 <b>${remaining}</b> 次视频奖励。</p><div class="hb-grid">
        <article><h3>漂流物资箱</h3><p>免费主线之外的额外修船补给。</p>${button('reward:supplies','观看演示 · 领物资',remaining<1)}</article>
        <article><h3>潮途鱼饵包</h3><p>缩短咬钩等待，普通鱼饵无限使用。</p>${button('reward:bait','观看演示 · 领鱼饵',remaining<1)}</article>
        <article><h3>试用专业装备</h3><p>限时体验鱼线和卷线器加成。</p>${button('reward:trial','观看演示 · 试装备',remaining<1)}</article>
        <article><h3>鱼获额外奖励</h3><p>最近一次鱼获的等值贝币，每条只可领取一次。</p>${button('reward:double','观看演示 · 领贝币',!this.exp.canClaimReward('double').ok)}</article>
        ${this.rescue?`<article><h3>救回刚才的鱼</h3><p>${esc(FISH[this.rescue.species].name)} · ${this.rescue.kg.toFixed(2)} kg</p>${button('reward:rescue','观看演示 · 救回鱼获',remaining<1)}</article>`:''}</div>
        <div class="hb-actions">${button('store','逛逛远行商店',false,'secondary')}</div><p class="hb-note">演示视频不产生广告收入，提前关闭不领取奖励。普通钓鱼、通航和首领重试不限次数。</p>`;
    } else if(this.panel==='store') {
      content=`<div class="hb-grid">${CATALOG.map(p=>`<article><span class="hb-tag">内购演示</span><h3>${esc(p.name||p.title)}</h3><p>${esc(p.description||'旅途中的一份小小补给')}</p>${button('buy:'+(p.sku||p.id),`体验领取 · ${esc(p.priceLabel||p.priceText||'演示商品')}`)}</article>`).join('')}</div><p class="hb-note">本版本不扣款。正式购买须接入微信支付与服务端订单发货，主线不依赖购买。</p>`;
    }
    this.modal.innerHTML=`<section class="hb-dialog" role="dialog" aria-modal="true" aria-label="${titles[this.panel]}"><header><div><span class="hb-eyebrow">潮汐归途 / ${esc(c.name)}</span><h2>${titles[this.panel]}</h2></div><button class="hb-close" data-action="close" aria-label="关闭">×</button></header><div class="hb-dialog-body">${content}</div><footer><span>贝币 <b>${s.money}</b> · 进度自动保存</span>${button('fish','回到码头',false,'secondary')}</footer></section>`;
  }
  simulate({product}={}) {
    return new Promise(resolve=>{
      const purchase=!!product; let left=purchase?0:5, timer;
      this.ad.hidden=false;
      this.ad.innerHTML=`<section class="hb-ad-card" role="dialog" aria-modal="true"><span class="hb-tag">${purchase?'内购流程演示 · 不会扣款':'激励广告演示 · 非真实广告'}</span><div class="hb-ad-art"><span>潮途</span><b>下一次咬钩<br>就在浪花之后</b><i></i></div><h2>${purchase?esc(product.name||product.title):'为下一段航程，补充一点底气'}</h2><p>${purchase?'点击体验领取，查看商品到账效果。':'完整观看后才能领取，关闭可以随时继续游戏。'}</p><button class="hb-button" data-claim ${left?'disabled':''}>${purchase?'体验领取':`观看中 ${left}s`}</button><button class="hb-button secondary" data-skip>${purchase?'取消':'提前关闭 · 不领取'}</button></section>`;
      const claim=this.ad.querySelector('[data-claim]');
      const finish=completed=>{clearInterval(timer);this.ad.hidden=true;this.ad.innerHTML='';resolve(completed);};
      this.ad.querySelector('[data-skip]').onclick=()=>finish(false);
      claim.onclick=()=>{if(!left)finish(true);};
      if(left)timer=setInterval(()=>{if(document.hidden)return;left--;claim.textContent=left?`观看中 ${left}s`:'观看完成 · 领取奖励';claim.disabled=left>0;},1000);
    });
  }
  async reward(kind) {
    const allowed=this.exp.canClaimReward(kind);if(!allowed.ok)return this.result(allowed);
    this.busy=true;this.clearInput();
    try {
      const r=await this.pay.rewarded(kind,{simulate:()=>this.simulate()});
      if(r.completed) {const grant=this.exp.claimReward(kind,r.receipt);this.result(grant);if(kind==='rescue'&&grant.ok)this.rescue=null;}
      else this.game.toast('已关闭，本次未领取奖励');
    } catch(e){this.game.toast(e.message,4500);} finally{this.busy=false;this.render();}
  }
  async purchase(sku) {
    this.busy=true;
    try {
      const r=await this.pay.purchase(sku,{simulate:args=>this.simulate(args)});
      if(r.completed && r.mode==='demo') {
        this.result(this.exp.claimDemoPurchase(sku,r.receipt));
      } else if(r.completed) this.game.toast('订单已确认，请同步服务端背包');
    }catch(e){this.game.toast(e.message,4500);}finally{this.busy=false;this.render();}
  }
  offerRescue(f) {this.rescue={species:f.species,kg:f.kg};this.exp.offerRescue?.(f.species,f.kg,this.game.hour);this.game.toast('鱼跑掉了。可在「漂流补给」自愿观看视频救回',4000);}
  bossResult(won) {this.game.toast(won?'航道首领已击败！打开航海日志前往下一站。':'首领暂时退去。调整装备后可以免费再挑战。',6500);this.refresh();}
}
