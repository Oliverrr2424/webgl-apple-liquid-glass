# Liquid Glass — 物理原理与复刻

WebGL2 从零复刻 iOS 26 / macOS Tahoe 的 **Liquid Glass**（以主屏文件夹为例），
并按参考截图做了多轮视觉对比与修正。

```bash
npm install          # 只装 playwright（截图验证用）
npm run serve        # http://localhost:8765
```

右侧面板可实时调参、切换场景/预设，并把材质拆成
**厚度场 / 法线 / 位移+色散** 三种可视化；画面里的文件夹可以直接拖动，
拖到高对比的树枝或岛屿边界上最容易看清边缘透镜。

---

## 1. 物理模型

Liquid Glass 不是"毛玻璃 + 白色半透明层"。它是一块**有厚度、有边缘曲率的
透明介质**，屏幕内容就是它背面的贴图。整条链路：

| 步 | 物理量 | 实现 |
| --- | --- | --- |
| 1 | 形状 | squircle（超椭圆）SDF `d(p)`，指数 `n≈4.2` 得到 Apple 的连续曲率圆角 |
| 2 | 厚度场 | `t = clamp(-d / bevel)`，高度 `h(t) = sqrt(1-(1-t)²)`：中间是平台，只有边缘一圈是斜面 |
| 3 | 法线 | `n = normalize(vec3(s · H/bevel · dh/dt · ∇d, 1))` |
| 4 | 折射 | Snell：`R = refract((0,0,-1), n, 1/ior)`，屏幕空间位移 `Δ = R.xy / -R.z · 光程` |
| 5 | 色散 | R/G/B 用 `ior ∓ dispersion` 各算一次 → 边缘彩边 |
| 6 | 散射 | 背景模糊金字塔上 `textureLod(lod(t))`：平台重、边缘轻（边缘要保留可读的弯折） |
| 7 | 反射 | Fresnel `(1-n.z)³` 混环境色 + 两个高光波瓣（主光左上、补光右下）→ 亮边 |
| 8 | 边缘 | 掠射角变暗的暗轮廓线 + 内侧亮线 |
| 9 | 自适应 | 按元件背后**平均**亮度（一次低分辨率 mip 采样）加白纱 |
| 10 | 阴影 | SDF 外侧指数衰减的接触阴影，略向下偏移 |

### 关键结论：边缘是"液面"而不是凸透镜

`s` 的符号决定了整个观感，这是复刻里最容易搞错的一点：

* `s = +1`（凸透镜边缘）：法线朝外倾 → 折射把采样点推向**内**，
  边缘放大内部内容，外面的东西完全进不来。
* `s = -1`（**meniscus / 凹液面**，`meniscus = 1`）：法线朝内倾 → 折射把采样点推向**外**，
  于是边缘一圈会把**外部背景挤压进来**，直线在边界处被"拉着"沿边缘走。

参考截图里树枝穿过文件夹边界时正是被压弯、贴着边框走，所以 Apple 的边缘等价于
**液体在容器壁上被表面张力拉起来的凹液面**——这也正是 "Liquid" 的来处。
面板里把 `meniscus` 拉到 0 就能看到两者区别（`shots/` 里也留了对比图）。

### 第二个易错点：自适应要看"平均亮度"

早期版本按每像素亮度加白纱，结果背后的深色树枝被洗成灰色。Apple 的自适应是
**整块元件级**的：只有整体背景偏暗时才整体提亮，暗部细节仍然保持暗。
现在用 `textureLod(uSrc, center, avgLod)` 一次采样得到平均亮度，
深蓝壁纸上面板变奶白，黄昏壁纸上树枝依旧是棕黑色。

---

## 2. 代码结构

```
index.html            舞台 + 调参面板
src/shaders.js         GLSL：壁纸、模糊降采样、玻璃材质（含推导注释）
src/renderer.js        WebGL2：mip 模糊链、每个玻璃元件一次 draw
src/material.js        材质参数默认值 / 预设 / 滑杆定义
src/overlay.js         玻璃之上的图标网格、名称、红色角标（2D canvas）
src/app.js             场景布局、交互、调试视图、window.__lg 自动化接口
tools/shot.mjs         Playwright 截图（复刻验证用）
```

渲染流程：壁纸 → mip 0；13-tap dual filter 逐级降采样出 7 级模糊链 →
背景直出屏幕 → 每个文件夹画一个带阴影 padding 的四边形（premultiplied 混合）→
2D canvas 画图标/文字。

模糊半径、斜面宽度、玻璃厚度都是 **CSS px**，渲染时乘 dpr，
`blur lod` 加 `log2(dpr)`，所以在任何缩放/DPR 下是同一块物理玻璃。

---

## 3. 视觉验证流程

```bash
npm run serve
node tools/shot.mjs shots/final0.png --scene 0 --size 620x420 --no-panel
node tools/shot.mjs shots/finalz.png --scene 0 --size 500x340 --no-panel --focus 0,2.4
node tools/shot.mjs shots/dbg3.png  --scene 0 --no-panel --focus 0,2.4 --set debug=3
```

`--focus i,zoom` 是**真放大**：文件夹尺寸、圆角、斜面、厚度、模糊 lod、
边线宽度、壁纸都按同一倍率放大，因此近景截图能直接和参考大图比例对照。
`--set k=v,...` 可临时改任意参数，用来做参数扫描。

对照参考截图后依次修掉的问题：

1. 壁纸树枝是离散的"珠链" → 贝塞尔改成折线段距离。
2. 边缘没有透镜感 → 发现折射符号反了，引入 meniscus 曲率。
3. 内部糊成一片粉色 → 降低平台 lod，并把树枝加粗到参考照片的比例。
4. 边界不清 → 加掠射角暗轮廓 + 内侧亮线（`edgeDark` / `edgeLine` / `edgeWidth`）。
5. 深色壁纸上玻璃不够亮 → 加 `adaptive` 白纱。
6. 白纱把暗部洗灰 → 改成按元件平均亮度自适应。
```
