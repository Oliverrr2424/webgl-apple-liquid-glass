// The component list.
//
// Selection lives in real DOM buttons rather than only on the canvas: that is
// what makes the stage reachable with a keyboard and a screen reader, and it
// doubles as the place to add, retype and delete components without editing the
// scene source.

import { t } from './i18n.js?press-lens=1';
import { resizeElementFromEditor } from './interactions.js';

const SHAPES = ['folder', 'rect', 'pill', 'circle'];
const MIN_SIZE = 28;

export function createComponentEditor({ container, addButton, addShape, store, onChange, announce, isLocked = () => false }) {
  function nextId(shape) {
    let index = 1;
    while (store.elements.some((element) => element.id === `${shape}-${index}`)) index++;
    return `${shape}-${index}`;
  }

  function add() {
    if (isLocked()) return;
    const shape = addShape.value;
    const stage = store.stageSize();
    const size = Math.max(80, Math.min(stage.width, stage.height) * 0.16);
    const element = {
      id: nextId(shape),
      shape,
      label: shape,
      content: shape === 'circle' ? '+' : shape === 'pill' ? 'Action' : '',
      x: stage.width / 2 - size / 2 + store.elements.length * 12,
      y: stage.height / 2 - size / 2 + store.elements.length * 12,
      w: shape === 'pill' ? size * 1.9 : size,
      h: shape === 'pill' ? size * 0.52 : size,
    };
    store.elements.push(element);
    store.selectedId = element.id;
    onChange('add');
    announce(t('announce.added', { shape, id: element.id }));
    render();
  }

  function remove(id) {
    if (isLocked()) return;
    store.elements = store.elements.filter((element) => element.id !== id);
    if (store.selectedId === id) store.selectedId = store.elements.at(-1)?.id ?? null;
    onChange('remove');
    announce(t('announce.removed', { id }));
    render();
  }

  function retype(id, shape) {
    if (isLocked()) return;
    const element = store.elements.find((entry) => entry.id === id);
    if (!element) return;
    element.shape = shape;
    // A capsule needs a long box to read as one; circles and folders stay square.
    if (shape === 'circle' || shape === 'folder') element.h = element.w;
    if (shape === 'pill' && element.w < element.h * 1.6) element.w = element.h * 1.9;
    onChange('retype');
    announce(t('announce.retyped', { id, shape }));
    render();
  }

  function resize(id, dimension, value, controls, shouldAnnounce = false) {
    if (isLocked()) return false;
    const element = store.elements.find((entry) => entry.id === id);
    if (!element || !resizeElementFromEditor(element, dimension, value)) return false;
    for (const [controlDimension, control] of Object.entries(controls)) {
      const next = Math.round(controlDimension === 'height' ? element.h : element.w);
      control.range.value = String(next);
      control.number.value = String(next);
    }
    onChange('resize');
    if (shouldAnnounce) {
      announce(t('announce.resized', {
        id, width: Math.round(element.w), height: Math.round(element.h),
      }));
    }
    return true;
  }

  function sizeEditor(element) {
    const editor = document.createElement('div');
    editor.className = 'componentInspector';

    const header = document.createElement('div');
    header.className = 'componentInspectorHeader';
    const title = document.createElement('strong');
    title.textContent = t('component.sizeTitle', { id: element.id });
    header.appendChild(title);
    const square = element.shape === 'circle' || element.shape === 'folder';
    if (square) {
      const linked = document.createElement('span');
      linked.textContent = t('component.linked');
      header.appendChild(linked);
    }
    editor.appendChild(header);

    const controls = {};
    const dimensions = square
      ? [['width', 'component.size']]
      : [['width', 'component.width'], ['height', 'component.height']];
    const stage = store.stageSize();
    for (const [dimension, labelKey] of dimensions) {
      const row = document.createElement('label');
      row.className = 'componentControl';
      const label = document.createElement('span');
      label.textContent = t(labelKey);
      const current = Math.round(dimension === 'width' ? element.w : element.h);
      const maximum = Math.max(current, Math.round(
        (dimension === 'width' ? stage.width : stage.height) * 1.35,
      ));
      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(MIN_SIZE);
      range.max = String(maximum);
      range.step = '1';
      range.value = String(current);
      range.setAttribute('aria-label', t(`aria.component${dimension === 'width' ? 'Width' : 'Height'}Slider`, {
        id: element.id,
      }));
      const number = document.createElement('input');
      number.type = 'number';
      number.min = String(MIN_SIZE);
      number.max = String(maximum);
      number.step = '1';
      number.value = String(current);
      number.setAttribute('aria-label', t(`aria.component${dimension === 'width' ? 'Width' : 'Height'}`, {
        id: element.id,
      }));
      controls[dimension] = { range, number };
      const update = (input, announceChange = false) => {
        if (!resize(element.id, dimension, input.value, controls, announceChange)) {
          const fallback = Math.round(dimension === 'width' ? element.w : element.h);
          input.value = String(fallback);
        }
      };
      range.addEventListener('input', () => update(range));
      range.addEventListener('change', () => update(range, true));
      number.addEventListener('input', () => {
        if (number.value !== '') update(number);
      });
      number.addEventListener('change', () => update(number, true));
      row.append(label, range, number);
      editor.appendChild(row);
    }

    const hint = document.createElement('p');
    hint.textContent = t('component.resizeHint');
    editor.appendChild(hint);
    return editor;
  }

  function render() {
    container.replaceChildren();
    if (!store.elements.length) {
      const empty = document.createElement('p');
      empty.className = 'note';
      empty.dataset.i18n = 'component.empty';
      empty.textContent = t('component.empty');
      container.appendChild(empty);
      return;
    }
    for (const element of store.elements) {
      const row = document.createElement('div');
      row.className = 'componentRow';
      row.classList.toggle('active', element.id === store.selectedId);

      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'componentName';
      select.textContent = element.id;
      select.setAttribute('aria-pressed', String(element.id === store.selectedId));
      select.title = t('component.selectTitle');
      select.addEventListener('click', () => {
        store.selectedId = element.id;
        onChange('select');
        render();
      });

      const shape = document.createElement('select');
      shape.className = 'componentShape';
      shape.setAttribute('aria-label', t('aria.componentShape', { id: element.id }));
      for (const name of SHAPES) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        shape.appendChild(option);
      }
      shape.value = element.shape;
      shape.addEventListener('change', () => retype(element.id, shape.value));

      const destroy = document.createElement('button');
      destroy.type = 'button';
      destroy.className = 'componentRemove';
      destroy.setAttribute('aria-label', t('aria.removeComponent', { id: element.id }));
      destroy.textContent = '−';
      destroy.addEventListener('click', () => remove(element.id));

      row.append(select, shape, destroy);
      container.appendChild(row);
    }
    const selected = store.elements.find((element) => element.id === store.selectedId);
    if (selected && !isLocked()) container.appendChild(sizeEditor(selected));
  }

  addButton.addEventListener('click', add);
  render();
  return { render };
}
