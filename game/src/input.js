// Keyboard + mouse (and touch) input, kept apart from the game rules so the
// world only ever sees "move left / right / launch / pause" and a mouse x.

// Keys we listen to, so the page never scrolls while playing.
const HANDLED_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
  'Enter',
  'KeyA',
  'KeyD',
  'KeyP',
  'KeyM',
  'KeyR',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    /** Pointer x in logical field coordinates, or null when never moved. */
    this.pointerX = null;
    /** True while the primary pointer button is held. */
    this.pointerDown = false;
    /** Edge-triggered actions, consumed by the loop once per frame. */
    this.pressed = new Set();
    this.onPointerDown = null;
    this.onPointerMove = null;
    this.onKeyDown = null;
    this._onKeyDown = (event) => {
      if (!HANDLED_KEYS.has(event.code)) return;
      event.preventDefault();
      if (!event.repeat) {
        this.pressed.add(event.code);
        if (this.onKeyDown) this.onKeyDown(event.code);
      }
      this.keys.add(event.code);
    };
    this._onKeyUp = (event) => {
      this.keys.delete(event.code);
    };
    this._onPointerMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      this.pointerX = (event.clientX - rect.left) * scaleX;
      if (this.onPointerMove) this.onPointerMove(this.pointerX);
    };
    this._onPointerDown = (event) => {
      this.pointerDown = true;
      this._onPointerMove(event);
      this.pressed.add('Pointer');
      if (this.onPointerDown) this.onPointerDown(this.pointerX);
    };
    this._onPointerUp = () => {
      this.pointerDown = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.pointerDown = false;
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointerup', this._onPointerUp);
  }

  /** -1, 0 or 1 from the held arrow / A-D keys. */
  moveDirection() {
    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const right = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  /** True if Space or Enter was pressed since the last consume. */
  consumeAction() {
    const hit = this.pressed.has('Space') || this.pressed.has('Enter') || this.pressed.has('Pointer');
    return hit;
  }

  consumeCode(code) {
    const hit = this.pressed.has(code);
    if (hit) this.pressed.delete(code);
    return hit;
  }

  endFrame() {
    this.pressed.clear();
  }
}
