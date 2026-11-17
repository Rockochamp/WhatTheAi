import { RACERS, PROPS, pointAt, clamp, mix } from './sim.js?v=2';

export const spriteURL = id => new URL('./art/' + id + '.webp', import.meta.url).href;
const sprites = new Map(RACERS.map(racer => {
  const image = new Image();
  image.src = spriteURL(racer.id);
  return [racer.id, image];
}));
const surfaceLight = {
  workshop: ['#efb967', '#32717d'],
  quarry: ['#ed7639', '#ac623d'],
  neon: ['#368fec', '#ef4fbf'],
  overdrive: ['#a57bff', '#47dbdc'],
};
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

function trackLighting(ctx, course, rand) {
  const colors = surfaceLight[course.id];
  for (let s = 14, index = 0; s < course.length; s += 122 + rand()*58, index++) {
    const direction = index % 2 ? -1 : 1;
    const p = pointAt(course,s,direction*(course.width+15));
    const color = colors[index % 3 === 1 ? 1 : 0];
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(p.angle);
    ctx.scale(1.16,.79);
    const glow = ctx.createRadialGradient(0,0,2,0,0,100);
    glow.addColorStop(0,color+'54');
    glow.addColorStop(.2,color+'31');
    glow.addColorStop(1,color+'00');
    ctx.fillStyle = glow;
    ctx.fillRect(-100,-100,200,200);
    ctx.fillStyle = '#10131a';
    ctx.fillRect(-15,-6,30,12);
    ctx.fillStyle = color;
    ctx.fillRect(-11,-3,22,6);
    ctx.fillStyle = '#ffffdea8';
    ctx.fillRect(-9,-1,18,2);
    ctx.restore();
  }
}

function paintTrackMarks(ctx,course,rand) {
  for (let s = 75; s < course.length; s += 58 + rand()*66) {
    const direction = rand() > .5 ? 1 : -1;
    const p = pointAt(course,s,direction*(course.width-24-rand()*24));
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(p.angle + direction*.08);
    ctx.beginPath();
    ctx.strokeStyle = course.id === 'quarry' ? '#1f120928' : '#02050a49';
    ctx.lineWidth = 2;
    for (const y of [-9,9]) {
      ctx.moveTo(-26,y-5);
      ctx.quadraticCurveTo(2,y+4,32,y);
    }
    ctx.stroke();
    ctx.restore();
  }
  for (let s = 85; s < course.length; s += 87) {
    for (const side of [-1,1]) {
      const p = pointAt(course,s,side*(course.width+8));
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#0b1319';
      ctx.fillRect(-13,-3.6,26,7.2);
      ctx.fillStyle = course.border;
      ctx.fillRect(-9,-1.3,18,2.6);
      ctx.restore();
    }
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
  line(ctx, course.nodes, width + 58, '#0005');
  line(ctx, course.nodes, width + 37, course.border+'26');
  line(ctx, course.nodes, width + 29, '#11151c');
  line(ctx, course.nodes, width + 17, '#0d1419');
  line(ctx, course.nodes, width + 10, course.light);
  line(ctx, course.nodes, width + 10, course.border, [19, 19]);
  line(ctx, course.nodes, width, course.road);
  line(ctx, course.nodes, width * .91, '#0003');
  line(ctx, course.nodes, width * .87, course.road);
  line(ctx, course.nodes, width * .48, '#ffffff06');
  line(ctx, course.nodes, 1.5, '#ddecdd68', [16, 23]);
  paintTrackMarks(ctx,course,rand);
  trackLighting(ctx,course,rand);
  for (let i=0;i<16500;i++) {
    const x = rand()*bound*2-bound, y = rand()*bound*2-bound;
    ctx.fillStyle = i % 3 === 0 ? '#ffffff13' : '#00000013';
    ctx.fillRect(x, y, i%4 ? 1 : 2, i%5 ? 1 : 2);
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
    ctx.fillStyle = '#0b151a';
    ctx.beginPath(); ctx.roundRect(-21,-25,42,50,4); ctx.fill();
    ctx.fillStyle = prop.color + '44';
    ctx.fillRect(-18,-21,36,42);
    ctx.strokeStyle = prop.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-18,-21,36,42);
    for(let i=-11;i<=11;i+=11) {
      ctx.globalAlpha = .68 + .32*Math.sin(tick*.15-i*.2)**2;
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
  const { scale = 1, yaw = 0, air = 0, active = false, hit = false, marker = false, powered = false, shield = false } = options;
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
  if (marker) {
    ctx.strokeStyle = racer.color+'bc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0,0,w*.65,h*.57,0,0,2*Math.PI);
    ctx.stroke();
  }
  if (hit) ctx.globalAlpha = .67;
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

function wrappedAngle(from,to) {
  return Math.atan2(Math.sin(to-from),Math.cos(to-from));
}

function racingPose(course,s,offset) {
  const p = pointAt(course,s,offset);
  const fore = pointAt(course,s+9);
  const aft = pointAt(course,s-9);
  p.angle = Math.atan2(fore.y-aft.y,fore.x-aft.x);
  return p;
}

function animateEffects(ctx,particles,waves,delta) {
  for (const fx of waves) {
    fx.age += delta;
    const progress = clamp(fx.age/fx.life,0,1);
    const radius = 7 + fx.radius*(1-(1-progress)**2);
    if (progress >= 1) continue;
    ctx.save();
    ctx.globalAlpha = (1-progress)*.78;
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 1 + (1-progress)*4;
    ctx.beginPath();ctx.arc(fx.x,fx.y,radius,0,2*Math.PI);ctx.stroke();
    if (fx.double) {
      ctx.strokeStyle = '#fff5ca';
      ctx.lineWidth = 2;
      ctx.beginPath();ctx.arc(fx.x,fx.y,radius*.84,0,2*Math.PI);ctx.stroke();
    }
    ctx.restore();
  }
  for (const f of particles) {
    f.age += delta;
    const progress = clamp(f.age/f.life,0,1);
    if (progress >= 1) continue;
    f.x += f.dx*delta;
    f.y += f.dy*delta;
    ctx.globalAlpha = (1-progress)**1.35;
    ctx.fillStyle = f.color;
    if (f.kind === 'plank') {
      ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle+progress*f.spin);
      ctx.fillRect(-f.size,-f.size*.42,f.size*2,f.size*.84);
      ctx.restore();
    } else if (f.kind === 'spark') {
      ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x-f.dx*.046,f.y-f.dy*.046);
      ctx.strokeStyle = f.color;ctx.lineWidth = 1.3;ctx.stroke();
    } else {
      ctx.beginPath();ctx.arc(f.x,f.y,f.size*(.5+progress),0,2*Math.PI);ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function speedLines(ctx,w,h,energy,tick) {
  ctx.save();
  const x = w*.5, y = h*.35;
  ctx.lineWidth = 1.4;
  for (let i=0;i<19;i++) {
    const angle = i*2.39996;
    const age = (tick*.045 + i*.618)%1;
    const radius = .23+age*.35;
    const scale = .09+age*.19;
    const dx = Math.cos(angle)*w, dy = Math.sin(angle)*h;
    ctx.globalAlpha = energy*age*.6;
    ctx.strokeStyle = i%3 ? '#d5fd94' : '#fff';
    ctx.beginPath();ctx.moveTo(x+dx*radius,y+dy*radius);
    ctx.lineTo(x+dx*(radius+scale),y+dy*(radius+scale));ctx.stroke();
  }
  ctx.restore();
}

let lastSurface;
export class RaceView {
  constructor(canvas, minimap, race) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.minimap = minimap;
    this.race = race;
    if (lastSurface?.course !== race.circuit) lastSurface = { course:race.circuit, ...buildSurface(race.circuit) };
    this.scenery = lastSurface;
    this.camera = racingPose(race.circuit,0,0).angle;
    this.cameraOffset = 0;
    this.zoom = 1;
    this.particles = [];
    this.waves = [];
    this.skids = [];
    this.shake = 0;
    this.flash = 0;
    this.drawCount = 0;
    this.trailAt = 0;
    this.tickVisual = 0;
    this.remember();
  }

  remember() {
    const r = this.race;
    this.previous = { distance:r.distance, offset:r.offset, side:r.side, rivals:r.rivals.map(v => [v.distance,v.offset]) };
  }

  scatter(p,count,kind,color,speed,life) {
    for (let i=0;i<count;i++) {
      const angle = Math.random()*Math.PI*2;
      const velocity = speed*(.23+.77*Math.random());
      this.particles.push({
        x:p.x,y:p.y,dx:Math.cos(angle)*velocity,dy:Math.sin(angle)*velocity,angle,
        spin:Math.random()*9-4.5,kind,color,size:2+Math.random()*5,age:0,life:life*(.56+.44*Math.random()),
      });
    }
    if (this.particles.length > 230) this.particles.splice(0,this.particles.length-230);
  }

  react(event, reduced) {
    const { race:r } = this;
    const { type, object } = event;
    const p = object ? pointAt(r.circuit,object.s,object.offset) : pointAt(r.circuit,event.distance ?? r.distance,event.offset ?? r.offset);
    if (type === 'punch' || type === 'smash' || type === 'pickup' || type === 'special') {
      const color = type === 'punch' ? '#ff523c' : object ? PROPS[object.kind].color : r.racer.color;
      this.waves.push({ ...p,color,age:0,life:type==='punch' ? .57 : .4,radius:event.radius ?? (type==='special' ? 59 : 26),double:type==='punch' && !reduced });
    }
    if (reduced) return;
    if (type === 'smash') {
      this.scatter(p,9,'plank',PROPS[object.kind].color,112,.64);
      this.scatter(p,15,'spark','#ffe08a',182,.42);
      this.shake = Math.max(this.shake,3+Math.min(3,event.combo));
    }
    if (type === 'punch' || type === 'hit') {
      this.scatter(p,22,'spark',type === 'punch' ? '#ffd491' : '#ff916a',192,.48);
      this.shake = Math.max(this.shake,type === 'punch' ? 9 : 6);
      this.flash = Math.max(this.flash,type === 'hit' ? .48 : .28);
    }
    if (type === 'boost' || type === 'oil') this.scatter(p,14,'dust',type === 'boost' ? '#c8ff8a66' : '#b29ad96e',92,.50);
  }

  draw(reduced, delta, interpolation = 1) {
    const { canvas, ctx, race:r, scenery, previous } = this;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(devicePixelRatio || 1,Math.sqrt(3400000/(W*H)),2);
    const scaledW = Math.round(W*dpr), scaledH = Math.round(H*dpr);
    if (canvas.width !== scaledW || canvas.height !== scaledH) { canvas.width = scaledW; canvas.height = scaledH; }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle = r.circuit.ground;ctx.fillRect(0,0,W,H);
    const distance = mix(previous.distance,r.distance,interpolation);
    const offset = mix(previous.offset,r.offset,interpolation);
    const side = mix(previous.side,r.side,interpolation);
    const p = racingPose(r.circuit,distance,offset);
    const ahead = racingPose(r.circuit,distance+23,0);
    this.camera += wrappedAngle(this.camera,ahead.angle)*(1-Math.exp(-delta*7));
    this.cameraOffset = mix(this.cameraOffset,reduced ? offset : offset*.74,1-Math.exp(-delta*8));
    const origin = pointAt(r.circuit,distance,this.cameraOffset);
    const powered = r.nitroFiring || r.turbo > 0;
    const targetZoom = reduced ? 1 : 1 - Math.max(0,r.speed-170)*.00057 - (powered ? .048 : 0);
    this.zoom = mix(this.zoom,targetZoom,1-Math.exp(-delta*9));
    const zoom = clamp(Math.min(H/490,W/380),.51,2.05)*this.zoom;
    this.tickVisual += delta*60;
    this.shake = reduced ? 0 : this.shake*Math.exp(-delta*8.5);
    this.flash = reduced ? 0 : Math.max(0,this.flash-delta*2.9);
    ctx.save();
    ctx.translate(W/2+this.shake*Math.sin(this.tickVisual*1.6), H*(W < 560 ? .56 : .63)+this.shake*Math.cos(this.tickVisual*1.1)*.62);
    ctx.scale(zoom,zoom);
    ctx.rotate(-this.camera-Math.PI/2);
    ctx.translate(-origin.x,-origin.y);
    ctx.drawImage(scenery.surface,-scenery.bound,-scenery.bound);
    const lap = Math.min(r.circuit.laps-1,Math.floor(r.distance/r.circuit.length));
    const round = r.distance % r.circuit.length;
    for (const o of r.objects) {
      const far = Math.abs(o.s-round);
      if (Math.min(far,r.circuit.length-far) > 720) continue;
      const visibleLap = round > r.circuit.length-650 && o.s < 650 ? lap+1 : lap;
      if (o.used < visibleLap && visibleLap < r.circuit.laps) drawProp(ctx,r.circuit,o,reduced ? 0 : this.tickVisual);
    }
    if (!reduced) {
      for (const skid of this.skids) {
        ctx.save();ctx.translate(skid.x,skid.y);ctx.rotate(skid.angle);
        ctx.strokeStyle = 'rgba(7,8,11,' + Math.max(0, .54 - (r.tick-skid.tick)/720) + ')';
        ctx.lineCap = 'round';ctx.lineWidth = 2.7;
        ctx.beginPath();
        for (const side of [-1,1]) {
          ctx.moveTo(-9,side*skid.width);
          ctx.lineTo(7,side*skid.width);
        }
        ctx.stroke();ctx.restore();
      }
      this.skids = this.skids.filter(skid => r.tick-skid.tick < 390);
    }
    for (let i=0;i<r.rivals.length;i++) {
      const v = r.rivals[i];
      if (Math.abs(v.distance-r.distance) > 640) continue;
      const [lastDistance,lastOffset] = previous.rivals[i];
      drawRacer(ctx,racingPose(r.circuit,mix(lastDistance,v.distance,interpolation),mix(lastOffset,v.offset,interpolation)),v.racer,
        { hit:!reduced && v.hit>.75 });
    }
    if (r.shot > 0) {
      const shot = pointAt(r.circuit,distance+(1-r.shot/.28)*105+12,offset);
      ctx.fillStyle = r.racer.color;
      ctx.beginPath();ctx.ellipse(shot.x,shot.y,12,3,shot.angle,0,2*Math.PI);ctx.fill();
    }
    if (!reduced && r.tick > this.trailAt && (r.drifting || powered || r.hp<38)) {
      this.trailAt = r.tick + 2;
      const tail = pointAt(r.circuit,distance-19,offset);
      this.scatter(tail,2,powered ? 'spark' : 'dust',powered ? '#ddff9f' : '#9dabac7a',powered ? 63 : 39,.36);
      if (r.drifting && this.skids.length < 132) {
        this.skids.push({ ...tail,angle:p.angle+side/240,tick:r.tick,width:r.racer.width*.33 });
      }
    }
    animateEffects(ctx,this.particles,this.waves,delta);
    const air = r.air > 0 ? Math.min(1,r.air*3.6) : 0;
    drawRacer(ctx,p,r.racer,{
      scale:1.1+air*.25,yaw:clamp(side/(r.drifting ? 151 : 212),-.66,.66),air,marker:true,active:r.specialTime>0,
      hit:!reduced && r.hit > .32,powered,shield:r.shield>0,
    });
    this.particles = this.particles.filter(f => f.age<f.life);
    this.waves = this.waves.filter(f => f.age<f.life);
    ctx.restore();
    if (!reduced && powered) speedLines(ctx,W,H,clamp((r.speed-158)/211,.15,.62),this.tickVisual);
    const vignette = ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.33,W/2,H/2,Math.max(W,H)*.7);
    vignette.addColorStop(0,'transparent');
    vignette.addColorStop(1,this.flash > 0 ? 'rgba(255,64,45,'+(this.flash+.16)+')' : '#0009');
    ctx.fillStyle = vignette;ctx.fillRect(0,0,W,H);
    if (this.drawCount++%5 === 0) drawMap(this.minimap,r.circuit,r);
  }
}
