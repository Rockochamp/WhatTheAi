export function createControls(
  canvas,
  stick,
  dashButton,
  { onPause, onChoice, onReroll, onActivity, isPlaying, screenToWorld },
) {
  const keys = new Set();
  let pointer = null,
    target = null,
    mouse = false,
    queuedDash = false,
    origin = null,
    vector = { x: 0, y: 0 };
  function reset() {
    keys.clear();
    pointer = null;
    mouse = false;
    target = null;
    origin = null;
    vector = { x: 0, y: 0 };
    queuedDash = false;
    stick.hidden = true;
    dashButton.classList.remove("pressed");
  }
  const editable = (el) => el?.matches("input,select,textarea");
  function keydown(e) {
    if (editable(e.target)) return;
    if (
      ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
        e.code,
      ) &&
      isPlaying()
    )
      e.preventDefault();
    if (e.repeat) return;
    if (["Escape", "KeyP"].includes(e.code)) {
      e.preventDefault();
      onPause();
      return;
    }
    if (/^Digit[123]$/.test(e.code)) {
      onChoice(Number(e.code.slice(-1)) - 1);
      return;
    }
    if (e.code === "KeyR" && !isPlaying()) {
      onReroll();
      return;
    }
    if (!isPlaying()) return;
    if (
      e.code === "Space" ||
      e.code === "ShiftLeft" ||
      e.code === "ShiftRight"
    ) {
      queuedDash = true;
      onActivity();
    } else keys.add(e.code);
  }
  function keyup(e) {
    keys.delete(e.code);
  }
  function down(e) {
    if (!isPlaying()) return;
    if (e.pointerType === "mouse" && e.button === 2) {
      queuedDash = true;
      e.preventDefault();
      return;
    }
    if (e.button > 0 || pointer !== null) return;
    onActivity();
    pointer = e.pointerId;
    canvas.setPointerCapture(pointer);
    const r = canvas.getBoundingClientRect(),
      x = e.clientX - r.left,
      y = e.clientY - r.top;
    if (e.pointerType === "mouse") {
      mouse = true;
      target = { x, y };
    } else {
      mouse = false;
      origin = { x, y };
      vector = { x: 0, y: 0 };
      stick.hidden = false;
      stick.style.left = `${x}px`;
      stick.style.top = `${y}px`;
      stick.firstElementChild.style.transform = "translate(-50%,-50%)";
    }
    e.preventDefault();
  }
  function move(e) {
    if (e.pointerId !== pointer) return;
    const r = canvas.getBoundingClientRect(),
      x = e.clientX - r.left,
      y = e.clientY - r.top;
    if (mouse) {
      target = { x, y };
      return;
    }
    const dx = x - origin.x,
      dy = y - origin.y,
      d = Math.hypot(dx, dy),
      clamp = d > 48 ? 48 / d : 1;
    vector = { x: (dx * clamp) / 48, y: (dy * clamp) / 48 };
    stick.firstElementChild.style.transform = `translate(calc(-50% + ${dx * clamp}px),calc(-50% + ${dy * clamp}px))`;
  }
  function up(e) {
    if (e.pointerId !== pointer) return;
    pointer = null;
    origin = null;
    target = null;
    mouse = false;
    vector = { x: 0, y: 0 };
    stick.hidden = true;
  }
  const dashDown = (e) => {
    if (!isPlaying()) return;
    e.preventDefault();
    e.stopPropagation();
    queuedDash = true;
    dashButton.classList.add("pressed");
    onActivity();
  };
  const dashUp = () => dashButton.classList.remove("pressed");
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", reset);
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("lostpointercapture", up);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  dashButton.addEventListener("pointerdown", dashDown);
  dashButton.addEventListener("pointerup", dashUp);
  dashButton.addEventListener("pointercancel", dashUp);
  // Keyboard activation of the visible dash button also works.
  dashButton.addEventListener("click", (e) => {
    if (e.detail === 0 && isPlaying()) queuedDash = true;
  });
  function sample(player) {
    let x = 0,
      y = 0;
    for (const key of keys) {
      if (key === "KeyW" || key === "ArrowUp") y--;
      if (key === "KeyS" || key === "ArrowDown") y++;
      if (key === "KeyA" || key === "ArrowLeft") x--;
      if (key === "KeyD" || key === "ArrowRight") x++;
    }
    let worldTarget = null;
    if (!x && !y) {
      if (mouse && target) {
        worldTarget = screenToWorld(target.x, target.y);
        const dx = worldTarget.x - player.x,
          dy = worldTarget.y - player.y,
          d = Math.hypot(dx, dy);
        if (d > 18) {
          x = dx / d;
          y = dy / d;
        }
      } else {
        x = vector.x;
        y = vector.y;
      }
    }
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }
    const dash = queuedDash;
    queuedDash = false;
    return { x, y, dash, moving: magnitude > 0.05, target: worldTarget, mouse };
  }
  return { sample, reset };
}
