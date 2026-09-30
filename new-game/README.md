# 潮汐归途 · Tidewater 中文荒岛改造版

可玩的中文钓鱼冒险：捕鱼、与 NPC 换物资、修船、挑战首领、逐岛回家。

## 启动

需要 Node.js 22.12+（建议 24）。

```sh
npm install
npm run dev
```

打开终端显示的本机地址。首页可选择 **3D 海岛** 或 **轻量触屏版**。

```sh
npm run build          # 浏览器发布文件 dist/
npm run build:wechat   # 生成微信轻量小游戏 wechat-game/game.js
npm start              # 在 http://127.0.0.1:5191/ 运行 dist/
```

已附带构建产物时，也可以双击 `启动游戏.cmd`。浏览器发布包可以放到静态托管服务，直接打开 HTML 文件不能正常运行模块和 WebGPU。

微信开发者工具选择“小游戏”并导入 `wechat-game/`，使用自己的小游戏 AppID（本包默认测试 AppID）。这是共享玩法的 Canvas 2D 轻量版，3D WebGPU 渲染并未移植到微信。正式广告、支付需运营账号及服务端配置。

## 已改造

- 主要玩家界面、18 种鱼、装备和操作引导汉化。
- 三岛修船主线、使用原版张力机制的首领战、自动存档与归航结局。
- NPC 鱼获换材料、出售、装备升级、触屏控制。
- 漂流补给、鱼饵、装备试用、鱼获加奖与救回的自愿广告入口。
- 虚构品牌“潮途”及不扣款的内购演示；真实平台调用另有适配层。
- 默认不扣款、不播放真实商业广告。主线可免费完成。

[改造范围与当前限制](docs/CHANGES-ZH.md) · [微信接入说明](docs/WECHAT.md) · [原版说明](docs/UPSTREAM-README.md)

保留原作者 MIT 版权和第三方素材许可。上游仓库为 [dgreenheck/tidewater](https://github.com/dgreenheck/tidewater)，基于提交 `4811ba48d795197de5621985f404e765c0b7c0ef`。

---

# Tidewater 原版介绍

An island fishing game for the browser. Cast from the pier, the beach or your own boat, fight the fish,
sell your catch to Joe at the fish stand, and spend it on better gear at Marta's chandlery. Around it is a
real-time tropical island and ocean: swim the reef, drive the boat out to deep water, and watch a humpback
breach. It runs directly on WebGPU and WGSL with its own small rendering engine, no framework.

**Play it:** https://dgreenheck.github.io/tidewater/

![Fishing off the pier at golden hour](docs/screenshot.jpg)

![The beach in the late afternoon](docs/screenshot-beach.jpg)

## Requirements

- A browser with WebGPU: a recent Chrome, Edge or Safari.
- A capable GPU. It targets 60 fps at 2560×1267 on an Apple M5 Pro, and dynamic resolution scales
  the render down on slower machines.
- The first load compiles several hundred shaders, which can take a minute or more. Later visits are
  faster because the browser caches them.

## Features

**Fishing**
- A spinning rod and reel that cast, reel and bend under load, with the bail, rotor and crank animated.
- Bites that depend on the water (shallows, pier, reef, bay, deep water), depth and time of day, across
  18 Caribbean species.
- A line-tension fight: keep the tension in the green band, ease off when the fish runs.
- A full-screen catch card with the fish's length and weight, a fish log with records, and a cooler.
- Joe's fish stand buys your catch; Marta's chandlery sells line, reels, rods, a bigger hold, fuel, a rebuilt
  engine, a fish finder and deck floodlights for night fishing.
- Walk the deck and the wheelhouse while the boat drifts; the boat burns fuel.
- A first-play guide, contextual tips and a minimap. Progress is saved in the browser.

**Ocean**
- Four-cascade FFT ocean (Tessendorf spectra) with foam, whitecaps, wind streaks and swell.
- Depth-aware breaking waves with peeling shoulders, whitewater, spray and foam lace.
- A shallow-water simulation for swash running up and down the sand.
- Boat wake and bow spray, and a whale wake.
- Caustics on the seabed and in the water, with light shafts.
- A split underwater/above-water view at the waterline, with water droplets on the lens after surfacing.
- Refraction of the seabed through the surface, including behind the pier and boats.

**Sky**
- Physically based atmosphere (Hillaire 2020) with a sun, moon and stars.
- Volumetric cumulus and wispy cirrus with cloud shadows on the land.
- Aerial perspective and sea haze.
- God rays, and a lens flare with occlusion.

**World**
- An island with a beach, hills, headlands and rocks.
- A fishing village, a pier, and the vendors' stalls built from Poly Haven scans.
- Realistic vendor characters (Microsoft Rocketbox) with skinned animation.
- A coral reef with fish.
- Palms, bananas, monstera, elephant ear, heliconia, bird of paradise, broadleaf trees, shrubs and dune
  grass, with impostors and dithered LOD fades.
- Beach debris.
- Birds, crabs and marine snow.
- A humpback whale with an escort of fish, blows, fluke dives and breaches.

**Lighting and post**
- Cascaded shadows with contact-hardening penumbrae, and screen-space contact shadows.
- Ground bounce light.
- GTAO ambient occlusion.
- Temporal upscaling and sharpening.
- Bloom, auto exposure and motion blur.
- Night lighting from lanterns, windows and the boat, plus a flashlight that also works underwater.

**Audio**
- Positional audio from real CC0 field recordings: surf timed to each breaking wave, wind, birds, the boat
  engine, footsteps by surface, underwater ambience, whale song, and the rod and reel (casts, the bail,
  reeling, the drag, line snaps, splashes).

## Controls

| Key | Action |
|---|---|
| W A S D | Move |
| Mouse | Look (click to capture the mouse, Esc to release) |
| Shift | Sprint / boat boost |
| Space | Jump / swim up |
| C | Crouch / dive |
| E | Interact: board the boat, take or leave the helm, step ashore, trade with the fish buyer or the chandlery |
| V | Boat camera at the helm (1st / 3rd person) |
| R | Take out / put away the fishing rod |
| Left mouse | Hold to wind up, release to cast · strike when a fish takes the bait · hold to reel |
| Right mouse | Reel an empty line in |
| I or Tab | Cooler / fish hold and the fish log |
| F | Free camera |
| L | Flashlight |
| T | Pause time |
| M | Mute |
| H | Settings panel |
| P | Photo mode |
| F1 or ? | All controls |

### Fishing

Walk the deck of the boat while it drifts, or fish from the pier and the beach. Cast, wait for the bobber
to dip and strike when it's pulled under, then play the fish: keep the line tension in the green band,
ease off when it runs. Different water holds different fish (the shallows, the pier, the reef, the bay and
deep water offshore), and some bite best at dawn, dusk or night. Sell your catch to Joe at the fish stand
on the beach by the pier, and spend it at Marta's chandlery by the boathouse: stronger line, a faster reel,
a longer rod, a bigger fish hold, a larger fuel tank, a rebuilt engine, a fish finder and deck floodlights for
night fishing. The boat burns diesel at the helm; fill up at the chandlery. Progress is saved in the browser.

The settings panel (H) exposes the sea state, time of day, sun azimuth, clouds, haze, post-processing and
more.

## URL options

Add these to the URL, for example `?fly&noAudio`:

| Option | Effect |
|---|---|
| `fly` | Start in the free camera |
| `noAudio` | Disable sound |
| `noClouds` | Skip the volumetric clouds |
| `noHaze` | Skip the haze and sun shafts |
| `noCaustics` | Skip caustics |
| `noVeg` | Skip vegetation |
| `noSim` | Skip the swash (shallow-water) simulation |

## Running locally

```sh
npm install
npm run dev      # http://127.0.0.1:5189
npm run build    # static build in dist/
```

Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Project layout

| Folder | Contents |
|---|---|
| `src/game/` | The fishing game: rod, bites, the fight, catch card, cooler and log, vendors and stalls, guide, minimap, HUD |
| `src/engine/` | The rendering engine: math, scene graph and geometry, GPU resources, WGSL shader composition, materials, lighting and shadows |
| `src/ocean/` | FFT ocean, water surface and material, shore waves, breakers, swash, wake, caustics, underwater lighting |
| `src/sky/` | Atmosphere, clouds, sky and environment |
| `src/world/` | Terrain, village, pier, reef, fish, vegetation, rocks, debris, wildlife, whale, boat |
| `src/post/` | Post chain: AO, underwater composite, haze, TAAU, motion blur, bloom, lens flare, droplets |
| `src/materials/` | Shared lighting: shadow filtering, bounce light, contact shadows, local lights, LOD fades |
| `src/player/` | Walking, swimming, the boat and the free camera |
| `src/audio/` | The sample-based soundscape |
| `src/ui/` | Settings panel, loading screen and HUD |
| `tools/` | Scripts that fetch and convert the characters, stall props and fishing sounds |
| `test/` | Headless engine smoke test and game-logic tests (`npm test`), and HUD / loader dev pages |

## Credits and license

The code is released under the MIT license; see [LICENSE](LICENSE). Third-party assets (CC0 audio from
Freesound, CC0 scans from Poly Haven, MIT characters from Microsoft Rocketbox, OFL / Apache fonts) and
technique references are listed in [CREDITS.md](CREDITS.md).
