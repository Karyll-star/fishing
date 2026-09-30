# 潮汐归途 · 微信轻量小游戏

在微信开发者工具中选择小游戏项目，导入此目录。将 project.config.json 的 appid 改为自己的小游戏 AppID。默认使用测试 AppID；若工具要求真实 AppID，请使用自己的小游戏账号。

本包为 Canvas 2D 触屏游戏，复用 Tidewater 的鱼类、装备与张力遛鱼逻辑，不包含 WebGPU 3D 渲染。所有素材由代码绘制，无远程资源依赖。

广告和内购默认演示，不扣款。真实接入请修改源码 src/platform/config.js 并重新运行 npm run build:wechat；需要广告位与支付服务端，不能仅修改模式就上线运营。尚未进行微信真机与正式支付联调。

原作代码 Copyright (c) 2026 DRG Software Solutions LLC，MIT 许可见 LICENSE。
