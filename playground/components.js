// The component list.
//
// Selection lives in real DOM buttons rather than only on the canvas: that is
// what makes the stage reachable with a keyboard and a screen reader, and it
// doubles as the place to add, retype and delete components without editing the
// scene source.

const SHAPES = ['folder', 'rect', 'pill', 'circle'];

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
    announce(`Added ${shape} ${element.id}`);
    render();
  }

  function remove(id) {
    if (isLocked()) return;
    store.elements = store.elements.filter((element) => element.id !== id);
    if (store.selectedId === id) store.selectedId = store.elements.at(-1)?.id ?? null;
    onChange('remove');
    announce(`Removed ${id}`);
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
    announce(`${id} is now a ${shape}`);
    render();
  }

  function render() {
    container.replaceChildren();
    if (!store.elements.length) {
      const empty = document.createElement('p');
      empty.className = 'note';
      empty.textContent = 'No components. Add one to start.';
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
      select.title = 'Select, then move with the arrow keys';
      select.addEventListener('click', () => {
        store.selectedId = element.id;
        onChange('select');
        render();
      });

      const shape = document.createElement('select');
      shape.className = 'componentShape';
      shape.setAttribute('aria-label', `${element.id} shape`);
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
      destroy.setAttribute('aria-label', `Remove ${element.id}`);
      destroy.textContent = '−';
      destroy.addEventListener('click', () => remove(element.id));

      row.append(select, shape, destroy);
      container.appendChild(row);
    }
  }

  addButton.addEventListener('click', add);
  render();
  return { render };
}
