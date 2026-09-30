import { FISH } from '../game/FishTable.js';

// All campaign requirements can be met with the free starting tackle and any fish.
// Boss descriptors use existing species and the normal CatchMinigame in Game.js.
export const CHAPTERS = Object.freeze( [

	Object.freeze( {
		id: 'driftwood', name: '漂木湾', npc: '阿岚', role: '修船匠',
		story: '暴风雨卷走了归航船。阿岚在海滩救下你，愿意用修船材料换取新鲜鱼。先修好小船，再钓起守在出海口的断桅巨鲹。',
		arrival: '海潮把你推回了沙滩。握紧这根旧鱼竿，回家的第一步就在眼前。',
		repairLabel: '补好船底', repairCost: Object.freeze( { wood: 2, rope: 1, metal: 0 } ),
		boss: Object.freeze( { name: '断桅巨鲹', species: 'jack', kg: 4, description: '它会突然冲刺。收线积累进度，张力升高时松手放线。', reward: 25 } ),
		departure: '巨鲹离开了航道。阿岚替你升起小帆，远方的雾岬亮起一盏灯。',
		palette: Object.freeze( { accent: '#66d9ba', sky: '#91c8cc' } ),
	} ),
	Object.freeze( {
		id: 'mistcape', name: '雾岬集市', npc: '罗叔', role: '灯塔守望人',
		story: '罗叔知道穿过迷雾的航线。用鱼换取木材、绳索和金属，加固船舷；再应对潜伏在航道里的雾影梭鱼。',
		arrival: '破旧灯塔穿透晨雾。罗叔递来一张海图：穿过这里，就能看见故乡的洋流。',
		repairLabel: '加固船舷', repairCost: Object.freeze( { wood: 2, rope: 1, metal: 1 } ),
		boss: Object.freeze( { name: '雾影梭鱼', species: 'barracuda', kg: 7, description: '梭鱼的冲刺持续更久。守住张力条，耐心等它疲惫。', reward: 45 } ),
		departure: '迷雾终于散去。罗叔把灯塔的备用信号镜交给你，风暴礁就在海平线上。',
		palette: Object.freeze( { accent: '#9fbef4', sky: '#a5b6c9' } ),
	} ),
	Object.freeze( {
		id: 'stormreef', name: '风暴礁', npc: '小满', role: '漂流信使',
		story: '小满认出了你家乡的船旗。补齐远航船体与索具，钓起盘踞礁口的风暴石斑，就能乘顺风回家。',
		arrival: '海风里已经有熟悉的气味。最后一道礁石屏障后面，就是回家的航线。',
		repairLabel: '装好远航桅杆', repairCost: Object.freeze( { wood: 2, rope: 2, metal: 2 } ),
		boss: Object.freeze( { name: '风暴石斑', species: 'grouper', kg: 10, description: '它的体力充沛。连续收线会断线，稳稳控制节奏才能完成最后一战。', reward: 80 } ),
		departure: '礁口恢复平静。你升起修补好的帆，用信号镜回应岸上的灯光。欢迎回家。',
		palette: Object.freeze( { accent: '#f3c884', sky: '#abb7ce' } ),
	} ),

] );

export const BARTER_RECIPES = Object.freeze( {
	wood: Object.freeze( { id: 'wood', name: '木材', fish: 1, amount: 1, description: '任意 1 条鱼 → 1 份木材' } ),
	rope: Object.freeze( { id: 'rope', name: '绳索', fish: 1, amount: 1, description: '任意 1 条鱼 → 1 份绳索' } ),
	metal: Object.freeze( { id: 'metal', name: '金属', fish: 1, amount: 1, description: '任意 1 条鱼 → 1 份金属' } ),
} );

export const REWARD_KINDS = Object.freeze( {
	supplies: Object.freeze( { name: '漂流补给箱', description: '木材 +1、绳索 +1', label: '领取补给' } ),
	bait: Object.freeze( { name: '特制鱼饵', description: '获得 3 份鱼饵，下次抛竿更快等到咬钩', label: '领取鱼饵' } ),
	trial: Object.freeze( { name: '潮途 · 渔具试用', description: '5 分钟内鱼线强度 +25%、收线速度 +15%', label: '试用装备' } ),
	double: Object.freeze( { name: '渔获加奖', description: '额外获得最近一次成功留存渔获的等值贝币，每条鱼限一次', label: '渔获加奖' } ),
	rescue: Object.freeze( { name: '救回渔获', description: '救回最近一次脱钩的普通鱼，首领不可救回', label: '救回这条鱼' } ),
} );

const VERSION = 1;
const ADS_PER_DAY = 3;
const TRIAL_MS = 5 * 60 * 1000;
const MATERIAL_IDS = Object.keys( BARTER_RECIPES );
const MAX_RESOURCE = 999999;
const DEMO_SKUS = Object.freeze( [ 'chaotu-rod-skin', 'voyage-supply', 'harbor-pass' ] );

/**
 * Campaign state owned by GameState.expedition. The host must include that field
 * in GameState.toJSON/fromJSON/reset and call completeBoss only after a real catch.
 * These local checks prevent accidental double grants. Real ad completion and
 * purchased entitlements must be verified by the platform/backend before granting.
 */
export class Expedition {

	constructor( gameState, { now = () => Date.now() } = {} ) {

		if ( ! gameState || ! Array.isArray( gameState.inventory ) ) throw new TypeError( 'Expedition needs a GameState' );
		this.state = gameState;
		this.now = now;
		this.state.expedition = normalize( gameState.expedition, this._now() );
		// A fight cannot survive a page reload: the fishing simulation is not saved.
		this.state.expedition.activeBoss = null;
		this._lastCatchRef = null;
		this._captureCatch();
		// Catch-card data is normally transient. Keep only the latest eligible reward
		// here so reloading never duplicates a claim or silently discards an offer.
		this._unsubscribe = this.state.onChange?.( () => {

			if ( this._captureCatch() ) this.state.save?.();

		} );
		this._commit();

	}

	get data() {

		if ( ! this.state.expedition || this.state.expedition.v !== VERSION ) this.state.expedition = normalize( null, this._now() );
		return this.state.expedition;

	}

	get chapter() { return this.data.chapter; }
	get current() { return CHAPTERS[ this.chapter ]; }
	get materials() { return this.data.materials; }
	get finished() { return this.data.finished; }
	get repaired() { return this.data.progress[ this.chapter ].repaired; }
	get bossDefeated() { return this.data.progress[ this.chapter ].bossDefeated; }
	get bait() { return this.data.bait; }
	get rescueCandidate() { return this.data.rescueCandidate; }
	get trialActive() { return this.data.trialUntil > this._now(); }
	get trialSecondsRemaining() { return Math.max( 0, Math.ceil( ( this.data.trialUntil - this._now() ) / 1000 ) ); }
	get dailyAdsRemaining() { this._rollDay(); return Math.max( 0, ADS_PER_DAY - this.data.daily.count ); }
	get totalFishNeeded() { return Object.values( this.current.repairCost ).reduce( ( sum, n ) => sum + n, 0 ); }

	get objectives() {

		const result = MATERIAL_IDS.filter( ( key ) => this.current.repairCost[ key ] > 0 ).map( ( key ) => ( {
			id: key,
			label: `兑换${ BARTER_RECIPES[ key ].name }`,
			current: this.repaired ? this.current.repairCost[ key ] : this.materials[ key ],
			target: this.current.repairCost[ key ],
			done: this.repaired || this.materials[ key ] >= this.current.repairCost[ key ],
		} ) );
		result.push( { id: 'repair', label: this.current.repairLabel, current: Number( this.repaired ), target: 1, done: this.repaired } );
		result.push( { id: 'boss', label: `挑战${ this.current.boss.name }`, current: Number( this.bossDefeated ), target: 1, done: this.bossDefeated } );
		return result;

	}

	barter( recipe, fishId = null ) {

		const key = typeof recipe === 'string' ? recipe : recipe?.id;
		if ( ! Object.prototype.hasOwnProperty.call( BARTER_RECIPES, key ) ) return no( '没有这项交换。' );
		if ( this.finished ) return no( '你已经完成归航，渔获仍可在鱼摊出售。' );
		if ( this.materials[ key ] >= MAX_RESOURCE ) return no( '这种材料已经放满了。' );
		const available = this.state.inventory.filter( ( fish ) => fish && FISH[ fish.species ] && Number.isFinite( fish.kg ) && fish.kg > 0 );
		const fish = fishId === null
			? available.reduce( ( best, next ) => ! best || next.value < best.value ? next : best, null )
			: available.find( ( entry ) => entry.id === fishId );
		if ( ! fish ) return no( '先钓一条鱼放进鱼箱，再来交换吧。' );
		const index = this.state.inventory.indexOf( fish );
		if ( index < 0 ) return no( '这条鱼已经不在鱼箱里了。' );
		this.state.inventory.splice( index, 1 );
		this.materials[ key ] ++;
		this.data.progress[ this.chapter ].fishTraded ++;
		this._commit();
		return yes( `${ this.current.npc }收下了${ FISH[ fish.species ].name }，交给你 1 份${ BARTER_RECIPES[ key ].name }。`, { recipe: key, fish, amount: 1 } );

	}

	canRepair() {

		return ! this.finished && ! this.repaired && MATERIAL_IDS.every( ( key ) => this.materials[ key ] >= this.current.repairCost[ key ] );

	}

	repair() {

		if ( this.finished ) return no( '归航已经完成。' );
		if ( this.repaired ) return no( '这一站的船只已经修好了。' );
		if ( ! this.canRepair() ) return no( '修船材料还不够。任意鱼都能向岛民换取材料。' );
		for ( const key of MATERIAL_IDS ) this.materials[ key ] -= this.current.repairCost[ key ];
		this.data.progress[ this.chapter ].repaired = true;
		this._commit();
		return yes( `${ this.current.repairLabel }完成！现在可以挑战${ this.current.boss.name }。` );

	}

	canChallenge() {

		return ! this.finished && this.repaired && ! this.bossDefeated && ! this.data.activeBoss;

	}

	beginBoss() {

		if ( ! this.canChallenge() ) return no( this.bossDefeated ? '这一片航道已经畅通。' : this.data.activeBoss ? '正在挑战岛屿首领。' : '先集齐材料修好船，再挑战首领。' );
		this.data.bossSequence ++;
		const token = `${ this.current.id }:${ this.data.bossSequence }:${ this._now() }`;
		this.data.activeBoss = { token, chapter: this.chapter };
		this._commit();
		return yes( `${ this.current.boss.name }出现了！像平常钓鱼一样控制张力。`, { token, boss: { ...this.current.boss } } );

	}

	completeBoss( token ) {

		const active = this.data.activeBoss;
		if ( ! active || active.token !== token || active.chapter !== this.chapter || ! this.repaired || this.bossDefeated || this.finished ) return no( '这次首领挑战已经结束或无效。' );
		const reward = this.current.boss.reward;
		this.data.progress[ this.chapter ].bossDefeated = true;
		this.data.activeBoss = null;
		this.state.money = safeMoney( this.state.money ) + reward;
		// The next boss remains accessible without grinding coins or buying gear.
		const lineLevel = Math.min( 2, this.chapter + 1 );
		const giftedLine = this.chapter < CHAPTERS.length - 1 && ( this.state.upgrades?.line || 0 ) < lineLevel;
		if ( giftedLine ) this.state.upgrades.line = lineLevel;
		this._commit();
		return yes( `成功钓起${ this.current.boss.name }！获得 ${ reward } 贝币，航道已开放。${ giftedLine ? `${ this.current.npc }还赠送了更结实的鱼线。` : '' }`, { reward, chapter: this.chapter, giftedLine, lineLevel } );

	}

	failBoss( token ) {

		if ( ! this.data.activeBoss || this.data.activeBoss.token !== token ) return no( '没有正在进行的这场挑战。' );
		this.data.activeBoss = null;
		this._commit();
		return yes( '首领暂时游走了。材料和修船进度保留，可以免费再次挑战。' );

	}

	sail() {

		if ( this.finished ) return no( '你已经平安回家。仍然可以自由钓鱼。' );
		if ( ! this.bossDefeated || ! this.repaired ) return no( '修好船并击败岛屿首领，才能出航。' );
		const departure = this.current.departure;
		this.data.progress[ this.chapter ].sailed = true;
		this.data.activeBoss = null;
		this.state.fuel = null;
		if ( this.chapter === CHAPTERS.length - 1 ) {

			this.data.finished = true;
			this.data.completedAt = this._now();
			this._commit();
			return yes( departure, { finished: true, chapter: this.chapter } );

		}
		this.data.chapter ++;
		this._commit();
		return yes( `${ departure }\n${ this.current.arrival }`, { finished: false, chapter: this.chapter, current: this.current } );

	}

	canClaimReward( kind ) {

		this._rollDay();
		if ( ! Object.prototype.hasOwnProperty.call( REWARD_KINDS, kind ) ) return no( '没有这项奖励。' );
		if ( this.dailyAdsRemaining <= 0 ) return no( '今日 3 次广告奖励已用完。继续钓鱼同样可以完成全部主线。' );
		if ( kind === 'double' ) {

			this._captureCatch();
			const catchKey = this.data.lastEligibleCatch?.key;
			if ( ! catchKey ) return no( '先成功钓到并留存一条鱼，再领取渔获加奖。' );
			if ( this.data.rewardedCatches.includes( catchKey ) ) return no( '这条鱼已经领过加奖了。' );

		}
		if ( kind === 'rescue' ) {

			if ( ! this.rescueCandidate ) return no( '目前没有可以救回的普通渔获。' );
			if ( ! this.state.fits( this.rescueCandidate.kg ) ) return no( '鱼箱空间不足，先卖鱼或交换材料后再救回。' );

		}
		if ( kind === 'trial' && this.trialActive ) return no( '装备仍在试用中，结束后再来领取吧。' );
		if ( kind === 'bait' && this.bait > MAX_RESOURCE - 3 ) return no( '特制鱼饵已经装满了。' );
		if ( kind === 'supplies' && ( this.materials.wood >= MAX_RESOURCE || this.materials.rope >= MAX_RESOURCE ) ) return no( '补给材料已经装满了。' );
		return yes( '可以领取。' );

	}

	claimReward( kind, token ) {

		if ( typeof token !== 'string' || token.length < 1 || token.length > 160 ) return no( '奖励凭证无效，请完成奖励展示后再领取。' );
		if ( this.data.rewardTokens.includes( token ) ) return no( '这份奖励已经领取过了。' );
		const allowed = this.canClaimReward( kind );
		if ( ! allowed.ok ) return allowed;
		let reward;
		if ( kind === 'supplies' ) {

			this.materials.wood ++;
			this.materials.rope ++;
			reward = '木材 +1、绳索 +1';

		} else if ( kind === 'bait' ) {

			this.data.bait += 3;
			reward = '特制鱼饵 +3';

		} else if ( kind === 'trial' ) {

			this.data.trialUntil = this._now() + TRIAL_MS;
			reward = '潮途渔具试用 5 分钟';

		} else if ( kind === 'double' ) {

			const amount = safeMoney( this.data.lastEligibleCatch.value );
			this.state.money = safeMoney( this.state.money ) + amount;
			this.data.rewardedCatches.push( this.data.lastEligibleCatch.key );
			reward = `${ amount } 贝币`;

		} else if ( kind === 'rescue' ) {

			const candidate = this.rescueCandidate;
			if ( ! this.state.fits( candidate.kg ) ) return no( '鱼箱空间不足，这次没有消耗广告奖励次数。' );
			const fish = this.state.addFish( candidate.species, candidate.kg, candidate.hour );
			if ( ! fish ) return no( '暂时无法留存渔获，这次没有消耗广告奖励次数。' );
			this.data.rescueCandidate = null;
			reward = `${ FISH[ candidate.species ].name }（${ candidate.kg.toFixed( 2 ) } 千克）`;

		}
		this.data.daily.count ++;
		this.data.daily.byKind[ kind ] = ( this.data.daily.byKind[ kind ] || 0 ) + 1;
		this.data.rewardTokens.push( token );
		this._commit();
		return yes( `已获得${ reward }。`, { kind, reward, remaining: this.dailyAdsRemaining } );

	}

	// Demonstration delivery only. Real purchases must use server-owned inventory.
	// Every demo product can be sampled once, and duplicate receipts never grant twice.
	claimDemoPurchase( sku, receipt ) {

		if ( ! DEMO_SKUS.includes( sku ) ) return no( '没有这件演示商品。' );
		if ( typeof receipt !== 'string' || receipt.length > 160 || ! receipt.startsWith( `demo:purchase:${ sku }:` ) ) return no( '演示领取凭证无效，不会发放真实支付商品。' );
		if ( this.data.demoPurchases.includes( sku ) || this.data.demoPurchaseReceipts.includes( receipt ) ) return no( '这件商品已经体验领取过了。' );
		const givesSupplies = sku === 'voyage-supply' || sku === 'harbor-pass';
		if ( givesSupplies && MATERIAL_IDS.some( key => this.materials[ key ] >= MAX_RESOURCE ) ) return no( '材料仓库已满，腾出空间后再领取。' );
		if ( sku === 'chaotu-rod-skin' ) this.data.skin = 'sea-salt';
		if ( sku === 'harbor-pass' ) this.data.harborSkin = true;
		if ( givesSupplies ) for ( const key of MATERIAL_IDS ) this.materials[ key ] ++;
		this.data.demoPurchases.push( sku );
		this.data.demoPurchaseReceipts.push( receipt );
		this._commit();
		const reward = sku === 'chaotu-rod-skin' ? '潮途·海盐蓝竿外观' : sku === 'harbor-pass' ? '港湾主题外观、木材 +1、绳索 +1、金属 +1' : '木材 +1、绳索 +1、金属 +1';
		return yes( `演示领取成功：${ reward }。本次没有扣款。`, { sku, reward, demo: true } );

	}

	offerRescue( species, kg, hour = 12, { isBoss = false } = {} ) {

		if ( isBoss || this.data.activeBoss ) return no( '首领无法通过奖励救回，请重新挑战。' );
		const fish = FISH[ species ];
		if ( ! fish || ! Number.isFinite( kg ) || kg < fish.kg[ 0 ] || kg > fish.kg[ 1 ] ) return no( '这条渔获无法救回。' );
		this.data.rescueSequence ++;
		this.data.rescueCandidate = {
			id: `rescue:${ this.data.rescueSequence }:${ this._now() }`,
			species, kg: Math.round( kg * 100 ) / 100,
			hour: Number.isFinite( hour ) ? ( ( hour % 24 ) + 24 ) % 24 : 12,
		};
		this._commit();
		return yes( '可以选择观看奖励展示，救回这条鱼；也可以继续免费钓鱼。', { candidate: { ...this.rescueCandidate } } );

	}

	useBait() {

		if ( this.bait <= 0 ) return no( '特制鱼饵已用完。普通鱼饵无限供应，可以继续免费钓鱼。', { biteMul: 1 } );
		this.data.bait --;
		this._commit();
		return yes( '使用 1 份特制鱼饵，这次抛竿更容易等到咬钩。', { biteMul: 1.4 } );

	}

	// Apply these multiplicative factors to a copy of GameState.stats for this cast.
	fishingBonuses( { consumeBait = false } = {} ) {

		const trial = this.trialActive;
		const bait = consumeBait && this.bait > 0 ? this.useBait() : null;
		return { lineMul: trial ? 1.25 : 1, reelMul: trial ? 1.15 : 1, biteMul: bait?.ok ? bait.biteMul : 1, trial, baitUsed: Boolean( bait?.ok ) };

	}

	reset() {

		this.state.expedition = normalize( null, this._now() );
		this._lastCatchRef = this.state.lastCatch;
		this._commit();

	}

	dispose() { this._unsubscribe?.(); }

	_captureCatch() {

		const fish = this.state.lastCatch;
		if ( ! fish || fish === this._lastCatchRef ) return false;
		this._lastCatchRef = fish;
		if ( ! fish.kept || ! FISH[ fish.species ] || ! Number.isFinite( fish.value ) || fish.value <= 0 ) return false;
		const count = integer( this.state.log[ fish.species ]?.count );
		const key = `${ fish.species }:${ count }:${ fish.kg }:${ fish.value }`;
		this.data.lastEligibleCatch = { key, species: fish.species, kg: fish.kg, value: safeMoney( fish.value ) };
		return true;

	}

	_rollDay() {

		const day = dayKey( this._now() );
		// A clock moving backwards must not refresh the allowance.
		if ( day > this.data.daily.date ) {

			this.data.daily = { date: day, count: 0, byKind: {} };
			this.state.save?.();

		}

	}

	_now() {

		const value = this.now();
		return Number.isFinite( value ) && value >= 0 ? Math.floor( value ) : Date.now();

	}

	_commit() {

		this.state.save?.();
		this.state.emit?.();

	}

}

function normalize( raw, now ) {

	const d = raw && typeof raw === 'object' && raw.v === VERSION ? raw : {};
	const progress = CHAPTERS.map( ( _, index ) => {

		const p = d.progress?.[ index ] || {};
		const repaired = p.repaired === true;
		const bossDefeated = repaired && p.bossDefeated === true;
		return { repaired, bossDefeated, sailed: bossDefeated && p.sailed === true, fishTraded: integer( p.fishTraded ) };

	} );
	// Only contiguous, completed crossings can unlock later chapters.
	let chapter = 0;
	while ( chapter < CHAPTERS.length - 1 && progress[ chapter ].sailed ) chapter ++;
	const finished = chapter === CHAPTERS.length - 1 && progress[ chapter ].sailed && d.finished === true;
	const savedDate = typeof d.daily?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test( d.daily.date ) ? d.daily.date : dayKey( now );
	const today = dayKey( now );
	const keepDaily = savedDate >= today;
	return {
		v: VERSION, chapter, finished, progress,
		seenPortableIntro: d.seenPortableIntro === true,
		materials: Object.fromEntries( MATERIAL_IDS.map( ( key ) => [ key, integer( d.materials?.[ key ] ) ] ) ),
		bait: integer( d.bait ),
		trialUntil: Number.isFinite( d.trialUntil ) ? Math.max( 0, Math.min( d.trialUntil, now + TRIAL_MS ) ) : 0,
		bossSequence: integer( d.bossSequence ),
		activeBoss: null,
		lastEligibleCatch: cleanCatch( d.lastEligibleCatch ),
		rescueCandidate: cleanRescue( d.rescueCandidate ),
		rescueSequence: integer( d.rescueSequence ),
		daily: { date: keepDaily ? savedDate : today, count: keepDaily ? integer( d.daily?.count, ADS_PER_DAY ) : 0, byKind: keepDaily ? Object.fromEntries( Object.keys( REWARD_KINDS ).map( ( key ) => [ key, integer( d.daily?.byKind?.[ key ], ADS_PER_DAY ) ] ) ) : {} },
		rewardTokens: cleanStrings( d.rewardTokens ),
		rewardedCatches: cleanStrings( d.rewardedCatches ),
		demoPurchases: cleanStrings( d.demoPurchases ).filter( sku => DEMO_SKUS.includes( sku ) ),
		demoPurchaseReceipts: cleanStrings( d.demoPurchaseReceipts ),
		skin: d.skin === 'sea-salt' ? 'sea-salt' : null,
		harborSkin: d.harborSkin === true,
		completedAt: finished && Number.isFinite( d.completedAt ) ? Math.max( 0, d.completedAt ) : null,
	};

}

function integer( value, max = MAX_RESOURCE ) { return Number.isFinite( value ) ? Math.max( 0, Math.min( max, Math.floor( value ) ) ) : 0; }
function safeMoney( value ) { return Number.isFinite( value ) ? Math.max( 0, Math.min( Number.MAX_SAFE_INTEGER / 2, Math.floor( value ) ) ) : 0; }
function cleanStrings( values ) { return Array.isArray( values ) ? [ ...new Set( values.filter( ( value ) => typeof value === 'string' && value.length > 0 && value.length <= 160 ) ) ] : []; }
function cleanCatch( value ) {

	return value && FISH[ value.species ] && typeof value.key === 'string' && value.key.length <= 160 && Number.isFinite( value.kg ) && value.kg > 0 && Number.isFinite( value.value ) && value.value > 0
		? { key: value.key, species: value.species, kg: value.kg, value: safeMoney( value.value ) } : null;

}
function cleanRescue( value ) {

	const fish = value && FISH[ value.species ];
	return fish && typeof value.id === 'string' && value.id.length <= 160 && Number.isFinite( value.kg ) && value.kg >= fish.kg[ 0 ] && value.kg <= fish.kg[ 1 ]
		? { id: value.id, species: value.species, kg: value.kg, hour: Number.isFinite( value.hour ) ? ( ( value.hour % 24 ) + 24 ) % 24 : 12 } : null;

}
function dayKey( now ) { return new Date( now + 8 * 60 * 60 * 1000 ).toISOString().slice( 0, 10 ); }
function yes( message, extra = {} ) { return { ok: true, message, ...extra }; }
function no( message, extra = {} ) { return { ok: false, message, ...extra }; }
