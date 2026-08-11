// Stage input.
//
// The pointer path goes through `glass.hitTest()`, the component's own signed
// distance field, so a click lands on the shape and not on its bounding box -
// and inside a fused group the bridge between two components is grabbable too.
// The keyboard path exists because a canvas that can only be dragged is a canvas
// half the people cannot use.

import { HANDLE_SIZE, handlesOf } from './overlay.js';

const MIN_SIZE = 28;

function handleUnder(element, x, y) {
  if (!element) return null;
  const reach = HANDLE_SIZE;
  return handlesOf(element).find((handle) => Math.abs(handle.x - x) <= reach
    && Math.abs(handle.y - y) <= reach) ?? null;
}

function resize(element, handle, x, y) {
  const right = element.x + element.w;
  const bottom = element.y + element.h;
  if (handle.id.includes('e')) element.w = Math.max(MIN_SIZE, x - element.x);
  if (handle.id.includes('s')) element.h = Math.max(MIN_SIZE, y - element.y);
  if (handle.id.includes('w')) {
    element.w = Math.max(MIN_SIZE, right - x);
    element.x = right - element.w;
  }
  if (handle.id.includes('n')) {
    element.h = Math.max(MIN_SIZE, bottom - y);
    element.y = bottom - element.h;
  }
  if (element.shape === 'circle') element.h = element.w;
}

export function attachStageInteractions({ canvas, glass, store, onChange, announce }) {
  let drag = null;

  const selected = () => store.elements.find((element) => element.id === store.selectedId) ?? null;
  const positionOf = (event) => glass.pointerPosition(event);

  canvas.addEventListener('pointerdown', (event) => {
    const { x, y } = positionOf(event);
    const handle = handleUnder(selected(), x, y);
    if (handle) {
      drag = { mode: 'resize', handle, element: selected() };
      canvas.setPointerCapture(event.pointerId);
      return;
    }

    const hit = glass.hitTestEvent(event);
    const element = hit ? store.elements.find((entry) => entry.id === hit.id) : null;
    if (!element) {
      if (store.selectedId !== null) {
        store.selectedId = null;
        onChange('deselect');
      }
      return;
    }
    store.selectedId = element.id;
    drag = { mode: 'move', element, dx: x - element.x, dy: y - element.y };
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });
    onChange('select');
  });

  canvas.addEventListener('pointermove', (event) => {
    const { x, y } = positionOf(event);
    if (!drag) {
      const handle = handleUnder(selected(), x, y);
      const hovering = handle || glass.hitTest(x, y);
      canvas.style.cursor = handle
        ? (handle.id === 'nw' || handle.id === 'se' ? 'nwse-resize' : 'nesw-resize')
        : (hovering ? 'grab' : 'default');
      return;
    }
    if (drag.mode === 'resize') resize(drag.element, drag.handle, x, y);
    else {
      drag.element.x = x - drag.dx;
      drag.element.y = y - drag.dy;
    }
    onChange('drag');
  });

  const endDrag = () => {
    if (!drag) return;
    const { element, mode } = drag;
    drag = null;
    announce(mode === 'resize'
      ? `${element.id} is ${Math.round(element.w)} by ${Math.round(element.h)}`
      : `${element.id} at ${Math.round(element.x)}, ${Math.round(element.y)}`);
    onChange('dragend');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  const NUDGE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  canvas.addEventListener('keydown', (event) => {
    const element = selected();
    if (event.key === 'Escape') {
      store.selectedId = null;
      onChange('deselect');
      return;
    }
    if (!element) {
      // With nothing selected the arrow keys pick the first component, so the
      // stage is usable from the keyboard without touching the panel.
      if (NUDGE[event.key] && store.elements.length) {
        event.preventDefault();
        store.selectedId = store.elements[0].id;
        onChange('select');
        announce(`Selected ${store.selectedId}`);
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      store.elements = store.elements.filter((entry) => entry.id !== element.id);
      store.selectedId = store.elements.at(-1)?.id ?? null;
      announce(`Removed ${element.id}`);
      onChange('remove');
      return;
    }
    if (event.key === '[' || event.key === ']') {
      event.preventDefault();
      const index = store.elements.indexOf(element);
      const next = (index + (event.key === ']' ? 1 : -1) + store.elements.length) % store.elements.length;
      store.selectedId = store.elements[next].id;
      announce(`Selected ${store.selectedId}`);
      onChange('select');
      return;
    }

    const nudge = NUDGE[event.key];
    if (!nudge) return;
    event.preventDefault();
    const amount = event.shiftKey ? 10 : 1;
    // Alt turns the arrow keys into a resize, mirroring the corner handles.
    if (event.altKey) {
      element.w = Math.max(MIN_SIZE, element.w + nudge[0] * amount);
      element.h = Math.max(MIN_SIZE, element.h + nudge[1] * amount);
      if (element.shape === 'circle') element.h = element.w;
      announce(`${element.id} is ${Math.round(element.w)} by ${Math.round(element.h)}`);
    } else {
      element.x += nudge[0] * amount;
      element.y += nudge[1] * amount;
      announce(`${element.id} at ${Math.round(element.x)}, ${Math.round(element.y)}`);
    }
    onChange('nudge');
  });
}
