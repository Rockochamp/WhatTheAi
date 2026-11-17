import { COURSES, RACERS } from './sim.js?v=2';

const URL = 'https://firestore.googleapis.com/v1/projects/cosmicdodge-5ae20/databases/(default)/documents';
export const ALIASES = ['Dino Driver', 'Turbo Leo', 'Nitro Ninja', 'Smash Star', 'Sky Pilot', 'Boxenblitz', 'Night Racer', 'Drift Kid', 'Komet', 'Rennfuchs'];

function collection(course, mode) {
  if (!COURSES.some(c => c.id === course) || !['crew','pro'].includes(mode)) throw new Error('Ungültige Bestenliste');
  return 'leaderboard_smarleos_smash_racer_sol_v1_' + course + '_' + mode;
}

async function request(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const response = await fetch(URL + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal,
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      const error = new Error('Weltrangliste vorübergehend nicht erreichbar');
      error.code = failure.error?.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function valid(score, time, playerName, racer) {
  return Number.isSafeInteger(score) && score >= 0 && score <= 200000
    && Number.isSafeInteger(time) && time >= 14000 && time <= 240000
    && ALIASES.includes(playerName) && RACERS.some(r => r.id === racer);
}

export function orderKey(score, time) {
  return score * 1000000 + (250000 - time);
}

export async function top(course, mode) {
  const documents = await request(':runQuery', { structuredQuery: {
    from: [{ collectionId: collection(course,mode) }],
    orderBy: [{ field: { fieldPath: 'order' }, direction: 'DESCENDING' }],
    limit: 40,
  } });
  return documents.flatMap(row => {
    const fields = row.document?.fields;
    if (fields?.ruleset?.integerValue !== '1') return [];
    const score = Number(fields.score?.integerValue), time = Number(fields.time?.integerValue);
    const playerName = fields.playerName?.stringValue, racer = fields.racer?.stringValue;
    if (!valid(score, time, playerName, racer) || Number(fields.order?.integerValue) !== orderKey(score,time)) return [];
    return [{ score, time, playerName, racer }];
  }).slice(0,20);
}

export async function submit({ id, course, mode, score, time, playerName, racer }) {
  if (!valid(score, time, playerName, racer) || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Ungültiger Rennlauf');
  const integer = n => ({ integerValue: String(n) });
  try {
    await request('/' + collection(course,mode) + '?documentId=' + encodeURIComponent(id), { fields: {
      playerName: { stringValue: playerName }, racer: { stringValue: racer },
      score: integer(score), time: integer(time), ruleset: integer(1), order: integer(orderKey(score,time)),
    } });
  } catch (err) {
    // A dropped response may leave the first submission stored under this run ID.
    if (err.code !== 'ALREADY_EXISTS') throw err;
  }
}
