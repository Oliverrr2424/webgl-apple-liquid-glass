// The V2 Press specimen is made from the package's public controls. Keeping
// this adapter limited to layout and playground state makes the demo an API
// acceptance test instead of a second implementation of the interaction.

import { LiquidGlassNavbar, LiquidGlassSwitch } from '../src/controls.js';

export const PLAYGROUND_CONTROL_IDS = Object.freeze([
  'selection-track',
  'selection-thumb',
  'compact-selection-track',
  'compact-selection-thumb',
  'green-toggle-track',
  'green-toggle-thumb',
]);

const CONTROL_IDS = new Set(PLAYGROUND_CONTROL_IDS);

export function isPlaygroundControl(elementOrId) {
  return CONTROL_IDS.has(typeof elementOrId === 'string' ? elementOrId : elementOrId?.id);
}

function applyFrame(host, track) {
  Object.assign(host.style, {
    left: `${track.x}px`,
    top: `${track.y}px`,
    width: `${track.w}px`,
    height: `${track.h}px`,
  });
}

function labelsFor(track) {
  return (track.navLabels ?? ['Home', 'Discover']).map((label, index) => ({
    value: index,
    label,
  }));
}

export function createPlaygroundControlSpecimen({
  stage,
  backdrop,
  positions,
  onSelect = () => {},
  onChange = () => {},
}) {
  const layer = document.createElement('div');
  layer.dataset.playgroundApiControls = '';
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '2',
    overflow: 'visible',
    pointerEvents: 'none',
  });
  stage.appendChild(layer);

  const mounted = new Map();
  let active = false;
  let materialKey = '';
  let appearanceKey = '';

  const remove = (trackId) => {
    const entry = mounted.get(trackId);
    if (!entry) return;
    entry.host.removeEventListener('pointerdown', entry.select);
    entry.control.destroy();
    entry.host.remove();
    mounted.delete(trackId);
  };

  const clear = () => {
    for (const trackId of [...mounted.keys()]) remove(trackId);
    materialKey = '';
    appearanceKey = '';
  };

  const mount = (track, kind, material, tintTone, lens) => {
    const host = document.createElement('div');
    host.dataset.playgroundControl = track.id;
    Object.assign(host.style, {
      position: 'absolute',
      overflow: 'visible',
      pointerEvents: 'auto',
    });
    applyFrame(host, track);
    const select = () => onSelect(track.sliderThumb ?? track.id);
    host.addEventListener('pointerdown', select);
    layer.appendChild(host);

    const common = {
      backdrop,
      material,
      live: false,
      ariaLabel: track.label,
    };
    const control = kind === 'navbar'
      ? new LiquidGlassNavbar(host, {
        ...common,
        items: labelsFor(track),
        value: Math.round(positions.get(track.id) ?? 0),
        tint: track.tint ?? 0.86,
        tintTone,
        fontSize: Math.max(11, track.h * (track.w < 400 ? 0.17 : 0.2)),
        lens,
        onChange: (value, index) => {
          positions.set(track.id, index);
          onChange({ trackId: track.id, value, index, kind });
        },
      })
      : new LiquidGlassSwitch(host, {
        ...common,
        checked: Boolean(Math.round(positions.get(track.id) ?? 0)),
        onChange: (checked) => {
          const index = checked ? 1 : 0;
          positions.set(track.id, index);
          onChange({ trackId: track.id, value: checked, index, kind });
        },
      });
    mounted.set(track.id, { control, host, select, kind, labels: JSON.stringify(track.navLabels ?? []) });
    return control;
  };

  return {
    sync({ enabled, elements, material, tintTone = 'light', lens }) {
      active = Boolean(enabled);
      layer.hidden = !active;
      if (!active) {
        clear();
        return;
      }

      const tracks = elements.filter((element) => (
        element.sliderThumb && (
          element.navigationLens || element.id === 'green-toggle-track'
        )
      ));
      const wanted = new Set(tracks.map((track) => track.id));
      for (const trackId of [...mounted.keys()]) {
        if (!wanted.has(trackId)) remove(trackId);
      }

      const nextMaterialKey = JSON.stringify(material);
      const nextAppearanceKey = JSON.stringify({ tintTone, lens });
      for (const track of tracks) {
        const kind = track.navigationLens ? 'navbar' : 'switch';
        const labels = JSON.stringify(track.navLabels ?? []);
        let entry = mounted.get(track.id);
        if (entry && (entry.kind !== kind || entry.labels !== labels)) {
          remove(track.id);
          entry = null;
        }
        const control = entry?.control ?? mount(track, kind, material, tintTone, lens);
        applyFrame(control.container, track);
        if (entry && materialKey !== nextMaterialKey) control.setMaterial(material);
        if (kind === 'navbar') {
          if (entry && appearanceKey !== nextAppearanceKey) {
            control.setLens(lens).setTintTone(tintTone);
          }
          const value = Math.round(positions.get(track.id) ?? 0);
          if (control.value !== value) control.setValue(value, { notify: false });
        } else {
          const checked = Boolean(Math.round(positions.get(track.id) ?? 0));
          if (control.checked !== checked) control.setChecked(checked, { notify: false });
        }
      }
      materialKey = nextMaterialKey;
      appearanceKey = nextAppearanceKey;
    },

    refresh() {
      if (active) for (const { control } of mounted.values()) control.refresh();
    },

    get(trackId) {
      return mounted.get(trackId)?.control ?? null;
    },

    get active() {
      return active;
    },

    get size() {
      return mounted.size;
    },

    destroy() {
      clear();
      layer.remove();
      active = false;
    },
  };
}
