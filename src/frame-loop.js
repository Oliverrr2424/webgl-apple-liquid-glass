// One requestAnimationFrame loop for every DOM-bound glass surface.
//
// Each frame reads all layout first and writes afterwards, so N surfaces cost
// one layout. The loop only runs while something can change: a scroll, a
// resize, a transition or animation on a surface or one of its ancestors, a
// live backdrop, or an explicit wake. At rest the page does no glass work.

const clients = new Set();
const running = new Map();
let frame = 0;
let wakeUntil = 0;
let listening = false;
let intersection = null;
// Bumped whenever page content may have moved relative to the viewport, even
// if a surface itself did not (a fixed navbar over a scrolling page).
let epoch = 0;

export const layoutEpoch = () => epoch;

/** Page content changed under the glass: repaint every visible backdrop. */
export function invalidateLayout() {
  epoch++;
  wake(34);
}

const now = () => globalThis.performance?.now?.() ?? Date.now();

function request() {
  if (!frame && typeof globalThis.requestAnimationFrame === 'function') {
    frame = globalThis.requestAnimationFrame(tick);
  }
}

/** Keep the loop running for at least `ms` milliseconds. */
export function wake(ms = 0) {
  wakeUntil = Math.max(wakeUntil, now() + ms);
  request();
}

function animationsAffectClients() {
  for (const element of running.keys()) {
    if (!element.isConnected) running.delete(element);
  }
  return running.size > 0;
}

function tick() {
  frame = 0;
  const time = now();
  if (running.size) epoch++;
  const active = [];
  for (const client of clients) if (client.visible) active.push(client);
  for (const client of active) {
    try {
      client.measure(time);
    } catch (error) {
      console.error(error);
    }
  }
  let keepAlive = false;
  for (const client of active) {
    try {
      if (client.draw(time)) keepAlive = true;
    } catch (error) {
      console.error(error);
    }
  }
  if (keepAlive || time < wakeUntil || animationsAffectClients()) request();
}

function affectsClients(target) {
  if (!target || typeof target.contains !== 'function') return false;
  for (const client of clients) {
    for (const element of client.trackedElements()) {
      if (target === element || target.contains(element)) return true;
    }
  }
  return false;
}

const onScroll = () => {
  epoch++;
  wake(160);
};
const onResize = () => {
  epoch++;
  clients.forEach((client) => client.onViewportResize?.());
  wake(320);
};
const onAnimationStart = (event) => {
  if (!affectsClients(event.target)) return;
  running.set(event.target, (running.get(event.target) ?? 0) + 1);
  request();
};
const onAnimationEnd = (event) => {
  const count = running.get(event.target);
  if (!count) return;
  if (count <= 1) running.delete(event.target);
  else running.set(event.target, count - 1);
  wake(34);
};
const onFontsLoaded = () => {
  epoch++;
  wake(200);
};

function listen() {
  if (listening || typeof globalThis.addEventListener !== 'function') return;
  listening = true;
  const passive = { capture: true, passive: true };
  // Scroll does not bubble, but capture on window sees every scroller.
  globalThis.addEventListener('scroll', onScroll, passive);
  globalThis.addEventListener('resize', onResize, { passive: true });
  for (const type of ['transitionrun', 'animationstart']) {
    document.addEventListener(type, onAnimationStart, true);
  }
  for (const type of ['transitionend', 'transitioncancel', 'animationend', 'animationcancel']) {
    document.addEventListener(type, onAnimationEnd, true);
  }
  document.fonts?.addEventListener?.('loadingdone', onFontsLoaded);
  if (typeof globalThis.IntersectionObserver === 'function') {
    intersection = new globalThis.IntersectionObserver((entries) => {
      for (const entry of entries) {
        for (const client of clients) {
          if (client.element === entry.target) client.visible = entry.isIntersecting;
        }
      }
      wake(64);
    }, { rootMargin: '256px' });
  }
}

function unlisten() {
  if (!listening) return;
  listening = false;
  globalThis.removeEventListener('scroll', onScroll, true);
  globalThis.removeEventListener('resize', onResize);
  for (const type of ['transitionrun', 'animationstart']) {
    document.removeEventListener(type, onAnimationStart, true);
  }
  for (const type of ['transitionend', 'transitioncancel', 'animationend', 'animationcancel']) {
    document.removeEventListener(type, onAnimationEnd, true);
  }
  document.fonts?.removeEventListener?.('loadingdone', onFontsLoaded);
  intersection?.disconnect();
  intersection = null;
  running.clear();
  if (frame && typeof globalThis.cancelAnimationFrame === 'function') globalThis.cancelAnimationFrame(frame);
  frame = 0;
}

/**
 * A client has `element`, `visible`, `trackedElements()`, `measure(time)` and
 * `draw(time) -> keepAlive`.
 */
export function addClient(client) {
  clients.add(client);
  client.visible = true;
  listen();
  intersection?.observe(client.element);
  wake(120);
}

export function removeClient(client) {
  if (!clients.delete(client)) return;
  intersection?.unobserve(client.element);
  if (!clients.size) unlisten();
}

export function eachClient(callback) {
  clients.forEach(callback);
}
