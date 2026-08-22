// Playground preferences: light/dark theme and English/中文 copy.
//
// Static markup opts in with `data-i18n` (text), `data-i18n-title` (tooltip)
// and `data-i18n-aria` (aria-label); dynamic strings call `t()` at the moment
// they are written. Both preferences persist in localStorage and default to
// the visitor's system settings on the first visit.

const THEME_KEY = 'lg-theme';
const LANG_KEY = 'lg-lang';

const STRINGS = {
  en: {
    'kicker': 'Material lab',
    'subhead': 'A small physics playground for translucent surfaces.',
    'panel.inspector': 'Inspector',
    'panel.hide': 'Hide inspector',
    'panel.show': 'Show inspector',
    'theme.toLight': 'Switch to light theme',
    'theme.toDark': 'Switch to dark theme',
    'lang.toggle': 'Switch language / 切换语言',

    'section.renderer': 'Renderer',
    'section.performance': 'Performance',
    'section.scene': 'Scene',
    'section.components': 'Components',
    'section.view': 'View',
    'section.debug': 'Debug view',
    'section.material': 'Material',

    'meta.thisFrame': 'this frame',
    'meta.v1': 'V1 original',
    'meta.v2': 'V2 transparent',
    'meta.v1params': 'V1 parameters',
    'meta.v2params': 'V2 parameters',
    'meta.shaderOutput': 'shader output',
    'meta.selectThenArrows': 'select, then arrow keys',

    'renderer.v1': 'V1 Original',
    'renderer.v2': 'V2 Transparent',
    'note.v1': 'The original frosted material with smooth-union fusion.',
    'note.v2': 'Clear edge-capture optics. Its values are independent from V1, including same-named controls.',

    'preset.regular': 'Regular',
    'preset.clear': 'Clear',
    'preset.lens': 'Lens',

    'action.copyLink': 'Copy link',
    'action.copyCode': 'Copy code',
    'action.reset': 'Reset all',
    'action.linkCopied': 'Link copied',
    'action.codeCopied': 'Code copied',
    'title.copyLink': 'Copy a link that reproduces this exact material',
    'title.copyCode': 'Copy the code that reproduces this material',
    'title.reset': 'Back to the package defaults',

    'stat.fps': 'Frame rate',
    'stat.cpu': 'CPU per frame',
    'stat.size': 'Drawing buffer',
    'stat.dpr': 'Device ratio',
    'stat.shapes': 'Components',
    'stat.backdrop': 'Backdrop',
    'perf.note': 'A static scene reports idle: dirty tracking skips the GPU entirely until something actually changes.',

    'scene.wallpaper': 'Wallpaper',
    'scene.uploadWallpaper': 'Upload wallpaper',
    'scene.addWallpaper': 'Add wallpaper',
    'aria.scene': 'Scene',
    'aria.sceneWallpaperPreset': 'Choose a Scene wallpaper',
    'aria.phoneWallpaperPreset': 'Choose a phone wallpaper',
    'aria.sceneWallpaperUpload': 'Upload a wallpaper for the selected Scene',
    'aria.phoneWallpaperUpload': 'Upload a custom wallpaper for the selected phone scene',

    'status.sceneWallpaper': 'Scene wallpaper',
    'status.wallpaperSelected': '{name} selected',
    'status.chooseWallpaper': 'Choose a wallpaper',
    'status.onlyPhoneScenes': 'Only for phone scenes',
    'status.selectSceneForWallpaper': 'Select Scene to choose a wallpaper',
    'status.choosePhoneScene': 'Choose a phone scene first',
    'status.chooseImage': 'Choose an image file',
    'status.loading': 'Loading wallpaper…',
    'status.loadFailed': 'Could not load that image',
    'status.selectSceneFirst': 'Select Scene first',
    'status.fileSelected': '{name} · selected',

    'component.add': 'Add component',
    'component.empty': 'No components. Add one to start.',
    'component.selectTitle': 'Select, then move with the arrow keys',
    'aria.addShape': 'Shape of the component to add',
    'aria.componentShape': '{id} shape',
    'aria.removeComponent': 'Remove {id}',

    'view.fusionOn': 'Smooth union',
    'view.fusionOff': 'Separate layers',
    'view.iconsOn': 'With icons',
    'view.iconsOff': 'Glass only',
    'view.labelsOn': 'Show labels',
    'view.labelsOff': 'Clean stage',

    'debug.final': 'Final',
    'debug.thickness': 'Thickness',
    'debug.normals': 'Normals',
    'debug.dispersion': 'Dispersion',

    'tip.v1': 'Drag components together: inside the fusion distance they form one surface, so the silhouette, refraction and highlight flow through a shared bridge. A gap only closes while it is narrower than about half the fusion distance.',
    'tip.v2': 'V2 keeps the centre nearly straight-through and captures nearby backdrop transitions only in the edge field. Roundness is a ratio; optical lengths are scaled independently.',
    'tip.locked': 'This reference scene has a fixed iPhone layout, but every liquid-glass component can be selected and pressed. Switch between V1 and V2, then adjust only that renderer’s material parameters.',
    'tip.interaction': 'Press and drag either side of the selected capsule. It expands and brightens while it follows your finger. Hold the standalone glass controls to see their white bloom and spring-back.',

    'kb.prefix': 'Keyboard:',
    'kb.toStage': 'to the stage,',
    'kb.cycle': 'to cycle components, arrows to move,',
    'kb.tenPixels': 'for ten pixels,',
    'kb.resize': 'to resize,',
    'kb.remove': 'to remove.',
    'kb.resetOne': 'Double click a parameter name to reset just that one.',

    'hud.interaction': '{kind} / press and drag the glass',
    'hud.locked': '{kind} / tap any glass component to select it',
    'hud.free': '{kind} / drag the components, or select one and use the arrow keys',

    'aria.stage': 'Liquid glass stage. Drag a component, or select one and move it with the arrow keys.',
    'aria.stageInteraction': 'Press effects. Drag the selected glass capsule to choose Home or Discover. Hold the other glass controls to make them bloom.',
    'aria.stageLockedHome': '{name}. Swipe horizontally, or use the left and right arrow keys, to change home screen pages.',
    'aria.stageLocked': '{name}. Tap any liquid-glass component to select and press it. Use the inspector to adjust material parameters.',

    'gesture.swipePages': 'Swipe pages',
    'gesture.swipePagesHint': 'Drag left or right',
    'gesture.notifications': 'Notifications',
    'gesture.notificationsHint': 'Pull down, top-left',
    'gesture.control': 'Control Centre',
    'gesture.controlHint': 'Pull down, top-right',
    'gesture.dismissSwipe': 'Dismiss swipe pages tip',
    'gesture.dismissNotifications': 'Dismiss notifications tip',
    'gesture.dismissControl': 'Dismiss control centre tip',
    'title.tipSwipe': 'Swipe left or right to change the home screen page',
    'title.tipNotification': 'Pull down from the top-left of the screen, then swipe up to close',
    'title.tipControl': 'Pull down from the top-right of the screen, then swipe up to close',

    'loadState': 'Loading source imagery',
    'unsupported.title': 'WebGL2 is unavailable',
    'unsupported.bodyA': 'This playground needs a WebGL2 context. The material cannot be rendered here, but',
    'unsupported.bodyB': 'and',
    'unsupported.bodyC': 'report the same thing in your own app so you can fall back to a CSS surface.',

    'group.geometry': 'Geometry',
    'group.optics': 'Optics',
    'group.lighting': 'Lighting',
    'group.edge': 'Edge',
    'group.transmission': 'Transmission',
    'group.reflection': 'Reflection',
    'group.interface': 'Interface',

    'slider.v1.radius': 'Corner radius',
    'slider.v1.squircle': 'Corner shape',
    'slider.v1.mergeRadius': 'Fusion distance',
    'slider.v1.bevel': 'Bevel width',
    'slider.v1.height': 'Optical height',
    'slider.v1.sizeAdaptation': 'Fit small controls',
    'slider.v1.ior': 'Index of refraction',
    'slider.v1.dispersion': 'Chromatic spread',
    'slider.v1.refractScale': 'Refraction scale',
    'slider.v1.meniscus': 'Meniscus curve',
    'slider.v1.blurPlateau': 'Plateau blur',
    'slider.v1.blurRim': 'Rim blur',
    'slider.v1.opticalDensity': 'Optical density',
    'slider.v1.specular': 'Specular',
    'slider.v1.specPower': 'Specular power',
    'slider.v1.highlightAdapt': 'Light adaptation',
    'slider.v1.highlightWidth': 'Highlight width',
    'slider.v1.highlightSharpness': 'Highlight sharpness',
    'slider.v1.highlightBase': 'Highlight base',
    'slider.v1.fresnel': 'Fresnel',
    'slider.v1.saturation': 'Saturation',
    'slider.v1.brightness': 'Brightness',
    'slider.v1.tintAmount': 'Tint amount',
    'slider.v1.tintAdapt': 'Light / dark tint',
    'slider.v1.shadow': 'Shadow',
    'slider.v1.shadowSize': 'Shadow size',
    'slider.v1.shadowOffset': 'Shadow offset',
    'slider.v1.lightX': 'Light X',
    'slider.v1.lightY': 'Light Y',
    'slider.v1.edgeLine': 'Edge highlight',
    'slider.v1.edgeWidth': 'Edge width',
    'slider.v1.edgeDark': 'Edge contrast',

    'slider.v2.refraction': 'Refraction',
    'slider.v2.edgeReach': 'Capture reach',
    'slider.v2.edgeWidth': 'Pull width',
    'slider.v2.dispersion': 'Dispersion',
    'slider.v2.frost': 'Softness ratio',
    'slider.v2.body': 'Glass body',
    'slider.v2.absorption': 'Absorption',
    'slider.v2.tint': 'Tint opacity',
    'slider.v2.rim': 'Edge light',
    'slider.v2.reflection': 'Reflection',
    'slider.v2.highlight': 'Highlight',
    'slider.v2.lightAngle': 'Light fallback',
    'slider.v2.echo': 'Inner echo',
    'slider.v2.hairline': 'Hairline',
    'slider.v2.hairWidth': 'Hair width',
    'slider.v2.roundness': 'Corner radius',

    'announce.webglUnavailable': 'This browser cannot run WebGL2.',
    'announce.contextLost': 'The GPU context was lost. Waiting for the browser to restore it.',
    'announce.contextRestored': 'The GPU context was restored.',
    'announce.videoBlocked': 'The browser blocked video playback. Interact with the page and pick the scene again.',
    'announce.reset': '{version} material reset to its own package defaults.',
    'announce.switched': 'Switched to {version} renderer.',
    'announce.wallpaperApplied': '{name} wallpaper applied to {scene}.',
    'announce.customWallpaper': 'Custom wallpaper applied to {scene}. It is now available in the wallpaper menu.',
    'announce.shareCopied': 'Share link copied.',
    'announce.codeCopied': 'Code copied to the clipboard.',
    'announce.clipboardBlocked': 'The browser blocked clipboard access.',
    'announce.page': 'Home screen page {page} of 2.',
    'announce.notifOpen': 'Notification Centre open.',
    'announce.controlOpen': 'Control Centre open.',
    'announce.backHome': 'Back to the Home Screen.',
    'announce.added': 'Added {shape} {id}',
    'announce.removed': 'Removed {id}',
    'announce.retyped': '{id} is now a {shape}',
  },

  zh: {
    'kicker': '材质实验室',
    'subhead': '一个探索半透明表面质感的实时渲染实验场。',
    'panel.inspector': '检查器',
    'panel.hide': '隐藏检查器',
    'panel.show': '显示检查器',
    'theme.toLight': '切换到浅色主题',
    'theme.toDark': '切换到深色主题',
    'lang.toggle': 'Switch language / 切换语言',

    'section.renderer': '渲染器',
    'section.performance': '性能',
    'section.scene': '场景',
    'section.components': '组件',
    'section.view': '视图',
    'section.debug': '调试视图',
    'section.material': '材质',

    'meta.thisFrame': '当前帧',
    'meta.v1': 'V1 经典',
    'meta.v2': 'V2 透明',
    'meta.v1params': 'V1 参数',
    'meta.v2params': 'V2 参数',
    'meta.shaderOutput': '着色器输出',
    'meta.selectThenArrows': '选中后用方向键移动',

    'renderer.v1': 'V1 经典',
    'renderer.v2': 'V2 透明',
    'note.v1': '经典的磨砂材质，支持平滑融合。',
    'note.v2': '清澈的边缘捕捉光学。参数与 V1 相互独立，同名参数互不影响。',

    'preset.regular': '常规',
    'preset.clear': '清透',
    'preset.lens': '透镜',

    'action.copyLink': '复制链接',
    'action.copyCode': '复制代码',
    'action.reset': '全部重置',
    'action.linkCopied': '链接已复制',
    'action.codeCopied': '代码已复制',
    'title.copyLink': '复制可精确复现当前材质的链接',
    'title.copyCode': '复制可复现当前材质的代码',
    'title.reset': '恢复为包默认参数',

    'stat.fps': '帧率',
    'stat.cpu': '单帧 CPU',
    'stat.size': '绘制缓冲',
    'stat.dpr': '设备像素比',
    'stat.shapes': '组件',
    'stat.backdrop': '背景',
    'perf.note': '静态场景会显示 idle：脏标记机制在画面没有变化时完全跳过 GPU。',

    'scene.wallpaper': '壁纸',
    'scene.uploadWallpaper': '上传壁纸',
    'scene.addWallpaper': '添加壁纸',
    'aria.scene': '场景',
    'aria.sceneWallpaperPreset': '选择 Scene 场景壁纸',
    'aria.phoneWallpaperPreset': '选择手机壁纸',
    'aria.sceneWallpaperUpload': '为 Scene 场景上传壁纸',
    'aria.phoneWallpaperUpload': '为所选手机场景上传自定义壁纸',

    'status.sceneWallpaper': '场景默认壁纸',
    'status.wallpaperSelected': '已选择 {name}',
    'status.chooseWallpaper': '选择一张壁纸',
    'status.onlyPhoneScenes': '仅适用于手机场景',
    'status.selectSceneForWallpaper': '选择 Scene 场景后可挑选壁纸',
    'status.choosePhoneScene': '请先选择一个手机场景',
    'status.chooseImage': '请选择图片文件',
    'status.loading': '正在加载壁纸…',
    'status.loadFailed': '无法加载该图片',
    'status.selectSceneFirst': '请先选择 Scene 场景',
    'status.fileSelected': '{name} · 已选择',

    'component.add': '添加组件',
    'component.empty': '暂无组件，添加一个开始吧。',
    'component.selectTitle': '选中后可用方向键移动',
    'aria.addShape': '要添加的组件形状',
    'aria.componentShape': '{id} 的形状',
    'aria.removeComponent': '移除 {id}',

    'view.fusionOn': '平滑融合',
    'view.fusionOff': '独立分层',
    'view.iconsOn': '显示图标',
    'view.iconsOff': '仅玻璃',
    'view.labelsOn': '显示标签',
    'view.labelsOff': '纯净画面',

    'debug.final': '最终',
    'debug.thickness': '厚度',
    'debug.normals': '法线',
    'debug.dispersion': '色散',

    'tip.v1': '把组件拖到一起：在融合距离内它们会合并为一个表面，轮廓、折射和高光会流过共同的桥接。只有当缝隙小于融合距离的一半左右时才会闭合。',
    'tip.v2': 'V2 让中心区域近乎直通，只在边缘区域捕捉附近的背景变化。圆角是比例值；光学长度独立缩放。',
    'tip.locked': '这个参考场景使用固定的 iPhone 布局，但每个液态玻璃组件都可以选中和按压。可在 V1 与 V2 之间切换，然后只调整当前渲染器的材质参数。',
    'tip.interaction': '按住并拖动选中胶囊的任意一侧，它会跟随手指放大并变亮。按住其他独立的玻璃控件，可以看到它们的白色泛光与回弹。',

    'kb.prefix': '快捷键：',
    'kb.toStage': '聚焦舞台，',
    'kb.cycle': '切换组件，方向键移动，',
    'kb.tenPixels': '每次十像素，',
    'kb.resize': '调整大小，',
    'kb.remove': '删除。',
    'kb.resetOne': '双击参数名可单独重置该参数。',

    'hud.interaction': '{kind} / 按住并拖动玻璃',
    'hud.locked': '{kind} / 点按任意玻璃组件将其选中',
    'hud.free': '{kind} / 拖动组件，或选中后用方向键移动',

    'aria.stage': '液态玻璃舞台。拖动组件，或选中一个后用方向键移动。',
    'aria.stageInteraction': '按压效果。拖动选中的玻璃胶囊在 Home 与 Discover 之间切换。按住其他玻璃控件可看到泛光效果。',
    'aria.stageLockedHome': '{name}。左右滑动，或使用左右方向键切换主屏幕页面。',
    'aria.stageLocked': '{name}。点按任意液态玻璃组件将其选中并按压。使用检查器调整材质参数。',

    'gesture.swipePages': '滑动翻页',
    'gesture.swipePagesHint': '左右拖动',
    'gesture.notifications': '通知中心',
    'gesture.notificationsHint': '从左侧顶部下拉',
    'gesture.control': '控制中心',
    'gesture.controlHint': '从右侧顶部下拉',
    'gesture.dismissSwipe': '关闭滑动翻页提示',
    'gesture.dismissNotifications': '关闭通知中心提示',
    'gesture.dismissControl': '关闭控制中心提示',
    'title.tipSwipe': '左右滑动以切换主屏幕页面',
    'title.tipNotification': '从屏幕左上方下拉，然后上滑关闭',
    'title.tipControl': '从屏幕右上方下拉，然后上滑关闭',

    'loadState': '正在加载素材',
    'unsupported.title': 'WebGL2 不可用',
    'unsupported.bodyA': '这个 playground 需要 WebGL2 上下文，无法在此渲染材质，但',
    'unsupported.bodyB': '和',
    'unsupported.bodyC': '在你的应用中也会给出同样的结果，因此可以回退到 CSS 表面。',

    'group.geometry': '几何',
    'group.optics': '光学',
    'group.lighting': '光照',
    'group.edge': '边缘',
    'group.transmission': '透射',
    'group.reflection': '反射',
    'group.interface': '界面',

    'slider.v1.radius': '圆角半径',
    'slider.v1.squircle': '角部形状',
    'slider.v1.mergeRadius': '融合距离',
    'slider.v1.bevel': '斜面宽度',
    'slider.v1.height': '光学高度',
    'slider.v1.sizeAdaptation': '适配小控件',
    'slider.v1.ior': '折射率',
    'slider.v1.dispersion': '色散程度',
    'slider.v1.refractScale': '折射缩放',
    'slider.v1.meniscus': '弯月面曲线',
    'slider.v1.blurPlateau': '平台模糊',
    'slider.v1.blurRim': '边缘模糊',
    'slider.v1.opticalDensity': '光学密度',
    'slider.v1.specular': '高光强度',
    'slider.v1.specPower': '高光锐度',
    'slider.v1.highlightAdapt': '光照自适应',
    'slider.v1.highlightWidth': '高光宽度',
    'slider.v1.highlightSharpness': '高光锐利度',
    'slider.v1.highlightBase': '高光基准',
    'slider.v1.fresnel': '菲涅尔',
    'slider.v1.saturation': '饱和度',
    'slider.v1.brightness': '亮度',
    'slider.v1.tintAmount': '着色强度',
    'slider.v1.tintAdapt': '明 / 暗着色',
    'slider.v1.shadow': '阴影',
    'slider.v1.shadowSize': '阴影大小',
    'slider.v1.shadowOffset': '阴影偏移',
    'slider.v1.lightX': '光源 X',
    'slider.v1.lightY': '光源 Y',
    'slider.v1.edgeLine': '边缘高光',
    'slider.v1.edgeWidth': '边缘宽度',
    'slider.v1.edgeDark': '边缘对比度',

    'slider.v2.refraction': '折射',
    'slider.v2.edgeReach': '捕捉范围',
    'slider.v2.edgeWidth': '拉伸宽度',
    'slider.v2.dispersion': '色散',
    'slider.v2.frost': '柔化比例',
    'slider.v2.body': '玻璃主体',
    'slider.v2.absorption': '吸收',
    'slider.v2.tint': '着色不透明度',
    'slider.v2.rim': '边缘光',
    'slider.v2.reflection': '反射',
    'slider.v2.highlight': '高光',
    'slider.v2.lightAngle': '光线回退',
    'slider.v2.echo': '内部回声',
    'slider.v2.hairline': '细线',
    'slider.v2.hairWidth': '细线宽度',
    'slider.v2.roundness': '圆角半径',

    'announce.webglUnavailable': '当前浏览器无法运行 WebGL2。',
    'announce.contextLost': 'GPU 上下文丢失，正在等待浏览器恢复。',
    'announce.contextRestored': 'GPU 上下文已恢复。',
    'announce.videoBlocked': '浏览器阻止了视频播放，请与页面交互后重新选择该场景。',
    'announce.reset': '{version} 材质已重置为包默认参数。',
    'announce.switched': '已切换到 {version} 渲染器。',
    'announce.wallpaperApplied': '已将壁纸 {name} 应用到{scene}。',
    'announce.customWallpaper': '自定义壁纸已应用到{scene}，现在可以在壁纸菜单中选择它。',
    'announce.shareCopied': '分享链接已复制。',
    'announce.codeCopied': '代码已复制到剪贴板。',
    'announce.clipboardBlocked': '浏览器阻止了剪贴板访问。',
    'announce.page': '主屏幕第 {page} 页，共 2 页。',
    'announce.notifOpen': '通知中心已打开。',
    'announce.controlOpen': '控制中心已打开。',
    'announce.backHome': '已返回主屏幕。',
    'announce.added': '已添加 {shape} {id}',
    'announce.removed': '已移除 {id}',
    'announce.retyped': '{id} 现在是 {shape}',
  },
};

function systemTheme() {
  return globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function systemLanguage() {
  return globalThis.navigator?.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let theme = localStorage.getItem(THEME_KEY) ?? systemTheme();
let lang = localStorage.getItem(LANG_KEY) ?? systemLanguage();
if (!STRINGS[lang]) lang = 'en';
const langListeners = new Set();

export function t(key, vars) {
  let text = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

export function getTheme() {
  return theme;
}

export function setTheme(next) {
  theme = next === 'light' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.dataset.theme = theme;
  syncThemeToggle();
}

export function getLanguage() {
  return lang;
}

export function setLanguage(next) {
  if (!STRINGS[next] || next === lang) return;
  lang = next;
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  applyI18n();
  syncLangToggle();
  for (const listener of langListeners) listener(lang);
}

/** Re-runs the dynamic writers (HUD, tips, statuses) after a language switch. */
export function onLanguageChange(listener) {
  langListeners.add(listener);
}

/** Applies the current language to every opted-in node under `root`. */
export function applyI18n(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll('[data-i18n-title]')) {
    node.title = t(node.dataset.i18nTitle);
  }
  for (const node of root.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nAria));
  }
}

function syncThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  const toLight = theme === 'dark';
  toggle.title = t(toLight ? 'theme.toLight' : 'theme.toDark');
  toggle.setAttribute('aria-label', toggle.title);
}

function syncLangToggle() {
  for (const button of document.querySelectorAll('[data-lang]')) {
    button.classList.toggle('active', button.dataset.lang === lang);
  }
  const toggle = document.getElementById('langToggle');
  if (toggle) toggle.setAttribute('aria-label', t('lang.toggle'));
}

/** Wires the header controls; call once the DOM is parsed. */
export function initPreferences() {
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  });
  for (const button of document.querySelectorAll('[data-lang]')) {
    button.addEventListener('click', () => setLanguage(button.dataset.lang));
  }
  applyI18n();
  syncThemeToggle();
  syncLangToggle();
}
