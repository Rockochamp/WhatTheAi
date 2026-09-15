import { ARENA, WEAPONS, stats, rng } from "./engine.js?v=5";
import { createGore } from "./gore.js?v=3";
import { createPickupSprites, SUPPLIES } from "./pickups.js?v=5";
const SPRITES = [
  [31, 35, 385, 382],
  [528, 162, 247, 250],
  [948, 160, 331, 258],
  [1331, 80, 429, 327],
  [56, 508, 317, 328],
  [510, 502, 321, 325],
  [1011, 616, 186, 211],
  [1330, 427, 427, 435],
];
const VETERANS = [
  [40, 10, 420, 465],
  [550, 67, 485, 415],
  [1054, 27, 468, 446],
  [39, 485, 483, 527],
  [520, 564, 546, 393],
  [1091, 468, 420, 545],
];
const TAU = Math.PI * 2;
export async function createRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw Error("This browser cannot create the game canvas.");
  const load = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(Error("The game artwork could not load. Please retry."));
      image.src = src;
    });
  const [atlas, ground, veterans] = await Promise.all([
    load(new URL("./characters.webp", import.meta.url)),
    load(new URL("./ground.webp", import.meta.url)),
    load(new URL("./veterans.webp", import.meta.url)),
  ]);
  const crops = SPRITES.map((rect, i) => ({
    image: i ? atlas : veterans,
    rect: i ? rect : VETERANS[0],
  }));
  crops.push(...VETERANS.slice(1).map((rect) => ({ image: veterans, rect })));
  const sprites = crops.map(({ image, rect }) => {
    const surface = document.createElement("canvas");
    surface.width = rect[2];
    surface.height = rect[3];
    surface.getContext("2d").drawImage(image, ...rect, 0, 0, rect[2], rect[3]);
    return surface;
  });
  const flashes = sprites.map((source) => {
    const c = document.createElement("canvas");
    c.width = source.width;
    c.height = source.height;
    const g = c.getContext("2d");
    g.drawImage(source, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#fff6d5";
    g.fillRect(0, 0, c.width, c.height);
    return c;
  });
  const soft = document.createElement("canvas");
  soft.width = soft.height = 128;
  const sg = soft.getContext("2d"),
    rad = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  rad.addColorStop(0, "#fff");
  rad.addColorStop(0.3, "#ffffff70");
  rad.addColorStop(1, "#ffffff00");
  sg.fillStyle = rad;
  sg.fillRect(0, 0, 128, 128);
  const pickupSprites = createPickupSprites();
  const random = rng(93014);
  const gore = createGore(rng(77151));
  let width = 0,
    height = 0,
    scale = 1,
    camera = { x: 0, y: 0 },
    shake = 0,
    fx = [],
    numbers = [],
    ghosts = [],
    quiet = false,
    low = false,
    adaptiveLow = false,
    now = 0,
    frames = 0,
    slow = 0;
  const motes = Array.from({ length: 28 }, () => ({
    x: random() * 2000,
    y: random() * 2000,
    r: 0.7 + random() * 1.2,
    seed: random() * 10,
  }));
  function resize() {
    const b = canvas.getBoundingClientRect();
    width = Math.max(1, b.width);
    height = Math.max(1, b.height);
    const ratio = Math.min(devicePixelRatio || 1, low ? 1 : 1.6);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    scale = width < 600 ? width / 720 : Math.min(width / 1120, height / 730);
    scale = Math.max(0.32, Math.min(1.5, scale));
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  function point(x, y) {
    return {
      x: (x - camera.x) * scale + width * 0.5,
      y: (y - camera.y) * scale + height * (width < 600 ? 0.46 : 0.53),
    };
  }
  function world(x, y) {
    return {
      x: (x - width * 0.5) / scale + camera.x,
      y: (y - height * (width < 600 ? 0.46 : 0.53)) / scale + camera.y,
    };
  }
  function visible(x, y, margin = 130) {
    const p = point(x, y);
    return (
      p.x > -margin &&
      p.x < width + margin &&
      p.y > -margin &&
      p.y < height + margin
    );
  }
  function circle(x, y, r, color, line = 0) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    if (line) {
      ctx.strokeStyle = color;
      ctx.lineWidth = line;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
  function glow(x, y, r, color, alpha = 0.25) {
    if (low) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "#0000");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  function ring(x, y, r, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    circle(x, y, r, color, Math.max(1.4, 2 * scale));
    ctx.restore();
  }
  function banana(x, y, r, angle, color = "#ffe17b") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-r * 0.75, -r * 0.65);
    ctx.quadraticCurveTo(r * 1.45, -r * 0.05, r * 0.7, r * 0.7);
    ctx.quadraticCurveTo(r * 0.35, r * 0.2, -r * 0.75, -r * 0.65);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#fff3ac";
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.stroke();
    ctx.restore();
  }
  function actor(
    sprite,
    x,
    y,
    size,
    {
      flip = false,
      tilt = 0,
      squash = 1,
      alpha = 1,
      flash = false,
      hero = false,
      bob = 0,
    } = {},
  ) {
    const p = point(x, y),
      image = sprites[sprite],
      w = ((size * image.width) / image.height) * scale,
      h = size * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#020a0880";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + h * 0.29, w * 0.37, h * 0.14, 0, 0, TAU);
    ctx.fill();
    if (hero) {
      glow(p.x, p.y, 57 * scale, "#ffdc79", 0.15);
      ring(p.x, p.y + h * 0.22, 21 * scale, "#ffe094", 0.65);
    }
    ctx.translate(p.x, p.y + bob * scale);
    ctx.rotate(tilt);
    ctx.scale(flip ? -1 : 1, squash);
    ctx.drawImage(image, -w * 0.5, -h * 0.68, w, h);
    if (flash) {
      ctx.globalAlpha = alpha * (typeof flash === "number" ? flash : 0.5);
      ctx.drawImage(flashes[sprite], -w * 0.5, -h * 0.68, w, h);
    }
    ctx.restore();
  }
  function emit(events, s, settings = {}) {
    for (const e of events) {
      gore.emit(e, s.player, {
        low: settings.low || low,
        quiet: settings.quiet || quiet,
        enabled: settings.gore !== false,
      });
      if (e.type === "hit" && !quiet && numbers.length < 25) {
        numbers.push({
          x: e.x + (random() - 0.5) * 18,
          y: e.y - 20,
          text: String(e.amount),
          color: e.critical ? "#ffdf72" : "#f3efe3",
          life: 0.65,
          max: 0.65,
          big: e.critical,
        });
      }
      if (e.type === "hurt") {
        shake = quiet ? 0 : 8;
        fx.push({
          kind: "ring",
          x: s.player.x,
          y: s.player.y,
          r: 60,
          color: "#ff6e73",
          life: 0.4,
          max: 0.4,
        });
      }
      if (e.type === "kill") {
        ghosts.push({
          sprite: e.sprite,
          x: e.x,
          y: e.y,
          size: e.size,
          life: 0.28,
          max: 0.28,
          tilt: (random() - 0.5) * 1.4,
        });
        for (let i = 0; i < (low || quiet ? 3 : 7) && fx.length < 200; i++) {
          const a = random() * TAU,
            v = 30 + random() * 85;
          fx.push({
            kind: "spark",
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            color: i % 3 === 0 ? "#ffe49a" : "#d47762",
            r: 2 + random() * 3,
            life: 0.3 + random() * 0.3,
            max: 0.6,
          });
        }
      }
      if (e.type === "dash") {
        for (let i = 0; i < 4; i++)
          ghosts.push({
            sprite: 0,
            x: e.x - e.dx * i * 14,
            y: e.y - e.dy * i * 14,
            size: 88,
            life: 0.26 + i * 0.03,
            max: 0.45,
            tilt: 0,
            cyan: true,
          });
      }
      if (e.type === "explode") {
        shake = quiet ? 0 : Math.min(5, e.r / 30);
        fx.push({
          kind: "blast",
          x: e.x,
          y: e.y,
          r: e.r,
          color: e.color,
          life: 0.45,
          max: 0.45,
        });
      }
      if (e.type === "lightning")
        fx.push({ kind: "lightning", points: e.points, life: 0.22, max: 0.22 });
      if (e.type === "frenzy" || e.type === "evolution") {
        fx.push({
          kind: "ring",
          x: s.player.x,
          y: s.player.y,
          r: 240,
          color: "#ffde80",
          life: 0.8,
          max: 0.8,
        });
        shake = quiet ? 0 : 5;
      }
      if (e.type === "cache")
        fx.push({
          kind: "ring",
          x: s.cache.x,
          y: s.cache.y,
          r: 100,
          color: "#89eaca",
          life: 0.6,
          max: 0.6,
        });
    }
    if (ghosts.length > 50) ghosts = ghosts.slice(-50);
    if (fx.length > 200) fx = fx.slice(-200);
  }
  function background() {
    ctx.fillStyle = "#11221c";
    ctx.fillRect(0, 0, width, height);
    const tile = 780,
      tl = world(0, 0),
      br = world(width, height),
      x0 = Math.floor(tl.x / tile),
      y0 = Math.floor(tl.y / tile);
    for (let x = x0; x <= Math.floor(br.x / tile); x++)
      for (let y = y0; y <= Math.floor(br.y / tile); y++) {
        const p = point(x * tile, y * tile);
        ctx.drawImage(ground, p.x, p.y, tile * scale + 1, tile * scale + 1);
      }
    ctx.fillStyle = "#05232335";
    ctx.fillRect(0, 0, width, height);
    const corner = point(-ARENA, -ARENA),
      side = ARENA * 2 * scale;
    ctx.strokeStyle = "#bdab6c55";
    ctx.lineWidth = 5 * scale;
    ctx.strokeRect(corner.x, corner.y, side, side);
    ctx.fillStyle = "#071915c9";
    if (corner.x > 0) ctx.fillRect(0, 0, corner.x, height);
    if (corner.y > 0) ctx.fillRect(0, 0, width, corner.y);
    if (corner.x + side < width)
      ctx.fillRect(corner.x + side, 0, width, height);
    if (corner.y + side < height)
      ctx.fillRect(0, corner.y + side, width, height);
  }
  function cache(s) {
    const c = s.cache;
    if (!c || !visible(c.x, c.y)) return;
    const p = point(c.x, c.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (!c.claimed) {
      glow(0, 0, 105 * scale, "#eab85b", 0.32);
      ring(0, 0, 43 * scale, "#f3d27e", 0.6 + Math.sin(now * 3) * 0.2);
    }
    ctx.rotate(-0.08);
    ctx.fillStyle = c.claimed ? "#3d3c2b" : "#70552a";
    ctx.strokeStyle = c.claimed ? "#7e7550" : "#eacb7e";
    ctx.lineWidth = 3 * scale;
    ctx.fillRect(-25 * scale, -22 * scale, 50 * scale, 39 * scale);
    ctx.strokeRect(-25 * scale, -22 * scale, 50 * scale, 39 * scale);
    ctx.fillStyle = c.claimed ? "#525640" : "#e1b65e";
    ctx.fillRect(-3 * scale, -22 * scale, 6 * scale, 39 * scale);
    ctx.fillRect(-25 * scale, -8 * scale, 50 * scale, 5 * scale);
    ctx.restore();
    if (!c.claimed) {
      ctx.textAlign = "center";
      ctx.font = `700 ${Math.max(9, 11 * scale)}px system-ui`;
      ctx.fillStyle = "#f6e6bc";
      ctx.fillText("SUPPLY CACHE", p.x, p.y - 36 * scale);
    }
  }
  function draw(s, dt = 0, input = {}) {
    now = s.time;
    quiet = !!input.quiet;
    const previousLow = low;
    low = !!input.low || adaptiveLow;
    if (previousLow !== low) resize();
    camera.x = s.player.x;
    camera.y = s.player.y;
    if (dt > 0.034) slow++;
    else slow = Math.max(0, slow - 1);
    if (slow > 90 && !low) {
      adaptiveLow = true;
      low = true;
      resize();
    }
    ctx.save();
    if (shake > 0 && !quiet)
      ctx.translate((random() - 0.5) * shake, (random() - 0.5) * shake);
    shake *= Math.exp(-dt * 12);
    background();
    if (input.gore === false) gore.clear();
    gore.update(dt);
    gore.ground(ctx, point, scale, visible);
    cache(s);
    if (s.showdown) {
      const arena = point(s.showdown.x, s.showdown.y),
        radius = s.showdown.radius * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.arc(arena.x, arena.y, radius, 0, TAU, true);
      ctx.fillStyle = "#5a15204a";
      ctx.fill("evenodd");
      ctx.restore();
      ring(
        arena.x,
        arena.y,
        radius,
        s.showdown.time > 65 ? "#ff8063" : "#e5ae79",
        0.85,
      );
      ring(arena.x, arena.y, radius - 8 * scale, "#ffbc7050", 0.5);
    }
    const st = stats(s),
      p = s.player;
    for (const h of s.hazards) {
      if (!visible(h.x, h.y)) continue;
      const q = point(h.x, h.y),
        r = h.r * scale;
      if (h.friendly) {
        circle(q.x, q.y, r, "#f4b84b12");
        ring(q.x, q.y, r, "#ffc971", 0.18);
        if (!quiet)
          circle(
            q.x,
            q.y,
            r * (0.3 + 0.15 * Math.sin(now * 7 + h.id)),
            "#ffc26b28",
          );
      } else if (!h.triggered) {
        const progress = Math.min(1, h.age / h.delay);
        circle(q.x, q.y, r, "#f45d4b35");
        ring(q.x, q.y, r, "#ffbc8a");
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, -Math.PI / 2, -Math.PI / 2 + progress * TAU);
        ctx.lineWidth = 5 * scale;
        ctx.strokeStyle = "#ffdda0";
        ctx.stroke();
        circle(q.x, q.y, 6 * scale, "#fff0bb");
      }
    }
    for (const e of s.enemies) {
      if (e.dead || !visible(e.x, e.y)) continue;
      const q = point(e.x, e.y);
      if (e.elite) ring(q.x, q.y, (e.r + 9) * scale, "#f2ad6e", 0.8);
      if (e.type === "boss" && e.recovery > 0)
        ring(q.x, q.y, (e.r + 15) * scale, "#a2efd0", 0.9);
      if (e.type === "boss" && e.enraged)
        ring(q.x, q.y, (e.r + 8) * scale, "#ef635a", 0.8);
      if (e.born > 0) {
        ring(q.x, q.y, e.r * scale * 1.5, "#eec47e", 0.65);
        continue;
      }
      if (e.windup > 0 && e.action === "fan") {
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(Math.atan2(e.ay, e.ax));
        const spread = e.enraged ? 0.8 : 0.42;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 440 * scale, -spread, spread);
        ctx.closePath();
        ctx.fillStyle = "#9acfff28";
        ctx.fill();
        ctx.strokeStyle = "#dbecff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
      if (e.windup > 0 && ["charge", "spit", "bones"].includes(e.action)) {
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(Math.atan2(e.ay, e.ax));
        const length =
          (e.action === "bones" ? 390 : e.type === "boss" ? 340 : 210) * scale;
        ctx.fillStyle = e.action === "bones" ? "#a6dfff36" : "#fb975536";
        ctx.fillRect(0, -e.r * scale, length, e.r * 2 * scale);
        ctx.strokeStyle = "#ffd49c";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.strokeRect(0, -e.r * scale, length, e.r * 2 * scale);
        ctx.restore();
      }
      if (e.windup > 0 && e.action === "burst")
        ring(q.x, q.y, (e.r + 20) * scale, "#ffb68b", 0.8);
      if (e.windup > 0 && e.action === "rupture") {
        circle(q.x, q.y, 108 * scale, "#ff472c36");
        ring(q.x, q.y, 108 * scale, "#ffd3a8");
        ring(q.x, q.y, 108 * scale * (1 - e.windup / 0.9), "#ff7057");
      }
      if (e.windup > 0 && e.action === "brood")
        ring(q.x, q.y, (45 + 9 * Math.sin(now * 9)) * scale, "#e9a0f4");
    }
    for (const d of s.drops) {
      if (!visible(d.x, d.y, 20)) continue;
      const q = point(d.x, d.y),
        bob = quiet ? 0 : Math.sin(now * 3 + d.id) * 2 * scale;
      const key =
        d.kind === "xp"
          ? d.value >= 30
            ? "xp-rare"
            : d.value >= 8
              ? "xp-rich"
              : "xp"
          : d.kind;
      const image = pickupSprites[key];
      if (!image) continue;
      const size =
        (d.kind === "xp" ? (d.value >= 30 ? 27 : d.value >= 8 ? 22 : 17) : 58) *
        scale;
      if (d.kind !== "xp") {
        circle(q.x, q.y + 11 * scale, 16 * scale, "#020d0a80");
        ring(q.x, q.y + 11 * scale, 19 * scale, SUPPLIES[d.kind].color, 0.45);
        if (!low && !quiet) {
          ctx.fillStyle = SUPPLIES[d.kind].color + "24";
          ctx.fillRect(
            q.x - 1.5 * scale,
            q.y - 44 * scale,
            3 * scale,
            40 * scale,
          );
        }
      }
      ctx.drawImage(image, q.x - size / 2, q.y + bob - size / 2, size, size);
    }
    if (s.ward > 0) {
      const q = point(p.x, p.y);
      ring(q.x, q.y - 20 * scale, 38 * scale, "#a2fbe0", 0.85);
    }

    for (const g of ghosts) {
      g.life -= dt;
      actor(g.sprite, g.x, g.y, g.size, {
        alpha: Math.max(0, g.life / g.max) * 0.45,
        squash: Math.max(0.2, g.life / g.max),
        tilt: g.tilt * (1 - g.life / g.max),
        flash: g.cyan,
      });
    }
    ghosts = ghosts.filter((g) => g.life > 0);
    const entities = s.enemies.filter((e) => !e.dead && visible(e.x, e.y));
    entities.push({ player: true, y: p.y });
    entities.sort((a, b) => a.y - b.y);
    for (const e of entities) {
      if (e.player) {
        const moving = input.moving || p.dash > 0,
          bob =
            moving && !quiet
              ? -Math.abs(Math.sin(now * 15)) * 4
              : Math.sin(now * 3) * 1.2;
        actor(0, p.x, p.y, 90, {
          hero: true,
          flip: Math.cos(p.angle) < 0,
          tilt:
            p.dash > 0
              ? p.dx * 0.15
              : moving && !quiet
                ? Math.sin(now * 15) * 0.045
                : 0,
          bob,
          squash: p.dash > 0 ? 0.85 : 1,
          flash: p.hit > 0,
        });
        if (p.invulnerable > 0 || s.frenzy > 0) {
          const q = point(p.x, p.y);
          ring(q.x, q.y, 42 * scale, s.frenzy > 0 ? "#ffe085" : "#b4f0e2", 0.8);
        }
      } else {
        const bob = quiet
          ? 0
          : Math.abs(Math.sin(now * (e.type === "hound" ? 15 : 8) + e.id)) * 3;
        actor(e.sprite, e.x, e.y, e.size, {
          flip: e.x > p.x,
          bob: -bob,
          tilt:
            e.charge > 0
              ? e.ax > 0
                ? 0.18
                : -0.18
              : quiet
                ? 0
                : Math.sin(now * 7 + e.id) * 0.035,
          flash: e.hit > 0 ? (e.type === "boss" ? 0.25 : 0.5) : false,
          squash:
            e.action === "rupture" && e.windup > 0
              ? 1 + (1 - e.windup / 0.9) * 0.24
              : 1,
          alpha:
            e.born > 0
              ? Math.max(0, 1 - e.born / (e.type === "boss" ? 1.6 : 0.65))
              : 1,
        });
        if (
          e.hp < e.maxHp &&
          e.type !== "boss" &&
          (e.maxHp > 60 || e.hit > 0)
        ) {
          const q = point(e.x, e.y),
            w = 36 * scale;
          ctx.fillStyle = "#03130bd9";
          ctx.fillRect(
            q.x - w * 0.5,
            q.y - e.size * 0.73 * scale,
            w,
            4 * scale,
          );
          ctx.fillStyle = "#d98772";
          ctx.fillRect(
            q.x - w * 0.5,
            q.y - e.size * 0.73 * scale,
            w * Math.max(0, e.hp / e.maxHp),
            4 * scale,
          );
        }
      }
    }
    const rank = s.weapons.peels;
    if (rank) {
      const count = rank === 5 ? 5 : rank >= 4 ? 3 : rank >= 2 ? 2 : 1,
        orbit = (rank >= 3 ? 82 : 65) * st.area;
      const center = point(p.x, p.y);
      ring(center.x, center.y, orbit * scale, "#bad494", 0.12);
      for (let i = 0; i < count; i++) {
        const a = now * (rank >= 4 ? 2.8 : 2.1) + (i * TAU) / count,
          q = point(p.x + Math.cos(a) * orbit, p.y + Math.sin(a) * orbit);
        banana(
          q.x,
          q.y,
          21 * scale * st.area,
          a + 0.8,
          rank === 5 ? "#b7f8b9" : "#ffe07a",
        );
      }
    }
    for (const b of s.shots) {
      if (!visible(b.x, b.y, 40)) continue;
      const q = point(b.x, b.y);
      if (b.kind === "banana") {
        if (!low) glow(q.x, q.y, b.r * scale * 2, "#ffe8a4", 0.2);
        banana(q.x, q.y, b.r * scale, b.age * 17);
      } else if (b.kind === "coconut") {
        const lift = Math.sin((b.age / b.life) * Math.PI) * 80 * scale;
        circle(q.x, q.y, 8 * scale, "#03130b60");
        circle(q.x, q.y - lift, 12 * scale, "#60442a");
        circle(q.x - 3 * scale, q.y - lift - 3 * scale, 7 * scale, "#cba06e");
      } else if (b.kind === "bone") {
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.strokeStyle = "#d9f1ff";
        ctx.lineWidth = 5 * scale;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-10 * scale, 0);
        ctx.lineTo(10 * scale, 0);
        ctx.stroke();
        circle(-9 * scale, -3 * scale, 3.5 * scale, "#e9e0ca");
        circle(9 * scale, 3 * scale, 3.5 * scale, "#e9e0ca");
        ctx.restore();
      } else if (b.hostile) {
        circle(q.x, q.y, b.r * scale + 3, "#def69250");
        circle(q.x, q.y, b.r * scale, "#b7e782");
        circle(q.x - 2 * scale, q.y - 2 * scale, 3 * scale, "#f3ffda");
      } else {
        const v = unit(b.vx, b.vy);
        ctx.beginPath();
        ctx.moveTo(q.x - v.x * 18 * scale, q.y - v.y * 18 * scale);
        ctx.lineTo(q.x, q.y);
        ctx.lineWidth = 5 * scale;
        ctx.lineCap = "round";
        ctx.strokeStyle = b.homing ? "#fff7c8" : "#f2c761";
        ctx.stroke();
        circle(q.x, q.y, 3 * scale, "#fff7c2");
      }
    }
    gore.airborne(ctx, point, scale, visible);
    for (const effect of fx) {
      effect.life -= dt;
      const alpha = Math.max(0, effect.life / effect.max),
        progress = 1 - alpha;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (effect.kind === "lightning") {
        ctx.strokeStyle = "#ceefff";
        ctx.lineWidth = 3 * scale;
        ctx.shadowBlur = low ? 0 : 12;
        ctx.shadowColor = "#86c5ff";
        ctx.beginPath();
        effect.points.forEach((a, i) => {
          const q = point(a.x, a.y);
          if (!i) ctx.moveTo(q.x, q.y);
          else {
            const prev = point(effect.points[i - 1].x, effect.points[i - 1].y);
            ctx.lineTo(
              (prev.x + q.x) / 2 + Math.sin(i * 40) * 12,
              (prev.y + q.y) / 2 + Math.cos(i * 30) * 12,
            );
            ctx.lineTo(q.x, q.y);
          }
        });
        ctx.stroke();
      } else {
        const q = point(effect.x, effect.y);
        if (effect.kind === "spark") {
          effect.x += effect.vx * dt;
          effect.y += effect.vy * dt;
          circle(q.x, q.y, effect.r * scale * alpha, effect.color);
        } else {
          const r = Math.max(1, effect.r * scale * (0.2 + progress));
          ring(q.x, q.y, r, effect.color);
          if (effect.kind === "blast") {
            circle(q.x, q.y, r * 0.75, effect.color + "44");
            circle(q.x, q.y, r * 0.3, "#fff3cb80");
          }
        }
      }
      ctx.restore();
    }
    fx = fx.filter((f) => f.life > 0);
    for (const n of numbers) {
      n.life -= dt;
      const q = point(n.x, n.y - (1 - n.life / n.max) * 34);
      ctx.globalAlpha = Math.max(0, n.life / n.max);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.max(10, (n.big ? 20 : 15) * scale)}px system-ui`;
      ctx.strokeStyle = "#15251b";
      ctx.lineWidth = 3;
      ctx.strokeText(n.text, q.x, q.y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, q.x, q.y);
    }
    numbers = numbers.filter((n) => n.life > 0);
    ctx.globalAlpha = 1;
    if (!quiet && !low) {
      for (const m of motes) {
        const x =
            (((m.x - camera.x * 0.12 + Math.sin(now * 0.3 + m.seed) * 15) %
              width) +
              width) %
            width,
          y = (((m.y - camera.y * 0.1 - now * 3) % height) + height) % height;
        circle(x, y, m.r, "#f0df9c55");
      }
    }
    const shade = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.17,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.72,
    );
    shade.addColorStop(0, "#05191200");
    shade.addColorStop(1, "#05100bd0");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    if (input.target && input.mouse) {
      const q = point(input.target.x, input.target.y);
      ring(q.x, q.y, 9, "#e3e8c6", 0.65);
      circle(q.x, q.y, 2, "#ffeaad");
    }
    // Offscreen navigation guides are presentation only, never spawn rules.
    const boss = s.enemies.find((e) => e.id === s.bossId);
    const objective = boss || (!s.cache.claimed ? s.cache : null);
    if (objective && !visible(objective.x, objective.y, -35)) {
      const target = point(objective.x, objective.y),
        dx = target.x - width * 0.5,
        dy = target.y - height * 0.5,
        a = Math.atan2(dy, dx),
        edge = Math.min(
          (width * 0.5 - 32) / Math.max(0.001, Math.abs(Math.cos(a))),
          (height * 0.5 - 115) / Math.max(0.001, Math.abs(Math.sin(a))),
        );
      const x = width * 0.5 + Math.cos(a) * edge,
        y = height * 0.5 + Math.sin(a) * edge;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = boss ? "#ffad93" : "#e6d298";
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-5, -6);
      ctx.lineTo(-5, 6);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    frames++;
  }
  function unit(x, y) {
    const d = Math.hypot(x, y) || 1;
    return { x: x / d, y: y / d };
  }
  return {
    draw,
    emit,
    resize,
    world,
    get scale() {
      return scale;
    },
    get size() {
      return { width, height };
    },
    reset() {
      gore.clear();
      fx = [];
      numbers = [];
      ghosts = [];
      shake = 0;
    },
    dispose() {
      observer.disconnect();
    },
  };
}
