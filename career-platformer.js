(() => {
  'use strict';
  const modal = document.getElementById('careerPlatformerModal');
  const canvas = document.getElementById('careerPlatformerCanvas');
  const closeBtn = document.getElementById('careerPlatformerClose');
  const overlay = document.getElementById('careerPlatformerOverlay');
  const overlayTitle = document.getElementById('platformerOverlayTitle');
  const overlayText = document.getElementById('platformerOverlayText');
  const startBtn = document.getElementById('careerPlatformerStart');
  const intelCard = document.getElementById('platformerIntelCard');
  if (!modal || !canvas || !closeBtn || !overlay || !startBtn || !intelCard) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const W = 960, H = 540, GROUND = 455, WORLD_W = 6500;
  canvas.width = W; canvas.height = H;

  const fallback = Array.from({length: 6}, (_, i) => ({
    empresa: `EMPRESA ${i + 1}`,
    cargo: 'OFFENSIVE SECURITY',
    periodo: { inicio: '0000-00', fim: 'ATUAL' },
    descricao: 'Arquivo profissional aguardando atualização.',
    impactos: ['Impacto profissional'],
    tecnologias: ['Security']
  }));

  let experiences = fallback;
  let blocks = [], platforms = [], hazards = [], coins = [], particles = [];
  let running = false, paused = true, started = false, raf = 0, last = 0;
  let cameraX = 0, score = 0, recovered = 0, remaining = 180, timerAcc = 0;
  let audioCtx = null, musicTimer = null, musicStep = 0;
  const keys = { left: false, right: false, jump: false };
  const player = { x: 90, y: GROUND - 42, w: 28, h: 42, vx: 0, vy: 0, grounded: false, facing: 1, anim: 0 };

  const $ = id => document.getElementById(id);
  const escapeHtml = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtPeriod = p => typeof p === 'string' ? p : `${p?.inicio || '?'} — ${p?.fim || '?'}`.toUpperCase();

  async function loadExperiences() {
    try {
      const r = await fetch('experiencias.json', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (Array.isArray(d) && d.length) experiences = d.slice(0, 6);
    } catch (e) { console.warn('Career Quest: fallback ativo.', e); }
  }

  function audio() {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, dur=.08, type='square', gain=.025, delay=0) {
    try {
      const a=audio(), o=a.createOscillator(), g=a.createGain();
      o.type=type; o.frequency.setValueAtTime(freq,a.currentTime+delay);
      g.gain.setValueAtTime(gain,a.currentTime+delay); g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+delay+dur);
      o.connect(g).connect(a.destination); o.start(a.currentTime+delay); o.stop(a.currentTime+delay+dur);
    } catch (_) {}
  }
  function startMusic() {
    stopMusic(); musicStep=0;
    const bass=[110,110,146.83,110,164.81,146.83,123.47,98];
    const lead=[440,523.25,659.25,523.25,493.88,440,392,329.63,392,440,493.88,659.25,587.33,523.25,440,392];
    musicTimer=setInterval(()=>{
      if (!running || paused) return;
      const s=musicStep++;
      tone(bass[s%bass.length],.13,'square',.012);
      if(s%2===0) tone(lead[s%lead.length],.07,'square',.009,.025);
      if(s%4===2) tone(lead[(s+5)%lead.length]/2,.045,'triangle',.006,.08);
    },145);
  }
  function stopMusic(){ if(musicTimer){clearInterval(musicTimer);musicTimer=null;} }

  function seededShuffle(arr) {
    for (let i=arr.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    return arr;
  }

  function buildLevel() {
    platforms = [
      {x:0,y:GROUND,w:WORLD_W,h:100,type:'ground'},
      {x:640,y:365,w:190,h:22},{x:1080,y:320,w:170,h:22},{x:1540,y:380,w:220,h:22},
      {x:2100,y:335,w:190,h:22},{x:2700,y:285,w:220,h:22},{x:3280,y:370,w:210,h:22},
      {x:3900,y:315,w:190,h:22},{x:4550,y:355,w:240,h:22},{x:5200,y:300,w:230,h:22},
      {x:5790,y:365,w:230,h:22}
    ];
    const candidates=[];
    for(let x=420;x<WORLD_W-450;x+=230+Math.random()*120){
      const elevated=Math.random()<.38;
      candidates.push({x, y:elevated?315+Math.floor(Math.random()*70):385, w:38,h:38,hit:false,career:-1,bump:0});
    }
    const selected=seededShuffle(candidates.map((_,i)=>i)).slice(0,experiences.length);
    selected.forEach((idx,career)=>candidates[idx].career=career);
    blocks=candidates;
    hazards=[900,1370,1880,2450,3100,3670,4300,5000,5550].map((x,i)=>({x,y:GROUND-24,w:30,h:24,vx:i%2?48:-48,min:x-70,max:x+70,alive:true}));
    coins=[]; particles=[];
  }

  function reset() {
    score=0; recovered=0; remaining=180; timerAcc=0; cameraX=0;
    Object.assign(player,{x:90,y:GROUND-42,vx:0,vy:0,grounded:false,facing:1,anim:0});
    buildLevel(); updateHud(); intelCard.classList.remove('show');
  }
  function updateHud(){
    $('platformerScore').textContent=String(score).padStart(6,'0');
    $('platformerProgress').textContent=`${recovered}/${experiences.length}`;
    $('platformerTime').textContent=String(Math.max(0,Math.ceil(remaining))).padStart(3,'0');
    $('platformerStatus').textContent=paused&&!started?'READY':paused?'INTEL':'RUN';
  }

  function startGame(){ reset(); started=true; paused=false; overlay.classList.remove('show'); audio(); startMusic(); canvas.focus(); tone(261.63,.08); tone(392,.12,'square',.025,.09); }
  function showEnd(win){
    paused=true; stopMusic();
    overlayTitle.textContent=win?'QUEST COMPLETE':'SECTOR FAILED';
    overlayText.textContent=win?`${experiences.length} arquivos profissionais recuperados. Score final: ${String(score).padStart(6,'0')}.`:'Tempo encerrado ou contato com ameaça. Reinicie o setor.';
    startBtn.textContent=win?'REPLAY QUEST':'RETRY QUEST'; overlay.classList.add('show');
    if(win){tone(523,.12);tone(659,.12,'square',.03,.12);tone(784,.2,'square',.03,.24);}else tone(90,.35,'sawtooth',.035);
  }

  function showIntel(exp) {
    paused=true;
    intelCard.innerHTML=`<div class="platformer-kicker">CAREER BLOCK ${String(recovered).padStart(2,'0')}</div><h2>${escapeHtml(exp.empresa)}</h2><h3>${escapeHtml(exp.cargo)}</h3><div class="platformer-period">${escapeHtml(fmtPeriod(exp.periodo))}</div><p>${escapeHtml(exp.descricao)}</p><h4>IMPACT</h4><ul>${(exp.impactos||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul><h4>TECH STACK</h4><div class="platformer-tech">${(exp.tecnologias||[]).map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div><button id="platformerContinue" type="button">CONTINUE QUEST</button>`;
    intelCard.classList.add('show'); updateHud();
    tone(880,.08);tone(1174,.11,'square',.03,.08);
    document.getElementById('platformerContinue').addEventListener('click',()=>{
      intelCard.classList.remove('show'); paused=false; startMusic(); canvas.focus(); updateHud();
      if(recovered>=experiences.length) setTimeout(()=>showEnd(true),150);
    },{once:true});
  }

  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x-cameraX),Math.round(y),Math.round(w),Math.round(h));}
  function worldRect(o,c){rect(o.x,o.y,o.w,o.h,c);}
  function hit(a,b){return a.x<a.x+a.w && a.x < b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;}

  function resolvePlatforms(prevY){
    player.grounded=false;
    const solids=[...platforms,...blocks];
    for(const s of solids){
      if(player.x+player.w<=s.x||player.x>=s.x+s.w||player.y+player.h<=s.y||player.y>=s.y+s.h)continue;
      if(prevY+player.h<=s.y&&player.vy>=0){player.y=s.y-player.h;player.vy=0;player.grounded=true;}
      else if(prevY>=s.y+s.h&&player.vy<0){player.y=s.y+s.h;player.vy=35;if(s.career!==undefined)hitBlock(s);}
      else if(player.x+player.w/2<s.x+s.w/2)player.x=s.x-player.w;else player.x=s.x+s.w;
    }
  }
  function hitBlock(b){
    if(b.hit)return; b.hit=true;b.bump=.18;score+=b.career>=0?1000:100;
    if(b.career>=0){recovered++;showIntel(experiences[b.career]);}
    else {coins.push({x:b.x+13,y:b.y-20,vy:-130,life:.7});tone(660,.06);}
    updateHud();
  }

  function update(dt){
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;p.life-=dt});particles=particles.filter(p=>p.life>0);
    coins.forEach(c=>{c.y+=c.vy*dt;c.vy+=280*dt;c.life-=dt});coins=coins.filter(c=>c.life>0);
    if(paused||!started)return;
    remaining-=dt;timerAcc+=dt;if(timerAcc>.25){timerAcc=0;updateHud();}if(remaining<=0){showEnd(false);return;}
    const accel=keys.left?-1:keys.right?1:0;
    player.vx+=accel*850*dt; player.vx*=Math.pow(.0008,dt); player.vx=Math.max(-230,Math.min(230,player.vx));
    if(accel)player.facing=accel;
    if(keys.jump&&player.grounded){player.vy=-430;player.grounded=false;tone(330,.07,'square',.02,0);tone(495,.05,'square',.015,.05);keys.jump=false;}
    const prevY=player.y;player.vy+=1050*dt;player.x+=player.vx*dt;player.y+=player.vy*dt;player.x=Math.max(0,Math.min(WORLD_W-player.w,player.x));resolvePlatforms(prevY);
    if(player.y>H+80){showEnd(false);return;}
    player.anim+=Math.abs(player.vx)*dt*.05;
    hazards.forEach(h=>{if(!h.alive)return;h.x+=h.vx*dt;if(h.x<h.min||h.x>h.max)h.vx*=-1;if(hit(player,h)){showEnd(false);}});
    blocks.forEach(b=>b.bump=Math.max(0,b.bump-dt));
    cameraX=Math.max(0,Math.min(WORLD_W-W,player.x-W*.34));
  }

  function pixelCloud(x,y,s){
    ctx.fillStyle='#fbfff8';
    rect(x+8*s,y,16*s,8*s,'#fbfff8');rect(x,y+6*s,32*s,10*s,'#fbfff8');
    rect(x+4*s,y+2*s,8*s,6*s,'#fbfff8');rect(x+20*s,y+2*s,8*s,6*s,'#fbfff8');
  }
  function pixelBush(x,y,s){
    ctx.fillStyle='#1e9c1e';
    rect(x+6*s,y,20*s,10*s,'#1e9c1e');rect(x,y+6*s,32*s,10*s,'#1e9c1e');
    ctx.fillStyle='#0e7a10';rect(x,y+12*s,32*s,4*s,'#0e7a10');
  }
  function pixelPipe(x,y,h){
    rect(x,y,52,h,'#00a800');rect(x,y-14,60,18,'#00c800');
    rect(x+6,y-14,6,h+14,'#5cf25c');rect(x+6,y,4,h,'#0e7a10');rect(x+42,y,4,h,'#0e7a10');
    rect(x-4,y-14,4,18,'#0e7a10');rect(x+60,y-14,4,18,'#0e7a10');
  }
  function drawBackground(){
    ctx.fillStyle='#5c94fc';ctx.fillRect(0,0,W,H);
    const par=cameraX*.16;
    for(let i=0;i<7;i++){const x=(i*260-par)%(W+220);pixelCloud((x+W+220)%(W+220)-40,54+((i*53)%70),2.1);}
    const par2=cameraX*.3;
    for(let i=0;i<10;i++){const x=(i*210-par2)%(W+160);pixelBush((x+W+160)%(W+160)-40,GROUND-58,1.9);}
    const par3=cameraX*.45;
    for(let i=0;i<3;i++){const x=(i*520-par3)%(W+400);pixelPipe((x+W+400)%(W+400)-60,GROUND-96,96);}
  }
  function drawGround(){
    platforms.forEach(p=>{
      if(p.x+p.w<cameraX||p.x>cameraX+W)return;
      worldRect(p,'#c84c0c');
      for(let gx=p.x;gx<p.x+p.w;gx+=16){
        for(let gy=p.y;gy<p.y+Math.min(p.h,32);gy+=16){
          rect(gx+1,gy+1,14,14,'#e8783c');
          rect(gx+3,gy+3,10,10,'#c84c0c');
        }
      }
      rect(p.x,p.y,p.w,4,'#ffdca0');
    });
  }
  function drawBlock(b){
    if(b.x+b.w<cameraX||b.x>cameraX+W)return;
    const y=b.y-(b.bump?Math.sin((.18-b.bump)/.18*Math.PI)*8:0);
    const career=b.career>=0&&!b.hit;
    if(b.hit){
      rect(b.x,y,b.w,b.h,'#9c5a1c');rect(b.x+4,y+4,b.w-8,b.h-8,'#b8763a');
      for(let gx=b.x;gx<b.x+b.w;gx+=12) rect(gx,y,2,b.h,'#7a441a');
    } else {
      rect(b.x,y,b.w,b.h,career?'#fcb414':'#e89010');
      rect(b.x+3,y+3,b.w-6,b.h-6,career?'#ffcf4a':'#f4a832');
      ctx.fillStyle='#a85c04';
      rect(b.x+2,y+2,3,3,'#a85c04');rect(b.x+b.w-5,y+2,3,3,'#a85c04');
      rect(b.x+2,y+b.h-5,3,3,'#a85c04');rect(b.x+b.w-5,y+b.h-5,3,3,'#a85c04');
      ctx.fillStyle='#7a3c00';ctx.font='bold 22px "Share Tech Mono"';ctx.textAlign='center';
      ctx.fillText('?',Math.round(b.x+b.w/2-cameraX),Math.round(y+27));
    }
  }
  function drawPlayer(){
    const x=Math.round(player.x-cameraX),y=Math.round(player.y),step=Math.floor(player.anim)%2;
    ctx.save();if(player.facing<0){ctx.translate(x+player.w,y);ctx.scale(-1,1);}else ctx.translate(x,y);
    // capacete/boné tático (amber)
    ctx.fillStyle='#ffc857';ctx.fillRect(5,0,17,7);ctx.fillRect(2,7,23,6);
    ctx.fillStyle='#071109';ctx.fillRect(6,3,7,3); // viseira/emblema, não é a logo "M"
    // rosto
    ctx.fillStyle='#e7b17b';ctx.fillRect(7,13,15,10);ctx.fillStyle='#071109';ctx.fillRect(17,16,3,3);
    // macacão tático cyan com crachá
    ctx.fillStyle='#00c8d8';ctx.fillRect(5,23,18,12);ctx.fillRect(2,27,5,8);ctx.fillRect(22,27,5,8);
    ctx.fillStyle='#ffc857';ctx.fillRect(12,26,5,5);
    ctx.fillStyle='#163f54';ctx.fillRect(7,35,7,7);ctx.fillRect(17,35,7,7);
    if(!player.grounded){ctx.fillRect(3,39,9,3);ctx.fillRect(18,37,9,3);}else if(step){ctx.fillRect(3,39,10,3);ctx.fillRect(18,37,8,3);}else{ctx.fillRect(7,39,7,3);ctx.fillRect(17,39,7,3);}
    ctx.restore();
  }
  function drawHazard(h){
    if(!h.alive||h.x+h.w<cameraX||h.x>cameraX+W)return;
    const x=h.x,y=h.y,bob=Math.sin(roadTimeSafe()*6+h.x*.05)*1.5;
    // criatura tipo "cogumelo" rastejante, cores clássicas de inimigo de plataforma
    rect(x+2,y+6+bob,26,18,'#8c4a1c');
    rect(x,y+16+bob,30,10,'#6a3212');
    rect(x+4,y+8+bob,8,7,'#fff');rect(x+18,y+8+bob,8,7,'#fff');
    ctx.fillStyle='#1a0d05';rect(x+6,y+10+bob,4,4,'#1a0d05');rect(x+20,y+10+bob,4,4,'#1a0d05');
    rect(x+2,y+24+bob,7,4,'#3a1c0a');rect(x+21,y+24+bob,7,4,'#3a1c0a');
  }
  function roadTimeSafe(){return performance.now()/1000;}
  function draw(){drawBackground();drawGround();blocks.forEach(drawBlock);hazards.forEach(drawHazard);coins.forEach(c=>{rect(c.x,c.y,12,16,'#ffc857');});particles.forEach(p=>rect(p.x,p.y,3,3,'#ffc857'));drawPlayer();}
  function loop(ts){if(!running)return;const dt=Math.min(.033,(ts-last)/1000||0);last=ts;update(dt);draw();raf=requestAnimationFrame(loop);}

  window.openCareerPlatformer=async function(){
    await loadExperiences();reset();started=false;paused=true;overlayTitle.textContent='CAREER QUEST';overlayText.textContent='Explore o setor, salte sob blocos de inteligência e recupere os seis arquivos profissionais escondidos aleatoriamente.';startBtn.textContent='START QUEST';overlay.classList.add('show');modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('arcade-modal-open');running=true;last=performance.now();canvas.focus();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
  };
  function close(){running=false;paused=true;stopMusic();cancelAnimationFrame(raf);modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('arcade-modal-open');intelCard.classList.remove('show');}
  startBtn.addEventListener('click',startGame);closeBtn.addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close();});
  window.addEventListener('keydown',e=>{if(!modal.classList.contains('open'))return;if(e.key==='Escape'){close();return;}if(['ArrowLeft','KeyA'].includes(e.code))keys.left=true;if(['ArrowRight','KeyD'].includes(e.code))keys.right=true;if(['ArrowUp','KeyW','Space'].includes(e.code)){keys.jump=true;e.preventDefault();}});
  window.addEventListener('keyup',e=>{if(['ArrowLeft','KeyA'].includes(e.code))keys.left=false;if(['ArrowRight','KeyD'].includes(e.code))keys.right=false;if(['ArrowUp','KeyW','Space'].includes(e.code))keys.jump=false;});
  document.querySelectorAll('[data-platformer]').forEach(btn=>{const a=btn.dataset.platformer;const on=()=>{keys[a]=true;audio();};const off=()=>keys[a]=false;btn.addEventListener('pointerdown',on);btn.addEventListener('pointerup',off);btn.addEventListener('pointercancel',off);btn.addEventListener('pointerleave',off);});
  draw();
})();
