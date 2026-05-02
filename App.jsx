import { useState, useEffect, useRef, useCallback } from "react";

const GW = 480;
const GH = 200;
const PX = 70;
const PW = 14;
const PH = 22;
const GRAV = 0.52;

const UPGRADE_DATA = {
  jumpPower:  { name: "JUMP BOOST",  desc: "Leap higher over gaps",       emoji: "⬆", costs: [60, 150, 350, 800, 2000], max: 5 },
  speedCap:   { name: "MAX SPEED",   desc: "Higher terminal velocity",     emoji: "⚡", costs: [80, 200, 500, 1200, 3000], max: 5 },
  idleRate:   { name: "IDLE INCOME", desc: "Earn credits while away",      emoji: "◆", costs: [100, 300, 800, 2000, 5000], max: 5 },
  doubleJump: { name: "DOUBLE JUMP", desc: "Jump again mid-air",           emoji: "✦", costs: [500], max: 1 },
  coyoteTime: { name: "EDGE GRIP",   desc: "Jump just after a ledge edge", emoji: "▸", costs: [150, 400, 1000], max: 3 },
};

const SKINS = [
  { color: "#00f5d4", name: "TEAL" },
  { color: "#ff6b6b", name: "CRIMSON" },
  { color: "#ffd93d", name: "GOLD" },
  { color: "#c77dff", name: "VIOLET" },
  { color: "#ff9f1c", name: "EMBER" },
  { color: "#74b9ff", name: "AZURE" },
  { color: "#ffffff", name: "GHOST" },
  { color: "#a8ff78", name: "NEON" },
];

const SAVE_KEY = "charlabolt_save";

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function writeSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}

export default function App() {
  const canvasRef = useRef(null);
  const gameRef   = useRef(null);
  const rafRef    = useRef(null);

  const saved = loadSave();

  const [screen,    setScreen]    = useState("menu");
  const [credits,   setCredits]   = useState(saved?.credits   ?? 50);
  const [bestScore, setBestScore] = useState(saved?.bestScore  ?? 0);
  const [upgrades,  setUpgrades]  = useState(saved?.upgrades   ?? { jumpPower:0, speedCap:0, idleRate:0, doubleJump:0, coyoteTime:0 });
  const [skinIdx,   setSkinIdx]   = useState(saved?.skinIdx    ?? 0);
  const [runData,   setRunData]   = useState({ score:0, coins:0, earned:0, isNewBest:false });
  const [flash,     setFlash]     = useState(null);
  const [idlePop,   setIdlePop]   = useState(0);

  // Refs for game loop access
  const upgradesRef  = useRef(upgrades);
  const skinRef      = useRef(skinIdx);
  const bestRef      = useRef(bestScore);
  const creditsRef   = useRef(credits);

  useEffect(() => { upgradesRef.current  = upgrades;  }, [upgrades]);
  useEffect(() => { skinRef.current      = skinIdx;   }, [skinIdx]);
  useEffect(() => { bestRef.current      = bestScore; }, [bestScore]);
  useEffect(() => { creditsRef.current   = credits;   }, [credits]);

  // Persist on change
  useEffect(() => {
    writeSave({ credits, bestScore, upgrades, skinIdx });
  }, [credits, bestScore, upgrades, skinIdx]);

  // Idle income
  useEffect(() => {
    const rates = [0, 2, 5, 14, 35, 90];
    const iv = setInterval(() => {
      const rate = rates[upgradesRef.current.idleRate] ?? 0;
      if (rate > 0 && bestRef.current > 0) {
        const amt = Math.max(1, Math.floor(rate * Math.log10(bestRef.current + 10)));
        setCredits(c => c + amt);
        setIdlePop(amt);
        setTimeout(() => setIdlePop(0), 2500);
      }
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const startGame = useCallback(() => {
    const u  = upgradesRef.current;
    const jumpPower = [-10.5, -11.5, -12.8, -14.2, -15.8, -17.5][u.jumpPower];
    const maxSpeed  = [6, 7.5, 9, 11, 13.5, 16.5][u.speedCap];
    const coyote    = [0, 6, 11, 18][u.coyoteTime];
    const hasDbl    = u.doubleJump >= 1;
    const sc        = SKINS[skinRef.current];

    const buildings = [];
    let bx = -20;
    buildings.push({ x: bx, w: 300, h: 60 });
    bx = 280;
    while (bx < GW + 400) {
      const w = 90 + Math.random() * 130;
      const h = 35 + Math.random() * 55;
      const gap = 22 + Math.random() * 46;
      buildings.push({ x: bx, w, h });
      bx += w + gap;
    }

    gameRef.current = {
      py: GH - 60 - PH, vy: 0,
      speed: 4, maxSpeed, jumpPower, coyote, coyoteLeft: 0,
      hasDbl, dbLeft: 0, onGround: true,
      buildings, coins: [], particles: [], trail: [],
      score: 0, coinCount: 0, frame: 0, gameOver: false,
      skinColor: sc.color,
    };
    setScreen("game");
  }, []);

  const jump = useCallback(() => {
    const s = gameRef.current;
    if (!s || s.gameOver) return;
    const burst = (n, spread, col) => {
      for (let i = 0; i < n; i++)
        s.particles.push({ x: PX+PW/2, y: s.py+PH,
          vx:(Math.random()-0.5)*spread, vy:-Math.random()*2-0.5,
          life:18, maxLife:18, color:col, size:2+Math.random()*2 });
    };
    if (s.onGround || s.coyoteLeft > 0) {
      s.vy = s.jumpPower; s.onGround = false; s.coyoteLeft = 0;
      if (s.hasDbl) s.dbLeft = 1;
      burst(5, 3, s.skinColor);
    } else if (s.dbLeft > 0) {
      s.vy = s.jumpPower * 0.85; s.dbLeft = 0;
      for (let i = 0; i < 8; i++)
        s.particles.push({ x:PX+PW/2, y:s.py+PH/2,
          vx:(Math.random()-0.5)*6, vy:(Math.random()-0.5)*6,
          life:22, maxLife:22, color:s.skinColor, size:3+Math.random()*2 });
    }
  }, []);

  // ── GAME LOOP ─────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "game") { cancelAnimationFrame(rafRef.current); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let fid;

    const tick = () => {
      const s = gameRef.current;
      if (!s || s.gameOver) return;

      s.frame++;
      s.score += s.speed / 10;
      s.speed = Math.min(s.maxSpeed, s.speed + 0.0028);

      s.vy += GRAV;
      s.py += s.vy;
      s.trail.unshift({ x:PX, y:s.py });
      if (s.trail.length > 10) s.trail.pop();

      for (const b of s.buildings) b.x -= s.speed;
      s.buildings = s.buildings.filter(b => b.x + b.w > -10);
      s.coins = s.coins.filter(c => c.x > -30);

      const last = s.buildings[s.buildings.length - 1];
      if (last.x + last.w < GW + 400) {
        const w = 90 + Math.random() * 130;
        const h = 35 + Math.random() * 55;
        const gap = 22 + Math.random() * 46 + s.speed * 1.8;
        const nb = { x: last.x + last.w + gap, w, h };
        s.buildings.push(nb);
        if (Math.random() < 0.6)
          s.coins.push({ x: nb.x + nb.w*0.3 + Math.random()*nb.w*0.4, y: GH - nb.h - 12, collected: false });
      }

      let landed = false;
      for (const b of s.buildings) {
        const bTop = GH - b.h;
        if (PX+PW > b.x+2 && PX < b.x+b.w-2 &&
            s.py+PH >= bTop && s.py+PH <= bTop+Math.abs(s.vy)+6 && s.vy >= 0) {
          s.py = bTop - PH; s.vy = 0; landed = true;
          if (!s.onGround && s.hasDbl) s.dbLeft = 1;
          if (!s.onGround)
            for (let i = 0; i < 5; i++)
              s.particles.push({ x:PX+PW/2+(Math.random()-0.5)*PW, y:s.py+PH,
                vx:(Math.random()-0.5)*3, vy:-Math.random()*1.5,
                life:14, maxLife:14, color:"#ffffff88", size:1.5 });
          break;
        }
      }

      if (s.onGround && !landed)      s.coyoteLeft = s.coyote;
      else if (landed)                 s.coyoteLeft = 0;
      else if (s.coyoteLeft > 0)       s.coyoteLeft--;
      s.onGround = landed;

      if (s.py > GH + 60) {
        s.gameOver = true;
        const finalScore = Math.floor(s.score);
        const earned = Math.floor(finalScore / 8) + s.coinCount * 8;
        const isNewBest = finalScore > bestRef.current;
        setBestScore(b => Math.max(b, finalScore));
        setCredits(c => c + earned);
        setRunData({ score: finalScore, coins: s.coinCount, earned, isNewBest });
        setTimeout(() => setScreen("dead"), 350);
        return;
      }

      for (const c of s.coins) {
        if (!c.collected && Math.abs(PX+PW/2 - c.x) < PW/2+8 && Math.abs(s.py+PH/2 - c.y) < PH/2+8) {
          c.collected = true; s.coinCount++;
          for (let i = 0; i < 8; i++)
            s.particles.push({ x:c.x, y:c.y,
              vx:(Math.random()-0.5)*5, vy:-Math.random()*4-1,
              life:25, maxLife:25, color:"#ffd93d", size:2+Math.random()*2 });
        }
      }

      for (const p of s.particles) { p.x+=p.vx; p.y+=p.vy; p.vy+=0.12; p.life--; }
      s.particles = s.particles.filter(p => p.life > 0);

      // ── DRAW ──────────────────────────────────────────────
      ctx.clearRect(0, 0, GW, GH);
      const sg = ctx.createLinearGradient(0,0,0,GH);
      sg.addColorStop(0,"#050510"); sg.addColorStop(1,"#0c0820");
      ctx.fillStyle = sg; ctx.fillRect(0,0,GW,GH);

      // Stars
      for (let i = 0; i < 40; i++) {
        const sx = ((i*137.5 + s.frame*s.speed*0.12) % (GW+10) + GW+10) % (GW+10);
        const sy = (i*53.3) % (GH*0.55);
        const p  = 0.3 + 0.7*Math.abs(Math.sin(i*2.3 + s.frame*0.015));
        ctx.globalAlpha = p*0.5; ctx.fillStyle="#fff";
        ctx.fillRect(sx,sy,1,1);
      }
      ctx.globalAlpha = 1;

      // Speed lines
      if (s.speed > 9) {
        const t = (s.speed-9) / (s.maxSpeed-9);
        ctx.globalAlpha = t*0.15; ctx.strokeStyle=s.skinColor; ctx.lineWidth=1;
        for (let i=0;i<8;i++){
          const ly = 20 + (i*67+s.frame*8)%(GH-30);
          const len = 30+Math.random()*60;
          ctx.beginPath(); ctx.moveTo(GW,ly); ctx.lineTo(GW-len,ly); ctx.stroke();
        }
        ctx.globalAlpha=1;
      }

      // BG city
      ctx.fillStyle="#0b0b1e";
      for (let i=0;i<14;i++){
        const bx2 = ((i*73 - s.frame*s.speed*0.18)%(GW+80)+GW+80)%(GW+80)-40;
        const bh2 = 18+(i*29)%58;
        ctx.fillRect(bx2,GH-bh2,52,bh2);
        if(i%4===0){
          ctx.fillRect(bx2+22,GH-bh2-14,3,14);
          if(s.frame%80<40){ ctx.fillStyle="#ff3333aa"; ctx.fillRect(bx2+22,GH-bh2-14,3,3); ctx.fillStyle="#0b0b1e"; }
        }
      }

      // Buildings
      for (const b of s.buildings) {
        const bTop = GH - b.h;
        ctx.fillStyle="#03030c"; ctx.fillRect(b.x+4,bTop+4,b.w,b.h);
        const bg = ctx.createLinearGradient(b.x,bTop,b.x+b.w,bTop);
        bg.addColorStop(0,"#111128"); bg.addColorStop(1,"#0d0d20");
        ctx.fillStyle=bg; ctx.fillRect(b.x,bTop,b.w,b.h);
        ctx.fillStyle=s.skinColor+"28"; ctx.fillRect(b.x,bTop,b.w,2);
        ctx.fillStyle=s.skinColor+"10"; ctx.fillRect(b.x,bTop+2,b.w,2);
        const wCols = Math.floor((b.w-10)/16);
        const wRows = Math.floor((b.h-8)/14);
        for (let wr=0;wr<wRows;wr++) for (let wc=0;wc<wCols;wc++){
          const wx=b.x+8+wc*16, wy=bTop+8+wr*14;
          const seed=(Math.floor(wx*0.1)*31+Math.floor(wy*0.1)*17)%7;
          if(seed<4){
            const flick=Math.sin(s.frame*0.04+seed*1.7)>0.97;
            ctx.fillStyle=flick?"#ffee9908":"#ffee9938";
            ctx.fillRect(wx,wy,7,8);
          }
        }
      }

      // Coins
      for (const c of s.coins) {
        if(c.collected) continue;
        const pulse=0.75+0.25*Math.sin(s.frame*0.12+c.x*0.05);
        ctx.save(); ctx.shadowColor="#ffd93d"; ctx.shadowBlur=10*pulse;
        ctx.fillStyle=`rgba(255,217,61,${pulse})`;
        ctx.beginPath();
        ctx.moveTo(c.x,c.y-7); ctx.lineTo(c.x+5,c.y);
        ctx.lineTo(c.x,c.y+7); ctx.lineTo(c.x-5,c.y);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }

      // Trail
      for (let i=s.trail.length-1;i>=0;i--){
        const t=s.trail[i], a=(1-i/s.trail.length)*0.38, sc2=1-(i/s.trail.length)*0.65;
        ctx.globalAlpha=a; ctx.fillStyle=s.skinColor;
        ctx.fillRect(t.x+PW*(1-sc2)/2,t.y+PH*(1-sc2)/2,PW*sc2,PH*sc2);
      }
      ctx.globalAlpha=1;

      // Player
      if (!s.gameOver){
        ctx.save();
        ctx.shadowColor=s.skinColor; ctx.shadowBlur=16;
        ctx.fillStyle=s.skinColor;
        ctx.fillRect(PX,s.py,PW,PH-8);
        const lp = s.onGround ? s.frame*0.38 : 0;
        ctx.fillStyle=s.skinColor+"cc";
        ctx.fillRect(PX+1,s.py+PH-8,5,8+Math.sin(lp)*3);
        ctx.fillRect(PX+PW-6,s.py+PH-8,5,8-Math.sin(lp)*3);
        ctx.fillStyle="#00000088"; ctx.fillRect(PX+PW-5,s.py+3,3,3);
        ctx.restore();
      }

      // Particles
      for (const p of s.particles){
        ctx.globalAlpha=(p.life/p.maxLife)*0.9;
        ctx.fillStyle=p.color;
        ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
      }
      ctx.globalAlpha=1;

      // HUD
      ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(0,0,GW,26);
      ctx.font="bold 13px 'Courier New',monospace";
      ctx.textAlign="center"; ctx.fillStyle="#fff";
      ctx.fillText(`${Math.floor(s.score)}m`,GW/2,17);
      ctx.textAlign="left"; ctx.fillStyle="#ffd93d";
      ctx.fillText(`◆ ${s.coinCount}`,8,17);
      ctx.textAlign="right"; ctx.fillStyle=s.skinColor+"aa";
      ctx.fillText(`${s.speed.toFixed(1)}x`,GW-8,17);
      ctx.textAlign="left";

      fid = requestAnimationFrame(tick);
      rafRef.current = fid;
    };

    fid = requestAnimationFrame(tick);
    rafRef.current = fid;
    return () => cancelAnimationFrame(fid);
  }, [screen]);

  // Keyboard
  useEffect(() => {
    const onKey = e => {
      if (["Space","ArrowUp","KeyW"].includes(e.code)){
        e.preventDefault();
        if (screen==="game") jump();
        else if (screen==="menu"||screen==="dead") startGame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, jump, startGame]);

  const buyUpgrade = key => {
    const data  = UPGRADE_DATA[key];
    const level = upgrades[key];
    if (level >= data.max) return;
    const cost = data.costs[level];
    if (creditsRef.current < cost) return;
    setCredits(c => c - cost);
    setUpgrades(u => {
      const nu = { ...u, [key]: u[key] + 1 };
      upgradesRef.current = nu;
      return nu;
    });
    setFlash(key);
    setTimeout(() => setFlash(null), 500);
  };

  const skin = SKINS[skinIdx];
  const c    = skin.color;

  const S = {
    page: { background:"#060612", color:"#fff", minHeight:"100vh",
      fontFamily:"'Courier New',monospace", display:"flex", flexDirection:"column",
      alignItems:"center", WebkitUserSelect:"none", userSelect:"none" },
    wrap: { width:"100%", maxWidth:"600px", padding:"20px 16px",
      display:"flex", flexDirection:"column", alignItems:"center", gap:"20px" },
    title:{ fontSize:"38px", fontWeight:"bold", letterSpacing:"6px",
      color:c, textShadow:`0 0 20px ${c},0 0 50px ${c}55`, textAlign:"center" },
    sub:  { fontSize:"10px", color:"#444", letterSpacing:"4px", textAlign:"center" },
    card: { background:"#0a0a18", border:`1px solid ${c}25`, padding:"16px 20px", width:"100%" },
    row:  { display:"flex", justifyContent:"space-between", alignItems:"center" },
    label:{ fontSize:"10px", color:"#555", letterSpacing:"2px", marginBottom:"6px" },
    btn: ok => ({
      background: ok ? c : "transparent", color: ok ? "#000" : c,
      border:`2px solid ${c}`, padding:"10px 22px",
      fontFamily:"'Courier New',monospace", fontSize:"12px", fontWeight:"bold",
      letterSpacing:"2px", cursor:"pointer", textTransform:"uppercase", transition:"all 0.15s",
    }),
  };

  // ── RENDER ────────────────────────────────────────────────

  if (screen === "game") return (
    <div style={S.page}>
      <div style={{ width:"100%", maxWidth:"600px" }}>
        <canvas ref={canvasRef} width={GW} height={GH}
          style={{ width:"100%", aspectRatio:`${GW}/${GH}`, display:"block",
            imageRendering:"pixelated", cursor:"pointer",
            border:`2px solid ${c}22`, boxShadow:`0 0 40px ${c}18` }}
          onPointerDown={e => { e.preventDefault(); jump(); }} />
        <div style={{ padding:"8px 12px", background:"#08080f",
          display:"flex", justifyContent:"space-between",
          fontSize:"10px", color:"#444", letterSpacing:"1px" }}>
          <span>TAP / SPACE TO JUMP</span>
          <span>◆ {credits}</span>
        </div>
      </div>
    </div>
  );

  if (screen === "dead") return (
    <div style={S.page}><div style={S.wrap}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"30px", fontWeight:"bold", color:"#ff4040",
          letterSpacing:"4px", textShadow:"0 0 20px #ff4040" }}>GAME OVER</div>
        {runData.isNewBest && <div style={{ color:"#ffd93d", fontSize:"11px",
          letterSpacing:"3px", marginTop:"6px" }}>✦ NEW BEST ✦</div>}
      </div>

      <div style={{ ...S.card, display:"flex", flexDirection:"column", gap:"12px",
        maxWidth:"280px", margin:"0 auto" }}>
        {[["DISTANCE",`${runData.score}m`,c],["COINS",`◆ ${runData.coins}`,"#ffd93d"]].map(([lbl,val,col])=>(
          <div key={lbl} style={S.row}>
            <span style={{ color:"#555", fontSize:"11px" }}>{lbl}</span>
            <span style={{ color:col, fontWeight:"bold" }}>{val}</span>
          </div>
        ))}
        <div style={{ borderTop:`1px solid ${c}18`, paddingTop:"12px", ...S.row }}>
          <span style={{ color:"#555", fontSize:"11px" }}>EARNED</span>
          <span style={{ color:"#ffd93d", fontWeight:"bold", fontSize:"15px" }}>+◆{runData.earned}</span>
        </div>
      </div>

      <div style={{ color:"#333", fontSize:"11px" }}>TOTAL ◆{credits}</div>

      <div style={{ display:"flex", flexDirection:"column", gap:"10px", alignItems:"center" }}>
        <button style={S.btn(true)} onClick={startGame}>▶ PLAY AGAIN</button>
        <div style={{ display:"flex", gap:"10px" }}>
          <button style={S.btn(false)} onClick={()=>setScreen("shop")}>⬆ UPGRADES</button>
          <button style={S.btn(false)} onClick={()=>setScreen("menu")}>⌂ MENU</button>
        </div>
      </div>
    </div></div>
  );

  if (screen === "shop") return (
    <div style={S.page}><div style={S.wrap}>
      <div style={{ ...S.row, width:"100%" }}>
        <div style={{ fontSize:"16px", fontWeight:"bold", color:c, letterSpacing:"3px" }}>UPGRADES</div>
        <div style={{ color:"#ffd93d", fontSize:"14px", fontWeight:"bold" }}>◆{credits}</div>
      </div>

      {idlePop > 0 && (
        <div style={{ color:"#ffd93d", fontSize:"11px", letterSpacing:"2px" }}>
          +◆{idlePop} idle income
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:"10px", width:"100%" }}>
        {Object.entries(UPGRADE_DATA).map(([key, data]) => {
          const level = upgrades[key];
          const maxed = level >= data.max;
          const cost  = maxed ? null : data.costs[level];
          const can   = !maxed && credits >= cost;
          return (
            <div key={key} style={{ ...S.card,
              border:`1px solid ${flash===key ? c : c+"22"}`,
              background: flash===key ? c+"14" : "#0a0a18",
              transition:"all 0.3s", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:"12px", fontWeight:"bold", letterSpacing:"1px",
                  color: maxed ? "#555" : "#eee" }}>
                  {data.emoji} {data.name}
                </div>
                <div style={{ fontSize:"10px", color:"#555", marginTop:"3px" }}>{data.desc}</div>
                <div style={{ marginTop:"8px", display:"flex", gap:"4px" }}>
                  {Array.from({length:data.max}).map((_,i) => (
                    <div key={i} style={{ width:"14px", height:"3px",
                      background: i<level ? c : "#1c1c30",
                      boxShadow: i<level ? `0 0 5px ${c}` : "none" }} />
                  ))}
                </div>
              </div>
              <div>
                {maxed
                  ? <span style={{ fontSize:"10px", color:"#ffd93d", letterSpacing:"1px" }}>MAXED</span>
                  : <button style={{ ...S.btn(can), opacity:can?1:0.35, padding:"8px 14px", fontSize:"11px" }}
                      onClick={()=>buyUpgrade(key)}>◆{cost}</button>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display:"flex", gap:"10px" }}>
        <button style={S.btn(true)} onClick={startGame}>▶ PLAY</button>
        <button style={S.btn(false)} onClick={()=>setScreen("menu")}>⌂ MENU</button>
      </div>
    </div></div>
  );

  if (screen === "customize") return (
    <div style={S.page}><div style={S.wrap}>
      <div style={{ fontSize:"16px", fontWeight:"bold", color:c, letterSpacing:"3px", alignSelf:"flex-start" }}>
        CUSTOMIZE
      </div>

      <div style={{ width:"100%" }}>
        <div style={S.label}>RUNNER COLOR</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"10px" }}>
          {SKINS.map((s2,i) => (
            <div key={i} onClick={()=>setSkinIdx(i)} style={{
              width:"44px", height:"44px", background:s2.color,
              boxShadow: skinIdx===i ? `0 0 18px ${s2.color},0 0 6px ${s2.color}` : "none",
              border: skinIdx===i ? "2px solid #fff" : "2px solid transparent",
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              {skinIdx===i && <span style={{ color:"#000", fontSize:"14px" }}>✓</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...S.card, display:"flex", flexDirection:"column", alignItems:"center", gap:"12px" }}>
        <div style={S.label}>PREVIEW</div>
        <div style={{ display:"flex", gap:"8px", alignItems:"flex-end" }}>
          {[0.4,0.6,1,0.6,0.4].map((a,i) => (
            <div key={i} style={{ width:PW*2.2, height:PH*2.5*a,
              background:c, opacity:a, boxShadow:`0 0 12px ${c}` }} />
          ))}
        </div>
        <div style={{ fontSize:"11px", color:c, letterSpacing:"3px" }}>{skin.name}</div>
      </div>

      <div style={{ display:"flex", gap:"10px" }}>
        <button style={S.btn(true)} onClick={startGame}>▶ PLAY</button>
        <button style={S.btn(false)} onClick={()=>setScreen("menu")}>⌂ MENU</button>
      </div>
    </div></div>
  );

  // MENU
  return (
    <div style={S.page}><div style={S.wrap}>
      <div style={{ height:"10px" }} />
      <div>
        <div style={{ fontSize:"10px", color:c+"88", letterSpacing:"6px", textAlign:"center", marginBottom:"10px" }}>
          ENDLESS RUNNER
        </div>
        <div style={S.title}>CHARLABOLT</div>
        <div style={{ ...S.sub, marginTop:"6px" }}>IDLE EDITION</div>
      </div>

      <div style={{ ...S.card, display:"flex", gap:"0", width:"auto", padding:"0" }}>
        {[["BEST",`${bestScore}m`,c],["CREDITS",`◆${credits}`,"#ffd93d"]].map(([lbl,val,col],i)=>(
          <div key={i} style={{ padding:"16px 28px", textAlign:"center",
            borderRight: i===0 ? `1px solid ${c}18` : "none" }}>
            <div style={{ fontSize:"9px", color:"#555", letterSpacing:"2px", marginBottom:"5px" }}>{lbl}</div>
            <div style={{ fontSize:"20px", color:col, fontWeight:"bold" }}>{val}</div>
          </div>
        ))}
      </div>

      {idlePop > 0 && (
        <div style={{ color:"#ffd93d", fontSize:"11px", letterSpacing:"2px" }}>
          +◆{idlePop} idle income!
        </div>
      )}

      <button style={{ ...S.btn(true), fontSize:"14px", padding:"13px 36px", letterSpacing:"4px" }}
        onClick={startGame}>▶ PLAY</button>

      <div style={{ display:"flex", gap:"10px" }}>
        <button style={S.btn(false)} onClick={()=>setScreen("shop")}>⬆ UPGRADES</button>
        <button style={S.btn(false)} onClick={()=>setScreen("customize")}>✦ LOOK</button>
      </div>

      <div style={{ ...S.sub, color:"#333" }}>SPACE / TAP TO JUMP</div>
    </div></div>
  );
}
