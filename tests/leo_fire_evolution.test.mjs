import test from 'node:test';
import assert from 'node:assert/strict';
import {
  worlds,
  WIDTH,
  HEIGHT,
  readTrail,
  pathTo,
  points,
} from '../games/leo_fire_evolution/ember/worlds.js';
import { aliases, valid, publish, leaders } from '../games/leo_fire_evolution/ember/board.js';

test('every world has a complete reachable trail, including all optional moths', () => {
  assert.equal(worlds.length, 10);
  assert.equal(new Set(worlds.map((world) => world.layout.join(''))).size, 10);
  for (const world of worlds) {
    const tiles = readTrail(world);
    assert.equal(world.layout.length, HEIGHT, world.name);
    assert.ok(
      world.layout.every((row) => row.length === WIDTH),
      world.name,
    );
    assert.deepEqual([tiles.s.length, tiles.a.length, tiles.m.length], [3, 2, 3]);
    assert.equal(world.layout.join('').match(/p/g).length, 1);
    assert.equal(world.layout.join('').match(/l/g).length, 1);
    for (const target of [...tiles.a, ...tiles.s, ...tiles.m, tiles.p]) {
      const path = pathTo(tiles.l, target, tiles['#']);
      assert.equal(path.at(-1), target, world.name);
      let previous = tiles.l;
      for (const cell of path) {
        assert.ok(!tiles['#'].includes(cell));
        const dx = Math.abs((cell % WIDTH) - (previous % WIDTH));
        const dy = Math.abs(Math.floor(cell / WIDTH) - Math.floor(previous / WIDTH));
        assert.equal(dx + dy, 1, 'Movement stays on adjacent cells');
        previous = cell;
      }
    }
  }
});

const record = {
  id: 'c47ef1bb-e00f-4ce2-aac9-071d37486143',
  world: 0,
  steps: 47,
  moths: 3,
  alias: aliases[0],
  score: points(3, 47),
};

test('the score rewards exploration and never penalises a long trail', () => {
  assert.equal(record.score, 1003);
  assert.equal(points(0, 120), 500);
  assert.ok(valid(record));
  for (const change of [
    { score: 1000000 },
    { world: 10 },
    { alias: 'Unlisted' },
    { moths: 4 },
    { steps: -1 },
  ]) {
    assert.ok(!valid({ ...record, ...change }));
  }
});

test('posting is idempotent after a lost response and rankings stay separate by world', async (t) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    requests.push({ url, body });
    if (options.method === 'GET')
      return Response.json({ name: 'collection/' + record.id, fields: requests[0].body.fields });
    if (url.endsWith(':runQuery')) {
      const fields = requests[0].body.fields;
      return Response.json([
        { document: { name: 'collection/' + record.id, fields } },
        { document: { name: 'collection/bad-row', fields: {} } },
      ]);
    }
    if (requests.length === 2) return Response.json({ error: { status: 'ALREADY_EXISTS' } }, { status: 409 });
    return Response.json({});
  });
  assert.equal(await publish(record), record.alias);
  assert.equal(await publish({ ...record, alias: aliases[1] }), record.alias);
  assert.equal(requests[0].url, requests[1].url);
  assert.ok(requests[0].url.endsWith('world_1?documentId=' + record.id));
  assert.deepEqual(await leaders(0), [record]);
  await leaders(9);
  assert.equal(
    requests.at(-1).body.structuredQuery.from[0].collectionId,
    'leaderboard_leo_fire_evolution_v1_world_10',
  );
});

test('a failed submission can be retried and malformed records never reach the board', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: { status: 'UNAVAILABLE' } }, { status: 503 }),
  );
  await assert.rejects(publish(record), { code: 'UNAVAILABLE' });
  await assert.rejects(publish({ ...record, alias: 'invalid' }), /Invalid trail/);
  assert.equal(request.mock.callCount(), 1);
});
