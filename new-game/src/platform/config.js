// 潮途是本项目的虚构品牌。这里的价格仅用于演示，正式商品以服务端和微信后台配置为准。
export const CATALOG = Object.freeze( [
	Object.freeze( {
		sku: 'chaotu-rod-skin', productId: 'chaotu-rod-skin', name: '潮途·海盐蓝竿',
		description: '鱼竿外观，不增加拉力；基础鱼竿也能完成旅程。',
		priceFen: 600, priceLabel: '¥6', category: 'cosmetic',
	} ),
	Object.freeze( {
		sku: 'voyage-supply', productId: 'voyage-supply', name: '潮途·航海补给包',
		description: '一份航海物资，缩短筹备时间；同类物资可通过钓鱼交易获得。',
		priceFen: 600, priceLabel: '¥6', category: 'convenience',
	} ),
	Object.freeze( {
		sku: 'harbor-pass', productId: 'harbor-pass', name: '潮途·港湾补给卡',
		description: '港湾主题外观与一次便捷补给，不解锁独占岛屿或首领。',
		priceFen: 1200, priceLabel: '¥12', category: 'convenience',
	} ),
] );

export const MONETIZATION_CONFIG = Object.freeze( {
	// 'demo' 只调用由界面传入的模拟器，不播放真实广告、不扣款。
	// 原生微信移植完成后才可改为 'wechat'，不会因为发现 wx 对象而自动启用。
	mode: 'demo',
	brand: '潮途',
	adUnits: Object.freeze( {} ),
	catalog: CATALOG,
	orderService: null,
	adTimeoutMs: 180000,
	paymentPollAttempts: 5,
	paymentPollIntervalMs: 1000,
} );

export default MONETIZATION_CONFIG;
