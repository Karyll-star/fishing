import { MONETIZATION_CONFIG } from './config.js';

// wx 的广告/支付面板是全局界面；多个适配器实例也只能同时打开一个。
let activeRequest = null;
let receiptCounter = 0;

function fault( code, message, cause ) {
	const error = new Error( message );
	error.code = code;
	if ( cause !== undefined ) error.cause = cause;
	return error;
}

function receipt( mode, type, subject ) {
	return `${mode}:${type}:${subject}:${Date.now().toString( 36 )}-${++receiptCounter}`;
}

function callbackAPI( api, name, options = {} ) {
	return new Promise( ( resolve, reject ) => {
		try { api[ name ]( { ...options, success: resolve, fail: reject } ); }
		catch ( error ) { reject( error ); }
	} );
}

const delay = ms => new Promise( resolve => setTimeout( resolve, ms ) );

/** 无 DOM 的商业化入口。真实商品只允许服务端发货，此类不修改游戏背包。 */
export class Monetization {
	constructor( config = {} ) {
		this.config = { ...MONETIZATION_CONFIG, ...config };
		this.mode = this.config.mode;
		if ( ! [ 'demo', 'wechat' ].includes( this.mode ) ) {
			throw fault( 'INVALID_MODE', '商业化模式无效，请使用 demo 或 wechat。' );
		}
		this._pendingOrders = new Map();
	}

	get busy() { return activeRequest !== null; }
	get catalog() { return this.config.catalog; }

	async _exclusive( operation ) {
		if ( activeRequest !== null ) throw fault( 'BUSY', '广告或订单正在处理中，请稍候。' );
		const token = {};
		activeRequest = token;
		try { return await operation(); }
		finally { if ( activeRequest === token ) activeRequest = null; }
	}

	_api() {
		const api = this.config.wx ?? globalThis.wx;
		if ( ! api ) throw fault( 'WECHAT_REQUIRED', '请在已适配的微信小游戏中使用此功能。' );
		return api;
	}

	async _simulate( type, subject, simulate, product ) {
		if ( typeof simulate !== 'function' ) {
			throw fault( 'DEMO_UI_REQUIRED', '演示尚未准备好，请通过游戏内的演示入口操作。' );
		}
		const result = await simulate( {
			mode: 'demo', type, ...( type === 'rewarded' ? { kind: subject } : { sku: subject, product } ),
		} );
		const completed = result === true || result?.completed === true;
		return { completed, receipt: completed ? receipt( 'demo', type, subject ) : null, mode: 'demo' };
	}

	/** simulate 仅在 demo 模式调用；提前退出返回 completed:false。 */
	async rewarded( kind, { simulate } = {} ) {
		return this._exclusive( async () => {
			if ( typeof kind !== 'string' || ! kind ) throw fault( 'INVALID_REWARD', '奖励类型无效。' );
			if ( this.mode === 'demo' ) return this._simulate( 'rewarded', kind, simulate );
			const api = this._api();
			const adUnitId = this.config.adUnits?.[ kind ] ?? this.config.adUnits?.rewarded;
			if ( ! adUnitId ) throw fault( 'AD_NOT_CONFIGURED', '激励广告位尚未配置，暂时无法领取广告奖励。' );
			if ( typeof api.createRewardedVideoAd !== 'function' ) {
				throw fault( 'AD_UNSUPPORTED', '当前微信版本暂不支持激励广告，请升级微信。' );
			}
			let ad;
			try { ad = api.createRewardedVideoAd( { adUnitId } ); }
			catch ( error ) { throw fault( 'AD_CREATE_FAILED', '广告暂时无法创建，请稍后重试。', error ); }
			return new Promise( ( resolve, reject ) => {
				let settled = false, starting = true, timer;
				const cleanup = () => {
					clearTimeout( timer );
					// 只卸载本次请求的监听，不影响其他业务注册的监听。
					try { ad.offClose?.( onClose ); } catch { /* 平台已释放广告 */ }
					try { ad.offError?.( onError ); } catch { /* 平台已释放广告 */ }
				};
				const finish = ( error, result ) => {
					if ( settled ) return;
					settled = true;
					cleanup();
					if ( error ) reject( error ); else resolve( result );
				};
				const onClose = result => {
					const completed = result?.isEnded === true;
					finish( null, { completed, receipt: completed ? receipt( 'wechat', 'rewarded', kind ) : null, mode: 'wechat' } );
				};
				const onError = error => {
					// 初次展示失败由下方的 load/show 重试统一处理。
					if ( ! starting ) finish( fault( 'AD_FAILED', '广告播放失败，未发放奖励，请稍后重试。', error ) );
				};
				try {
					ad.onClose( onClose );
					ad.onError( onError );
					timer = setTimeout( () => finish( fault( 'AD_TIMEOUT', '未收到广告完成结果，请稍后重试。' ) ), this.config.adTimeoutMs );
					Promise.resolve().then( () => ad.show() ).catch( () => {
						if ( settled ) return;
						return Promise.resolve( ad.load() ).then( () => { if ( ! settled ) return ad.show(); } );
					} ).then( () => { starting = false; } ).catch( error => {
						finish( fault( 'AD_FAILED', '暂无可播放的广告，未发放奖励，请稍后重试。', error ) );
					} );
				} catch ( error ) {
					finish( fault( 'AD_FAILED', '广告暂时不可用，请稍后重试。', error ) );
				}
			} );
		} );
	}

	async _checkPaymentSupport( api ) {
		if ( typeof api.requestMidasPaymentGameItem !== 'function' ) {
			throw fault( 'PAY_UNSUPPORTED', '当前环境暂不支持道具购买，请升级微信后重试。' );
		}
		if ( typeof api.checkIsSupportMidasPayment === 'function' ) {
			let result;
			try { result = await callbackAPI( api, 'checkIsSupportMidasPayment' ); }
			catch ( error ) { throw fault( 'PAY_SUPPORT_FAILED', '暂时无法确认支付能力，请稍后重试。', error ); }
			if ( result?.data?.allow_pay !== true ) throw fault( 'PAY_UNSUPPORTED', '当前环境尚不支持虚拟支付。' );
		} else {
			let platform = '';
			try { platform = String( ( api.getDeviceInfo?.() ?? api.getSystemInfoSync?.() )?.platform ?? '' ).toLowerCase(); }
			catch { /* 老基础库无系统信息接口时不能推定 iOS 支持 */ }
			if ( ! [ 'android', 'windows', 'mac', 'ohos', 'harmony' ].includes( platform ) ) {
				throw fault( 'PAY_UNSUPPORTED', '当前微信无法确认支付支持，请升级微信后重试。' );
			}
		}
	}

	async _settleOrder( sku, orderId ) {
		const service = this.config.orderService;
		const attempts = Math.max( 1, Math.min( 10, Number( this.config.paymentPollAttempts ) || 1 ) );
		for ( let i = 0; i < attempts; i++ ) {
			let order;
			try { order = await service.status( { orderId } ); }
			catch ( error ) { throw fault( 'ORDER_STATUS_FAILED', '订单结果暂未确认，请稍后再次点击该商品查询，勿重复付款。', error ); }
			if ( order?.orderId !== orderId || order?.sku !== sku ) {
				throw fault( 'ORDER_MISMATCH', '订单信息不一致，请联系客服查询。' );
			}
			if ( order.status === 'fulfilled' ) {
				let inventory;
				try { inventory = await service.refresh( { orderId } ); }
				catch ( error ) { throw fault( 'INVENTORY_REFRESH_FAILED', '订单已发货，背包同步失败；请稍后再次点击该商品刷新。', error ); }
				this._pendingOrders.delete( sku );
				return { completed: true, mode: 'wechat', receipt: order.receipt ?? `wechat:purchase:${orderId}`, sku, orderId, inventory };
			}
			if ( [ 'cancelled', 'closed', 'failed', 'refunded' ].includes( order.status ) ) {
				this._pendingOrders.delete( sku );
				return { completed: false, receipt: null, mode: 'wechat', sku, orderId, status: order.status };
			}
			if ( i < attempts - 1 ) await delay( Math.max( 0, Number( this.config.paymentPollIntervalMs ) || 0 ) );
		}
		// 保留订单；再次点击只查询这一单，不重复创建支付。
		return { completed: false, receipt: null, mode: 'wechat', sku, orderId, status: 'pending', pending: true };
	}

	/** 成功仅表示服务端 fulfilled 且库存刷新完成；调用方不得自行发放真实商品。 */
	async purchase( sku, { simulate } = {} ) {
		return this._exclusive( async () => {
			const product = this.catalog?.find( item => item.sku === sku );
			if ( ! product ) throw fault( 'UNKNOWN_PRODUCT', '商品不存在或已下架。' );
			if ( this.mode === 'demo' ) return { ...await this._simulate( 'purchase', sku, simulate, product ), sku };
			const api = this._api();
			const service = this.config.orderService;
			if ( ! service || [ 'createOrder', 'status', 'refresh' ].some( key => typeof service[ key ] !== 'function' ) ) {
				throw fault( 'PAY_NOT_CONFIGURED', '支付服务尚未配置，暂未开放真实购买。' );
			}
			if ( this._pendingOrders.has( sku ) ) return this._settleOrder( sku, this._pendingOrders.get( sku ) );
			await this._checkPaymentSupport( api );
			if ( typeof api.login !== 'function' ) throw fault( 'LOGIN_UNSUPPORTED', '微信登录尚不可用，请重新进入游戏。' );
			let login;
			try { login = await callbackAPI( api, 'login' ); }
			catch ( error ) { throw fault( 'LOGIN_FAILED', '微信登录失败，请稍后重试。', error ); }
			if ( ! login?.code ) throw fault( 'LOGIN_FAILED', '未获得微信登录凭证，请重新进入游戏。' );
			let order;
			try { order = await service.createOrder( { sku, productId: product.productId, loginCode: login.code } ); }
			catch ( error ) { throw fault( 'ORDER_CREATE_FAILED', '暂时无法创建订单，请稍后重试。', error ); }
			const payment = order?.payment;
			if ( ! order?.orderId || order.sku !== sku || typeof payment?.signData !== 'string' || ! payment.paySig || ! payment.signature ) {
				throw fault( 'INVALID_ORDER', '支付订单配置不完整，请联系运营人员。' );
			}
			this._pendingOrders.set( sku, order.orderId );
			try {
				await callbackAPI( api, 'requestMidasPaymentGameItem', {
					signData: payment.signData, paySig: payment.paySig, signature: payment.signature,
				} );
			} catch ( error ) {
				// 客户端回调失败也不能推定后台未扣款；通过服务端查询最终状态。
				const result = await this._settleOrder( sku, order.orderId );
				return { ...result, paymentError: error?.errCode ?? error?.errno ?? 'PAY_CALLBACK_FAILED' };
			}
			return this._settleOrder( sku, order.orderId );
		} );
	}
}

export default Monetization;
