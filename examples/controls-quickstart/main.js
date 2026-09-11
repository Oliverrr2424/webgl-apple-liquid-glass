import {
  LiquidGlassNavbar,
  LiquidGlassSwitch,
} from 'apple-liquid-glass-webgl/controls';

const backdrop = document.createElement('canvas');
backdrop.width = 1200;
backdrop.height = 500;
const context = backdrop.getContext('2d');
const sky = context.createLinearGradient(0, 0, backdrop.width, backdrop.height);
sky.addColorStop(0, '#164f8b');
sky.addColorStop(0.48, '#81a9bf');
sky.addColorStop(1, '#d48245');
context.fillStyle = sky;
context.fillRect(0, 0, backdrop.width, backdrop.height);
context.fillStyle = 'rgba(255,255,255,.3)';
for (let x = -100; x < backdrop.width; x += 170) {
  context.beginPath();
  context.arc(x, 90 + (x % 260), 130, 0, Math.PI * 2);
  context.fill();
}

const state = document.querySelector('#state');
let navValue = 'gallery';
let checked = false;
const showState = () => {
  state.value = `navbar: ${navValue} · switch: ${checked ? 'on' : 'off'}`;
};

const navbar = new LiquidGlassNavbar(document.querySelector('#navbar'), {
  backdrop,
  items: [
    { value: 'gallery', label: 'Gallery', icon: '▣' },
    { value: 'featured', label: 'Featured', icon: '▰' },
  ],
  value: navValue,
  onChange(value) {
    navValue = value;
    showState();
  },
});

const toggle = new LiquidGlassSwitch(document.querySelector('#toggle'), {
  backdrop,
  checked,
  onChange(value) {
    checked = value;
    showState();
  },
});

showState();
window.controls = { navbar, toggle };
window.controlsReady = Promise.all([navbar.ready, toggle.ready]);
