import { useState, useEffect, useRef, useCallback } from "react";

const GW = 480;
const GH = 220;
const PX = 75;
const PW = 22;
const PH = 18;
const GRAV = 0.48;
const INTERIOR_FLOOR_Y = GH - 20;

const UPGRADE_DATA = {
  jumpPower:  { name: "JUMP BOOST",  desc: "Leap higher between carriages", emoji: "⬆", costs: [60,150,350,800,2000], max:5 },
  speedCap:   { name: "MAX SPEED",   desc: "Higher terminal velocity",       emoji: "⚡", costs: [80,200,500,1200,3000], max:5 },
  idleRate:   { name: "IDLE INCOME", desc: "Earn credits while away",        emoji: "◆", costs: [100,300,800,2000,5000], max:5 },
  doubleJump: { name: "DOUBLE HOP",  desc: "Hop again mid-air",              emoji: "✦", costs: [500], max:1 },
  coyoteTime: { name: "EDGE GRIP",   desc: "Hop just after a carriage edge", emoji: "▸", costs: [150,400,1000], max:3 },
};

const SKINS = [
  { color:"#5dbb63", name:"FOREST" },
  { color:"#29b6f6", name:"POND" },
  { color:"#ffd93d", name:"GOLDEN" },
  { color:"#ef5350", name:"DART" },
  { color:"#ff9f1c", name:"TANGERINE" },
  { color:"#ce93d8", name:"VIOLET" },
  { color:"#e0e0e0", name:"GHOST" },
  { color:"#80cbc4", name:"JADE" },
];

const SAVE_KEY = "charlabolt_save";
function loadSave(){ try{ return JSON.parse(localStorage.getItem(SAVE_KEY)); }catch{ return null; } }
function writeSave(d){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(d)); }catch{} }

function drawHoppy(ctx, px, py, frame, color, onGround, vy) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.fillRect(px, py+5, PW, PH-5);
  ctx.fillRect(px-2, py+2, PW+4, 10);
  ctx.shadowBlur = 0;
  for (const ex of [px+3, px+PW-3]) {
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(ex,py+4,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(ex+1,py+4,2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(ex+2,py+2.5,1,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle = color;
  const lp = onGround ? frame*0.35 : 0;
  if (vy < -3) {
    ctx.fillRect(px-4,py+PH-3,8,4); ctx.fillRect(px+PW-4,py+PH-3,8,4);
  } else {
    ctx.fillRect(px+1,py+PH-1,7,4+Math.sin(lp)*3);
    ctx.fillRect(px+PW-8,py+PH-1,7,4-Math.sin(lp)*3);
  }
  ctx.restore();
}

function drawCarriageExterior(ctx, b, skinColor, frame) {
  const top = GH - b.h;
  ctx.fillStyle="#00000055"; ctx.fillRect(b.x+7,top+8,b.w,b.h);
  const bg=ctx.createLinearGradient(b.x,top,b.x,top+b.h);
  bg.addColorStop(0,"#221740"); bg.addColorStop(0.3,"#1b1233"); bg.addColorStop(1,"#100b22");
  ctx.fillStyle=bg; ctx.fillRect(b.x,top,b.w,b.h);
  // Trims
  ctx.fillStyle="#c9a84c"; ctx.fillRect(b.x,top,b.w,5);
  ctx.fillStyle="#8b6914"; ctx.fillRect(b.x,top+5,b.w,2);
  ctx.fillStyle="#c9a84c"; ctx.fillRect(b.x,top+b.h-16,b.w,3);
  ctx.fillStyle="#8b6914"; ctx.fillRect(b.x,top+b.h-13,b.w,2);
  // Side windows
  const wW=24,wH=28,wSp=36,nW=Math.floor((b.w-16)/wSp);
  for(let i=0;i<nW;i++){
    const wx=b.x+8+i*wSp, wy=top+10;
    ctx.fillStyle="#ff960033"; ctx.fillRect(wx-3,wy-3,wW+6,wH+6);
    const wg=ctx.createLinearGradient(wx,wy,wx,wy+wH);
    wg.addColorStop(0,"#ffe09066"); wg.addColorStop(1,"#ff720044");
    ctx.fillStyle=wg; ctx.fillRect(wx,wy,wW,wH);
    ctx.fillStyle="#c9a84c88"; ctx.fillRect(wx+wW/2,wy,1,wH);
    ctx.fillStyle="#c9a84c";
    ctx.fillRect(wx-1,wy-1,wW+2,2); ctx.fillRect(wx-1,wy+wH-1,wW+2,2);
    ctx.fillRect(wx-1,wy,2,wH); ctx.fillRect(wx+wW-1,wy,2,wH);
  }
  // Number plate
  ctx.fillStyle="#c9a84c"; ctx.fillRect(b.x+b.w/2-10,top+b.h-12,20,10);
  ctx.fillStyle="#100b22"; ctx.font="bold 7px 'Courier New'"; ctx.textAlign="center";
  ctx.fillText(`${(Math.abs(Math.floor(b.x/50))%99)+1}`,b.x+b.w/2,top+b.h-5);
  ctx.textAlign="left";
  // Wheels
  const wheelY=top+b.h;
  for(const wx of [b.x+18,b.x+b.w-18]){
    ctx.fillStyle="#00000055"; ctx.beginPath(); ctx.arc(wx+2,wheelY+2,11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#3a2850"; ctx.beginPath(); ctx.arc(wx,wheelY,11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#1a1030"; ctx.beginPath(); ctx.arc(wx,wheelY,8,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#4a3860"; ctx.lineWidth=1.5;
    const a0=(frame*0.14)%(Math.PI*2);
    for(let s=0;s<4;s++){const a=a0+s*(Math.PI/2);ctx.beginPath();ctx.moveTo(wx,wheelY);ctx.lineTo(wx+Math.cos(a)*7,wheelY+Math.sin(a)*7);ctx.stroke();}
    ctx.fillStyle="#c9a84c"; ctx.beginPath(); ctx.arc(wx,wheelY,2.5,0,Math.PI*2); ctx.fill();
  }
  // Couplings
  ctx.fillStyle="#666";
  ctx.fillRect(b.x+b.w,top+b.h-20,7,7);
  ctx.fillRect(b.x-7,top+b.h-20,7,7);
}

function drawSkylight(ctx, b, g, skinColor) {
  const bTop = GH - b.h;
  if (g.broken) {
    // Hole outline
    ctx.fillStyle = "#00000088";
    ctx.fillRect(g.x-10,bTop-7,20,8);
    ctx.fillStyle = "#8b6914";
    ctx.fillRect(g.x-11,bTop-7,3,7); ctx.fillRect(g.x+8,bTop-7,3,7);
  } else {
    ctx.save();
    ctx.shadowColor="#88ccff"; ctx.shadowBlur=8;
    ctx.fillStyle="#c9a84c";
    ctx.fillRect(g.x-11,bTop-7,22,2); ctx.fillRect(g.x-11,bTop-1,22,1);
    ctx.fillRect(g.x-11,bTop-7,2,7); ctx.fillRect(g.x+9,bTop-7,2,7);
    ctx.fillStyle="#99ddff55"; ctx.fillRect(g.x-9,bTop-6,18,5);
    ctx.fillStyle="#cceeffe8"; ctx.fillRect(g.x-8,bTop-5,6,1);
    ctx.restore();
  }
}

function drawInterior(ctx, b, frame, skinColor) {
  const top = GH - b.h + 7;
  const floorY = INTERIOR_FLOOR_Y;
  // Warm amber interior
  const ig = ctx.createLinearGradient(b.x,top,b.x,floorY);
  ig.addColorStop(0,"#1e0e00cc"); ig.addColorStop(0.4,"#2a1200bb"); ig.addColorStop(1,"#1a0b00aa");
  ctx.fillStyle = ig;
  ctx.fillRect(b.x, top, b.w, floorY - top);
  // Ceiling strip (gold trim visible inside)
  ctx.fillStyle = "#8b6914aa"; ctx.fillRect(b.x, top, b.w, 4);
  // Floor boards
  ctx.fillStyle = "#2a1800bb"; ctx.fillRect(b.x, floorY-6, b.w, 6);
  for(let i=0;i<8;i++){
    const fx=b.x+i*(b.w/7);
    ctx.fillStyle="#3a2000aa"; ctx.fillRect(fx,floorY-6,1,6);
  }
  // Seats
  const seatH=10, seatY=floorY-6-seatH;
  const gap=18;
  for(let i=0;i<Math.floor((b.w-30)/gap);i++){
    const sx=b.x+15+i*gap;
    ctx.fillStyle="#4a2200cc"; ctx.fillRect(sx,seatY,12,seatH);
    ctx.fillStyle="#5a2f00aa"; ctx.fillRect(sx,seatY,12,3);
  }
  // Side window interiors — moving scenery glimpse
  const wW=20,wH=22,wSp=36,nW=Math.floor((b.w-16)/wSp);
  for(let i=0;i<nW;i++){
    const wx=b.x+10+i*wSp, wy=top+4;
    ctx.fillStyle="#0a0614"; ctx.fillRect(wx,wy,wW,wH);
    // Scrolling hills glimpse
    ctx.fillStyle="#1a1030";
    ctx.beginPath(); ctx.moveTo(wx,wy+wH); ctx.quadraticCurveTo(wx+10,wy+8,wx+wW,wy+wH); ctx.fill();
    // Window frame overlay
    ctx.fillStyle="#c9a84c";
    ctx.fillRect(wx-1,wy-1,wW+2,2); ctx.fillRect(wx-1,wy+wH-1,wW+2,2);
    ctx.fillRect(wx-1,wy,2,wH); ctx.fillRect(wx+wW-1,wy,2,wH);
    // Lamp glow
    ctx.fillStyle="#ff980022";
    ctx.beginPath(); ctx.arc(wx+wW/2,wy-2,6,0,Math.PI*2); ctx.fill();
  }
  // Hanging lanterns
  for(let i=0;i<Math.floor(b.w/45);i++){
    const lx=b.x+22+i*45;
    ctx.strokeStyle="#8b6914aa"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(lx,top+4); ctx.lineTo(lx,top+12); ctx.stroke();
    ctx.fillStyle="#ffaa0066"; ctx.beginPath(); ctx.arc(lx,top+15,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#ffcc6644"; ctx.beginPath(); ctx.arc(lx,top+15,2,0,Math.PI*2); ctx.fill();
  }
  // Ambient glow
  ctx.fillStyle="#ff800006";
  ctx.fillRect(b.x,top,b.w,floorY-top);
}

function drawCarriageForeground(ctx, b) {
  const top = GH - b.h;
  // Top gold trim redrawn on top of Hoppy
  ctx.fillStyle="#c9a84c"; ctx.fillRect(b.x,top,b.w,5);
  ctx.fillStyle="#8b6914"; ctx.fillRect(b.x,top+5,b.w,2);
  // Wall panels on sides (so Hoppy appears inside)
  const panelW=8;
  ctx.fillStyle="#221740"; ctx.fillRect(b.x,top+7,panelW,GH-top-7);
  ctx.fillRect(b.x+b.w-panelW,top+7,panelW,GH-top-7);
}

export default function App() {
  const canvasRef = useRef(null);
  const gameRef   = useRef(null);
  const rafRef    = useRef(null);

  const saved = loadSave();
  const [screen,    setScreen]    = useState("menu");
  const [credits,   setCredits]   = useState(saved?.credits   ?? 50);
  const [bestScore, setBestScore] = useState(saved?.bestScore  ?? 0);
  const [upgrades,  setUpgrades]  = useState(saved?.upgrades   ?? {jumpPower:0,speedCap:0,idleRate:0,doubleJump:0,coyoteTime:0});
  const [skinIdx,   setSkinIdx]   = useState(saved?.skinIdx    ?? 0);
  const [runData,   setRunData]   = useState({score:0,coins:0,earned:0,isNewBest:false});
  const [flash,     setFlash]     = useState(null);
  const [idlePop,   setIdlePop]   = useState(0);

  const upgradesRef = useRef(upgrades);
  const skinRef     = useRef(skinIdx);
  const bestRef     = useRef(bestScore);
  const creditsRef  = useRef(credits);

  useEffect(()=>{upgradesRef.current=upgrades;},[upgrades]);
  useEffect(()=>{skinRef.current=skinIdx;},[skinIdx]);
  useEffect(()=>{bestRef.current=bestScore;},[bestScore]);
  useEffect(()=>{creditsRef.current=credits;},[credits]);
  useEffect(()=>{writeSave({credits,bestScore,upgrades,skinIdx});},[credits,bestScore,upgrades,skinIdx]);

  useEffect(()=>{
    const rates=[0,2,5,14,35,90];
    const iv=setInterval(()=>{
      const rate=rates[upgradesRef.current.idleRate]??0;
      if(rate>0&&bestRef.current>0){
        const amt=Math.max(1,Math.floor(rate*Math.log10(bestRef.current+10)));
        setCredits(c=>c+amt); setIdlePop(amt); setTimeout(()=>setIdlePop(0),2500);
      }
    },5000);
    return ()=>clearInterval(iv);
  },[]);

  const makeGlass = (cx,w) => {
    const num = Math.random()<0.7 ? 1+Math.floor(Math.random()*2) : 0;
    return Array.from({length:num},(_,i)=>({
      x: cx + 25 + i*(w/(num+1)), broken: false
    }));
  };

  const spawnGlass = (s, gx, gy) => {
    for(let i=0;i<16;i++){
      const angle=Math.random()*Math.PI*2, spd=1.5+Math.random()*5;
      s.particles.push({x:gx,y:gy,vx:Math.cos(angle)*spd+s.speed*0.15,vy:Math.sin(angle)*spd-2,
        life:30,maxLife:30,color:`rgba(${160+(Math.random()*95)|0},${200+(Math.random()*55)|0},255,${0.5+Math.random()*0.5})`,size:1.5+Math.random()*3});
    }
    for(let i=0;i<5;i++)
      s.particles.push({x:gx,y:gy,vx:(Math.random()-0.5)*4,vy:-Math.random()*3,life:10,maxLife:10,color:"#ffffffee",size:3+Math.random()*3});
  };

  const startGame = useCallback(() => {
    const u=upgradesRef.current;
    const jumpPower=[-10.5,-11.5,-12.8,-14.2,-15.8,-17.5][u.jumpPower];
    const maxSpeed=[4.5,5.5,7,8.5,10.5,13][u.speedCap];
    const coyote=[0,6,11,18][u.coyoteTime];
    const hasDbl=u.doubleJump>=1;
    const sc=SKINS[skinRef.current];

    const carriages=[{x:-20,w:420,h:82,glass:[]}];
    let cx=400;
    while(cx<GW+900){
      const w=220+Math.random()*180, h=72+Math.random()*18;
      carriages.push({x:cx,w,h,glass:makeGlass(cx,w)});
      cx+=w+60+Math.random()*50;
    }
    const coins=carriages
      .filter(b=>b.x>50&&Math.random()<0.5)
      .map(b=>({x:b.x+b.w*0.3+Math.random()*b.w*0.4,y:GH-b.h-14,collected:false}));

    gameRef.current={
      py:GH-82-PH, vy:0,
      speed:2.5, maxSpeed, jumpPower, coyote, coyoteLeft:0,
      hasDbl, dbLeft:0, onGround:true,
      layer:"roof",      // "roof" | "interior"
      inCarriage:null,   // ref to carriage object when inside
      carriages, coins, particles:[], trail:[], steam:[],
      score:0, coinCount:0, frame:0, gameOver:false,
      skinColor:sc.color,
    };
    setScreen("game");
  },[]);

  const jump = useCallback(()=>{
    const s=gameRef.current;
    if(!s||s.gameOver) return;
    const burst=(n,spread,col)=>{
      for(let i=0;i<n;i++)
        s.particles.push({x:PX+PW/2,y:s.py+PH,vx:(Math.random()-0.5)*spread,vy:-Math.random()*2-0.5,life:18,maxLife:18,color:col,size:2+Math.random()*2});
    };
    if(s.onGround||s.coyoteLeft>0){
      s.vy=s.jumpPower; s.onGround=false; s.coyoteLeft=0;
      if(s.hasDbl) s.dbLeft=1;
      burst(6,4,s.skinColor);
    } else if(s.dbLeft>0){
      s.vy=s.jumpPower*0.85; s.dbLeft=0;
      for(let i=0;i<12;i++)
        s.particles.push({x:PX+PW/2,y:s.py+PH/2,vx:(Math.random()-0.5)*8,vy:(Math.random()-0.5)*8,life:22,maxLife:22,color:s.skinColor,size:3+Math.random()*2});
    }
  },[]);

  useEffect(()=>{
    if(screen!=="game"){cancelAnimationFrame(rafRef.current);return;}
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext("2d");
    let fid;

    const tick=()=>{
      const s=gameRef.current;
      if(!s||s.gameOver) return;

      s.frame++;
      s.score+=s.speed/10;
      s.speed=Math.min(s.maxSpeed,s.speed+0.0015);
      s.vy+=GRAV;
      s.py+=s.vy;
      s.trail.unshift({x:PX,y:s.py});
      if(s.trail.length>12) s.trail.pop();

      // Scroll world
      for(const b of s.carriages){b.x-=s.speed; for(const g of b.glass) g.x-=s.speed;}
      for(const c of s.coins) c.x-=s.speed;
      for(const st of s.steam){st.x+=st.vx;st.y+=st.vy;st.size+=0.4;st.life--;}
      s.carriages=s.carriages.filter(b=>b.x+b.w>-20);
      s.coins=s.coins.filter(c=>c.x>-30);
      s.steam=s.steam.filter(st=>st.life>0);
      if(s.frame%28===0)
        s.steam.push({x:20,y:GH-100-Math.random()*30,vx:-0.3,vy:-0.5,life:70,maxLife:70,size:10+Math.random()*10});

      // Generate carriages
      const last=s.carriages[s.carriages.length-1];
      if(last&&last.x+last.w<GW+600){
        const w=220+Math.random()*180, h=72+Math.random()*18;
        const gap=60+Math.random()*50+s.speed*1.5;
        const nx=last.x+last.w+gap;
        s.carriages.push({x:nx,w,h,glass:makeGlass(nx,w)});
        if(Math.random()<0.5)
          s.coins.push({x:nx+w*0.3+Math.random()*w*0.4,y:GH-h-14,collected:false});
      }

      // ── PHYSICS ─────────────────────────────────────────
      if(s.layer==="roof"){
        let landed=false;
        for(const b of s.carriages){
          const bTop=GH-b.h;
          if(PX+PW>b.x+2&&PX<b.x+b.w-2&&s.py+PH>=bTop&&s.py+PH<=bTop+Math.abs(s.vy)+8&&s.vy>=0){
            // Check if landing on a skylight
            const hitGlass=b.glass.find(g=>!g.broken&&Math.abs(PX+PW/2-g.x)<12);
            if(hitGlass){
              // Smash through skylight into interior
              hitGlass.broken=true;
              spawnGlass(s,hitGlass.x,bTop-4);
              s.layer="interior";
              s.inCarriage=b;
              s.onGround=false;
              // vy continues - Hoppy falls into interior
            } else {
              s.py=bTop-PH; s.vy=0; landed=true;
              if(!s.onGround&&s.hasDbl) s.dbLeft=1;
              if(!s.onGround)
                for(let i=0;i<4;i++) s.particles.push({x:PX+PW/2+(Math.random()-0.5)*PW,y:s.py+PH,vx:(Math.random()-0.5)*3,vy:-Math.random()*2,life:12,maxLife:12,color:"#ffffff55",size:2});
            }
            break;
          }
        }
        if(s.onGround&&!landed) s.coyoteLeft=s.coyote;
        else if(landed)         s.coyoteLeft=0;
        else if(s.coyoteLeft>0) s.coyoteLeft--;
        s.onGround=landed;

      } else {
        // INTERIOR physics
        const b=s.inCarriage;
        const ceilingY=GH-b.h+7;
        const floorY=INTERIOR_FLOOR_Y;

        // Front wall passed — exit into gap
        if(b.x+b.w<PX+PW){
          s.layer="roof"; s.inCarriage=null;
          s.py=floorY-PH; s.onGround=false;
        } else {
          // Floor
          if(s.vy>=0&&s.py+PH>=floorY){
            s.py=floorY-PH; s.vy=0; s.onGround=true;
            if(s.hasDbl) s.dbLeft=1;
          } else {
            s.onGround=false;
          }
          // Ceiling — exit upward (smash through nearest skylight or roof)
          if(s.vy<0&&s.py<=ceilingY+4){
            // Find nearest skylight, or just bust through the roof
            const nearest=b.glass.reduce((best,g)=>{
              const d=Math.abs(PX+PW/2-g.x);
              return(!best||d<Math.abs(PX+PW/2-best.x))?g:best;
            },null);
            const exitX = nearest ? nearest.x : PX+PW/2;
            if(nearest&&!nearest.broken){ nearest.broken=true; spawnGlass(s,nearest.x,ceilingY); }
            else if(!nearest){ spawnGlass(s,exitX,ceilingY); }
            // Pop out onto roof with upward momentum
            s.py=ceilingY-PH-2;
            s.layer="roof"; s.inCarriage=null;
            s.onGround=false; s.coyoteLeft=0;
          }
        }
      }

      // Death
      if(s.py>GH+80){
        s.gameOver=true;
        const finalScore=Math.floor(s.score);
        const earned=Math.floor(finalScore/8)+s.coinCount*8;
        const isNewBest=finalScore>bestRef.current;
        setBestScore(b=>Math.max(b,finalScore));
        setCredits(c=>c+earned);
        setRunData({score:finalScore,coins:s.coinCount,earned,isNewBest});
        setTimeout(()=>setScreen("dead"),350);
        return;
      }

      // Coins
      for(const c of s.coins)
        if(!c.collected&&Math.abs(PX+PW/2-c.x)<PW/2+10&&Math.abs(s.py+PH/2-c.y)<PH/2+10){
          c.collected=true; s.coinCount++;
          for(let i=0;i<8;i++) s.particles.push({x:c.x,y:c.y,vx:(Math.random()-0.5)*5,vy:-Math.random()*4-1,life:25,maxLife:25,color:"#ffd93d",size:2+Math.random()*2});
        }

      for(const p of s.particles){p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.life--;}
      s.particles=s.particles.filter(p=>p.life>0);

      // ── DRAW ─────────────────────────────────────────────
      ctx.clearRect(0,0,GW,GH);

      // Sky
      const sky=ctx.createLinearGradient(0,0,0,GH);
      sky.addColorStop(0,"#080514"); sky.addColorStop(0.55,"#0f0a1e"); sky.addColorStop(1,"#1c0f0c");
      ctx.fillStyle=sky; ctx.fillRect(0,0,GW,GH);

      // Stars
      for(let i=0;i<65;i++){
        const sx=((i*137.5+s.frame*s.speed*0.07)%(GW+10)+GW+10)%(GW+10);
        const sy=(i*46.1)%(GH*0.42);
        const p=0.2+0.8*Math.abs(Math.sin(i*2.3+s.frame*0.011));
        ctx.globalAlpha=p*0.65; ctx.fillStyle=i%7===0?"#ffe4c4":"#fff";
        ctx.fillRect(sx,sy,i%13===0?2:1,i%13===0?2:1);
      }
      ctx.globalAlpha=1;

      // Moon
      const moonX=GW*0.78,moonY=32;
      ctx.save();
      ctx.shadowColor="#fff8dc"; ctx.shadowBlur=20; ctx.fillStyle="#fff8dc";
      ctx.beginPath(); ctx.arc(moonX,moonY,20,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#080514"; ctx.shadowBlur=0;
      ctx.beginPath(); ctx.arc(moonX+7,moonY-4,17,0,Math.PI*2); ctx.fill();
      ctx.restore();

      // Hills
      ctx.fillStyle="#0d0820";
      for(let i=0;i<7;i++){const hx=((i*110-s.frame*s.speed*0.05)%(GW+160)+GW+160)%(GW+160)-80;ctx.beginPath();ctx.moveTo(hx-30,GH);ctx.quadraticCurveTo(hx+45,GH-60,hx+120,GH);ctx.fill();}
      ctx.fillStyle="#120e22";
      for(let i=0;i<9;i++){const hx=((i*85-s.frame*s.speed*0.12)%(GW+110)+GW+110)%(GW+110)-55;ctx.beginPath();ctx.moveTo(hx-20,GH);ctx.quadraticCurveTo(hx+28,GH-38,hx+76,GH);ctx.fill();}

      // Telegraph poles
      for(let i=0;i<6;i++){
        const tx=((i*110-s.frame*s.speed*0.38)%(GW+140)+GW+140)%(GW+140)-70;
        ctx.strokeStyle="#1e1635"; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(tx,GH-4); ctx.lineTo(tx,GH-85); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx-14,GH-76); ctx.lineTo(tx+14,GH-76); ctx.stroke();
        ctx.fillStyle="#2a1f40"; ctx.fillRect(tx-14,GH-79,3,5); ctx.fillRect(tx+11,GH-79,3,5);
      }

      // Steam
      for(const st of s.steam){ctx.globalAlpha=(st.life/st.maxLife)*0.35;ctx.fillStyle="#c8bcd8";ctx.beginPath();ctx.arc(st.x,st.y,st.size,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=1;

      // Tracks
      ctx.fillStyle="#100b20"; ctx.fillRect(0,GH-6,GW,6);
      ctx.fillStyle="#2a1f40"; ctx.fillRect(0,GH-5,GW,2); ctx.fillRect(0,GH-3,GW,2);
      for(let i=0;i<18;i++){const sx=((i*32-s.frame*s.speed*0.9)%(GW+32)+GW+32)%(GW+32)-16;ctx.fillStyle="#1c1535";ctx.fillRect(sx-6,GH-6,12,6);}

      // Draw all carriages (exterior)
      for(const b of s.carriages){
        drawCarriageExterior(ctx,b,s.skinColor,s.frame);
        for(const g of b.glass) drawSkylight(ctx,b,g,s.skinColor);
      }

      // If inside: draw interior of current carriage
      if(s.layer==="interior"&&s.inCarriage){
        const b=s.inCarriage;
        drawInterior(ctx,b,s.frame,s.skinColor);
      }

      // Coins
      for(const c of s.coins){
        if(c.collected) continue;
        const pulse=0.7+0.3*Math.sin(s.frame*0.12+c.x*0.05);
        ctx.save(); ctx.shadowColor="#ffd93d"; ctx.shadowBlur=12*pulse;
        ctx.fillStyle=`rgba(255,217,61,${pulse})`;
        ctx.beginPath(); ctx.moveTo(c.x,c.y-7); ctx.lineTo(c.x+5,c.y); ctx.lineTo(c.x,c.y+7); ctx.lineTo(c.x-5,c.y); ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // Trail
      for(let i=s.trail.length-1;i>=0;i--){
        const t=s.trail[i],a=(1-i/s.trail.length)*0.3,sc2=1-(i/s.trail.length)*0.72;
        ctx.globalAlpha=a; ctx.fillStyle=s.skinColor;
        ctx.fillRect(t.x+PW*(1-sc2)/2,t.y+PH*(1-sc2)/2,PW*sc2,PH*sc2);
      }
      ctx.globalAlpha=1;

      // Hoppy
      if(!s.gameOver) drawHoppy(ctx,PX,s.py,s.frame,s.skinColor,s.onGround,s.vy);

      // If inside: draw carriage foreground over Hoppy
      if(s.layer==="interior"&&s.inCarriage){
        drawCarriageForeground(ctx,s.inCarriage);
        // Interior HUD hint
        const b=s.inCarriage;
        const distToFront=b.x+b.w-PX;
        if(distToFront<120){
          const urgency=1-(distToFront/120);
          ctx.fillStyle=`rgba(255,100,0,${urgency*0.4})`;
          ctx.fillRect(0,0,GW,GH);
          ctx.fillStyle=`rgba(255,180,50,${urgency*0.9})`;
          ctx.font=`bold ${10+urgency*4|0}px 'Courier New'`;
          ctx.textAlign="center";
          ctx.fillText("JUMP OUT!",GW/2,GH/2-20);
          ctx.textAlign="left";
        }
      }

      // Particles
      for(const p of s.particles){ctx.globalAlpha=(p.life/p.maxLife)*0.92;ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);}
      ctx.globalAlpha=1;

      // HUD
      ctx.fillStyle="rgba(0,0,0,0.62)"; ctx.fillRect(0,0,GW,26);
      ctx.font="bold 13px 'Courier New',monospace";
      ctx.textAlign="center"; ctx.fillStyle="#fff"; ctx.fillText(`${Math.floor(s.score)}m`,GW/2,17);
      ctx.textAlign="left"; ctx.fillStyle="#ffd93d"; ctx.fillText(`◆ ${s.coinCount}`,8,17);
      ctx.textAlign="right"; ctx.fillStyle=s.skinColor+"aa"; ctx.fillText(`${s.speed.toFixed(1)}x`,GW-8,17);
      // Inside indicator
      if(s.layer==="interior"){
        ctx.textAlign="center"; ctx.fillStyle="#ff9f1c";
        ctx.fillText("▼ INSIDE",GW/2+60,17);
      }
      ctx.textAlign="left";

      fid=requestAnimationFrame(tick);
      rafRef.current=fid;
    };

    fid=requestAnimationFrame(tick);
    rafRef.current=fid;
    return()=>cancelAnimationFrame(fid);
  },[screen]);

  useEffect(()=>{
    const onKey=e=>{
      if(["Space","ArrowUp","KeyW"].includes(e.code)){
        e.preventDefault();
        if(screen==="game") jump();
        else if(screen==="menu"||screen==="dead") startGame();
      }
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[screen,jump,startGame]);

  const buyUpgrade=key=>{
    const data=UPGRADE_DATA[key],level=upgrades[key];
    if(level>=data.max) return;
    const cost=data.costs[level];
    if(creditsRef.current<cost) return;
    setCredits(c=>c-cost);
    setUpgrades(u=>{const nu={...u,[key]:u[key]+1};upgradesRef.current=nu;return nu;});
    setFlash(key); setTimeout(()=>setFlash(null),500);
  };

  const skin=SKINS[skinIdx],c=skin.color;
  const S={
    page:{background:"#06050e",color:"#fff",minHeight:"100vh",fontFamily:"'Courier New',monospace",display:"flex",flexDirection:"column",alignItems:"center",WebkitUserSelect:"none",userSelect:"none"},
    wrap:{width:"100%",maxWidth:"600px",padding:"20px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:"20px"},
    title:{fontSize:"36px",fontWeight:"bold",letterSpacing:"5px",color:c,textShadow:`0 0 20px ${c},0 0 50px ${c}55`,textAlign:"center"},
    sub:{fontSize:"10px",color:"#444",letterSpacing:"4px",textAlign:"center"},
    card:{background:"#090815",border:`1px solid ${c}25`,padding:"16px 20px",width:"100%"},
    row:{display:"flex",justifyContent:"space-between",alignItems:"center"},
    label:{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:"6px"},
    btn:ok=>({background:ok?c:"transparent",color:ok?"#060512":c,border:`2px solid ${c}`,padding:"10px 22px",fontFamily:"'Courier New',monospace",fontSize:"12px",fontWeight:"bold",letterSpacing:"2px",cursor:"pointer",textTransform:"uppercase",transition:"all 0.15s"}),
  };

  if(screen==="game") return (
    <div style={S.page}>
      <div style={{width:"100%",maxWidth:"600px"}}>
        <canvas ref={canvasRef} width={GW} height={GH}
          style={{width:"100%",aspectRatio:`${GW}/${GH}`,display:"block",imageRendering:"pixelated",cursor:"pointer",border:`2px solid ${c}22`,boxShadow:`0 0 40px ${c}15`}}
          onPointerDown={e=>{e.preventDefault();jump();}}/>
        <div style={{padding:"8px 12px",background:"#07060d",display:"flex",justifyContent:"space-between",fontSize:"10px",color:"#444",letterSpacing:"1px"}}>
          <span>TAP / SPACE TO HOP • LAND ON SKYLIGHT TO GO INSIDE</span>
          <span>◆ {credits}</span>
        </div>
      </div>
    </div>
  );

  if(screen==="dead") return (
    <div style={S.page}><div style={S.wrap}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:"28px",fontWeight:"bold",color:"#ff4040",letterSpacing:"4px",textShadow:"0 0 20px #ff4040"}}>HOPPY FELL!</div>
        {runData.isNewBest&&<div style={{color:"#ffd93d",fontSize:"11px",letterSpacing:"3px",marginTop:"6px"}}>✦ NEW BEST ✦</div>}
      </div>
      <div style={{...S.card,display:"flex",flexDirection:"column",gap:"12px",maxWidth:"280px",margin:"0 auto"}}>
        {[["DISTANCE",`${runData.score}m`,c],["COINS",`◆ ${runData.coins}`,"#ffd93d"]].map(([lbl,val,col])=>(
          <div key={lbl} style={S.row}><span style={{color:"#555",fontSize:"11px"}}>{lbl}</span><span style={{color:col,fontWeight:"bold"}}>{val}</span></div>
        ))}
        <div style={{borderTop:`1px solid ${c}18`,paddingTop:"12px",...S.row}}>
          <span style={{color:"#555",fontSize:"11px"}}>EARNED</span>
          <span style={{color:"#ffd93d",fontWeight:"bold",fontSize:"15px"}}>+◆{runData.earned}</span>
        </div>
      </div>
      <div style={{color:"#333",fontSize:"11px"}}>TOTAL ◆{credits}</div>
      <div style={{display:"flex",flexDirection:"column",gap:"10px",alignItems:"center"}}>
        <button style={S.btn(true)} onClick={startGame}>▶ HOP AGAIN</button>
        <div style={{display:"flex",gap:"10px"}}>
          <button style={S.btn(false)} onClick={()=>setScreen("shop")}>⬆ UPGRADES</button>
          <button style={S.btn(false)} onClick={()=>setScreen("menu")}>⌂ MENU</button>
        </div>
      </div>
    </div></div>
  );

  if(screen==="shop") return (
    <div style={S.page}><div style={S.wrap}>
      <div style={{...S.row,width:"100%"}}>
        <div style={{fontSize:"16px",fontWeight:"bold",color:c,letterSpacing:"3px"}}>UPGRADES</div>
        <div style={{color:"#ffd93d",fontSize:"14px",fontWeight:"bold"}}>◆{credits}</div>
      </div>
      {idlePop>0&&<div style={{color:"#ffd93d",fontSize:"11px",letterSpacing:"2px"}}>+◆{idlePop} idle income</div>}
      <div style={{display:"flex",flexDirection:"column",gap:"10px",width:"100%"}}>
        {Object.entries(UPGRADE_DATA).map(([key,data])=>{
          const level=upgrades[key],maxed=level>=data.max,cost=maxed?null:data.costs[level],can=!maxed&&credits>=cost;
          return (
            <div key={key} style={{...S.card,border:`1px solid ${flash===key?c:c+"22"}`,background:flash===key?c+"14":"#090815",transition:"all 0.3s",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:"12px",fontWeight:"bold",letterSpacing:"1px",color:maxed?"#555":"#eee"}}>{data.emoji} {data.name}</div>
                <div style={{fontSize:"10px",color:"#555",marginTop:"3px"}}>{data.desc}</div>
                <div style={{marginTop:"8px",display:"flex",gap:"4px"}}>
                  {Array.from({length:data.max}).map((_,i)=>(<div key={i} style={{width:"14px",height:"3px",background:i<level?c:"#1c1c30",boxShadow:i<level?`0 0 5px ${c}`:"none"}}/>))}
                </div>
              </div>
              <div>{maxed?<span style={{fontSize:"10px",color:"#ffd93d",letterSpacing:"1px"}}>MAXED</span>:<button style={{...S.btn(can),opacity:can?1:0.35,padding:"8px 14px",fontSize:"11px"}} onClick={()=>buyUpgrade(key)}>◆{cost}</button>}</div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:"10px"}}>
        <button style={S.btn(true)} onClick={startGame}>▶ PLAY</button>
        <button style={S.btn(false)} onClick={()=>setScreen("menu")}>⌂ MENU</button>
      </div>
    </div></div>
  );

  if(screen==="customize") return (
    <div style={S.page}><div style={S.wrap}>
      <div style={{fontSize:"16px",fontWeight:"bold",color:c,letterSpacing:"3px",alignSelf:"flex-start"}}>HOPPY'S LOOK</div>
      <div style={{width:"100%"}}>
        <div style={S.label}>FROG COLOUR</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"10px"}}>
          {SKINS.map((s2,i)=>(
            <div key={i} onClick={()=>setSkinIdx(i)} style={{width:"44px",height:"44px",background:s2.color,boxShadow:skinIdx===i?`0 0 18px ${s2.color},0 0 6px ${s2.color}`:"none",border:skinIdx===i?"2px solid #fff":"2px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {skinIdx===i&&<span style={{color:"#111",fontSize:"14px"}}>✓</span>}
            </div>
          ))}
        </div>
      </div>
      <div style={{...S.card,display:"flex",flexDirection:"column",alignItems:"center",gap:"16px"}}>
        <div style={S.label}>PREVIEW</div>
        <div style={{position:"relative",width:"64px",height:"54px"}}>
          <div style={{position:"absolute",left:"4px",top:"14px",width:"56px",height:"24px",background:c,boxShadow:`0 0 18px ${c}88`}}/>
          <div style={{position:"absolute",left:"2px",top:"8px",width:"60px",height:"14px",background:c}}/>
          {[6,44].map(ex=>(
            <div key={ex} style={{position:"absolute",left:`${ex}px`,top:"3px",width:"16px",height:"16px",borderRadius:"50%",background:"#fff"}}>
              <div style={{position:"absolute",left:"5px",top:"5px",width:"7px",height:"7px",borderRadius:"50%",background:"#111"}}/>
            </div>
          ))}
          <div style={{position:"absolute",left:"6px",bottom:"0",width:"14px",height:"10px",background:c}}/>
          <div style={{position:"absolute",right:"6px",bottom:"0",width:"14px",height:"10px",background:c}}/>
        </div>
        <div style={{fontSize:"11px",color:c,letterSpacing:"3px"}}>{skin.name}</div>
      </div>
      <div style={{display:"flex",gap:"10px"}}>
        <button style={S.btn(true)} onClick={startGame}>▶ PLAY</button>
        <button style={S.btn(false)} onClick={()=>setScreen("menu")}>⌂ MENU</button>
      </div>
    </div></div>
  );

  return (
    <div style={S.page}><div style={S.wrap}>
      <div style={{height:"8px"}}/>
      <div>
        <div style={{fontSize:"10px",color:c+"88",letterSpacing:"6px",textAlign:"center",marginBottom:"8px"}}>ENDLESS RUNNER</div>
        <div style={S.title}>CHARLABOLT</div>
        <div style={{...S.sub,marginTop:"4px",color:"#c9a84c88"}}>HOPPY'S IDLE ADVENTURE</div>
      </div>
      <div style={{...S.card,display:"flex",gap:"0",width:"auto",padding:"0"}}>
        {[["BEST",`${bestScore}m`,c],["CREDITS",`◆${credits}`,"#ffd93d"]].map(([lbl,val,col],i)=>(
          <div key={i} style={{padding:"16px 28px",textAlign:"center",borderRight:i===0?`1px solid ${c}18`:"none"}}>
            <div style={{fontSize:"9px",color:"#555",letterSpacing:"2px",marginBottom:"5px"}}>{lbl}</div>
            <div style={{fontSize:"20px",color:col,fontWeight:"bold"}}>{val}</div>
          </div>
        ))}
      </div>
      {idlePop>0&&<div style={{color:"#ffd93d",fontSize:"11px",letterSpacing:"2px"}}>+◆{idlePop} idle income!</div>}
      <button style={{...S.btn(true),fontSize:"15px",padding:"14px 40px",letterSpacing:"4px"}} onClick={startGame}>▶ HOP!</button>
      <div style={{display:"flex",gap:"10px"}}>
        <button style={S.btn(false)} onClick={()=>setScreen("shop")}>⬆ UPGRADES</button>
        <button style={S.btn(false)} onClick={()=>setScreen("customize")}>✦ HOPPY'S LOOK</button>
      </div>
      <div style={{...S.sub,color:"#2a2035"}}>SPACE / TAP TO HOP</div>
    </div></div>
  );
}
