// Frame instrumentation for the inspector.
//
// A WebGL material is always met with "what does it cost?", so the playground
// answers on screen. Frames are counted rather than assumed: with dirty
// tracking a static scene draws nothing at all, and the readout says `idle`
// instead of pretending to run at 60fps.

const WINDOW_MS = 1000;

export function createStats(root) {
  const fields = {};
  for (const node of root.querySelectorAll('[data-stat]')) {
    fields[node.dataset.stat] = node;
  }

  const frames = [];
  let cpuTotal = 0;
  let info = {};

  const set = (key, value) => {
    const node = fields[key];
    if (node && node.textContent !== value) node.textContent = value;
  };

  const flush = () => {
    const now = performance.now();
    while (frames.length && now - frames[0].at > WINDOW_MS) {
      cpuTotal -= frames.shift().cpu;
    }
    if (frames.length < 2) {
      set('fps', 'idle');
      set('cpu', frames.length ? `${(cpuTotal / frames.length).toFixed(1)} ms` : '—');
    } else {
      const span = (frames.at(-1).at - frames[0].at) / 1000;
      set('fps', span > 0 ? `${Math.round((frames.length - 1) / span)} fps` : 'idle');
      set('cpu', `${(cpuTotal / frames.length).toFixed(1)} ms`);
    }
    for (const [key, value] of Object.entries(info)) set(key, value);
  };

  const timer = setInterval(flush, 250);

  return {
    /** Called once per frame that actually reached the GPU. */
    frame(cpuMs) {
      frames.push({ at: performance.now(), cpu: cpuMs });
      cpuTotal += cpuMs;
    },
    /** Static facts about the current frame: size, dpr, group count, mode. */
    info(next) {
      info = { ...info, ...next };
    },
    stop() {
      clearInterval(timer);
    },
  };
}
