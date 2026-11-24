import { DRIVERS, RAIL, clamp } from './sim.js';

const art = new Map();
function image(path) {
  if (!art.has(path)) {
    const img = new Image(); img.src = new URL(path,import.meta.url).href; art.set(path,img);
  }
  return art.get(path);
}
const props = { crate:64, bumper:72, gem:27, key:40, vault:98, pad:83 };
const ready = img => img && img.complete && img.naturalWidth>0;
for (const d of DRIVERS) image(d.art);
for (const item of ['crate','bumper','gem','vault']) image('art/'+item+'.webp');
const rgb = (hex,alpha) => hex+Math.round(clamp(alpha,0,1)*255).toString(16).padStart(2,'0');
const noise = i => { const n=Math.sin(i*127.1+311.7)*43758.5453; return n-Math.floor(n); };

export class Display {
  constructor(canvas) {
    this.canvas=canvas; this.g=canvas.getContext('2d',{alpha:false});
    this.effects=[]; this.shake=0;
  }
  resize() {
    const {width,height}=this.canvas.getBoundingClientRect();
    this.w=Math.max(1,width); this.h=Math.max(1,height);
    const dpr=Math.min(2,window.devicePixelRatio||1);
    this.canvas.width=Math.round(this.w*dpr); this.canvas.height=Math.round(this.h*dpr);
    this.g.setTransform(dpr,0,0,dpr,0,0);
    this.base=Math.min(this.w/468,this.h/505);
  }
  project(x,s) {
    const { race:r,w,h,base }=this, d=Math.max(-290,s-r.s), depth=610/(610+d);
    const k=base*Math.pow(depth,.87);
    const phase=r.table.seed*.09, bend=v=>.72*Math.sin(v/1350+phase)+.28*Math.sin(v/570+phase);
    const center=w*.5+(bend(s)-bend(r.s))*Math.min(w*.25,200)*(1-Math.min(1,depth));
    return {x:center+x*k,y:h*(.755-.815*(1-depth)),k};
  }
  poly(points,fill,stroke,width=1) {
    const g=this.g;
    g.beginPath(); points.forEach(([x,y],i)=>i ? g.lineTo(x,y) : g.moveTo(x,y)); g.closePath();
    if(fill){g.fillStyle=fill;g.fill();} if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}
  }
  band(left,right,s,end,color) {
    const a=this.project(left,s), b=this.project(right,s), c=this.project(right,end), d=this.project(left,end);
    this.poly([[a.x,a.y],[b.x,b.y],[c.x,c.y],[d.x,d.y]],color);
  }
  stage(r) {
    const {g,w,h}=this, t=r.table, scenic=image('art/'+t.id+'.webp');
    g.fillStyle=t.dark; g.fillRect(-5,-5,w+10,h+10);
    if (ready(scenic)) {
      const ih=Math.max(h*.87,w*scenic.naturalHeight/scenic.naturalWidth), iw=ih*scenic.naturalWidth/scenic.naturalHeight;
      g.globalAlpha=.76;g.drawImage(scenic,(w-iw)/2,-h*.03,iw,ih);g.globalAlpha=1;
    }
    const fog=g.createLinearGradient(0,0,0,h); fog.addColorStop(0,'#0e071a11');fog.addColorStop(.42,rgb(t.dark,.47));fog.addColorStop(.93,t.dark);
    g.fillStyle=fog;g.fillRect(-5,-5,w+10,h+10);
    const first=Math.floor((r.s-265)/110),last=Math.ceil((r.s+2900)/110);
    for(let i=last;i>=first;i--) {
      const s=i*110,end=s+110;
      this.band(-226,226,s,end,i%2 ? t.dark : '#1b1724');
      this.band(-209,209,s,end,t.floor);
      for (const side of [-1,1]) {
        this.band(side*164,side*191,s,end,'#08071532');
        this.band(side*170,side*172,s,end,rgb(t.color,.19));
        this.band(side*210,side*214,s,end,'#ddd4e3');
        if(i%4===0)this.band(side*120,side*157,s+18,s+24,rgb(t.color,.14));
      }
      for(const side of [-1,1]) {
        this.band(side*192,side*199,s,end,i%4===0 ? '#fcdf78' : t.rail);
        this.band(side*202,side*209,s,end,i%2 ? '#322b4b' : '#ded6d6');
        if(i%2===0) this.band(side*183,side*186,s+8,s+74,rgb(t.color,.48));
        if(i%3===0) {
          const p=this.project(side*217,s+35);g.fillStyle=t.color;
          g.beginPath();g.arc(p.x,p.y,Math.max(.9,3.2*p.k),0,Math.PI*2);g.fill();
        }
        if(i%2===0) this.band(side*62,side*64,s+11,s+67,'#ffffff27');
      }
      this.band(-190,190,s,s+1.5,'#ffffff15');
      if(i%7===0) {
        const p=this.project(0,s);g.save();g.translate(p.x,p.y);g.scale(p.k,p.k*.72);
        g.strokeStyle='#ffffff19';g.lineWidth=3;
        for (const x of [-34,0,34]) {g.beginPath();g.moveTo(x-10,7);g.lineTo(x,-3);g.lineTo(x+10,7);g.stroke();}
        g.restore();
      }
      if(i%2===0) this.scenery(i,s,t);
    }
    for(const finish of [100,r.table.length]) {
      if(finish<r.s-220 || finish>r.s+2100) continue;
      for(let row=0;row<2;row++) for(let col=0;col<18;col++) this.band(-190+col*21.1,-190+(col+1)*21.1,finish+row*16,finish+(row+1)*16,(col+row)%2 ? '#ebe9df' : '#222033');
    }
  }
  scenery(i,s,t) {
    const side=i%4 ? -1 : 1, p=this.project(side*(245+noise(i+23)*78),s), g=this.g;
    const height=(22+noise(i+38)*53)*p.k;
    g.save();g.translate(p.x,p.y);
    if(t.id==='pier') {
      g.fillStyle='#3b1b20';g.fillRect(-2*p.k,-height,4*p.k,height);
      g.fillStyle=t.color;g.beginPath();g.arc(0,-height,6*p.k,0,7);g.fill();
      g.strokeStyle=rgb(t.color,.22);g.lineWidth=3*p.k;g.beginPath();g.arc(0,-height,11*p.k,0,7);g.stroke();
    } else {
      const half=height*.23;
      this.poly([[-half,0],[-half*.88,-height*.55],[0,-height],[half,-height*.48],[half*.8,0]],rgb(t.rail,.7));
      this.poly([[0,-height],[half,-height*.48],[half*.8,0],[1,0]],rgb('#ffffff',.31));
    }
    g.restore();
  }
  stamp(path,p,width,rotation=0) {
    const img=image(path),g=this.g,W=p.k*width;
    g.save();g.translate(p.x,p.y);g.rotate(rotation);
    if(ready(img)) {
      const H=W*img.naturalHeight/img.naturalWidth;
      g.fillStyle='#08061280';g.beginPath();g.ellipse(1,H*.24,W*.48,H*.28,0,0,7);g.fill();
      g.drawImage(img,-W/2,-H*.57,W,H);
    } else {
      this.poly([[0,-W*.5],[W*.44,0],[0,W*.4],[-W*.44,0]],'#d4aaff','#fff');
    }
    g.restore();
  }
  prop(o,r) {
    const p=this.project(o.x,o.s),g=this.g;
    if(o.kind==='pad') {
      g.save();g.translate(p.x,p.y);g.scale(p.k,p.k*.85);
      this.poly([[-38,22],[-32,-20],[32,-20],[38,22]],'#165d5b','#6effce',2);
      for (const y of [-5,9]) this.poly([[-22,y],[0,y-12],[22,y],[22,y+6],[0,y-5],[-22,y+6]],'#b2ffe1');
      g.restore();return;
    }
    if(o.kind==='key') {
      const size=props.key*p.k;
      g.save();g.translate(p.x,p.y);g.rotate(-.55);g.lineWidth=Math.max(1.6,size*.13);g.strokeStyle='#ffd35b';g.fillStyle='#fff0a6';
      g.beginPath();g.arc(0,-size*.25,size*.23,0,7);g.stroke();
      g.fillRect(-size*.07,-size*.06,size*.14,size*.62);g.fillRect(0,size*.27,size*.23,size*.1);g.fillRect(0,size*.45,size*.25,size*.1);
      g.restore();return;
    }
    if(o.kind==='bumper' && o.done) g.globalAlpha=.65;
    this.stamp('art/'+o.kind+'.webp',p,props[o.kind],o.kind==='gem' ? .12*Math.sin(r.time*3+o.s) : 0);
    g.globalAlpha=1;
    if(o.kind==='vault' && r.keys===3) {
      g.strokeStyle='#ffe36f';g.lineWidth=3*p.k;g.beginPath();g.ellipse(p.x,p.y,60*p.k,38*p.k,0,0,7);g.stroke();
    }
  }
  react(r,e,reduced) {
    if(e.kind==='finish') return;
    const big=['fork','slam','jackpot','power','bumper','bank'].includes(e.kind);
    this.effects.push({...e,age:0,life:e.kind==='fork' ? .44 : big ? .56 : .34,seed:r.time*300});
    if(big && !reduced) this.shake=Math.max(this.shake,e.kind==='jackpot' ? 7 : 3);
    if(this.effects.length>70) this.effects.shift();
  }
  effect(e,reduced) {
    const g=this.g,p=this.project(e.x,e.s), k=e.age/e.life;
    g.save();g.globalAlpha=Math.max(0,1-k);
    const color=({fork:'#d7a7ff',slam:'#ff8270',power:this.race.driver.color,gem:'#e79bff',key:'#ffdf57',jackpot:'#ffe77f',bank:'#e5ff79',bumper:'#b6ff77'})[e.kind]||'#fff0b6';
    if(e.kind==='fork'){
      for(const dir of [-1,0,1]) {
        const len=(.45+.55*Math.min(1,k*3))*e.reach;
        for(let j=1;j<=5;j++){
          const d=len*j/5,tip=this.project(e.x+dir*d*.52,e.s+d),size=(20-j*1.8)*tip.k;
          this.poly([[tip.x-size,tip.y],[tip.x+size*.3,tip.y-size*2.4],[tip.x+size,tip.y+2]],'#a05ff2','#f6e1ff',1.3*tip.k);
        }
      }
    } else if(['slam','bank','bumper','jackpot','power','pin','pad'].includes(e.kind)) {
      g.strokeStyle=color;g.lineWidth=(reduced ? 2 : 4)*p.k;const radius=(e.reach||48)*(.25+.75*k)*p.k;
      g.beginPath();g.ellipse(p.x,p.y,radius,radius*.66,0,0,7);g.stroke();
    }
    if(!reduced) {
      const n=e.kind==='gem' ? 3 : 9;
      for(let i=0;i<n;i++){
        const a=noise(i+e.seed)*6.28, len=(12+noise(i*7+e.seed)*43)*k*p.k;
        const x=p.x+Math.cos(a)*len, y=p.y+Math.sin(a)*len-18*Math.sin(k*Math.PI)*p.k;
        g.fillStyle=i%2 ? color : '#fff1d9';g.fillRect(x,y,3.8*p.k,3.8*p.k);
      }
    }
    g.restore();
  }
  draw(r,dt,reduced,ghost) {
    this.race=r;const {g,w,h}=this;
    g.save();if(this.shake && !reduced)g.translate(Math.sin(r.time*72)*this.shake,Math.cos(r.time*55)*this.shake*.5);
    this.shake=Math.max(0,this.shake-dt*18);
    this.stage(r);
    const objects=[];
    for(let i=r.first;i<r.objects.length;i++){const o=r.objects[i];if(o.s>r.s+2200) break;if(!o.done||o.kind==='bumper')objects.push(o);}
    objects.push(...r.rivals.map(v=>({...v,kind:'rival'})),{kind:'player',s:r.s,x:r.x});
    if(ghost && ghost.s<r.table.length && Math.abs(ghost.s-r.s)>18)objects.push({...ghost,kind:'ghost'});
    objects.sort((a,b)=>b.s-a.s);
    for(const o of objects) {
      if(o.s<r.s-240 || o.s>r.s+2200)continue;
      if(o.kind==='rival'||o.kind==='ghost'||o.kind==='player'){
        const p=this.project(o.x,o.s),player=o.kind==='player',isGhost=o.kind==='ghost';
        const sprite=player||isGhost ? r.driver.art : '../sol/art/'+o.id+'.webp';
        if(isGhost)g.globalAlpha=.3;
        if(player){
          const c=r.driver.color, rad=p.k*(r.powerTime ? 48 : 34);
          g.strokeStyle=rgb(c,.83);g.lineWidth=2*p.k;g.beginPath();g.ellipse(p.x,p.y+10*p.k,rad,rad*.55,0,0,7);g.stroke();
          if(r.pin||r.rush) {
            const x=p.x-clamp(r.vx,-400,400)*.09*p.k;
            this.poly([[p.x-15*p.k,p.y+8*p.k],[x,p.y+(reduced ? 32 : 57)*p.k],[p.x+15*p.k,p.y+8*p.k]],rgb(c,.7));
          }
          if(!r.pin) {
            const dx=r.aim*22*p.k;g.strokeStyle='#efff8f';g.lineWidth=2.4*p.k;g.beginPath();g.moveTo(p.x+dx,p.y-23*p.k);g.lineTo(p.x+dx*1.6,p.y-35*p.k);g.stroke();
          }
        }
        if(player && r.driver.id==='rex' && r.powerTime>0){
          g.save();g.translate(p.x,p.y);g.scale(p.k,p.k);
          for(const sign of [-1,1]){
            g.save();g.scale(sign,1);g.strokeStyle='#7fffc5';g.lineWidth=4;
            g.beginPath();g.moveTo(26,-6);g.quadraticCurveTo(58,-37,22,-70);g.stroke();
            for(const [x,y] of [[31,-18],[39,-33],[36,-49]])this.poly([[x,y],[x-10,y-3],[x,y-7]],'#edffe8');
            g.restore();
          }
          g.restore();
        }
        let turn=player ? clamp(r.vx/1000,-.45,.45) : o.hit ? .34 : 0;
        if(player && r.time>0 && !reduced && r.driver.id==='golem'){
          const stride=Math.sin(r.time*(r.rush ? 18 : 13));
          p.y-=Math.abs(stride)*3*p.k;turn+=stride*.043;
        }
        this.stamp(sprite,p,player||isGhost ? 65 : 46,turn);
        g.globalAlpha=1;
      } else this.prop(o,r);
    }
    this.effects=this.effects.filter(e=>{e.age+=dt;if(e.age>=e.life)return false;this.effect(e,reduced);return true;});
    g.restore();
  }
}
