/* Leo's Smash Race — manifest-driven asset loader.
   ART.get(name) always returns something drawable: the real file once it has loaded, otherwise the interim
   vector art from proc.js. Files load with ?v=<version> so CDN copies never go stale. */
(function (root) {
'use strict';
const M = root.LEO_MANIFEST || { version: 1, base: 'art/', sprites: {}, layers: {} };
const cache = {}, layerCache = {}, listeners = [];
let pending = 0, loaded = 0, failed = [];
function url(e) { return M.base + e.src + (e.src.includes('?') ? '&' : '?') + 'v=' + (e.v || M.version); }
function load(e, done) { const im = new Image(); im.decoding = 'async'; pending++;
  im.onload = () => { pending--; loaded++; done(im); listeners.forEach(f => f()); };
  im.onerror = () => { pending--; failed.push(e.src); }; im.src = url(e); }
function entry(name) { return M.sprites[name] || M.sprites[name.replace(/\.\d+$/, '')] || null; }
/* Aliases: an entry may say { alias: 'other.name' }, and manifest.poseAliases maps vehicle poses
   (default boost -> drive, celebrate -> fly) when that pose has no file of its own. */
function resolve(name, depth) { depth = depth || 0; if (depth > 4) return name; const e = entry(name);
  if (e && e.alias) return resolve(e.alias, depth + 1);
  const m = name.match(/^(veh\.\w+)\.(\w+)$/), pa = M.poseAliases || {};
  if (m && (!e || !e.src) && pa[m[2]] && pa[m[2]] !== m[2]) return resolve(m[1] + '.' + pa[m[2]], depth + 1);
  return name; }
function fx(name) { const r = resolve(name), e = entry(r) || {}; if (e.fx) return e.fx; const base = r.replace(/\.\w+$/, '.drive'), b = entry(base); return (b && b.fx) || {}; }
function get(name) {
  let c = cache[name]; if (c) return c;
  const r = resolve(name); if (r !== name) return (cache[name] = get(r));
  const e = entry(name) || { size: [256, 256], anchor: [0.5, 0.95], wu: 100 };
  c = cache[name] = { img: root.LeoProc.sprite(name, e.size), w: e.size[0], h: e.size[1], ax: (e.anchor || [0.5, 0.95])[0], ay: (e.anchor || [0.5, 0.95])[1], wu: e.wu || 100, real: false };
  if (e.src) load(e, im => { c.img = im; c.w = im.naturalWidth; c.h = im.naturalHeight; c.real = true; });
  return c;
}
/* Parallax layers for a track: [{ role, par, img, w, h }], interim layers are drawn at half the authored size. */
function layers(track) {
  if (layerCache[track]) return layerCache[track];
  const list = (M.layers[track] || []).map(L => { const w = Math.round(L.size[0] / 2), h = Math.round(L.size[1] / 2);
    const o = { role: L.role, par: L.par, base: L.base == null ? 1 : L.base, img: L.role === 'front' ? null : root.LeoProc.layer(track, L.role, w, h), w, h, real: false };
    if (L.src) load(L, im => { o.img = im; o.w = im.naturalWidth; o.h = im.naturalHeight; o.real = true; }); return o; });
  return (layerCache[track] = list);
}
/* HTML <img> overrides for UI icons: <span data-art="ui.fly">…fallback…</span> */
function decorate(rootEl) { (rootEl || document).querySelectorAll('[data-art]').forEach(el => { const e = entry(el.dataset.art); if (!e || !e.src || el.dataset.artDone) return;
  el.dataset.artDone = '1'; const im = new Image(); im.alt = ''; im.className = 'art-img'; im.onload = () => { el.textContent = ''; el.appendChild(im); }; im.src = url(e); }); }
function preload(names) { names.forEach(get); }
/* Variants: 'debris.wood' -> ['debris.wood', 'debris.wood.2', ...] (only names the manifest lists). */
const varCache = {};
function variants(name) { if (varCache[name]) return varCache[name]; const re = new RegExp('^' + name.replace(/\./g, '\\.') + '\\.\\d+$'); const v = [name].concat(Object.keys(M.sprites).filter(k => re.test(k))); return (varCache[name] = v); }
root.LeoArt = { get, resolve, fx, variants, layers, decorate, preload, onChange: f => listeners.push(f), stats: () => ({ pending, loaded, failed: failed.slice() }), manifest: M };
})(window);
