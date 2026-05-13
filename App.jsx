import { useState, useEffect, useRef, useCallback } from "react";

const GW = 480;
const GH = 220;
const PX = 75;
const PW = 22;
const PH = 18;
const GRAV = 0.48;
const INTERIOR_FLOOR_Y = GH - 20;
const WIN_TOP  = 12;
const WIN_H    = 55;
const WIN_FLOOR = WIN_TOP + WIN_H;

// How high can each jump tier reach (approx world-units above platform)
const JUMP_TIERS = [1, 2, 3, 4]; // max air jumps per tier

const UPGRADE_DATA = {
  jumpPower:  { name:"JUMP BOOST",   desc:"Leap higher each hop",              emoji:"⬆", costs:[60,150,350,800,2000], max:5 },
  speedCap:   { name:"MAX SPEED",    desc:"Higher terminal velocity",           emoji:"⚡", costs:[80,200,500,1200,3000], max:5 },
  idleRate:   { name:"IDLE INCOME",  desc:"Earn credits while away",            emoji:"◆", costs:[100,300,800,2000,5000], max:5 },
  multiJump:  { name:"MULTI-HOP",    desc:"Double → Triple → Quad jump",        emoji:"✦", costs:[500,1200,2500], max:3 },
  coyoteTime: { name:"EDGE GRIP",    desc:"Hop just after an edge",             emoji:"▸", costs:[150,400,1000], max:3 },
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

const HATS = [
  { id:"none",  name:"BARE",     price:0 },
  { id:"top",   name:"TOP HAT",  price:100 },
  { id:"cap",   name:"FLAT CAP", price:100 },
  { id:"crown", name:"CROWN",    price:100 },
];

const SAVE_KEY = "charlabolt_save";
function loadSave(){ try{ return JSON.parse(localStorage.getItem(SAVE_KEY)); }catch{ return null; } }
function writeSave(d){ try{ localStorage.setItem(SAVE_KEY,JSON.stringify(d)); }catch{} }

// Building height ranges per jump tier (min, max)
const BUILDING_H_RANGE = [
  [140, 200],  // 1 jump — normal
  [160, 260],  // 2 jumps — taller
  [200, 340],  // 3 jumps — big
  [260, 440],  // 4 jumps — massive
];
const GAP_RANGE = [
  [60, 90],
  [70, 110],
  [80, 140],
  [100, 180],
];

function drawHat(ctx, px, py, hatId) {
  if(!hatId||hatId==="none") return;
  const cx=px+PW/2, top=py+1;
  if(hatId==="top"){
    ctx.fillStyle="#1a6bd4"; ctx.fillRect(cx-7,top-14,14,13);
    ctx.fillStyle="#1558b0"; ctx.fillRect(cx-9,top-3,18,3);
  } else if(hatId==="cap"){
    ctx.fillStyle="#c0392b"; ctx.fillRect(cx-8,top-9,16,8); ctx.fillRect(cx-9,top-2,18,3);
    ctx.fillStyle="#a93226"; ctx.fillRect(cx+5,top-9,3,4);
  } else if(hatId==="crown"){
    ctx.fillStyle="#f1c40f"; ctx.fillRect(cx-8,top-6,16,6);
    for(let i=0;i<3;i++) ctx.fillRect(cx-8+i*6,top-10,4,5);
    ctx.fillStyle="#e74c3c"; ctx.fillRect(cx-5,top-4,2,2);
    ctx.fillStyle="#2ecc71"; ctx.fillRect(cx+3,top-4,2,2);
  }
}

function drawHoppy(ctx, px, py, frame, color, onGround, vy, hatId, airJumpsLeft, maxAirJumps) {
  ctx.save();
  ctx.shadowColor=color; ctx.shadowBlur=14;
  ctx.fillStyle=color;
  ctx.fillRect(px,py+5,PW,PH-5); ctx.fillRect(px-2,py+2,PW+4,10);
  ctx.shadowBlur=0;
  for(const ex of [px+3,px+PW-3]){
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(ex,py+4,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(ex+1,py+4,2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(ex+2,py+2.5,1,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle=color;
  const lp=onGround?frame*0.35:0;
  if(vy<-3){ ctx.fillRect(px-4,py+PH-3,8,4); ctx.fillRect(px+PW-4,py+PH-3,8,4); }
  else{ ctx.fillRect(px+1,py+PH-1,7,4+Math.sin(lp)*3); ctx.fillRect(px+PW-8,py+PH-1,7,4-Math.sin(lp)*3); }
  ctx.restore();
  drawHat(ctx,px,py,hatId);
  // Jump pips above Hoppy showing remaining air jumps
  if(!onGround && maxAirJumps > 0){
    for(let i=0;i<maxAirJumps;i++){
      const pipX = px + i*(8) - (maxAirJumps-1)*4;
      const filled = i < airJumpsLeft;
      ctx.fillStyle = filled ? color+"cc" : "#ffffff33";
      ctx.beginPath(); ctx.arc(px+PW/2 + (i-(maxAirJumps-1)/2)*9, py-8, 3, 0, Math.PI*2); ctx.fill();
    }
  }
}

function drawBuilding(ctx, b, frame) {
  const top=GH-b.h;
  ctx.fillStyle="#00000044"; ctx.fillRect(b.x+8,top+8,b.w,b.h);
  const bg=ctx.createLinearGradient(b.x,top,b.x,top+b.h);
  bg.addColorStop(0,"#2a1e10"); bg.addColorStop(1,"#1a1008");
  ctx.fillStyle=bg; ctx.fillRect(b.x,top,b.w,b.h);
  ctx.strokeStyle="#44280e1a"; ctx.lineWidth=0.5;
  for(let row=0;row<Math.ceil(b.h/8);row++)
    for(let col=0;col<Math.ceil(b.w/18)+1;col++)
      ctx.strokeRect(b.x+(col*18)+(row%2?9:0),top+row*8,17,7);
  ctx.fillStyle="#3d2b12"; ctx.fillRect(b.x,top,b.w,7);
  for(let i=0;i<Math.floor(b.w/14);i++){ctx.fillStyle="#2a1e10"; ctx.fillRect(b.x+i*14+4,top,6,9);}
  ctx.fillStyle="#5a3e1a"; ctx.fillRect(b.x,top+7,b.w,2);
  const wW=16,wSp=28,nW=Math.floor((b.w-16)/wSp);
  for(let i=0;i<nW;i++){
    const wx=b.x+10+i*wSp, wy=top+WIN_TOP;
    const lit=((Math.floor(wx*0.07)*13)+(Math.floor(wy*0.05)*7))%5<3;
    ctx.fillStyle=lit?"#ffcc6633":"#110a0511"; ctx.fillRect(wx,wy,wW,WIN_H);
    ctx.strokeStyle="#5a3e1a88"; ctx.lineWidth=1.5; ctx.strokeRect(wx,wy,wW,WIN_H);
    ctx.fillStyle="#5a3e1a55"; ctx.fillRect(wx+wW/2,wy,1,WIN_H);
  }
  const entryW=36;
  const drawEntry=(ex,broken)=>{
    if(broken){
      ctx.fillStyle="#1a1008"; ctx.fillRect(ex,top+WIN_TOP,entryW,WIN_H);
      ctx.strokeStyle="#5a3e1a"; ctx.lineWidth=2; ctx.strokeRect(ex,top+WIN_TOP,entryW,WIN_H);
      ctx.fillStyle="#5a3e1a"; ctx.fillRect(ex,top+WIN_TOP,2,WIN_H/3); ctx.fillRect(ex+entryW-2,top+WIN_TOP,2,WIN_H/2);
    } else {
      ctx.save(); ctx.shadowColor="#aaddff88"; ctx.shadowBlur=8;
      const gg=ctx.createLinearGradient(ex,top+WIN_TOP,ex+entryW,top+WIN_FLOOR);
      gg.addColorStop(0,"#bbddff66"); gg.addColorStop(1,"#88aadd44");
      ctx.fillStyle=gg; ctx.fillRect(ex,top+WIN_TOP,entryW,WIN_H);
      ctx.fillStyle="#ddeeffbb"; ctx.fillRect(ex+2,top+WIN_TOP+3,5,2);
      ctx.strokeStyle="#c9a84c"; ctx.lineWidth=2; ctx.strokeRect(ex,top+WIN_TOP,entryW,WIN_H);
      ctx.restore();
    }
  };
  drawEntry(b.x,b.leftWindowBroken);
  drawEntry(b.x+b.w-entryW,b.rightWindowBroken);
}

function drawBuildingInterior(ctx, b, frame) {
  const top=GH-b.h, ceilY=top+WIN_TOP, floorY=top+WIN_FLOOR, intH=floorY-ceilY;
  const ig=ctx.createLinearGradient(b.x,ceilY,b.x,floorY);
  ig.addColorStop(0,"#1a0e05dd"); ig.addColorStop(1,"#2a1800cc");
  ctx.fillStyle=ig; ctx.fillRect(b.x,ceilY,b.w,intH);
  ctx.fillStyle="#3d2200bb"; ctx.fillRect(b.x,ceilY,b.w,4);
  ctx.fillStyle="#3a2000cc"; ctx.fillRect(b.x,floorY-5,b.w,5);
  for(let i=0;i<Math.ceil(b.w/16);i++){ctx.fillStyle="#2a130088"; ctx.fillRect(b.x+i*16,floorY-5,1,5);}
  ctx.fillStyle="#22140822";
  for(let i=0;i<Math.ceil(b.w/10);i++) ctx.fillRect(b.x+i*10,ceilY+6,1,intH-10);
  for(let i=0;i<Math.floor(b.w/55);i++){
    const lx=b.x+30+i*55;
    ctx.fillStyle="#5a3e1a88"; ctx.fillRect(lx,ceilY+4,2,8);
    ctx.fillStyle="#ffaa0044"; ctx.beginPath(); ctx.arc(lx+1,ceilY+14,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#ffcc6633"; ctx.beginPath(); ctx.arc(lx+1,ceilY+14,4,0,Math.PI*2); ctx.fill();
  }
}

function drawBuildingForeground(ctx, b) {
  const top=GH-b.h;
  ctx.fillStyle="#2a1e10"; ctx.fillRect(b.x,top,10,b.h); ctx.fillRect(b.x+b.w-10,top,10,b.h);
  ctx.fillStyle="#5a3e1a"; ctx.fillRect(b.x+10,top,b.w-20,2);
}

function drawCarriageExterior(ctx, b, skinColor, frame) {
  const top=GH-b.h;
  ctx.fillStyle="#00000055"; ctx.fillRect(b.x+7,top+8,b.w,b.h);
  const bg=ctx.createLinearGradient(b.x,top,b.x,top+b.h);
  bg.addColorStop(0,"#221740"); bg.addColorStop(0.3,"#1b1233"); bg.addColorStop(1,"#100b22");
  ctx.fillStyle=bg; ctx.fillRect(b.x,top,b.w,b.h);
  ctx.fillStyle="#c9a84c"; ctx.fillRect(b.x,top,b.w,5);
  ctx.fillStyle="#8b6914"; ctx.fillRect(b.x,top+5,b.w,2);
  ctx.fillStyle="#c9a84c"; ctx.fillRect(b.x,top+b.h-16,b.w,3);
  ctx.fillStyle="#8b6914"; ctx.fillRect(b.x,top+b.h-13,b.w,2);
  const wW=24,wH=28,wSp=36,nW=Math.floor((b.w-16)/wSp);
  for(let i=0;i<nW;i++){
    const wx=b.x+8+i*wSp,wy=top+10;
    ctx.fillStyle="#ff960033"; ctx.fillRect(wx-3,wy-3,wW+6,wH+6);
    const wg=ctx.createLinearGradient(wx,wy,wx,wy+wH);
    wg.addColorStop(0,"#ffe09066"); wg.addColorStop(1,"#ff720044");
    ctx.fillStyle=wg; ctx.fillRect(wx,wy,wW,wH);
    ctx.fillStyle="#c9a84c88"; ctx.fillRect(wx+wW/2,wy,1,wH);
    ctx.fillStyle="#c9a84c";
    ctx.fillRect(wx-1,wy-1,wW+2,2); ctx.fillRect(wx-1,wy+wH-1,wW+2,2);
    ctx.fillRect(wx-1,wy,2,wH); ctx.fillRect(wx+wW-1,wy,2,wH);
  }
  ctx.fillStyle="#c9a84c"; ctx.fillRect(b.x+b.w/2-10,top+b.h-12,20,10);
  ctx.fillStyle="#100b22"; ctx.font="bold 7px 'Courier New'"; ctx.textAlign="center";
  ctx.fillText(`${(Math.abs(Math.floor(b.x/50))%99)+1}`,b.x+b.w/2,top+b.h-5);
  ctx.textAlign="left";
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
  ctx.fillStyle="#666"; ctx.fillRect(b.x+b.w,top+b.h-20,7,7); ctx.fillRect(b.x-7,top+b.h-20,7,7);
}

function drawSkylight(ctx, b, g) {
  const bTop=GH-b.h;
  if(g.broken){
    ctx.fillStyle="#00000088"; ctx.fillRect(g.x-10,bTop-7,20,8);
    ctx.fillStyle="#8b6914"; ctx.fillRect(g.x-11,bTop-7,3,7); ctx.fillRect(g.x+8,bTop-7,3,7);
  } else {
    ctx.save(); ctx.shadowColor="#88ccff"; ctx.shadowBlur=8;
    ctx.fillStyle="#c9a84c";
    ctx.fillRect(g.x-11,bTop-7,22,2); ctx.fillRect(g.x-11,bTop-1,22,1);
    ctx.fillRect(g.x-11,bTop-7,2,7); ctx.fillRect(g.x+9,bTop-7,2,7);
    ctx.fillStyle="#99ddff55"; ctx.fillRect(g.x-9,bTop-6,18,5);
    ctx.fillStyle="#cceeffe8"; ctx.fillRect(g.x-8,bTop-5,6,1);
    ctx.restore();
  }
}

function drawTrainInterior(ctx, b, frame) {
  const top=GH-b.h+7,floorY=INTERIOR_FLOOR_Y;
  const ig=ctx.createLinearGradient(b.x,top,b.x,floorY);
  ig.addColorStop(0,"#1e0e00cc"); ig.addColorStop(0.4,"#2a1200bb"); ig.addColorStop(1,"#1a0b00aa");
  ctx.fillStyle=ig; ctx.fillRect(b.x,top,b.w,floorY-top);
  ctx.fillStyle="#8b6914aa"; ctx.fillRect(b.x,top,b.w,4);
  ctx.fillStyle="#2a1800bb"; ctx.fillRect(b.x,floorY-6,b.w,6);
  for(let i=0;i<8;i++){ctx.fillStyle="#3a2000aa"; ctx.fillRect(b.x+i*(b.w/7),floorY-6,1,6);}
  const seatH=10,seatY=floorY-16;
  for(let i=0;i<Math.floor((b.w-30)/18);i++){
    const sx=b.x+15+i*18;
    ctx.fillStyle="#4a2200cc"; ctx.fillRect(sx,seatY,12,seatH);
    ctx.fillStyle="#5a2f00aa"; ctx.fillRect(sx,seatY,12,3);
  }
  for(let i=0;i<Math.floor(b.w/45);i++){
    const lx=b.x+22+i*45;
    ctx.strokeStyle="#8b6914aa"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(lx,top+4); ctx.lineTo(lx,top+12); ctx.stroke();
    ctx.fillStyle="#ffaa0066"; ctx.beginPath(); ctx.arc(lx,top+15,4,0,Math.PI*2); ctx.fill();
  }
}

function drawTrainForeground(ctx, b) {
  const top=GH-b.h;
  ctx.fillStyle="#c9a84c"; ctx.fillRect(b.x,top,b.w,5);
  ctx.fillStyle="#8b6914"; ctx.fillRect(b.x,top+5,b.w,2);
  ctx.fillStyle="#221740";
  ctx.fillRect(b.x,top+7,9,GH-top); ctx.fillRect(b.x+b.w-9,top+7,9,GH-top);
}

// ── APP ───────────────────────────────────────────────────

export default function App() {
  const canvasRef=useRef(null), gameRef=useRef(null), rafRef=useRef(null);
  const saved=loadSave();
  const [screen,    setScreen]    = useState("menu");
  const [credits,   setCredits]   = useState(saved?.credits   ?? 50);
  const [bestScore, setBestScore] = useState(saved?.bestScore  ?? 0);
  const rawSavedUpgrades = saved?.upgrades ?? {};
  const migratedUpgrades = { jumpPower: rawSavedUpgrades.jumpPower ?? 0, speedCap: rawSavedUpgrades.speedCap ?? 0, idleRate: rawSavedUpgrades.idleRate ?? 0, multiJump: rawSavedUpgrades.multiJump ?? (rawSavedUpgrades.doubleJump ? 1 : 0), coyoteTime: rawSavedUpgrades.coyoteTime ?? 0 };
  const [upgrades,  setUpgrades]  = useState(migratedUpgrades);
  const [skinIdx,   setSkinIdx]   = useState(saved?.skinIdx    ?? 0);
  const [hatId,     setHatId]     = useState(saved?.hatId      ?? "none");
  const [ownedHats, setOwnedHats] = useState(saved?.ownedHats  ?? ["none"]);
  const [runData,   setRunData]   = useState({score:0,coins:0,earned:0,isNewBest:false});
  const [flash,     setFlash]     = useState(null);
  const [idlePop,   setIdlePop]   = useState(0);

  const upgradesRef=useRef(upgrades), skinRef=useRef(skinIdx), hatRef=useRef(hatId);
  const bestRef=useRef(bestScore), creditsRef=useRef(credits), ownedRef=useRef(ownedHats);

  useEffect(()=>{upgradesRef.current=upgrades;},[upgrades]);
  useEffect(()=>{skinRef.current=skinIdx;},[skinIdx]);
  useEffect(()=>{hatRef.current=hatId;},[hatId]);
  useEffect(()=>{bestRef.current=bestScore;},[bestScore]);
  useEffect(()=>{creditsRef.current=credits;},[credits]);
  useEffect(()=>{ownedRef.current=ownedHats;},[ownedHats]);
  useEffect(()=>{writeSave({credits,bestScore,upgrades,skinIdx,hatId,ownedHats});},[credits,bestScore,upgrades,skinIdx,hatId,ownedHats]);

  useEffect(()=>{
    const rates=[0,2,5,14,35,90];
    const iv=setInterval(()=>{
      const rate=rates[upgradesRef.current.idleRate]??0;
      if(rate>0&&bestRef.current>0){
        const amt=Math.max(1,Math.floor(rate*Math.log10(bestRef.current+10)));
        setCredits(c=>c+amt); setIdlePop(amt); setTimeout(()=>setIdlePop(0),2500);
      }
    },5000);
    return()=>clearInterval(iv);
  },[]);

  const makeSkylights=(cx,w)=>{
    const num=Math.random()<0.7?1+Math.floor(Math.random()*2):0;
    return Array.from({length:num},(_,i)=>({x:cx+30+i*(w/(num+1)),broken:false}));
  };

  const spawnGlass=(s,gx,gy)=>{
    for(let i=0;i<16;i++){
      const angle=Math.random()*Math.PI*2,spd=1.5+Math.random()*5;
      s.particles.push({x:gx,y:gy,vx:Math.cos(angle)*spd+s.speed*0.15,vy:Math.sin(angle)*spd-2,
        life:30,maxLife:30,color:`rgba(${160+(Math.random()*95)|0},${200+(Math.random()*55)|0},255,${0.5+Math.random()*0.5})`,size:1.5+Math.random()*3});
    }
    for(let i=0;i<5;i++) s.particles.push({x:gx,y:gy,vx:(Math.random()-0.5)*4,vy:-Math.random()*3,life:10,maxLife:10,color:"#ffffffee",size:3+Math.random()*3});
  };

  const generatePlatforms=(jumpTier)=>{
    const [hMin,hMax]=BUILDING_H_RANGE[jumpTier];
    const [gMin,gMax]=GAP_RANGE[jumpTier];
    const platforms=[{type:"carriage",x:-20,w:380,h:82,glass:[],windowBarriers:[]}];
    let cx=360;
    while(cx<GW+900){
      const w=200+Math.random()*200;
      const gap=gMin+Math.random()*(gMax-gMin);
      if(Math.random()>0.45){
        const h=hMin+Math.random()*(hMax-hMin);
        platforms.push({type:"building",x:cx,w,h,leftWindowBroken:false,rightWindowBroken:false});
      } else {
        platforms.push({type:"carriage",x:cx,w,h:72+Math.random()*18,glass:makeSkylights(cx,w),windowBarriers:[]});
      }
      cx+=w+gap;
    }
    return platforms;
  };

  const startGame=useCallback(()=>{
    const u=upgradesRef.current;
    const jumpPower=[-10.5,-11.5,-12.8,-14.2,-15.8,-17.5][u.jumpPower];
    const maxSpeed=[4.5,5.5,7,8.5,10.5,13][u.speedCap];
    const coyote=[0,6,11,18][u.coyoteTime];
    const maxAirJumps=u.multiJump; // 0=single, 1=double, 2=triple, 3=quad
    const jumpTier=Math.min(u.multiJump, BUILDING_H_RANGE.length-1);
    const platforms=generatePlatforms(jumpTier);
    const coins=platforms.filter(b=>b.x>50&&Math.random()<0.5)
      .map(b=>({x:b.x+b.w*0.3+Math.random()*b.w*0.4,y:GH-b.h-14,collected:false}));
    gameRef.current={
      py:GH-82-PH,vy:0,speed:2.5,maxSpeed,jumpPower,coyote,coyoteLeft:0,
      maxAirJumps,airJumpsLeft:maxAirJumps,
      onGround:true,
      layer:"roof",inTrain:null,inBuilding:null,
      platforms,coins,particles:[],trail:[],steam:[],
      score:0,coinCount:0,frame:0,gameOver:false,
      skinColor:SKINS[skinRef.current].color,hatId:hatRef.current,
      camScale:1.0, // current camera zoom
      jumpTier,
    };
    setScreen("game");
  },[]);

  const jump=useCallback(()=>{
    const s=gameRef.current; if(!s||s.gameOver)return;
    if(s.layer==="building") return;
    const burst=(n,sp,col,vy2)=>{for(let i=0;i<n;i++) s.particles.push({x:PX+PW/2,y:s.py+PH,vx:(Math.random()-0.5)*sp,vy:vy2-Math.random()*1.5,life:18,maxLife:18,color:col,size:2+Math.random()*2});};
    if(s.onGround||s.coyoteLeft>0){
      s.vy=s.jumpPower; s.onGround=false; s.coyoteLeft=0;
      s.airJumpsLeft=s.maxAirJumps;
      burst(6,4,s.skinColor,-0.5);
    } else if(s.airJumpsLeft>0){
      s.vy=s.jumpPower*(0.75+0.1*s.airJumpsLeft); // each successive air jump slightly weaker
      s.airJumpsLeft--;
      // Different burst colour per jump count
      const cols=["#ffffff","#ffd93d","#ff9f1c","#ff4040"];
      const col=cols[s.maxAirJumps-s.airJumpsLeft-1]||s.skinColor;
      burst(10,6,col,-0.5);
      // Ring effect
      for(let i=0;i<16;i++){
        const a=(i/16)*Math.PI*2;
        s.particles.push({x:PX+PW/2+Math.cos(a)*12,y:s.py+PH/2+Math.sin(a)*8,
          vx:Math.cos(a)*3,vy:Math.sin(a)*3-1,life:14,maxLife:14,color:col,size:2});
      }
    }
  },[]);

  useEffect(()=>{
    if(screen!=="game"){cancelAnimationFrame(rafRef.current);return;}
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext("2d"); let fid;

    const tick=()=>{
      const s=gameRef.current; if(!s||s.gameOver)return;
      s.frame++; s.score+=s.speed/10; s.speed=Math.min(s.maxSpeed,s.speed+0.0015);
      s.vy+=GRAV; s.py+=s.vy;
      s.trail.unshift({x:PX,y:s.py}); if(s.trail.length>14)s.trail.pop();

      for(const b of s.platforms){
        b.x-=s.speed;
        if(b.glass) for(const g of b.glass) g.x-=s.speed;
      }
      for(const c of s.coins) c.x-=s.speed;
      for(const st of s.steam){st.x+=st.vx;st.y+=st.vy;st.size+=0.4;st.life--;}
      s.platforms=s.platforms.filter(b=>b.x+b.w>-30);
      s.coins=s.coins.filter(c=>c.x>-30);
      s.steam=s.steam.filter(st=>st.life>0);
      if(s.frame%28===0) s.steam.push({x:20,y:GH-100-Math.random()*30,vx:-0.3,vy:-0.5,life:70,maxLife:70,size:10+Math.random()*10});

      // Generate platforms
      const last=s.platforms[s.platforms.length-1];
      if(last&&last.x+last.w<GW+900){
        const w=200+Math.random()*200;
        const [gMin,gMax]=GAP_RANGE[s.jumpTier];
        const gap=gMin+Math.random()*(gMax-gMin)+s.speed*1.5;
        const nx=last.x+last.w+gap;
        if(Math.random()>0.45){
          const [hMin,hMax]=BUILDING_H_RANGE[s.jumpTier];
          const h=hMin+Math.random()*(hMax-hMin);
          s.platforms.push({type:"building",x:nx,w,h,leftWindowBroken:false,rightWindowBroken:false});
        } else {
          s.platforms.push({type:"carriage",x:nx,w,h:72+Math.random()*18,glass:makeSkylights(nx,w),windowBarriers:[]});
        }
        if(Math.random()<0.5) s.coins.push({x:nx+w*0.3+Math.random()*w*0.4,y:GH-last.h-14,collected:false});
      }

      // ── CAMERA ZOOM ──────────────────────────────────────
      // Zoom out when Hoppy goes high. normalPy = typical platform top
      const normalPy = GH - 100;
      const extraH = Math.max(0, normalPy - s.py);
      // With quad jump, can go ~300px above normal — zoom to fit
      const maxExtraH = s.maxAirJumps * 90 + 60;
      const targetScale = s.maxAirJumps > 0
        ? Math.max(0.45, 1 - (extraH / maxExtraH) * (1 - 0.45))
        : 1.0;
      s.camScale += (targetScale - s.camScale) * 0.06;

      // ── PHYSICS ─────────────────────────────────────────

      if(s.layer==="roof"){
        let landed=false;
        for(const b of s.platforms){
          const bTop=GH-b.h;
          if(b.type==="carriage"){
            if(PX+PW>b.x+2&&PX<b.x+b.w-2&&s.py+PH>=bTop&&s.py+PH<=bTop+Math.abs(s.vy)+8&&s.vy>=0){
              const hitG=b.glass&&b.glass.find(g=>!g.broken&&Math.abs(PX+PW/2-g.x)<14);
              if(hitG){hitG.broken=true;spawnGlass(s,hitG.x,bTop-4);s.layer="train";s.inTrain=b;s.onGround=false;}
              else{s.py=bTop-PH;s.vy=0;landed=true;s.airJumpsLeft=s.maxAirJumps;if(!s.onGround)for(let i=0;i<4;i++) s.particles.push({x:PX+PW/2+(Math.random()-0.5)*PW,y:s.py+PH,vx:(Math.random()-0.5)*3,vy:-Math.random()*2,life:12,maxLife:12,color:"#ffffff44",size:2});}
              break;
            }
          } else {
            if(PX+PW>b.x+2&&PX<b.x+b.w-2&&s.py+PH>=bTop&&s.py+PH<=bTop+Math.abs(s.vy)+8&&s.vy>=0){
              s.py=bTop-PH;s.vy=0;landed=true;s.airJumpsLeft=s.maxAirJumps;
              if(!s.onGround) for(let i=0;i<4;i++) s.particles.push({x:PX+PW/2+(Math.random()-0.5)*PW,y:s.py+PH,vx:(Math.random()-0.5)*3,vy:-Math.random()*2,life:12,maxLife:12,color:"#ffffff44",size:2});
              break;
            }
            // Horizontal entry
            const winTopAbs=bTop+WIN_TOP, winBotAbs=bTop+WIN_FLOOR;
            if(!landed&&PX+PW>=b.x&&PX+PW<b.x+24&&s.py+PH>winTopAbs&&s.py<winBotAbs){
              b.leftWindowBroken=true; spawnGlass(s,b.x+12,winTopAbs+WIN_H/2);
              s.py=winBotAbs-PH;s.vy=0;s.layer="building";s.inBuilding=b;s.onGround=true;
              break;
            }
          }
        }
        if(s.onGround&&!landed&&s.layer==="roof") s.coyoteLeft=s.coyote;
        else if(landed) s.coyoteLeft=0;
        else if(s.coyoteLeft>0) s.coyoteLeft--;
        if(s.layer==="roof") s.onGround=landed;

      } else if(s.layer==="train"){
        const b=s.inTrain,ceilY=GH-b.h+7,floorY=INTERIOR_FLOOR_Y;
        if(b.x+b.w<PX+PW){s.layer="roof";s.inTrain=null;s.py=floorY-PH;s.onGround=false;}
        else{
          if(s.vy>=0&&s.py+PH>=floorY){s.py=floorY-PH;s.vy=0;s.onGround=true;s.airJumpsLeft=s.maxAirJumps;}
          else s.onGround=false;
          if(s.vy<0&&s.py<=ceilY+4){
            const nearest=b.glass&&b.glass.reduce((best,g)=>{const d=Math.abs(PX+PW/2-g.x);return(!best||d<Math.abs(PX+PW/2-best.x))?g:best;},null);
            if(nearest&&!nearest.broken){nearest.broken=true;spawnGlass(s,nearest.x,ceilY);}
            else if(!nearest)spawnGlass(s,PX+PW/2,ceilY);
            s.py=ceilY-PH-2;s.layer="roof";s.inTrain=null;s.onGround=false;s.coyoteLeft=0;
          }
        }
      } else if(s.layer==="building"){
        const b=s.inBuilding,bTop=GH-b.h,floorY=bTop+WIN_FLOOR;
        s.py=floorY-PH;s.vy=0;s.onGround=true;
        if(b.x+b.w-10<=PX+PW){
          b.rightWindowBroken=true;spawnGlass(s,b.x+b.w-5,bTop+WIN_TOP+WIN_H/2);
          s.layer="roof";s.inBuilding=null;s.onGround=false;s.vy=-1;s.coyoteLeft=s.coyote;
          s.airJumpsLeft=s.maxAirJumps;
        }
      }

      if(s.py>GH+80){
        s.gameOver=true;
        const finalScore=Math.floor(s.score),earned=Math.floor(finalScore/8)+s.coinCount*8,isNewBest=finalScore>bestRef.current;
        setBestScore(b=>Math.max(b,finalScore));setCredits(c=>c+earned);
        setRunData({score:finalScore,coins:s.coinCount,earned,isNewBest});
        setTimeout(()=>setScreen("dead"),350);return;
      }

      for(const c of s.coins)
        if(!c.collected&&Math.abs(PX+PW/2-c.x)<PW/2+10&&Math.abs(s.py+PH/2-c.y)<PH/2+10){
          c.collected=true;s.coinCount++;
          for(let i=0;i<8;i++) s.particles.push({x:c.x,y:c.y,vx:(Math.random()-0.5)*5,vy:-Math.random()*4-1,life:25,maxLife:25,color:"#ffd93d",size:2+Math.random()*2});
        }
      for(const p of s.particles){p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.life--;}
      s.particles=s.particles.filter(p=>p.life>0);

      // ── DRAW ─────────────────────────────────────────────
      ctx.clearRect(0,0,GW,GH);

      // Apply camera zoom — pivot at bottom-center
      const sc=s.camScale;
      const tx=GW/2*(1-sc), ty=GH*(1-sc);
      ctx.save();
      ctx.setTransform(sc,0,0,sc,tx,ty);

      // Extended sky (covers zoomed out area above GH)
      const skyTop=-GH*1.2; // well above max zoom
      const sky=ctx.createLinearGradient(0,skyTop,0,GH);
      sky.addColorStop(0,"#020308"); sky.addColorStop(0.3,"#080514"); sky.addColorStop(0.7,"#0f0a1e"); sky.addColorStop(1,"#1c0f0c");
      ctx.fillStyle=sky; ctx.fillRect(-GW,skyTop,GW*3,GH-skyTop);

      // Stars — extended range
      for(let i=0;i<100;i++){
        const sx=((i*137.5+s.frame*s.speed*0.07)%(GW+10)+GW+10)%(GW+10);
        const sy=((i*46.1)%(GH*1.5))-GH*0.5;
        if(sy>GH*0.5) continue;
        const p=0.2+0.8*Math.abs(Math.sin(i*2.3+s.frame*0.011));
        ctx.globalAlpha=p*0.7;ctx.fillStyle=i%7===0?"#ffe4c4":"#fff";
        ctx.fillRect(sx,sy,i%13===0?2:1,i%13===0?2:1);
      }
      ctx.globalAlpha=1;

      // Moon
      ctx.save();ctx.shadowColor="#fff8dc";ctx.shadowBlur=20;ctx.fillStyle="#fff8dc";
      ctx.beginPath();ctx.arc(GW*0.78,-10,20,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#080514";ctx.shadowBlur=0;ctx.beginPath();ctx.arc(GW*0.78+7,-14,17,0,Math.PI*2);ctx.fill();ctx.restore();

      // BG city — taller to fill zoomed view
      ctx.fillStyle="#0c0820";
      for(let i=0;i<14;i++){
        const bx=((i*55-s.frame*s.speed*0.04)%(GW+80)+GW+80)%(GW+80)-40,bh=40+((i*37)%90);
        ctx.fillRect(bx,GH-bh-14,32,bh);
        for(let r=0;r<5;r++) for(let cc=0;cc<2;cc++){
          ctx.fillStyle=(i+r+cc)%3!==0?"#ffcc4411":"transparent";
          ctx.fillRect(bx+4+cc*12,GH-bh-14+6+r*10,7,6);
        }
      }

      // Hills
      ctx.fillStyle="#0d0820";
      for(let i=0;i<7;i++){const hx=((i*110-s.frame*s.speed*0.05)%(GW+160)+GW+160)%(GW+160)-80;ctx.beginPath();ctx.moveTo(hx-30,GH);ctx.quadraticCurveTo(hx+45,GH-55,hx+120,GH);ctx.fill();}
      ctx.fillStyle="#120e22";
      for(let i=0;i<9;i++){const hx=((i*85-s.frame*s.speed*0.12)%(GW+110)+GW+110)%(GW+110)-55;ctx.beginPath();ctx.moveTo(hx-20,GH);ctx.quadraticCurveTo(hx+28,GH-35,hx+76,GH);ctx.fill();}

      // Poles
      for(let i=0;i<6;i++){
        const tx2=((i*110-s.frame*s.speed*0.38)%(GW+140)+GW+140)%(GW+140)-70;
        ctx.strokeStyle="#1e1635";ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(tx2,GH-4);ctx.lineTo(tx2,GH-85);ctx.stroke();
        ctx.beginPath();ctx.moveTo(tx2-14,GH-76);ctx.lineTo(tx2+14,GH-76);ctx.stroke();
        ctx.fillStyle="#2a1f40";ctx.fillRect(tx2-14,GH-79,3,5);ctx.fillRect(tx2+11,GH-79,3,5);
      }
      for(const st of s.steam){ctx.globalAlpha=(st.life/st.maxLife)*0.35;ctx.fillStyle="#c8bcd8";ctx.beginPath();ctx.arc(st.x,st.y,st.size,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=1;

      // Tracks
      ctx.fillStyle="#100b20";ctx.fillRect(0,GH-6,GW,6);
      ctx.fillStyle="#2a1f40";ctx.fillRect(0,GH-5,GW,2);ctx.fillRect(0,GH-3,GW,2);
      for(let i=0;i<18;i++){const sx=((i*32-s.frame*s.speed*0.9)%(GW+32)+GW+32)%(GW+32)-16;ctx.fillStyle="#1c1535";ctx.fillRect(sx-6,GH-6,12,6);}

      // Platforms
      for(const b of s.platforms){
        if(b.type==="carriage"){drawCarriageExterior(ctx,b,s.skinColor,s.frame);if(b.glass)for(const g of b.glass)drawSkylight(ctx,b,g);}
        else drawBuilding(ctx,b,s.frame);
      }

      if(s.layer==="train"&&s.inTrain) drawTrainInterior(ctx,s.inTrain,s.frame);
      if(s.layer==="building"&&s.inBuilding) drawBuildingInterior(ctx,s.inBuilding,s.frame);

      // Coins
      for(const c of s.coins){
        if(c.collected)continue;
        const pulse=0.7+0.3*Math.sin(s.frame*0.12+c.x*0.05);
        ctx.save();ctx.shadowColor="#ffd93d";ctx.shadowBlur=12*pulse;ctx.fillStyle=`rgba(255,217,61,${pulse})`;
        ctx.beginPath();ctx.moveTo(c.x,c.y-7);ctx.lineTo(c.x+5,c.y);ctx.lineTo(c.x,c.y+7);ctx.lineTo(c.x-5,c.y);ctx.closePath();ctx.fill();ctx.restore();
      }

      // Trail
      for(let i=s.trail.length-1;i>=0;i--){
        const t=s.trail[i],a=(1-i/s.trail.length)*0.3,sc2=1-(i/s.trail.length)*0.72;
        ctx.globalAlpha=a;ctx.fillStyle=s.skinColor;ctx.fillRect(t.x+PW*(1-sc2)/2,t.y+PH*(1-sc2)/2,PW*sc2,PH*sc2);
      }
      ctx.globalAlpha=1;

      if(!s.gameOver)drawHoppy(ctx,PX,s.py,s.frame,s.skinColor,s.onGround,s.vy,s.hatId,s.airJumpsLeft,s.maxAirJumps);

      // Foregrounds
      if(s.layer==="train"&&s.inTrain){
        drawTrainForeground(ctx,s.inTrain);
        const dist=s.inTrain.x+s.inTrain.w-PX;
        if(dist<130){const u2=1-(dist/130);ctx.fillStyle=`rgba(255,100,0,${u2*0.35})`;ctx.fillRect(0,0,GW,GH);ctx.fillStyle=`rgba(255,180,50,${u2*0.9})`;ctx.font=`bold ${(10+u2*4)|0}px 'Courier New'`;ctx.textAlign="center";ctx.fillText("JUMP OUT!",GW/2,GH/2-20);ctx.textAlign="left";}
      }
      if(s.layer==="building"&&s.inBuilding){
        drawBuildingForeground(ctx,s.inBuilding);
        const dist=s.inBuilding.x+s.inBuilding.w-PX;
        if(dist<80){const u2=1-(dist/80);ctx.fillStyle=`rgba(255,140,0,${u2*0.2})`;ctx.fillRect(0,0,GW,GH);}
      }

      // Particles
      for(const p of s.particles){ctx.globalAlpha=(p.life/p.maxLife)*0.92;ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);}
      ctx.globalAlpha=1;

      // Restore camera transform before HUD
      ctx.restore();

      // HUD (always full-size, no camera transform)
      ctx.fillStyle="rgba(0,0,0,0.72)";ctx.fillRect(0,0,GW,26);
      ctx.font="bold 13px 'Courier New',monospace";
      ctx.textAlign="center";ctx.fillStyle="#fff";ctx.fillText(`${Math.floor(s.score)}m`,GW/2,17);
      ctx.textAlign="left";ctx.fillStyle="#ffd93d";ctx.fillText(`◆ ${s.coinCount}`,8,17);
      ctx.textAlign="right";ctx.fillStyle=s.skinColor+"aa";ctx.fillText(`${s.speed.toFixed(1)}x`,GW-8,17);
      // Jump tier label
      if(s.maxAirJumps>0){
        const labels=["","DBL","TRIPLE","QUAD"];
        ctx.textAlign="center";ctx.fillStyle="#ffffff66";
        ctx.fillText(labels[s.maxAirJumps]||"",GW/2+70,17);
      }
      if(s.layer==="train"){ctx.textAlign="center";ctx.fillStyle="#ff9f1c";ctx.fillText("▼ TRAIN",GW/2-50,17);}
      if(s.layer==="building"){ctx.textAlign="center";ctx.fillStyle="#c9a84c";ctx.fillText("▶ INSIDE",GW/2-50,17);}
      // Zoom indicator
      if(sc<0.85){
        ctx.textAlign="right";ctx.fillStyle="#ffffff44";
        ctx.font="10px 'Courier New'";
        ctx.fillText(`${Math.round(sc*100)}%`,GW-8,GH-6);
      }
      ctx.textAlign="left";

      fid=requestAnimationFrame(tick);rafRef.current=fid;
    };
    fid=requestAnimationFrame(tick);rafRef.current=fid;
    return()=>cancelAnimationFrame(fid);
  },[screen]);

  useEffect(()=>{
    const onKey=e=>{if(["Space","ArrowUp","KeyW"].includes(e.code)){e.preventDefault();if(screen==="game")jump();else if(screen==="menu"||screen==="dead")startGame();}};
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  },[screen,jump,startGame]);

  const buyUpgrade=key=>{
    const data=UPGRADE_DATA[key],level=upgrades[key];if(level>=data.max)return;
    const cost=data.costs[level];if(creditsRef.current<cost)return;
    setCredits(c=>c-cost);setUpgrades(u=>{const nu={...u,[key]:u[key]+1};upgradesRef.current=nu;return nu;});
    setFlash(key);setTimeout(()=>setFlash(null),500);
  };
  const buyHat=id=>{
    if(ownedRef.current.includes(id))return;
    const hat=HATS.find(h=>h.id===id);if(!hat||creditsRef.current<hat.price)return;
    setCredits(c=>c-hat.price);
    setOwnedHats(o=>{const n=[...o,id];ownedRef.current=n;return n;});
    setHatId(id);hatRef.current=id;setFlash("hat_"+id);setTimeout(()=>setFlash(null),500);
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

  const jumpLabel=["SINGLE","DOUBLE","TRIPLE","QUAD"][upgrades.multiJump]||"SINGLE";

  if(screen==="game") return (
    <div style={S.page}><div style={{width:"100%",maxWidth:"600px"}}>
      <canvas ref={canvasRef} width={GW} height={GH}
        style={{width:"100%",aspectRatio:`${GW}/${GH}`,display:"block",imageRendering:"pixelated",cursor:"pointer",border:`2px solid ${c}22`,boxShadow:`0 0 40px ${c}15`}}
        onPointerDown={e=>{e.preventDefault();jump();}}/>
      <div style={{padding:"8px 12px",background:"#07060d",display:"flex",justifyContent:"space-between",fontSize:"10px",color:"#444"}}>
        <span>TAP / SPACE TO HOP</span><span>◆ {credits}</span>
      </div>
    </div></div>
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
          const isMultiJump=key==="multiJump";
          const nextLabel=isMultiJump?["→ DOUBLE","→ TRIPLE","→ QUAD"][level]||"":null;
          return(<div key={key} style={{...S.card,border:`1px solid ${flash===key?c:c+"22"}`,background:flash===key?c+"14":"#090815",transition:"all 0.3s",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:"12px",fontWeight:"bold",color:maxed?"#555":"#eee"}}>{data.emoji} {data.name}</div>
              <div style={{fontSize:"10px",color:"#555",marginTop:"3px"}}>{data.desc}</div>
              {isMultiJump&&<div style={{fontSize:"10px",color:c,marginTop:"3px"}}>{["SINGLE","DOUBLE","TRIPLE","QUAD"][level]} JUMP</div>}
              <div style={{marginTop:"8px",display:"flex",gap:"4px"}}>{Array.from({length:data.max}).map((_,i)=>(<div key={i} style={{width:"14px",height:"3px",background:i<level?c:"#1c1c30",boxShadow:i<level?`0 0 5px ${c}`:"none"}}/>))}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"4px"}}>
              {nextLabel&&<div style={{fontSize:"9px",color:c+"88",letterSpacing:"1px"}}>{nextLabel}</div>}
              {maxed?<span style={{fontSize:"10px",color:"#ffd93d"}}>MAXED</span>:<button style={{...S.btn(can),opacity:can?1:0.35,padding:"8px 14px",fontSize:"11px"}} onClick={()=>buyUpgrade(key)}>◆{cost}</button>}
            </div>
          </div>);
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
      <div style={{...S.row,width:"100%"}}>
        <div style={{fontSize:"16px",fontWeight:"bold",color:c,letterSpacing:"3px"}}>HOPPY'S LOOK</div>
        <div style={{color:"#ffd93d",fontSize:"14px",fontWeight:"bold"}}>◆{credits}</div>
      </div>
      <div style={{width:"100%"}}>
        <div style={S.label}>FROG COLOUR</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"10px"}}>
          {SKINS.map((s2,i)=>(<div key={i} onClick={()=>setSkinIdx(i)} style={{width:"44px",height:"44px",background:s2.color,boxShadow:skinIdx===i?`0 0 18px ${s2.color}`:"none",border:skinIdx===i?"2px solid #fff":"2px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{skinIdx===i&&<span style={{color:"#111",fontSize:"14px"}}>✓</span>}</div>))}
        </div>
      </div>
      <div style={{width:"100%"}}>
        <div style={S.label}>HATS</div>
        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {HATS.map(hat=>{
            const owned=ownedHats.includes(hat.id),equipped=hatId===hat.id,can=!owned&&credits>=hat.price;
            return(<div key={hat.id} style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${flash==="hat_"+hat.id?c:equipped?c+"66":c+"22"}`,background:equipped?c+"0e":"#090815",transition:"all 0.3s"}}>
              <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
                <div style={{width:"36px",height:"36px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {hat.id==="none"&&<div style={{width:"22px",height:"10px",background:"#2a2040",borderRadius:"2px"}}/>}
                  {hat.id==="top"&&<div style={{position:"relative",width:"22px",height:"28px"}}><div style={{position:"absolute",bottom:"3px",left:"0",width:"22px",height:"4px",background:"#1a6bd4"}}/><div style={{position:"absolute",bottom:"7px",left:"3px",width:"16px",height:"18px",background:"#1a6bd4"}}/></div>}
                  {hat.id==="cap"&&<div style={{position:"relative",width:"24px",height:"20px"}}><div style={{position:"absolute",bottom:"0",left:"0",width:"24px",height:"4px",background:"#c0392b"}}/><div style={{position:"absolute",bottom:"4px",left:"2px",width:"18px",height:"12px",background:"#c0392b"}}/><div style={{position:"absolute",bottom:"10px",right:"0",width:"7px",height:"6px",background:"#a93226"}}/></div>}
                  {hat.id==="crown"&&<div style={{position:"relative",width:"24px",height:"22px"}}><div style={{position:"absolute",bottom:"0",left:"0",width:"24px",height:"11px",background:"#f1c40f"}}/>{[0,8,16].map(x=><div key={x} style={{position:"absolute",bottom:"11px",left:`${x}px`,width:"7px",height:"9px",background:"#f1c40f"}}/>)}</div>}
                </div>
                <div>
                  <div style={{fontSize:"12px",fontWeight:"bold",color:equipped?"#fff":"#aaa"}}>{hat.name}</div>
                  <div style={{fontSize:"10px",color:"#555",marginTop:"2px"}}>{hat.price===0?"FREE":`◆${hat.price}`}</div>
                </div>
              </div>
              <div>
                {equipped?<span style={{fontSize:"10px",color:c}}>EQUIPPED</span>
                :owned?<button style={{...S.btn(true),padding:"7px 14px",fontSize:"11px"}} onClick={()=>{setHatId(hat.id);hatRef.current=hat.id;}}>EQUIP</button>
                :<button style={{...S.btn(can),opacity:can?1:0.35,padding:"7px 14px",fontSize:"11px"}} onClick={()=>buyHat(hat.id)}>◆{hat.price}</button>}
              </div>
            </div>);
          })}
        </div>
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
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:"10px",color:c+"88",letterSpacing:"6px",marginBottom:"8px"}}>IDLE ENDLESS RUNNER</div>
        <div style={S.title}>HOPPY'S</div>
        <div style={{fontSize:"28px",fontWeight:"bold",letterSpacing:"3px",color:c,textShadow:`0 0 20px ${c}`,textAlign:"center"}}>ADVENTURE</div>
        {upgrades.multiJump>0&&<div style={{fontSize:"10px",color:c+"88",letterSpacing:"3px",marginTop:"6px"}}>{jumpLabel} JUMP UNLOCKED</div>}
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
