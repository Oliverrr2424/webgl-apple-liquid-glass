// Tactile Liquid Glass input.
//
// This is presentation state rather than a CSS animation. The WebGL surface
// receives the same changing dimensions as its highlight and content layer,
// so the glass itself appears to inflate.

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const SLIDER_RELEASE_MATERIAL_MS = 140;

export function sliderProgressForPointer(track, thumb, pointerX) {
  const travel = Math.max(1, track.w - thumb.w);
  return clamp((pointerX - thumb.w / 2 - track.x) / travel, 0, 1);
}

export function attachPressEffects({
  canvas, getGlass, getElements, getFallbackElement, getSliderProgress,
  isActive, onSelect, onVisualChange, announce,
}) {
  let press = null;
  let animationFrame = 0;
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');

  const emit = () => onVisualChange(press ? { ...press } : null);
  const stop = () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };
  const tick = (lastTime) => {
    animationFrame = requestAnimationFrame((now) => {
      if (!press) return;
      const seconds = Math.min(0.034, Math.max(0.001, (now - lastTime) / 1000));
      if (reduceMotion?.matches) {
        press.amount = press.target;
        press.velocity = 0;
      } else {
        // A firm arrival and looser release leave the characteristic soft
        // "duang" in the last few pixels of the animation.
        const stiffness = press.target ? 520 : 540;
        // Let the held surface travel very slightly past its full scale before
        // resting there; this is the small arrival rebound in Liquid Glass.
        const damping = press.target ? 28 : 31;
        press.velocity += (press.target - press.amount) * stiffness * seconds;
        press.velocity *= Math.exp(-damping * seconds);
        press.amount += press.velocity * seconds;
      }
      if (press.type === 'slider' && !press.target) {
        press.releaseMix = reduceMotion?.matches
          ? 1
          : clamp((now - press.releaseStartedAt) / SLIDER_RELEASE_MATERIAL_MS, 0, 1);
      }
      if (press.type === 'slider') {
        // Position has its own spring. The capsule follows the finger closely,
        // then always resolves to a whole segment rather than parking midway.
        const positionStiffness = press.target ? 420 : 360;
        const positionDamping = press.target ? 31 : 27;
        press.sliderVelocity += (press.sliderTarget - press.sliderProgress) * positionStiffness * seconds;
        press.sliderVelocity *= Math.exp(-positionDamping * seconds);
        press.sliderProgress += press.sliderVelocity * seconds;
        press.sliderProgress = clamp(press.sliderProgress, 0, 1);
      }
      press.amount = clamp(press.amount, 0, 1.12);
      emit();
      const sliderSettled = press.type !== 'slider'
        || (Math.abs(press.sliderTarget - press.sliderProgress) < 0.003
          && Math.abs(press.sliderVelocity) < 0.018);
      const materialSettled = press.type !== 'slider' || press.releaseMix >= 1;
      if (!press.target && press.amount < 0.004 && Math.abs(press.velocity) < 0.018
        && sliderSettled && materialSettled) {
        press = null;
        emit();
        animationFrame = 0;
        return;
      }
      tick(now);
    });
  };
  const beginAnimation = () => { stop(); tick(performance.now()); };
  const pointOf = (event) => getGlass().pointerPosition(event);
  const elementOf = (id) => getElements().find((element) => element.id === id);

  canvas.addEventListener('pointerdown', (event) => {
    if (!isActive()) return;
    const point = pointOf(event);
    const hit = getGlass().hitTestEvent(event);
    const element = hit ? elementOf(hit.id) : getFallbackElement?.(point);
    if (!element) return;

    const trackId = element.sliderTrack ?? (element.sliderThumb ? element.id : null);
    const thumbId = element.sliderThumb ?? (element.sliderTrack ? element.id : null);
    const slider = Boolean(trackId && thumbId);
    const track = slider ? elementOf(trackId) : null;
    const thumb = slider ? elementOf(thumbId) : null;
    if (slider && (!track || !thumb)) return;

    // Pressing the bar directly still selects the movable glass capsule; the
    // track remains a normal hit target, while the thing that grows is clear.
    onSelect(slider ? thumb.id : element.id);
    press = {
      pointerId: event.pointerId,
      id: slider ? thumb.id : element.id,
      selectedId: element.id,
      type: slider ? 'slider' : 'surface',
      amount: 0,
      velocity: 0,
      target: 1,
      sliderTrackId: slider ? track.id : undefined,
      sliderThumbId: slider ? thumb.id : undefined,
      sliderProgress: slider ? (getSliderProgress?.(track.id) ?? 0) : undefined,
      sliderTarget: slider ? sliderProgressForPointer(track, thumb, point.x) : undefined,
      sliderVelocity: 0,
      releaseMix: 0,
      releaseStartedAt: 0,
    };
    emit();
    beginAnimation();
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    // Phone paging and editor drag handlers must not take ownership of a
    // component that is being pressed.
    event.stopImmediatePropagation();
  }, true);

  canvas.addEventListener('pointermove', (event) => {
    if (!press || event.pointerId !== press.pointerId) return;
    // Pointer capture can be dropped by the browser or an embedded inspector.
    // A mouse move with no button held is authoritative release evidence.
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      finishPress(false);
      return;
    }
    if (press.type !== 'slider') return;
    const track = elementOf(press.sliderTrackId);
    const thumb = elementOf(press.sliderThumbId);
    if (!track || !thumb) return;
    press.sliderTarget = sliderProgressForPointer(track, thumb, pointOf(event).x);
    emit();
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  const finishPress = (cancelled = false) => {
    if (!press || press.target === 0) return;
    if (press.type === 'slider') {
      // Follow the finger while held; settle to a clear tab-selection resting
      // point on release.
      press.sliderTarget = press.sliderTarget >= 0.5 ? 1 : 0;
      if (!cancelled) {
        const selectionBar = press.sliderTrackId === 'selection-track';
        announce(selectionBar
          ? (press.sliderTarget ? 'Discover selected.' : 'Home selected.')
          : (press.sliderTarget ? 'Green toggle on.' : 'Green toggle off.'));
      }
    }
    press.target = 0;
    press.releaseMix = 0;
    press.releaseStartedAt = performance.now();
    emit();
    beginAnimation();
  };

  const end = (event, cancelled = false) => {
    if (!press || event.pointerId !== press.pointerId) return;
    finishPress(cancelled);
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  canvas.addEventListener('pointerup', (event) => end(event), true);
  canvas.addEventListener('pointercancel', (event) => end(event, true), true);
  canvas.addEventListener('lostpointercapture', () => finishPress(true), true);

  // Window capture is a second release path for browsers that dispatch the up
  // outside the canvas before they honour setPointerCapture().
  const endAnywhere = (event) => end(event, event.type === 'pointercancel');
  globalThis.addEventListener?.('pointerup', endAnywhere, true);
  globalThis.addEventListener?.('pointercancel', endAnywhere, true);
  const endOnBlur = () => finishPress(true);
  globalThis.addEventListener?.('blur', endOnBlur);

  return {
    destroy() {
      stop();
      globalThis.removeEventListener?.('pointerup', endAnywhere, true);
      globalThis.removeEventListener?.('pointercancel', endAnywhere, true);
      globalThis.removeEventListener?.('blur', endOnBlur);
    },
  };
}
