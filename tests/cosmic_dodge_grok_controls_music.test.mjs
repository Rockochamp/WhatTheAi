import test from "node:test";
import assert from "node:assert/strict";
import { DragSteering } from "../games/cosmic_dodge/grok_4_6/controls.js";
import {
  scoreStep,
  Soundtrack,
  STEP,
} from "../games/cosmic_dodge/grok_4_6/music.js";
const event = (id, x, y, type = "pointermove", pointerType = "touch") => ({
  pointerId: id,
  clientX: x,
  clientY: y,
  type,
  pointerType,
  button: 0,
});
const bounds = { left: 20, right: 370, top: 100, bottom: 650 };
test("touch starts at the ship, ignores a second thumb, and reverses from edges immediately", () => {
  const drag = new DragSteering();
  assert.ok(drag.begin(event(1, 100, 600), { x: 190, y: 500 }));
  assert.deepEqual(drag.target, { x: 190, y: 500 });
  assert.equal(drag.begin(event(2, 320, 730), { x: 190, y: 500 }), false);
  assert.equal(drag.move(event(2, 200, 400), bounds), false);
  drag.move(event(1, 600, 900), bounds);
  assert.deepEqual(drag.target, { x: 370, y: 650 });
  drag.move(event(1, 590, 890), bounds);
  assert.deepEqual(drag.target, { x: 358.5, y: 638.5 });
});
test("quick swipe keeps its destination through normal capture release; cancellation stops", () => {
  const drag = new DragSteering();
  drag.begin(event(1, 100, 600), { x: 190, y: 500 });
  drag.move(event(1, 150, 550), bounds);
  drag.end(event(1, 150, 550, "pointerup"));
  const destination = { ...drag.target };
  drag.end(event(1, 150, 550, "lostpointercapture"));
  assert.deepEqual(drag.target, destination);
  drag.begin(event(2, 100, 600), { x: 240, y: 450 });
  drag.end(event(2, 100, 600, "pointercancel"));
  assert.equal(drag.target, null);
});
test("mouse dragging uses the same movement and keyboard takeover clears stale targets", () => {
  const drag = new DragSteering();
  assert.equal(
    drag.begin(
      { ...event(1, 100, 600), pointerType: "mouse", button: 2 },
      { x: 190, y: 500 },
    ),
    false,
  );
  drag.begin(event(1, 100, 600, "pointerdown", "mouse"), { x: 190, y: 500 });
  drag.move(event(1, 120, 610), bounds);
  assert.deepEqual(drag.target, { x: 213, y: 511.5 });
  drag.clear();
  assert.equal(drag.pointer, null);
  assert.equal(drag.target, null);
  assert.equal(drag.move(event(1, 400, 400), bounds), false);
});
test("the soundtrack loops musically and adds intensity without changing tempo", () => {
  for (let i = 0; i < 512; i++)
    assert.deepEqual(scoreStep(i, 20), scoreStep(i + 512, 20));
  assert.ok(scoreStep(8 * 16, 1).some((n) => n.voice === "lead"));
  assert.ok(!scoreStep(16 * 16, 30).some((n) => n.voice === "kick"));
  assert.ok(scoreStep(20 * 16, 1).some((n) => n.voice === "crash"));
  assert.ok(scoreStep(4 * 16 + 1, 20).length > scoreStep(4 * 16 + 1, 1).length);
  for (let level of [1, 10, 30, 80])
    for (let i = 0; i < 512; i++)
      for (const note of scoreStep(i, level)) {
        assert.ok(
          Number.isFinite(note.volume) && note.volume > 0 && note.volume < 1,
        );
        assert.ok(note.duration > 0 && Math.abs(note.pan) <= 1);
      }
});
test("audio scheduler skips stale time instead of playing a backlog after interruption", () => {
  const track = Object.create(Soundtrack.prototype),
    scheduled = [];
  Object.assign(track, {
    playing: true,
    context: { state: "running", currentTime: 50 },
    nextAt: 1,
    index: 100,
    level: 20,
    scheduleStep: (i, at) => scheduled.push({ i, at }),
  });
  track.tick();
  assert.ok(scheduled.length <= 2);
  assert.ok(scheduled[0].at >= 50);
  assert.ok(Math.abs(track.nextAt - (50.03 + scheduled.length * STEP)) < 1e-8);
  track.playing = false;
  track.tick();
  assert.ok(scheduled.length <= 2);
});
