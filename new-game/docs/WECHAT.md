# 微信接入边界与配置

本项目提供两个入口：原版 3D 改造使用 WebGPU/WGSL 和 HTML/CSS；`wechat-game/` 是另外编译的 **Canvas 2D 轻量触屏小游戏**，共享鱼类、装备、张力战斗和三岛主线。轻量版已使用 `wx.createCanvas`、触摸事件和微信本地存储，不依赖 DOM 或远程资源，但尚未进行微信真机调试。

3D 浏览器版不能直接提交为微信原生小游戏。官方小游戏画布列出 Canvas 2D、WebGL 和 WebGL2；若要把原版高画质场景带到微信，仍需要 WebGL 渲染移植、Canvas HUD、资源分包和真机性能优化。

运行 `npm run build:wechat` 后，在微信开发者工具中导入 `wechat-game/`，类型选择小游戏，将测试 AppID 换成自己的小游戏 AppID。商业化默认演示模式，不扣款。

## 现在的演示

`src/platform/config.js` 默认 `mode: 'demo'`。虚构品牌“潮途”不代表真实商业合作。游戏界面必须明确显示广告演示、商品体验和“不扣款”；适配器不内置界面，不自行修改背包。

```js
import { Monetization } from '../src/platform/Monetization.js';
const commerce = new Monetization();
const ad = await commerce.rewarded('supplies', {
  simulate: async ({ mode, kind }) => showClearlyLabeledDemo(kind),
});
// 模拟器只有返回 true 或 { completed: true } 才算完成；false 是取消。
// ad: { completed, receipt, mode: 'demo' }
const purchase = await commerce.purchase('chaotu-rod-skin', {
  simulate: async ({ product }) => showDemoPurchase(product),
});
```

`receipt` 是本次操作的本地去重标识，不是平台签名凭据。客户端存档、演示商品和演示奖励不能作为正式服付费资产。真实广告未配置、加载失败或提前关闭，不会自动改为模拟领奖。

## 原生移植后的正式接入

1. 在微信后台完成小游戏与商业化能力开通，创建审核通过的广告位和虚拟支付商品。根据实际资格及平台审核结果配置，不在源码中填写 AppKey 或商户密钥。
2. 用 `new Monetization({ mode: 'wechat', wx, adUnits: { supplies: '自己的广告位 ID', rewarded: '可选默认广告位 ID' }, catalog, orderService })` 初始化。商品目录内 `productId` 对应微信后台商品。前端价格仅展示，服务端必须校验商品、金额、用户身份和订单归属。正式服还需把返回的权威物品清单绑定到游戏背包，并将客户端演示存档与正式服资产隔离；现有演示商城不会把支付回调直接当作发货。
3. 广告只有 `onClose` 的 `isEnded === true` 才完成。适配器会锁定并发操作，展示失败重载一次，每次结束卸载本次监听。根据业务需要，正式服奖励还应由服务端记录领取次数、防重放和校验风控；不要将本地 receipt 当作广告平台凭据。
4. 支付服务层实现以下异步函数，通过受保护的 HTTPS 服务调用。适配器调用 `wx.login` 获得一次性 code；服务端交换登录态、保存 session_key，生成订单和签名。原始 `signData` 字符串必须完整下发，客户端不得重新序列化或计算签名。

```js
const orderService = {
  // 服务端响应；orderId 为本系统订单 ID，sku 对应传入商品。
  async createOrder({ sku, productId, loginCode }) {
    return { orderId, sku, payment: { signData, paySig, signature } };
  },
  async status({ orderId }) {
    return { orderId, sku, status: 'pending' /* 或 fulfilled / cancelled / closed / failed / refunded */, receipt };
  },
  async refresh({ orderId }) {
    return authoritativeInventoryFromServer;
  },
};
```

5. 服务端验签接收微信发货通知，以订单号保证重复推送只发一次；调用官方订单查询补偿遗漏通知。只有服务端库存成功落库后，`status` 才能返回 `fulfilled`。客户端支付回调不能直接发货。`purchase` 只有收到 `fulfilled` 并刷新库存后才返回 `completed: true`；真实模式调用方应用服务端库存，不能本地再加一次商品。
6. 支付处理中返回 `{ completed: false, pending: true, orderId }` 时显示“订单确认中，请勿重复付款”。同一适配器内再次点击只查询该订单。重新启动后须由服务端恢复未完成订单与购买记录；生产服务层还必须提供持久化订单查询、防止重复下单和退款处理，本项目未部署此支付后端。

当前微信提供 `wx.checkIsSupportMidasPayment`，应按 `data.allow_pay` 判断，不能一律禁止 iOS 或一律开启。官方当前列出的 iOS 条件包括 iOS 15+、基础库 3.10.3+、微信 8.0.68+；苹果支付不支持沙箱，需按实际后台开通情况和官方流程验证。旧基础库没有此 API 时，本适配器仅允许已知非 iOS 平台继续检测支付接口。

## 官方来源

- [Canvas.getContext](https://developers.weixin.qq.com/minigame/dev/api/render/canvas/Canvas.getContext.html)
- [Adapter 与运行环境](https://developers.weixin.qq.com/minigame/dev/guide/runtime/adapter.html)
- [激励视频创建](https://developers.weixin.qq.com/minigame/dev/api/ad/wx.createRewardedVideoAd.html)与[完整观看判断](https://developers.weixin.qq.com/minigame/dev/api/ad/RewardedVideoAd.onClose.html)
- [道具直购 API](https://developers.weixin.qq.com/minigame/dev/api/midas-payment/wx.requestMidasPaymentGameItem.html)与[发货消息和幂等要求](https://developers.weixin.qq.com/minigame/dev/guide/open-ability/virtual-payment/goods.html)
- [支付能力检查](https://developers.weixin.qq.com/minigame/dev/api/midas-payment/wx.checkIsSupportMidasPayment.html)
