// Top-down on-foot: A left (−x), D right (+x), W up (−y), S down (+y).
// Split is edge-triggered. No twin-stick aim — you are the blade.
export function createControls(canvas, splitButton) {
  const keys = new Set();
  let pointer = null,
    stick = null,
    splitQueued = false,
    splitHeld = false,
    forced = null;

  function axis() {
    if (forced) return forced;
    let x =
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    let y =
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) -
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
    if (stick) {
      x = stick.x;
      y = stick.y;
    } else if (pointer && !stick) {
      x = pointer.x;
      y = pointer.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y, moving: len > 0.05 };
  }

  function down(code) {
    keys.add(code);
    if (code === "Space" || code === "ShiftLeft" || code === "ShiftRight")
      splitQueued = true;
  }
  function up(code) {
    keys.delete(code);
  }

  window.addEventListener("keydown", (e) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code))
      e.preventDefault();
    down(e.code);
  });
  window.addEventListener("keyup", (e) => up(e.code));
  window.addEventListener("blur", () => keys.clear());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) keys.clear();
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button === 2) {
      splitQueued = true;
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    pointer = {
      x: (e.clientX - cx) / (rect.width * 0.28),
      y: (e.clientY - cy) / (rect.height * 0.28),
    };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pointer) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    pointer = {
      x: (e.clientX - cx) / (rect.width * 0.28),
      y: (e.clientY - cy) / (rect.height * 0.28),
    };
  });
  const endPointer = () => {
    pointer = null;
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  if (splitButton) {
    const press = (e) => {
      e.preventDefault();
      splitHeld = true;
      splitQueued = true;
    };
    const release = () => {
      splitHeld = false;
    };
    splitButton.addEventListener("pointerdown", press);
    splitButton.addEventListener("pointerup", release);
    splitButton.addEventListener("pointercancel", release);
  }

  return {
    sample() {
      const a = axis();
      const dash = splitQueued || splitHeld;
      splitQueued = false;
      return { ...a, dash };
    },
    setStick(value) {
      stick = value;
    },
    reset() {
      keys.clear();
      pointer = null;
      stick = null;
      splitQueued = false;
      splitHeld = false;
      forced = null;
    },
    setKeys(codes) {
      keys.clear();
      forced = null;
      for (const code of codes) keys.add(code);
    },
  };
}
