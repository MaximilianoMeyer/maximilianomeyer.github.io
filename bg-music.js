/* ═══════════════════════════════════════════════════
   MAX MEYER // AMBIENT 16-BIT SITE THEME
   Trilha original sintetizada via Web Audio API (sem
   dependência de arquivos externos). Toca em loop pelo
   site inteiro e abaixa o volume automaticamente quando
   um dos mini-games (que têm trilha própria) é aberto.
═══════════════════════════════════════════════════ */
(() => {
  'use strict';
  const toggleBtn = document.getElementById('bgMusicToggle');
  const label = document.getElementById('bgMusicLabel');
  if (!toggleBtn) return;

  const STORAGE_KEY = 'mm_bgmusic_muted';
  let audioCtx = null, master = null, musicTimer = null, step = 0;
  let started = false;
  let userMuted = localStorage.getItem(STORAGE_KEY) === '1';
  let ducked = false;

  // Progressão de acordes (Em - C - G - D), estilo tema de overworld 16-bit.
  const BPM = 128;
  const STEP_MS = (60000 / BPM) / 2; // colcheias
  const bassLine = [82.41,82.41,110.00,82.41, 65.41,65.41,98.00,65.41, 98.00,98.00,146.83,98.00, 73.42,73.42,110.00,73.42];
  const leadLine = [
    329.63,392.00,493.88,587.33, 493.88,440.00,392.00,329.63,
    261.63,329.63,392.00,523.25, 440.00,392.00,349.23,293.66,
    392.00,493.88,587.33,659.25, 587.33,523.25,493.88,440.00,
    293.66,349.23,440.00,587.33, 523.25,440.00,392.00,349.23
  ];
  const harmony = [196.00,164.81,246.94,220.00];

  function ctx(){
    if(!audioCtx){
      audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      master = audioCtx.createGain();
      master.gain.value = userMuted ? 0 : 0.05;
      master.connect(audioCtx.destination);
    }
    if(audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, dur, type, gain, delay, dest){
    try{
      const a = ctx(), o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, a.currentTime + delay);
      g.gain.setValueAtTime(0, a.currentTime + delay);
      g.gain.linearRampToValueAtTime(gain, a.currentTime + delay + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + delay + dur);
      o.connect(g).connect(dest || master);
      o.start(a.currentTime + delay); o.stop(a.currentTime + delay + dur + 0.02);
    }catch(_e){}
  }
  function hat(delay){
    try{
      const a = ctx(), bufSize = a.sampleRate * 0.03, buf = a.createBuffer(1, bufSize, a.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0;i<bufSize;i++) d[i] = (Math.random()*2-1) * (1 - i/bufSize);
      const src = a.createBufferSource(); src.buffer = buf;
      const g = a.createGain(); g.gain.setValueAtTime(0.012, a.currentTime + delay);
      const hp = a.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=6000;
      src.connect(hp).connect(g).connect(master);
      src.start(a.currentTime + delay);
    }catch(_e){}
  }

  function scheduleStep(){
    const s = step % leadLine.length;
    const bassIdx = step % bassLine.length;
    tone(bassLine[bassIdx], 0.34, 'triangle', 0.09, 0);
    tone(leadLine[s], 0.16, 'square', 0.045, 0.01);
    if(step % 4 === 2) tone(harmony[Math.floor(step/8)%harmony.length], 0.5, 'sine', 0.03, 0);
    if(step % 2 === 0) hat(0.02);
    step++;
  }

  function startMusic(){
    if(musicTimer) return;
    step = 0;
    scheduleStep();
    musicTimer = setInterval(scheduleStep, STEP_MS);
  }
  function stopMusic(){
    if(musicTimer){ clearInterval(musicTimer); musicTimer = null; }
  }

  function applyVolume(){
    if(!master) return;
    const target = userMuted ? 0 : (ducked ? 0.012 : 0.05);
    master.gain.setTargetAtTime(target, ctx().currentTime, 0.25);
  }

  function updateUI(){
    toggleBtn.classList.toggle('muted', userMuted);
    toggleBtn.setAttribute('aria-pressed', String(!userMuted));
    if(label) label.textContent = userMuted ? 'MUTED' : 'TRACK 01';
  }

  function beginIfNeeded(){
    if(started) return;
    started = true;
    ctx();
    startMusic();
    applyVolume();
  }

  // Inicia no primeiro gesto do usuário (política de autoplay dos navegadores).
  ['pointerdown','keydown','touchstart'].forEach(evt=>{
    window.addEventListener(evt, beginIfNeeded, { once:true, passive:true });
  });

  toggleBtn.addEventListener('click', () => {
    beginIfNeeded();
    userMuted = !userMuted;
    localStorage.setItem(STORAGE_KEY, userMuted ? '1' : '0');
    applyVolume();
    updateUI();
  });

  // Abaixa a música ambiente quando um mini-game com trilha própria está aberto.
  const arcadeModalIds = ['certRoadModal','careerPlatformerModal'];
  const observer = new MutationObserver(() => {
    const anyOpen = arcadeModalIds.some(id => {
      const el = document.getElementById(id);
      return el && el.classList.contains('open');
    });
    if(anyOpen !== ducked){
      ducked = anyOpen;
      applyVolume();
    }
  });
  arcadeModalIds.forEach(id=>{
    const el = document.getElementById(id);
    if(el) observer.observe(el, { attributes:true, attributeFilter:['class'] });
  });

  updateUI();
})();
