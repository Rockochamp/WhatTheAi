import { clamp } from "./engine.js?v=3";

// A relative drag keeps the ship above the finger and allows a second thumb
// to press Burst without taking over the steering pointer.
export class DragSteering {
  constructor() {
    this.pointer = null;
    this.target = null;
  }
  begin(event, player) {
    if (this.pointer || (event.pointerType === "mouse" && event.button !== 0))
      return false;
    this.pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      shipX: player.x,
      shipY: player.y,
    };
    this.target = { x: player.x, y: player.y };
    return true;
  }
  move(event, bounds) {
    const p = this.pointer;
    if (!p || p.id !== event.pointerId) return false;
    this.target = {
      x: clamp(
        p.shipX + (event.clientX - p.x) * 1.15,
        bounds.left,
        bounds.right,
      ),
      y: clamp(
        p.shipY + (event.clientY - p.y) * 1.15,
        bounds.top,
        bounds.bottom,
      ),
    };
    for (const [axis, ship, min, max] of [
      ["x", "shipX", "left", "right"],
      ["y", "shipY", "top", "bottom"],
    ]) {
      if (
        this.target[axis] === bounds[min] ||
        this.target[axis] === bounds[max]
      ) {
        p[axis] = axis === "x" ? event.clientX : event.clientY;
        p[ship] = this.target[axis];
      }
    }
    return true;
  }
  end(event) {
    if (this.pointer?.id !== event.pointerId) return;
    this.pointer = null;
    if (event.type !== "pointerup") this.target = null;
  }
  clear() {
    this.pointer = null;
    this.target = null;
  }
}
