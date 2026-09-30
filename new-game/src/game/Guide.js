import { STAND } from './FishStand.js';
import { CHANDLERY } from './Chandlery.js';

// First-play guide:
//  - an intro (3 cards) the first time the game starts, after the start overlay: the goal, the fishing
//    controls, getting around and where Joe and Marta are (live direction and distance; their
//    markers pulse on the minimap). Enter / Space / click: next, Esc: skip. Replay from the help (F1).
//  - one-time tips the first time something happens (rod out, first nibble, fish on, first catch,
//    full cooler, next to the boat, at Joe's, at Marta's), in a card above the minimap.
// Seen state in localStorage ('tidewater.guide'), wrapped in try/catch.
//   const guide = new Guide( ui, game, minimap );  guide.update( dt );  guide.replay()

const KEY = 'tidewater.guide';

const CSS = /* css */`
.gm-guide { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; opacity: 0; visibility: hidden;
	background: radial-gradient(70% 70% at 50% 50%, rgba(4, 10, 16, 0.2), rgba(4, 10, 16, 0.55));
	transition: opacity 420ms var(--tw-ease), visibility 0s linear 420ms; }
.gm-guide.is-on { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity 420ms var(--tw-ease), visibility 0s; }
.gm-guide-card { width: min(calc(480 * var(--tw-u)), calc(100vw - 2 * var(--tw-edge))); padding: var(--tw-5) var(--tw-5) var(--tw-4); border-radius: var(--tw-r-lg);
	color: var(--tw-ink); font: 500 var(--tw-fs-md) var(--tw-font); transform: translateY(calc(10 * var(--tw-u))); transition: transform 520ms var(--tw-ease); }
.gm-guide.is-on .gm-guide-card { transform: none; }
.gm-guide-eyebrow { font-size: var(--tw-fs-xs); font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: var(--tw-sun); }
.gm-guide-card h2 { margin: var(--tw-2) 0 var(--tw-3); font-size: calc(24 * var(--tw-u)); font-weight: 600; letter-spacing: -0.01em; line-height: 1.2; }
.gm-guide-body { color: var(--tw-ink-2); line-height: 1.55; }
.gm-guide-body p { margin: 0 0 var(--tw-3); }
.gm-guide-body b { color: var(--tw-ink); font-weight: 600; }
.gm-guide-list { display: grid; gap: calc(7 * var(--tw-u)); margin: 0 0 var(--tw-3); }
.gm-guide-row { display: grid; grid-template-columns: calc(92 * var(--tw-u)) 1fr; gap: var(--tw-3); align-items: baseline; }
.gm-guide-row .k { display: flex; flex-wrap: wrap; gap: 3px; }
.gm-guide-row kbd { font: 600 var(--tw-fs-xs) var(--tw-mono); color: var(--tw-ink); padding: 1px calc(6 * var(--tw-u)); border-radius: calc(4 * var(--tw-u));
	border: 1px solid var(--tw-line-2); background: var(--tw-fill); }
.gm-guide-where { display: grid; gap: var(--tw-2); margin: var(--tw-1) 0 var(--tw-3); }
.gm-guide-where div { display: flex; align-items: center; gap: var(--tw-3); padding: var(--tw-2) var(--tw-3); border-radius: var(--tw-r-md); background: var(--tw-fill); border: 1px solid var(--tw-line); }
.gm-guide-where i { width: calc(12 * var(--tw-u)); height: calc(12 * var(--tw-u)); border-radius: 50%; flex: none; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.8); }
.gm-guide-where .is-joe i { background: var(--tw-sun); }
.gm-guide-where .is-marta i { background: var(--tw-aqua); }
.gm-guide-where span { flex: 1; }
.gm-guide-where em { font-style: normal; font-family: var(--tw-mono); font-size: var(--tw-fs-sm); color: var(--tw-ink-2); white-space: nowrap; }
.gm-guide-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--tw-3); margin-top: var(--tw-4); }
.gm-guide-dots { display: flex; gap: 6px; }
.gm-guide-dots span { width: 6px; height: 6px; border-radius: 50%; background: var(--tw-fill-2); transition: background var(--tw-med), width var(--tw-med) var(--tw-ease); }
.gm-guide-dots span.is-on { width: 18px; border-radius: 3px; background: var(--tw-sun); }
.gm-guide-btns { display: flex; align-items: center; gap: var(--tw-2); }
.gm-guide-hint { color: var(--tw-ink-3); font-size: var(--tw-fs-xs); margin-right: var(--tw-2); }
.gm-coach { position: absolute; right: var(--tw-edge); bottom: calc(var(--tw-edge) + 184 * var(--tw-u) + var(--tw-3)); width: min(calc(290 * var(--tw-u)), calc(100vw - 2 * var(--tw-edge)));
	padding: var(--tw-3) var(--tw-4); border-radius: var(--tw-r-lg); color: var(--tw-ink); font: 500 var(--tw-fs-sm) var(--tw-font); line-height: 1.5;
	pointer-events: none; opacity: 0; transform: translateY(calc(8 * var(--tw-u))); visibility: hidden;
	transition: opacity 360ms var(--tw-ease), transform 480ms var(--tw-ease), visibility 0s linear 480ms, right var(--tw-slow) var(--tw-ease); }
.tw-root[data-panel='open'] .gm-coach { right: calc(var(--tw-panel-w) + 2 * var(--tw-3)); }
.gm-coach.is-on { opacity: 1; transform: none; visibility: visible; transition: opacity 360ms var(--tw-ease), transform 480ms var(--tw-ease), visibility 0s, right var(--tw-slow) var(--tw-ease); }
.gm-coach-eyebrow { display: block; margin-bottom: 3px; font-size: var(--tw-fs-xs); font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--tw-aqua); }
.gm-coach b { color: var(--tw-ink); font-weight: 600; }
.gm-coach kbd { font: 600 var(--tw-fs-xs) var(--tw-mono); color: var(--tw-ink); padding: 0 calc(5 * var(--tw-u)); border-radius: calc(4 * var(--tw-u)); border: 1px solid var(--tw-line-2); background: var(--tw-fill); }

.tw-help-guide { display: flex; align-items: center; gap: var(--tw-4); margin-top: var(--tw-4); padding-top: var(--tw-4); border-top: 1px solid var(--tw-line);
	color: var(--tw-ink-2); font-size: var(--tw-fs-sm); line-height: 1.5; }
.tw-help-guide b { color: var(--tw-ink); }
.tw-help-guide .gm-btn { flex: none; }
@media (max-height: 860px) { .gm-coach { right: calc(var(--tw-edge) + 58 * var(--tw-u)); } }
@media (max-width: 640px) { .tw-help-guide { flex-direction: column; align-items: flex-start; } .gm-coach { bottom: calc(var(--tw-edge) + 128 * var(--tw-u) + var(--tw-3)); } .gm-guide-row { grid-template-columns: calc(78 * var(--tw-u)) 1fr; } }
@media (prefers-reduced-motion: reduce) { .gm-guide-card, .gm-coach { transform: none !important; } }
`;

const k = ( ...keys ) => keys.map( ( x ) => `<kbd>${ x }</kbd>` ).join( '' );
const row = ( keys, text ) => `<div class="gm-guide-row"><span class="k">${ keys }</span><span>${ text }</span></div>`;

const CARDS = [
	{
		eyebrow: '潮汐归途 · 荒岛求生',
		title: '从一根鱼竿，找到回家的路',
		body: `<p>一场海难把你留在陌生的岛上。用捡来的鱼竿在<b>沙滩</b>、<b>码头</b>和<b>船上</b>捕鱼，把渔获换成物资，修好回家的船。</p>
			<p>码头的<b>阿岚</b>收购渔获，船屋旁的<b>罗叔</b>出售鱼线、渔轮、鱼舱与照明。浅滩、珊瑚礁和深海各藏着不同的鱼，昼夜也会改变鱼群。</p><p>积攒物资、升级装备、挑战海域首领，逐岛解锁归途。先从钓起第一条鱼开始。</p>`,
	},
	{
		eyebrow: '钓鱼入门',
		title: '抛竿、提竿、收线',
		body: `<div class="gm-guide-list">
			${ row( k( 'R' ), '在水边或船上取出鱼竿' ) }
			${ row( k( '按住', '左键' ), '按住蓄力，松开抛竿；蓄力越久，抛得越远' ) }
			${ row( k( '左键' ), '浮漂<b>完全沉入水中</b>时提竿，轻微晃动只是试饵' ) }
			${ row( k( '按住', '左键' ), '按住收线；拉力变红时<b>立即松手</b>，避免断线' ) }
			${ row( k( '右键' ), '收回没有中鱼的钓线' ) }
			${ row( k( 'I' ), '打开鱼箱与鱼类图鉴' ) }
		</div>`,
	},
	{
		eyebrow: '岛上生活',
		title: '找到阿岚和罗叔',
		body: `<div class="gm-guide-list">
			${ row( k( 'W', 'A', 'S', 'D' ), '移动，鼠标转动视角，<kbd>Shift</kbd> 奔跑' ) }
			${ row( k( 'E' ), '登船、驾驶，或与阿岚和罗叔交谈' ) }
			${ row( k( 'F1' ), '查看所有操作，重看新手指引' ) }
		</div>
		<div class="gm-guide-where">
			<div class="is-joe"><i></i><span><b>阿岚</b> · 码头旁的鱼摊</span><em data-where="joe"></em></div>
			<div class="is-marta"><i></i><span><b>罗叔</b> · 船屋旁的补给店</span><em data-where="marta"></em></div>
		</div>
		<p style="margin:0;color:var(--tw-ink-3);font-size:var(--tw-fs-sm)">两人的位置都已标在右下角的小地图上。</p>`,
	},
];

const TIPS = {
	rodOut: '按住<b>鼠标左键</b>蓄力，松开抛竿。试试深水、码头边或珊瑚礁上方。',
	nibble: '浮漂轻轻晃动：有鱼正在<b>试饵</b>。等它<b>沉入水下</b>，立即点击提竿。',
	fishOn: '<b>按住鼠标左键</b>收线。拉力指针接近<b>红色区域</b>时松手，回落后再收线。',
	caught: '渔获已放入鱼箱（<kbd>I</kbd>）。去码头找<b>阿岚</b>换贝币，小地图上能找到他。',
	full: '鱼箱<b>满了</b>！去找阿岚出售，或向罗叔购买更大的鱼舱。',
	boat: '你的船。按 <kbd>E</kbd> 登船，到方向盘旁再按 <kbd>E</kbd> 驾驶（<kbd>W</kbd><kbd>S</kbd> 油门，<kbd>A</kbd><kbd>D</kbd> 转向）。罗叔出售柴油。',
	joe: '<b>阿岚</b>收购渔获。按 <kbd>E</kbd> 看看能换多少贝币。',
	marta: '<b>罗叔</b>出售装备和柴油。按 <kbd>E</kbd> 查看货架。',
};

const h = ( tag, cls, html ) => {

	const e = document.createElement( tag );
	if ( cls ) e.className = cls;
	if ( html !== undefined ) e.innerHTML = html;
	return e;

};

// compass word for the direction from (x, z) to (tx, tz); north is -z
export function compassWord( x, z, tx, tz ) {

	const a = Math.atan2( tx - x, - ( tz - z ) ); // 0 north, clockwise
	const W = [ '北', '东北', '东', '东南', '南', '西南', '西', '西北' ];
	return W[ ( ( Math.round( a / ( Math.PI / 4 ) ) % 8 ) + 8 ) % 8 ];

}

export class Guide {

	constructor( ui, game, minimap = null ) {

		this.ui = ui;
		this.game = game;
		this.minimap = minimap;
		const style = h( 'style' );
		style.textContent = CSS;
		document.head.append( style );

		this.seen = this._load();
		this.el = h( 'div', 'gm-guide tw-interactive', `<div class="gm-guide-card tw-glass" role="dialog" aria-modal="true" aria-live="polite">
			<div class="gm-guide-eyebrow"></div><h2></h2><div class="gm-guide-body"></div>
			<div class="gm-guide-foot"><div class="gm-guide-dots">${ CARDS.map( () => '<span></span>' ).join( '' ) }</div>
			<div class="gm-guide-btns"><span class="gm-guide-hint">Enter 继续 · Esc 跳过</span><button type="button" class="gm-btn is-ghost gm-guide-skip">跳过</button><button type="button" class="gm-btn gm-guide-next">下一步</button></div></div></div>` );
		this.card = this.el.firstChild;
		this.eyebrow = this.el.querySelector( '.gm-guide-eyebrow' );
		this.title = this.el.querySelector( 'h2' );
		this.body = this.el.querySelector( '.gm-guide-body' );
		this.dots = [ ...this.el.querySelectorAll( '.gm-guide-dots span' ) ];
		this.nextBtn = this.el.querySelector( '.gm-guide-next' );
		this.el.querySelector( '.gm-guide-skip' ).addEventListener( 'click', ( e ) => {

			e.stopPropagation();
			this.close();

		} );
		this.nextBtn.addEventListener( 'click', ( e ) => {

			e.stopPropagation();
			this.next();

		} );
		ui.root.append( this.el );

		this.coach = h( 'div', 'gm-coach tw-glass', '<span class="gm-coach-eyebrow">小贴士</span><span class="gm-coach-text"></span>' );
		this.coachText = this.coach.lastChild;
		( ui.hud || ui.root ).append( this.coach );

		this.open = false;
		this.step = 0;
		this._wait = this.seen.intro ? - 1 : 0.8; // seconds after the start overlay before the intro
		this._coachT = 0;
		this._queue = [];
		this._whereT = 0;
		this._prev = { lastCatch: game.state.lastCatch };

		// while the intro is up it owns the keyboard and the mouse (capture phase, before the game's input)
		this._onKey = ( e ) => {

			if ( ! this.open ) return;
			if ( e.code === 'Escape' ) this.close();
			else if ( e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight' ) this.next();
			else if ( e.code === 'ArrowLeft' ) this.show( Math.max( 0, this.step - 1 ) );
			else if ( e.code !== 'F1' ) return;
			e.preventDefault();
			e.stopPropagation();

		};

		this._onDown = ( e ) => {

			if ( ! this.open ) return;
			if ( e.target && e.target.closest && e.target.closest( 'button' ) ) return;
			e.preventDefault();
			e.stopPropagation();
			this.next();

		};

		window.addEventListener( 'keydown', this._onKey, true );
		window.addEventListener( 'mousedown', this._onDown, true );

	}

	_load() {

		try {

			return JSON.parse( localStorage.getItem( KEY ) || '{}' ) || {};

		} catch ( e ) {

			return {};

		}

	}

	_save() {

		try {

			localStorage.setItem( KEY, JSON.stringify( this.seen ) );

		} catch ( e ) { /* storage blocked: the guide just shows again next time */ }

	}

	// ---- intro
	show( i ) {

		this.step = i;
		const c = CARDS[ i ];
		this.eyebrow.textContent = c.eyebrow;
		this.title.textContent = c.title;
		this.body.innerHTML = c.body;
		this.dots.forEach( ( d, j ) => d.classList.toggle( 'is-on', j === i ) );
		this.nextBtn.textContent = i === CARDS.length - 1 ? '开始钓鱼' : '下一步';
		if ( this.minimap ) this.minimap.highlight( i === CARDS.length - 1 ? [ 'joe', 'marta' ] : [] );
		this._whereT = 0;
		if ( ! this.open ) {

			this.open = true;
			this.el.classList.add( 'is-on' );

		}

	}

	next() {

		if ( this.step < CARDS.length - 1 ) this.show( this.step + 1 );
		else this.close();

	}

	close() {

		if ( ! this.open ) return;
		this.open = false;
		this.el.classList.remove( 'is-on' );
		if ( this.minimap ) this.minimap.highlight( [] );
		this.seen.intro = true;
		this._save();

	}

	replay() {

		this.seen = {};
		this._save();
		this._queue.length = 0;
		this._hideCoach();
		if ( this.ui.toggleHelp ) this.ui.toggleHelp( false );
		this.show( 0 );

	}

	// ---- one-time tips
	tip( id ) {

		if ( this.seen[ id ] || this._queue.includes( id ) || this._current === id ) return;
		this._queue.push( id );

	}

	_hideCoach() {

		this._current = null;
		this.coach.classList.remove( 'is-on' );

	}

	update( dt ) {

		const ui = this.ui, g = this.game, app = g.app, p = app.player;

		// the intro, once the start overlay is gone
		if ( this._wait >= 0 && ! ui._start ) {

			this._wait -= dt;
			if ( this._wait < 0 ) this.show( 0 );

		}

		if ( this.open ) {

			// live direction and distance to Joe and Marta
			this._whereT -= dt;
			if ( this._whereT <= 0 && this.step === CARDS.length - 1 ) {

				this._whereT = 0.25;
				const x = p.position.x, z = p.position.z;
				for ( const [ id, t ] of [ [ 'joe', STAND ], [ 'marta', CHANDLERY ] ] ) {

					const el = this.body.querySelector( `[data-where="${ id }"]` );
					if ( el ) el.textContent = `${ Math.round( Math.hypot( t.x - x, t.z - z ) ) } m ${ compassWord( x, z, t.x, t.z ) }`;

				}

			}

			return;

		}

		// triggers (edge detected; each tip shows once)
		const rod = g.rod, b = g.bite, prev = this._prev;
		if ( rod.equipped && ! prev.equipped ) this.tip( 'rodOut' );
		if ( b && b.phase === 'nibble' ) this.tip( 'nibble' );
		if ( g.fight && ! prev.fight ) this.tip( 'fishOn' );
		const lc = g.state.lastCatch;
		if ( lc && lc !== prev.lastCatch && lc.kept ) this._afterCard = 'caught';
		if ( this._afterCard && ! ( g.hud && g.hud.catchOpen ) && ! g.landing ) {

			this.tip( this._afterCard );
			this._afterCard = null;

		}

		const s = g.state;
		if ( s.holdKg >= s.stats.holdKg * 0.92 ) this.tip( 'full' );
		if ( p.mode === 'walk' ) {

			const bt = app.boatCtl;
			if ( bt && Math.hypot( bt.position.x - p.position.x, bt.position.z - p.position.z ) < 9 ) this.tip( 'boat' );
			for ( const v of g.vendors ) if ( v.inRange( p.position ) ) this.tip( v.kind === 'buyer' ? 'joe' : 'marta' );

		}

		prev.equipped = rod.equipped;
		prev.fight = !! g.fight;
		prev.lastCatch = lc;

		// the coach card: one tip at a time, ~7 s each (not over the catch card or a panel)
		const busy = g.hud && ( g.hud.catchOpen || g.hud.invOpen || g.hud.standOpen );
		if ( this._current ) {

			this._coachT -= dt;
			if ( this._coachT <= 0 || busy ) this._hideCoach();

		} else if ( this._queue.length && ! busy ) {

			const id = this._queue.shift();
			this._current = id;
			this.seen[ id ] = true;
			this._save();
			this.coachText.innerHTML = TIPS[ id ];
			this.coach.classList.add( 'is-on' );
			this._coachT = 7.5;

		}

	}

}
