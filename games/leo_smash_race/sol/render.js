import { RACERS, PROPS, pointAt, clamp } from './sim.js';

export const spriteURL = id => new URL('./art/' + id + '.webp', import.meta.url).href;
const sprites = new Map(RACERS.map(racer => {
  const image = new Image();
  image.src = spriteURL(racer.id);
  return [racer.id, image];
}));
const palette = {
  workshop: ['#272f31', '#394945', '#2d373a'],
  quarry: ['#483329', '#624739', '#382c27'],
  neon: ['#193046', '#273855', '#192738'],
  overdrive: ['#2f3341', '#363746', '#292b3a'],
};

function line(ctx, nodes, width, color, dash = []) {
  ctx.beginPath();
  for (let i = 0; i < nodes.length; i++) {
    if (i === 0) ctx.moveTo(nodes[i].x, nodes[i].y);
    else ctx.lineTo(nodes[i].x, nodes[i].y);
  }
  ctx.closePath();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

function dots(ctx, point, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
  ctx.fill();
}

const mapLayouts = new Map();
export function drawMap(canvas, course, race) {
  const ctx = canvas.getContext('2d');
  let bounds = mapLayouts.get(course.id);
  if (!bounds) {
    const xs = course.nodes.map(p => p.x), ys = course.nodes.map(p => p.y);
    bounds = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    mapLayouts.set(course.id, bounds);
  }
  const [x1,x2,y1,y2] = bounds;
  const w = canvas.width, h = canvas.height;
  const scale = Math.min((w - 22) / (x2-x1), (h - 20) / (y2-y1));
  const shift = p => ({ x: (p.x-(x1+x2)/2)*scale + w/2, y: (p.y-(y1+y2)/2)*scale + h/2 });
  ctx.clearRect(0, 0, w, h);
  ctx.lineJoin = 'round';
  line(ctx, course.nodes.filter((_, i) => i % 3 === 0).map(shift), race ? 5 : 7, '#080e13');
  line(ctx, course.nodes.filter((_, i) => i % 3 === 0).map(shift), race ? 2 : 3, course.border);
  dots(ctx, shift(course.nodes[0]), 3, '#fff');
  if (race) {
    for (const v of race.rivals) dots(ctx, shift(pointAt(course, v.distance)), 2.8, '#97a4bd');
    dots(ctx, shift(pointAt(course, race.distance)), 4.4, '#ebff73');
  }
}

function paintScenery(ctx, course, rand, bounds) {
  const [startX,startY,endX,endY] = bounds;
  const colors = palette[course.id];
  const nodeSample = course.nodes.filter((_, i) => i % 5 === 0);
  for (let i = 0; i < 260; i++) {
    const x = startX + rand() * (endX-startX), y = startY + rand() * (endY-startY);
    if (nodeSample.some(p => Math.hypot(p.x-x,p.y-y) < course.width + 70)) continue;
    const w = 12 + rand()*56, h = 15 + rand()*50, color = colors[i % colors.length];
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rand() * 2);
    ctx.fillStyle = '#0005';
    ctx.fillRect(-w/2+7,-h/2+8,w,h);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff15';
    ctx.lineWidth = 2;
    if (course.id === 'quarry') {
      ctx.beginPath();
      ctx.ellipse(0,0,w/2,h/2,0,0,2*Math.PI);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(-w/2,-h/2,w,h);
      ctx.strokeRect(-w/2,-h/2,w,h);
      if (course.id === 'neon' || i % 7 === 0) {
        ctx.fillStyle = course.id === 'neon' ? '#39779775' : '#a2a5685e';
        ctx.fillRect(-w/2+4,-h/2+3,w-8,3);
      }
    }
    ctx.restore();
  }
}

function buildSurface(course) {
  const surface = document.createElement('canvas');
  const bound = 890;
  surface.width = surface.height = bound * 2;
  const ctx = surface.getContext('2d');
  ctx.translate(bound, bound);
  ctx.fillStyle = course.ground;
  ctx.fillRect(-bound, -bound, surface.width, surface.height);
  let seed = course.seed;
  const rand = () => {
    seed = (Math.imul(1664525,seed)+1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (course.id !== 'quarry') {
    ctx.strokeStyle = '#ffffff0c';
    for (let a = -bound; a <= bound; a += 45) {
      ctx.beginPath();
      ctx.moveTo(a,-bound); ctx.lineTo(a,bound);
      ctx.moveTo(-bound,a); ctx.lineTo(bound,a);
      ctx.stroke();
    }
  }
  paintScenery(ctx, course, rand, [-bound,-bound,bound,bound]);
  ctx.lineJoin = 'round';
  const width = course.width * 2;
  line(ctx, course.nodes, width + 29, '#0006');
  line(ctx, course.nodes, width + 17, '#0d1419');
  line(ctx, course.nodes, width + 10, course.light);
  line(ctx, course.nodes, width + 10, course.border, [19, 19]);
  line(ctx, course.nodes, width, course.road);
  line(ctx, course.nodes, width * .77, '#00000010');
  line(ctx, course.nodes, 1.5, '#ddecdd63', [20, 30]);
  for (let i=0;i<16500;i++) {
    const x = rand()*bound*2-bound, y = rand()*bound*2-bound;
    ctx.fillStyle = i % 3 === 0 ? '#ffffff13' : '#00000013';
    ctx.fillRect(x, y, i%4 ? 1 : 2, i%5 ? 1 : 2);
  }
  for (let s=180;s<course.length;s+=125) {
    const side = Math.sin(s) > 0 ? 1 : -1;
    const p = pointAt(course, s, side * (course.width + 19));
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle);
    ctx.fillStyle = '#0c1117'; ctx.fillRect(-16,-5,32,10);
    ctx.fillStyle = course.border; ctx.fillRect(-12,-2,24,4);
    ctx.restore();
  }
  const start = pointAt(course,0);
  ctx.save(); ctx.translate(start.x,start.y); ctx.rotate(start.angle);
  const tile = width / 14;
  for (let col=0;col<2;col++) for (let row=0;row<14;row++) {
    ctx.fillStyle = (col+row)%2 ? '#eff3e4' : '#10191c';
    ctx.fillRect(-tile + col*tile,-course.width + row*tile,tile,tile);
  }
  for (const off of [-39,39]) for (const s of [-27,-56,-85]) {
    ctx.strokeStyle = '#f1fff05c';
    ctx.lineWidth = 2;
    ctx.strokeRect(s-8,off-12,17,24);
  }
  ctx.restore();
  return { surface, bound };
}

function drawProp(ctx, course, obj, tick) {
  const p = pointAt(course,obj.s,obj.offset);
  const prop = PROPS[obj.kind];
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle);
  if (obj.kind === 'oil') {
    ctx.fillStyle = '#10091ccc';
    ctx.beginPath(); ctx.ellipse(0,0,19,23,.36,0,2*Math.PI); ctx.fill();
    ctx.strokeStyle = '#b36ffc96';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0,0,13,16,.36,0,4.5); ctx.stroke();
  } else if (prop.damage) {
    const count = obj.kind === 'stack' ? 3 : obj.kind === 'barrier' ? 4 : 1;
    for (let i=0; i<count; i++) {
      const y = (i - (count-1)/2) * (count === 4 ? 14 : 12);
      const x = obj.kind === 'stack' ? (i===1 ? 5 : -4) : 0;
      ctx.fillStyle = '#0006'; ctx.fillRect(x-8,y-7,22,19);
      ctx.fillStyle = obj.kind === 'barrier' ? (i%2 ? '#fa7d52' : '#efc684') : prop.color;
      ctx.fillRect(x-9,y-7,18,15);
      ctx.strokeStyle = '#50291d'; ctx.lineWidth = 1.7;
      ctx.strokeRect(x-8,y-6,16,13);
      ctx.beginPath(); ctx.moveTo(x-7,y+5); ctx.lineTo(x+7,y-5); ctx.stroke();
    }
  } else if (obj.kind === 'pad' || obj.kind === 'ramp') {
    ctx.fillStyle = obj.kind === 'pad' ? '#283b24' : '#533817';
    ctx.fillRect(-18,-21,36,42);
    ctx.strokeStyle = prop.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-18,-21,36,42);
    for(let i=-11;i<=11;i+=11) {
      ctx.beginPath(); ctx.moveTo(i-5,-13); ctx.lineTo(i+3,0); ctx.lineTo(i-5,13); ctx.stroke();
    }
  } else {
    ctx.rotate(-p.angle);
    const b = Math.sin(tick/13 + obj.s) * 2;
    ctx.translate(0,b);
    ctx.fillStyle = prop.color + '35';
    ctx.beginPath(); ctx.arc(0,0,16,0,2*Math.PI); ctx.fill();
    ctx.strokeStyle = prop.color;
    ctx.lineWidth = 3;
    if (obj.kind === 'ring') {
      ctx.beginPath(); ctx.arc(0,0,13,0,2*Math.PI); ctx.stroke();
      ctx.globalAlpha = .6; ctx.beginPath(); ctx.arc(0,0,17,0,2*Math.PI); ctx.stroke();
    } else {
      ctx.fillStyle = '#0b1721';
      ctx.beginPath(); ctx.roundRect(-9,-10,18,20,4); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#f4ffe6'; ctx.lineWidth = 2.3;
      ctx.beginPath();
      if (obj.kind === 'repair') {
        ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.moveTo(0,-5); ctx.lineTo(0,5);
      } else if (obj.kind === 'shield') {
        ctx.moveTo(-4,-4);ctx.lineTo(4,-4);ctx.lineTo(3,2);ctx.lineTo(0,5);ctx.lineTo(-3,2);ctx.closePath();
      } else {
        ctx.moveTo(2,-6);ctx.lineTo(-3,1);ctx.lineTo(3,0);ctx.lineTo(-1,6);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRacer(ctx, p, racer, options = {}) {
  const { scale = 1, yaw = 0, air = 0, active = false, hit = false, marker = false, powered = false, shield = false, smoke = false } = options;
  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(p.angle + Math.PI/2 + yaw);
  ctx.scale(scale,scale);
  const img = sprites.get(racer.id);
  const w = racer.width;
  const h = img.naturalWidth ? Math.min(w*1.9,w*img.naturalHeight/img.naturalWidth) : w*1.35;
  const spriteW = img.naturalHeight ? Math.min(w,h*img.naturalWidth/img.naturalHeight) : w;
  ctx.fillStyle = '#0008';
  ctx.beginPath();ctx.ellipse(3+air*9,3+air*9,w*.63,h*.53,0,0,2*Math.PI);ctx.fill();
  if (powered || active) {
    ctx.strokeStyle = active ? racer.color : '#dfff5a';
    ctx.fillStyle = ctx.strokeStyle + '35';
    ctx.lineWidth = 2;
    ctx.beginPath();ctx.ellipse(0,0,w*.68,h*.6,0,0,2*Math.PI);ctx.fill();ctx.stroke();
  }
  if (powered) {
    const flame = ctx.createLinearGradient(0,h/2-4,0,h/2+26);
    flame.addColorStop(0,'#fcffc5');flame.addColorStop(.35,'#bcfa48');flame.addColorStop(1,'#c9fb4000');
    ctx.fillStyle = flame;
    for (const x of [-w*.23,w*.23]) {
      ctx.beginPath();ctx.moveTo(x-5,h/2-5);ctx.lineTo(x+2,h/2+26);ctx.lineTo(x+5,h/2-5);ctx.fill();
    }
  }
  if (smoke) { ctx.fillStyle = '#979b9966';ctx.beginPath();ctx.arc(4,h*.62,10,0,2*Math.PI);ctx.fill(); }
  if (hit) ctx.globalAlpha = .55;
  if (img.complete && img.naturalWidth) ctx.drawImage(img,-spriteW/2,-h/2-air*3,spriteW,h);
  else { ctx.fillStyle = racer.color; ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,7);ctx.fill(); }
  ctx.globalAlpha = 1;
  if (shield) { ctx.strokeStyle = '#88deff';ctx.lineWidth = 2;ctx.beginPath();ctx.ellipse(0,0,w*.65,h*.59,0,0,2*Math.PI);ctx.stroke(); }
  if (marker) {
    ctx.fillStyle = '#efff92';
    ctx.beginPath();ctx.moveTo(-5,-h/2-13);ctx.lineTo(5,-h/2-13);ctx.lineTo(0,-h/2-6);ctx.fill();
  }
  ctx.restore();
}

export class RaceView {
  constructor(canvas, minimap, race) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.minimap = minimap;
    this.race = race;
    this.scenery = buildSurface(race.circuit);
    this.camera = pointAt(race.circuit,0).angle;
    this.particles = [];
    this.shake = 0;
    this.drawCount = 0;
  }

  react(event, reduced) {
    if (reduced || (!['smash','hit','oil','special'].includes(event.type))) return;
    const r = this.race;
    const p = event.object ? pointAt(r.circuit,event.object.s,event.object.offset) : pointAt(r.circuit,r.distance,r.offset);
    const count = event.type === 'smash' ? 18 : 12;
    const tint = event.object ? PROPS[event.object.kind].color : r.racer.color;
    for (let i=0;i<count;i++) {
      const a = Math.random() * 2 * Math.PI, speed = 28 + Math.random()*105;
      this.particles.push({ x:p.x,y:p.y,dx:Math.cos(a)*speed,dy:Math.sin(a)*speed,t:.25+Math.random()*.55,c:tint,w:2+Math.random()*5 });
    }
    if (event.type === 'smash' || event.type === 'hit') this.shake = event.type === 'hit' ? 5 : 3;
  }

  draw(reduced, delta) {
    const { canvas, ctx, race: r, scenery } = this;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const scaledW = Math.round(W*dpr), scaledH = Math.round(H*dpr);
    if (canvas.width !== scaledW || canvas.height !== scaledH) { canvas.width = scaledW; canvas.height = scaledH; }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle = r.circuit.ground; ctx.fillRect(0,0,W,H);
    const p = pointAt(r.circuit,r.distance,r.offset);
    const heading = pointAt(r.circuit,r.distance+12).angle;
    this.camera += Math.atan2(Math.sin(heading-this.camera),Math.cos(heading-this.camera)) * Math.min(1,delta*8);
    const zoom = clamp(Math.min(H/480, W/380), .56, 2.1) * (reduced ? 1 : 1 - Math.max(0,r.speed-175)*.00058);
    this.shake = reduced ? 0 : Math.max(0,this.shake - delta*17);
    ctx.save();
    ctx.translate(W/2 + this.shake*Math.sin(r.tick*1.9),H*(W < 560 ? .57 : .64));
    ctx.scale(zoom,zoom);
    ctx.rotate(-this.camera-Math.PI/2);
    ctx.translate(-p.x,-p.y);
    ctx.drawImage(scenery.surface,-scenery.bound,-scenery.bound);
    const lap = Math.min(r.circuit.laps-1,Math.floor(r.distance/r.circuit.length));
    const round = r.distance % r.circuit.length;
    for (const o of r.objects) {
      const far = Math.abs(o.s - round);
      if (Math.min(far,r.circuit.length-far) > 720) continue;
      const visibleLap = round > r.circuit.length-650 && o.s < 650 ? lap+1 : lap;
      if (o.used < visibleLap && visibleLap < r.circuit.laps) drawProp(ctx,r.circuit,o,reduced ? 0 : r.tick);
    }
    for (const v of r.rivals) {
      if (Math.abs(v.distance-r.distance) > 640) continue;
      drawRacer(ctx,pointAt(r.circuit,v.distance,v.offset),v.racer,{ hit:v.hit>0 && r.tick%8 < 4 });
    }
    if (r.shot > 0) {
      const s = pointAt(r.circuit,r.distance+(1-r.shot/.28)*105+12,r.offset);
      ctx.fillStyle = r.racer.color;
      ctx.beginPath();ctx.ellipse(s.x,s.y,9,3,s.angle,0,2*Math.PI);ctx.fill();
    }
    const air = r.air > 0 ? Math.min(1,r.air*3.6) : 0;
    drawRacer(ctx,p,r.racer,{
      scale: 1.08 + air*.22, yaw: clamp(r.side/190,-.56,.56), air, marker:true, active:r.specialTime>0,
      hit: !reduced && r.hit > 0 && r.tick%6 < 3, powered:r.nitroFiring || r.turbo>0, shield:r.shield>0,
      smoke:r.hp<38 || r.recover>0,
    });
    for (const particle of this.particles) {
      particle.x += particle.dx*delta;
      particle.y += particle.dy*delta;
      particle.t -= delta;
      ctx.globalAlpha = clamp(particle.t*2.8,0,1);
      ctx.fillStyle = particle.c;
      ctx.fillRect(particle.x,particle.y,particle.w*1.5,particle.w);
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter(particle => particle.t > 0);
    ctx.restore();
    const vignette = ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.28,W/2,H/2,Math.max(W,H)*.69);
    vignette.addColorStop(0,'transparent');
    vignette.addColorStop(1,'#0008');
    ctx.fillStyle = vignette;ctx.fillRect(0,0,W,H);
    if ((this.drawCount++ % 4) === 0) drawMap(this.minimap,r.circuit,r);
  }
}
