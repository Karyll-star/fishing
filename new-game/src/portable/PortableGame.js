import { GameState } from '../game/GameState.js';
import { FISH } from '../game/FishTable.js';
import { UPGRADES, nextLevel } from '../game/Gear.js';
import { pickSpecies, rollWeight, biteDelay } from '../game/Bites.js';
import { CatchMinigame } from '../game/CatchMinigame.js';
import { Expedition, CHAPTERS } from '../homebound/Expedition.js';
import { Monetization } from '../platform/Monetization.js';
import { CATALOG } from '../platform/config.js';

const W=390,H=844;
const INK='#163e45',MUTED='#68858a',TEAL='#206777',GOLD='#e8c78e',PAPER='#f5f2e8';
const names={wood:'漂流木',rope:'绳索',metal:'金属'};
const habitats=[{shallows:0.7,pier:1,reef:0,bay:0.1,deep:0},{shallows:0,pier:0.7,reef:1,bay:0.2,deep:0},{shallows:0,pier:0.4,reef:0.6,bay:1,deep:0.5}];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/** Pure Canvas game shell: no DOM, WebGPU, window or browser-only dependency. */
export class PortableGame {
  constructor({canvas,width=390,height=844,pixelRatio=1,storage,commerce,vibrate=()=>{},topInset=0,bottomInset=0}) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.vibrate=vibrate;
    this.state=new GameState(storage);this.state.load();this.exp=new Expedition(this.state);
    this.commerce=commerce||new Monetization();this.phase='idle';this.charge=0;this.held=false;this.clock=0;
    this.buttons=[];this.panel=null;this.panelScroll=0;this.maxScroll=0;this.toastText='';this.toastTime=0;
    this.demo=null;this.busy=false;this.hidden=false;this.catchInfo=null;this.bossToken=null;this.intro=!this.exp.data.seenPortableIntro;
    this.resize(width,height,pixelRatio,topInset,bottomInset);
  }
  resize(width,height,dpr=1,top=0,bottom=0) {
    this.width=width;this.height=height;this.dpr=Math.min(2,dpr||1);
    this.canvas.width=Math.round(width*this.dpr);this.canvas.height=Math.round(height*this.dpr);
    this.scale=Math.min(width/W,(height-top-bottom)/H);this.ox=(width-W*this.scale)/2;this.oy=top+(height-top-bottom-H*this.scale)/2;
  }
  point(x,y) {return{x:(x-this.ox)/this.scale,y:(y-this.oy)/this.scale};}
  hit(b,p) {return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;}
  pointerDown(x,y,id=0) {
    if(this.pointer)return;
    const p=this.point(x,y);const b=[...this.buttons].reverse().find(b=>!b.disabled&&this.hit(b,p));
    this.pointer={id,start:p,last:p,b,moved:false};
    if(b?.hold&&!this.blocked){this.held=true;this.reelDown();}
  }
  pointerMove(x,y,id=0) {
    if(!this.pointer||this.pointer.id!==id)return;
    const p=this.point(x,y),a=this.pointer;
    if(this.panel&&!this.demo&&Math.abs(p.y-a.start.y)>7){a.moved=true;this.panelScroll=clamp(this.panelScroll+a.last.y-p.y,0,this.maxScroll);}
    a.last=p;
  }
  pointerUp(x,y,id=0,cancel=false) {
    if(!this.pointer||this.pointer.id!==id)return;
    const a=this.pointer,p=this.point(x,y);this.pointer=null;
    if(a.b?.hold){this.held=false;if(!cancel&&this.phase==='charging')this.cast();else if(cancel&&this.phase==='charging')this.phase='idle';}
    else if(!cancel&&!a.moved&&a.b&&this.hit(a.b,p)&&!a.b.disabled)a.b.action?.();
  }
  release() {this.pointer=null;this.held=false;if(this.phase==='charging')this.phase='idle';}
  setHidden(value) {this.hidden=value;this.release();this.state.save();}
  get blocked() {return this.hidden||this.panel||this.demo||this.intro||this.catchInfo||this.busy;}
  toast(message) {this.toastText=String(message);this.toastTime=4.5;}
  result(r) {this.toast(r?.message||'暂时无法操作');}
  open(panel) {
    if(this.phase!=='idle')return this.toast('先完成这次钓鱼，或收回空线。');
    this.release();this.panel=panel;this.panelScroll=0;
  }
  reelDown() {
    if(this.phase==='idle'){this.phase='charging';this.charge=0;}
    else if(this.phase==='bite')this.hook();
  }
  cast() {
    this.bonus=this.exp.fishingBonuses({consumeBait:true});
    this.distance=8+this.charge*Math.min(30,this.state.stats.castM*.64);
    const habitat={...habitats[this.exp.chapter]};
    if(this.distance>20){habitat.bay+=.3;habitat.deep+=this.exp.chapter*.12;}
    this.wait=clamp(biteDelay(habitat,10)/this.bonus.biteMul,2,9);
    this.species=pickSpecies(habitat,10)||'grunt';this.kg=rollWeight(this.species);
    this.phase='waiting';this.held=false;
  }
  hook() {
    const stats=this.state.stats,bonus=this.bonus||this.exp.fishingBonuses();
    this.fight=new CatchMinigame({species:this.species,kg:this.kg,lineKg:stats.lineKg*bonus.lineMul,reelSpeed:stats.reelSpeed*bonus.reelMul,distance:this.distance});
    this.phase='fighting';this.vibrate();
  }
  challenge() {
    const r=this.exp.beginBoss();if(!r.ok)return this.result(r);
    this.panel=null;this.bossToken=r.token;this.species=r.boss.species;this.kg=r.boss.kg;this.distance=18;
    this.bonus=this.exp.fishingBonuses();this.hook();this.held=false;
    this.toast(`${r.boss.name}上钩了！冲刺时松手，稳住张力。`);
  }
  sail() {
    const r=this.exp.sail();this.result(r);
    if(r.ok){this.panelScroll=0;this.catchInfo=null;this.phase='idle';this.panel=this.exp.finished?'ending':'journey';}
  }
  update(dt) {
    dt=clamp(dt,0,.05);if(this.hidden)return;
    this.clock+=dt;this.toastTime=Math.max(0,this.toastTime-dt);
    if(this.demo){this.demo.left=Math.max(0,this.demo.left-dt);return;}
    if(this.blocked)return;
    if(this.phase==='charging')this.charge=clamp(this.charge+dt/1.6,0,1);
    if(this.phase==='waiting'){this.wait-=dt;if(this.wait<=0){this.phase='bite';this.biteTime=3;this.vibrate();}}
    else if(this.phase==='bite'){this.biteTime-=dt;if(this.biteTime<=0){this.phase='idle';this.toast('慢了一点，鱼儿游走了。再抛一竿吧。');}}
    else if(this.phase==='fighting'){
      const outcome=this.fight.update(dt,this.held);
      if(outcome!=='fighting'){
        this.phase='idle';this.held=false;
        if(outcome==='caught'){
          let bossMessage='';
          if(this.bossToken){const result=this.exp.completeBoss(this.bossToken);bossMessage=result.message;this.bossToken=null;}
          this.state.addFish(this.species,this.kg,10);
          this.catchInfo={...this.state.lastCatch,bossMessage};this.vibrate();
        }else{
          if(this.bossToken){this.exp.failBoss(this.bossToken);this.bossToken=null;this.toast('首领游走了，材料和修船进度保留。可以免费再挑战。');}
          else{this.exp.offerRescue(this.species,this.kg,10);this.toast(outcome==='snapped'?'鱼线断了！张力变红时松手。可在补给中救回。':'鱼儿脱钩了！别让鱼线松弛太久。');}
        }
        this.fight=null;
      }
    }
  }
  demoUI({product}={}) {
    return new Promise(resolve=>{this.demo={product,left:product?0:5,resolve};this.release();});
  }
  closeDemo(completed) {const d=this.demo;if(!d)return;this.demo=null;d.resolve(completed);}
  async reward(kind) {
    if(this.busy)return;const can=this.exp.canClaimReward(kind);if(!can.ok)return this.result(can);
    this.busy=true;
    try{const r=await this.commerce.rewarded(kind,{simulate:()=>this.demoUI()});if(r.completed)this.result(this.exp.claimReward(kind,r.receipt));else this.toast('已关闭，本次没有领取奖励。');}
    catch(e){this.toast(e.message);}finally{this.busy=false;}
  }
  async purchase(sku) {
    if(this.busy)return;this.busy=true;
    try{const r=await this.commerce.purchase(sku,{simulate:args=>this.demoUI(args)});if(r.completed&&r.mode==='demo')this.result(this.exp.claimDemoPurchase(sku,r.receipt));else if(r.completed)this.toast('订单已确认，请同步服务端背包。');}
    catch(e){this.toast(e.message);}finally{this.busy=false;}
  }
  box(x,y,w,h,r=12,fill=PAPER,stroke=null) {
    const c=this.ctx;r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
    if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}
  }
  text(s,x,y,size=14,color=INK,weight=400,align='left') {
    const c=this.ctx;c.font=`${weight} ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;c.fillStyle=color;c.textAlign=align;c.textBaseline='top';c.fillText(String(s),x,y);c.textAlign='left';
  }
  wrap(s,x,y,width,size=13,color=MUTED,line=23) {
    let row='',yy=y;const c=this.ctx;c.font=`400 ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;
    for(const char of Array.from(String(s))){if(char==='\n'||c.measureText(row+char).width>width){this.text(row,x,yy,size,color);row=char==='\n'?'':char;yy+=line;}else row+=char;}
    if(row)this.text(row,x,yy,size,color);return yy+line;
  }
  button(label,x,y,w,h,action,{disabled=false,secondary=false,hold=false,small=false}={}) {
    const c=this.ctx;c.save();if(disabled)c.globalAlpha=.38;
    this.box(x,y,w,h,12,secondary?'#e7ebe5':TEAL);this.text(label,x+w/2,y+(h-(small?11:13))/2,small?11:13,secondary?INK:'#f6f5e9',600,'center');c.restore();
    const inPanel=!this.panelClip||y>=this.panelClip.top&&y+h<=this.panelClip.bottom;
    if(inPanel)this.buttons.push({x,y,w,h,action,disabled,hold});
  }
  line(x1,y1,x2,y2,color,width=1){const c=this.ctx;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  circle(x,y,r,color){const c=this.ctx;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
  draw() {
    const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#153f48';c.fillRect(0,0,this.width,this.height);
    c.translate(this.ox,this.oy);c.scale(this.scale,this.scale);c.fillStyle=PAPER;c.fillRect(0,0,W,H);this.buttons=[];this.panelClip=null;
    this.drawHome();
    if(this.panel)this.drawPanel();
    if(this.catchInfo)this.drawCatch();
    if(this.intro)this.drawIntro();
    if(this.demo)this.drawDemo();
    if(this.toastTime>0&&!this.demo){c.save();c.globalAlpha=Math.min(1,this.toastTime);this.box(25,690,340,48,12,'#153f48ed');this.wrap(this.toastText,39,700,311,11,'#f3eddc',16);c.restore();}
  }
  drawHome() {
    const exp=this.exp,s=this.state,chapter=exp.current,c=this.ctx;
    this.text('TIDEWATER  /  HOMEBOUND',20,24,9,MUTED,600);this.text('潮汐归途',20,43,26,INK,600);
    this.button(`${s.inventory.length} 条鱼 · ${s.money} 贝币`,240,42,130,35,()=>this.open('inventory'),{secondary:true,small:true});
    this.box(16,94,358,46,12,'#e5e9df');this.text(`0${exp.chapter+1}  ${chapter.name}`,30,109,13,INK,600);
    this.text(exp.finished?'已平安归航':exp.bossDefeated?'航道已开放':exp.repaired?'迎战航道首领':'用鱼换物资，修好小船',359,110,10,MUTED,400,'right');
    this.drawScene();
    this.box(16,452,358,133,16,'#fffdf6','#d8e0d8');
    let title='海风正好，抛出第一竿',hint='按住下方按钮蓄力，松开把鱼饵送进海里。';
    if(this.phase==='charging'){title='选好距离，松手抛竿';hint=`蓄力 ${Math.round(this.charge*100)}% · 越远的鱼需要收更长的线`;}
    else if(this.phase==='waiting'){title='浮漂轻轻起伏，等一等';hint='普通鱼饵无限供应。鱼儿真正咬钩时再提竿。';}
    else if(this.phase==='bite'){title='咬钩了！现在点击提竿';hint='看到浮漂下沉就立即点击，不要错过时机。';}
    else if(this.phase==='fighting'){title=this.bossToken?chapter.boss.name:FISH[this.species].name;hint=this.fight.tension>.87?'张力过高！松手泄力':this.fight.surge>.6?'鱼正在冲刺，松手让它跑一会儿':'按住收线，让张力保持在绿色区域';}
    this.text(title,32,469,17,INK,600);this.text(hint,32,499,11,MUTED);
    if(this.phase==='fighting'){
      const f=this.fight;this.bar(32,525,270,8,f.tension/1.05,'#d88e77','#e6e8dc');
      c.fillStyle='#78b6a070';c.fillRect(32+270*f.band[0]/1.05,523,270*(f.band[1]-f.band[0])/1.05,12);
      this.circle(32+clamp(f.tension/1.05,0,1)*270,529,5,'#143c46');this.text(`${f.distance.toFixed(1)}m`,351,522,10,MUTED,500,'right');
      this.text('鱼的体力',32,550,10,MUTED);this.bar(97,553,205,4,f.stamina,GOLD,'#e9e5d7');
    }else if(this.phase==='charging'){this.bar(32,535,320,8,this.charge,GOLD,'#e9e5d7');}
    else{this.text(`木材 ${exp.materials.wood}     绳索 ${exp.materials.rope}     金属 ${exp.materials.metal}`,32,545,12,TEAL);}
    const label={idle:'按住抛竿',charging:'松手抛竿',waiting:'等待咬钩',bite:'立即提竿',fighting:this.held?'正在收线':'按住收线'}[this.phase];
    this.button(label,121,605,148,70,()=>{},{hold:true,disabled:this.phase==='waiting'});
    this.text(this.phase==='fighting'?'松手泄力 · 别让张力冲进红区':'手指按住蓄力，松开抛竿',195,685,10,MUTED,400,'center');
    if(['waiting','bite'].includes(this.phase))this.button('收回',291,620,65,40,()=>{this.phase='idle';this.held=false;},{secondary:true,small:true});
    if(this.exp.trialActive)this.text(`潮途装备试用 ${Math.ceil(exp.trialSecondsRemaining/60)} 分钟`,195,722,10,TEAL,500,'center');
    else this.text(`特制饵 ${exp.bait}  ·  普通饵无限  ·  自动保存`,195,722,10,MUTED,400,'center');
    this.box(16,752,358,66,16,'#e6e9df');
    [['日志','journey'],['营地','camp'],['装备','gear'],['补给','supply']].forEach(([label,p],i)=>this.button(label,23+i*88,763,80,42,()=>this.open(p),{secondary:true}));
    this.text('轻量触屏版 · 广告与内购为演示',195,827,9,MUTED,400,'center');
  }
  bar(x,y,w,h,value,color,base){this.box(x,y,w,h,h/2,base);if(value>0)this.box(x,y,Math.max(1,w*clamp(value,0,1)),h,h/2,color);}
  drawScene() {
    const c=this.ctx,n=this.exp.chapter,t=this.clock;
    c.save();this.box(16,154,358,281,18,null);c.clip();
    const sky=c.createLinearGradient(0,154,0,285);sky.addColorStop(0,['#9dcfd0','#adb8cd','#9eafb9'][n]);sky.addColorStop(1,['#e4e4cf','#dee1d6','#e4ccb1'][n]);c.fillStyle=sky;c.fillRect(16,154,358,281);
    this.circle(307,199,23,n===2?'#e7b888':'#f4e9c1');
    c.fillStyle=['#548e83','#788d9c','#627d7e'][n];c.beginPath();c.moveTo(16,281);c.lineTo(25,235);c.lineTo(59,218);c.lineTo(83,241);c.lineTo(106,208);c.lineTo(139,245);c.lineTo(171,242);c.lineTo(209,281);c.fill();
    c.fillStyle='#456f7180';c.beginPath();c.moveTo(250,285);c.lineTo(277,254);c.lineTo(297,256);c.lineTo(325,235);c.lineTo(374,282);c.fill();
    const sea=c.createLinearGradient(0,267,0,440);sea.addColorStop(0,['#6dbbbc','#739da9','#6c97a0'][n]);sea.addColorStop(1,['#146c80','#215d78','#224d67'][n]);c.fillStyle=sea;c.fillRect(16,271,358,164);
    for(let i=0;i<26;i++){const y=278+i*6,x=16+((i*83+t*(i%2?5:-4))%358+358)%358;this.line(x,y,Math.min(374,x+22+(i%5)*5),y,'#e0ffff30',1);}
    // Sandy point, timber pier and palm are original procedural Canvas scenery.
    c.fillStyle='#e0ce9f';c.beginPath();c.moveTo(16,294);c.bezierCurveTo(58,292,44,329,94,347);c.bezierCurveTo(137,362,92,405,134,435);c.lineTo(16,435);c.fill();
    this.line(48,351,190,354,'#4b5349',23);this.line(48,344,190,347,'#ad9170',17);
    for(let i=0;i<14;i++)this.line(54+i*10,337,54+i*10,356,'#6a695b',1);
    this.line(62,346,62,374,'#635b48',4);this.line(163,349,163,377,'#635b48',4);
    this.line(45,330,37,256,'#75684c',6);this.line(37,278,47,248,'#75684c',5);
    for(let i=0;i<7;i++){const a=-Math.PI+i*.48,x=43+Math.cos(a)*45,y=258+Math.sin(a)*25;c.beginPath();c.moveTo(43,258);c.quadraticCurveTo(x,235,x+7,270);c.strokeStyle=i%2?'#28695a':'#42846b';c.lineWidth=6;c.stroke();}
    // Fisher and animated rod.
    this.circle(145,310,7,'#c49a73');this.line(145,318,142,338,this.exp.data.harborSkin?'#d0b378':'#24444a',12);
    this.line(142,335,134,345,'#343e40',4);this.line(145,335,154,345,'#343e40',4);
    c.fillStyle='#e3c88f';c.fillRect(134,304,23,4);this.box(139,298,14,9,3,'#d2b578');
    const rodX=this.phase==='charging'?169-this.charge*18:202,rodY=this.phase==='charging'?274-this.charge*14:285;
    this.line(148,323,rodX,rodY,this.exp.data.skin==='sea-salt'?'#a5e7e7':'#4a4d39',2.2);
    const active=['waiting','bite','fighting'].includes(this.phase),bobX=268+Math.sin(t*2)*4,bobY=342+Math.sin(t*2.4)*2;
    if(active){c.beginPath();c.moveTo(rodX,rodY);c.quadraticCurveTo(234,306,bobX,bobY);c.strokeStyle='#e9ecd2bd';c.lineWidth=1;c.stroke();this.circle(bobX,bobY,3,this.phase==='bite'?'#edcb71':'#e1aa79');if(this.phase==='bite'){this.text('!',bobX,bobY-37,27,'#fff0bd',700,'center');}}
    else{c.beginPath();c.moveTo(rodX,rodY);c.quadraticCurveTo(rodX+11,310,rodX-6,322);c.strokeStyle='#e8edd18a';c.stroke();}
    // Moored sailboat, rebuilt through the campaign.
    const bx=320,by=322+Math.sin(t)*2;c.fillStyle=this.exp.repaired?'#d5b377':'#786958';c.beginPath();c.moveTo(bx-24,by);c.lineTo(bx+23,by);c.lineTo(bx+14,by+10);c.lineTo(bx-16,by+10);c.closePath();c.fill();
    this.line(bx,by,bx,by-36,'#5c5544',2);if(this.exp.repaired){c.fillStyle='#efe4c0';c.beginPath();c.moveTo(bx-2,by-36);c.lineTo(bx-2,by-5);c.lineTo(bx-21,by-5);c.fill();}
    if(n===1){c.fillStyle='#e0e6e522';c.fillRect(16,255,358,60);}if(n===2)for(let i=0;i<15;i++)this.line(25+i*28,185+(t*45+i*11)%225,20+i*28,197+(t*45+i*11)%225,'#d4e4e72e');
    this.box(29,168,135,27,8,'#173e457c');this.text(`${this.exp.current.name} · ${['晴朗浅滩','晨雾礁岸','风暴海域'][n]}`,40,177,10,'#f9f2dc');
    c.restore();
  }
  panelStart(title,sub) {
    this.ctx.fillStyle='#102e4399';this.ctx.fillRect(0,0,W,H);this.box(16,103,358,642,20,PAPER);
    this.text(sub||'潮汐归途 / 海岛生活',34,124,9,MUTED,600);this.text(title,34,148,23,INK,600);
    this.button('×',325,119,32,32,()=>{this.panel=null;this.panelScroll=0;},{secondary:true});
    this.ctx.save();this.ctx.beginPath();this.ctx.rect(28,192,334,506);this.ctx.clip();this.panelClip={top:192,bottom:698};
    return 196-this.panelScroll;
  }
  panelEnd(y) {
    this.ctx.restore();this.panelClip=null;this.maxScroll=Math.max(0,y+this.panelScroll-688);
    this.text(this.maxScroll?'上下滑动查看更多':'每一次收获，都更接近家',195,719,10,MUTED,400,'center');
    if(this.maxScroll){this.box(364,200,3,480,2,'#dae0d7');this.box(364,200+this.panelScroll/this.maxScroll*390,3,90,2,'#96aeab');}
  }
  drawPanel() {
    const e=this.exp,s=this.state,c=e.current,p=this.panel;
    const titles={journey:'归家的航海日志',camp:`${c.npc}的交换小铺`,inventory:'今日鱼获',gear:'罗叔的装备铺',supply:'漂流补给站',store:'潮途 · 远行商店',ending:'欢迎回家'};
    let y=this.panelStart(titles[p],`${c.name} · ${s.money} 贝币`);
    if(p==='journey'){
      CHAPTERS.forEach((ch,i)=>{this.box(33,y,324,49,9,i===e.chapter?'#dce8dc':'#e8e9df');this.text(`0${i+1}   ${ch.name}`,46,y+11,14,i===e.chapter?TEAL:MUTED,600);this.text(i<e.chapter?'已通航':i===e.chapter?'当前位置':'等待解锁',343,y+16,10,MUTED,400,'right');y+=58;});
      y=this.wrap(c.story,34,y+7,320,12,MUTED,21)+15;
      e.objectives.forEach(t=>{this.text(`${t.done?'✓':'○'}  ${t.label}`,35,y,12,t.done?TEAL:MUTED);this.text(`${t.current}/${t.target}`,349,y,12,TEAL,500,'right');y+=29;});
      this.button(e.repaired?'船已修好':'交付材料，修好船',34,y,320,44,()=>this.result(e.repair()),{disabled:!e.canRepair()});y+=55;
      this.button(`挑战 ${c.boss.name}`,34,y,320,44,()=>this.challenge(),{disabled:!e.canChallenge()});y+=55;
      this.button(e.chapter===2?'扬帆回家':'前往下一座岛',34,y,320,44,()=>this.sail(),{disabled:!e.bossDefeated||e.finished});y+=60;
      y=this.wrap('材料来自任何一条鱼。首领失败可以免费重试，不重复消耗修船材料。',34,y,320,11,MUTED,20);
    }else if(p==='camp'){
      y=this.wrap('“把鱼留下，修船的物资你拿走。家就在下一段航程的那头。”',34,y,316,13,TEAL,24)+18;
      Object.keys(names).forEach(key=>{this.box(33,y,324,78,11,'#e8e9df');this.text(names[key],47,y+14,16,INK,600);this.text(`拥有 ${e.materials[key]} · 任意 1 条鱼换 1 份`,47,y+43,10,MUTED);this.button('交换',273,y+18,70,40,()=>this.result(e.barter(key)),{disabled:!s.inventory.length});y+=91;});
      y=this.wrap('自动优先交换价值最低的鱼。剩余鱼获可以卖成贝币，用来升级渔具。',35,y+6,316,12,MUTED,22)+15;
      this.button(`出售全部鱼获 · ${s.holdValue} 贝币`,34,y,320,44,()=>{const r=s.sell();this.toast(`卖出 ${r.count} 条鱼，获得 ${r.total} 贝币。`);},{disabled:!s.inventory.length});y+=60;
    }else if(p==='inventory'){
      this.text(`鱼箱 ${s.holdKg.toFixed(1)} / ${s.stats.holdKg} kg`,35,y,14,TEAL,600);y+=36;
      this.button(`全部出售 · ${s.holdValue} 贝币`,34,y,320,43,()=>{const r=s.sell();this.toast(`获得 ${r.total} 贝币。`);},{disabled:!s.inventory.length});y+=61;
      if(!s.inventory.length){y=this.wrap('鱼箱里空空的。回到海边抛出第一竿吧。',35,y,314,13,MUTED,23)+15;}
      s.inventory.forEach(f=>{this.text(FISH[f.species].name,35,y+7,14,INK,600);this.text(`${f.kg.toFixed(2)} kg  /  ${f.cm} cm`,35,y+29,10,MUTED);this.button(`${f.value} 贝币`,273,y+5,81,36,()=>{const r=s.sell([f.id]);this.toast(`获得 ${r.total} 贝币。`);},{secondary:true,small:true});y+=61;});
      y+=18;this.text('鱼类图鉴',35,y,17,INK,600);y+=34;
      Object.entries(FISH).forEach(([id,f])=>{const record=s.log[id];this.text(record?`${f.name} · ${record.count} 条`:'未发现的鱼',35,y,12,record?TEAL:MUTED);if(record)this.text(`纪录 ${record.bestKg.toFixed(2)} kg`,349,y,10,MUTED,400,'right');y+=29;});
    }else if(p==='gear'){
      y=this.wrap('更强的鱼线抵挡冲刺，更好的卷线器缩短收线时间。所有装备都能用鱼获赚取的贝币购买。',35,y,316,12,MUTED,22)+18;
      Object.entries(UPGRADES).filter(([key])=>['line','reel','rod','hold'].includes(key)).forEach(([key,u])=>{const next=nextLevel(s.upgrades,key);this.box(33,y,324,109,12,'#e8e9df');this.text(u.name,47,y+14,16,INK,600);this.text(`当前：${u.levels[s.upgrades[key]]?.label}`,47,y+40,10,MUTED);this.text(next?next.label:'已升至最高级',47,y+74,11,TEAL);this.button(next?`${next.cost} 贝币`:'已满级',266,y+66,78,30,()=>{const r=s.buy(key);this.toast(r?`已装备 ${r.label}`:'贝币不足');},{disabled:!next||next.cost>s.money,small:true});y+=123;});
    }else if(p==='supply'){
      this.box(33,y,324,92,12,TEAL);this.text('潮途',50,y+14,11,'#e8c78e',600);this.text('海浪送来的，一点帮助',50,y+37,20,'#f5f2e8',500);this.text(`今日还可领取 ${e.dailyAdsRemaining} 次 · 自愿观看`,50,y+69,10,'#abc9c9');y+=109;
      const items=[['supplies','漂流物资箱','木材 +1，绳索 +1'],['bait','潮途鱼饵包','特制饵 +3，咬钩更快'],['trial','专业装备试用','5 分钟鱼线 +25%、收线 +15%'],['double','鱼获额外奖励','最近一条留存鱼的等值贝币'],['rescue','救回刚才的鱼','只可救回普通鱼，不能跳过首领']];
      items.forEach(([kind,title,description])=>{this.text(title,36,y,15,INK,600);this.text(description,36,y+26,10,MUTED);const can=e.canClaimReward(kind);this.button('观看演示 · 领取',35,y+48,318,39,()=>this.reward(kind),{disabled:!can.ok,secondary:true,small:true});y+=104;});
      this.button('逛逛远行商店',35,y,318,43,()=>{this.panel='store';this.panelScroll=0;});y+=62;
      y=this.wrap('虚构品牌展示位。演示广告不产生收入，提前关闭不会发奖。普通钓鱼不限次数。',35,y,317,11,MUTED,21);
    }else if(p==='store'){
      y=this.wrap('内购流程演示，不扣款。便捷补给的所有材料，也可以通过捕鱼交换获得。',35,y,316,12,MUTED,22)+15;
      CATALOG.forEach(product=>{this.box(33,y,324,162,12,'#e6e9df');this.text(product.name,48,y+17,17,INK,600);this.text(`${product.priceLabel} / 仅演示`,48,y+44,11,TEAL);this.wrap(product.description,48,y+68,292,11,MUTED,20);this.button(this.exp.data.demoPurchases.includes(product.sku)?'已体验领取':'体验领取 · 不扣款',48,y+119,294,32,()=>this.purchase(product.sku),{disabled:this.exp.data.demoPurchases.includes(product.sku),small:true});y+=177;});
    }else if(p==='ending'){
      this.text('HOME, AT LAST.',195,y+27,11,TEAL,600,'center');y+=80;
      this.text('岸上的灯，终于为你亮起。',195,y,20,INK,600,'center');y+=50;
      y=this.wrap('你合上湿漉漉的航海日志。阿岚的木板、罗叔的绳索、小满递来的海图，终于拼成了一条回家的路。\n\n三片海域，三次挑战。每一条普通的小鱼，都曾是旅途中不可缺少的希望。',40,y,307,14,MUTED,27)+30;
      this.button('继续在海边钓鱼',35,y,320,46,()=>this.panel=null);y+=65;
    }
    this.panelEnd(y);
  }
  drawCatch() {
    this.buttons=[];this.ctx.fillStyle='#092936da';this.ctx.fillRect(0,0,W,H);
    const f=this.catchInfo,species=FISH[f.species];
    this.text(f.bossMessage?'航道首领 · 挑战成功':f.newSpecies?'图鉴解锁 · 新的伙伴':f.record?'刷新个人纪录':'今日的海洋赠礼',195,169,11,GOLD,500,'center');
    this.text(species.name,195,205,28,'#f3e9cb',600,'center');
    this.drawFish(195,341,1.35,f.species);
    this.text(`${f.kg.toFixed(2)} kg`,105,419,26,'#f1dcab',600,'center');this.text(`${f.cm} cm`,281,419,26,'#f1dcab',600,'center');
    this.text('重量',105,458,11,'#9fbbbf',400,'center');this.text('长度',281,458,11,'#9fbbbf',400,'center');
    this.text(f.kept?`收入鱼箱 · 价值 ${f.value} 贝币`:'鱼箱装满了，这条鱼已放生，纪录已保存',195,508,12,'#b8ccce',400,'center');
    if(f.bossMessage)this.wrap(f.bossMessage,39,545,315,12,'#eddbb5',22);
    this.button('收好鱼获，继续旅程',40,637,310,48,()=>this.catchInfo=null);
    if(f.kept)this.button('自愿观看演示 · 领取等值贝币',40,699,310,40,()=>this.reward('double'),{secondary:true,small:true,disabled:!this.exp.canClaimReward('double').ok});
  }
  drawFish(x,y,scale,id) {
    const c=this.ctx;c.save();c.translate(x,y);c.scale(scale,scale);c.rotate(-.12+Math.sin(this.clock)*.025);
    const colors=['#9abbbc','#c9b970','#749fb0','#5b97a6','#b8a98c'];const color=colors[Object.keys(FISH).indexOf(id)%colors.length];
    c.fillStyle=color;c.beginPath();c.ellipse(0,0,75,31,0,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(-65,0);c.lineTo(-110,-35);c.lineTo(-99,3);c.lineTo(-112,36);c.closePath();c.fill();
    c.fillStyle='#e7dfae';c.beginPath();c.moveTo(12,-26);c.lineTo(-16,-55);c.lineTo(-42,-20);c.closePath();c.fill();
    c.fillStyle='#ecddae88';c.beginPath();c.ellipse(6,12,58,12,0,0,Math.PI*2);c.fill();
    this.circle(52,-7,7,'#f3e6bc');this.circle(53,-7,4,'#15333b');this.line(73,9,65,9,'#294e53',2);this.line(37,-20,32,22,'#31596288',2);c.restore();
  }
  drawIntro() {
    this.buttons=[];this.ctx.fillStyle='#113844dc';this.ctx.fillRect(0,0,W,H);this.box(24,177,342,478,22,PAPER);
    this.text('潮汐归途 / 轻量触屏版',47,207,10,TEAL,600);this.text('从一根旧鱼竿开始。',47,239,25,INK,600);
    let y=this.wrap('风暴把你留在了荒岛。钓鱼，与岛民交换修船物资，挑战挡住航道的大鱼，一站一站回家。',47,287,295,14,MUTED,25)+24;
    for(const text of ['① 按住蓄力，松开抛竿','② 浮漂下沉时，点击提竿','③ 按住收线，张力高时松手','④ 用鱼换物资，修船后挑战首领']){this.text(text,47,y,13,INK);y+=34;}
    this.button('去海边，抛出第一竿',47,575,296,48,()=>{this.intro=false;this.exp.data.seenPortableIntro=true;this.state.save();});
  }
  drawDemo() {
    this.buttons=[];this.panelClip=null;const d=this.demo,purchase=!!d.product;
    this.ctx.fillStyle='#092b39ee';this.ctx.fillRect(0,0,W,H);this.box(24,143,342,566,21,PAPER);
    this.text(purchase?'内购流程演示 · 不扣款':'激励广告演示 · 非真实广告',195,168,10,TEAL,600,'center');
    this.box(43,205,304,210,14,TEAL);this.text('潮 / 途',64,227,12,GOLD,600);this.text('下一次咬钩',64,270,29,'#f5eddb',600);this.text('就在浪花之后',64,311,27,'#f5eddb',500);this.text('为下一段航程，补充一点底气。',64,373,11,'#abc6c7');
    this.text(purchase?d.product.name:'完整观看后领取奖励',195,444,18,INK,600,'center');
    this.wrap(purchase?'这是商品到账演示，不会发起真实扣款。':'你可以随时提前关闭。提前关闭不发奖励，也不消耗今日领取次数。',47,482,296,12,MUTED,23);
    this.button(purchase?'体验领取':d.left>0?`观看中 ${Math.ceil(d.left)} 秒`:'观看完成 · 领取',47,574,296,46,()=>this.closeDemo(true),{disabled:d.left>0});
    this.button(purchase?'取消':'提前关闭 · 不领取',47,634,296,40,()=>this.closeDemo(false),{secondary:true});
  }
}
