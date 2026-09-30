import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await build({configFile:false,root,publicDir:false,build:{outDir:'wechat-game',emptyOutDir:false,target:'es2019',minify:true,
  lib:{entry:path.join(root,'src/portable/wechat.js'),name:'HomeboundGame',formats:['cjs'],fileName:()=> 'game.js'},
  rolldownOptions:{output:{codeSplitting:false}}}});
fs.copyFileSync(path.join(root,'LICENSE'),path.join(root,'wechat-game/LICENSE'));
fs.writeFileSync(path.join(root,'wechat-game/README.md'),'# 潮汐归途 · 微信轻量小游戏\n\n在微信开发者工具中选择小游戏项目，导入此目录。将 project.config.json 的 appid 改为自己的小游戏 AppID。默认使用测试 AppID；若工具要求真实 AppID，请使用自己的小游戏账号。\n\n本包为 Canvas 2D 触屏游戏，复用 Tidewater 的鱼类、装备与张力遛鱼逻辑，不包含 WebGPU 3D 渲染。所有素材由代码绘制，无远程资源依赖。\n\n广告和内购默认演示，不扣款。真实接入请修改源码 src/platform/config.js 并重新运行 npm run build:wechat；需要广告位与支付服务端，不能仅修改模式就上线运营。尚未进行微信真机与正式支付联调。\n\n原作代码 Copyright (c) 2026 DRG Software Solutions LLC，MIT 许可见 LICENSE。\n');
console.log('微信轻量版已生成：wechat-game/game.js');
