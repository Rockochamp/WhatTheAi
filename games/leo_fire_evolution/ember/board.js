// The site uses Firestore for its other casual world leaderboards too.
import { points, worlds } from './worlds.js';
export const aliases = ['Ember Fox', 'Moss Scout', 'Moon Moth', 'Cinder Cub', 'Star Finch', 'Fern Sprite'];
const endpoint =
  'https://firestore.googleapis.com/v1/projects/cosmicdodge-5ae20/databases/(default)/documents';
function collection(world) {
  if (!Number.isInteger(world) || !worlds[world]) throw Error('Unknown trail');
  return 'leaderboard_leo_fire_evolution_v1_world_' + (world + 1);
}
export function valid(record) {
  return (
    record &&
    Number.isInteger(record.moths) &&
    record.moths >= 0 &&
    record.moths <= 3 &&
    Number.isSafeInteger(record.steps) &&
    record.steps > 0 &&
    record.steps <= 1000000 &&
    record.score === points(record.moths, record.steps) &&
    aliases.includes(record.alias) &&
    /^[a-f0-9-]{36}$/.test(record.id) &&
    Number.isInteger(record.world) &&
    !!worlds[record.world]
  );
}
async function request(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      cache: 'no-store',
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const reason = await response.json().catch(() => ({}));
      throw Object.assign(Error('World board unavailable'), { code: reason.error?.status });
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
function readRecord(document, world) {
  if (!document?.name || !document.fields) return null;
  const fields = document.fields;
  const record = {
    id: document.name.split('/').pop(),
    world,
    alias: fields.alias?.stringValue,
    steps: Number(fields.steps?.integerValue),
    moths: Number(fields.moths?.integerValue),
    score: Number(fields.score?.integerValue),
  };
  return valid(record) ? record : null;
}
export async function publish(record) {
  if (!valid(record)) throw Error('Invalid trail');
  const num = (n) => ({ integerValue: String(n) });
  const { score, steps, moths, alias, id, world } = record;
  try {
    await request('/' + collection(world) + '?documentId=' + id, {
      fields: {
        alias: { stringValue: alias },
        steps: num(steps),
        moths: num(moths),
        score: num(score),
      },
    });
  } catch (err) {
    if (err.code !== 'ALREADY_EXISTS') throw err;
    // A previous POST may have reached the board even if its reply was lost.
    const previous = readRecord(await request('/' + collection(world) + '/' + id), world);
    if (
      !previous ||
      previous.id !== id ||
      previous.score !== score ||
      previous.steps !== steps ||
      previous.moths !== moths
    )
      throw Error('Conflicting trail');
    return previous.alias;
  }
  return alias;
}
export async function leaders(world) {
  const rows = await request(':runQuery', {
    structuredQuery: {
      from: [{ collectionId: collection(world) }],
      orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }],
      limit: 25,
    },
  });
  return rows
    .map((row) => readRecord(row.document, world))
    .filter(Boolean)
    .slice(0, 10);
}
