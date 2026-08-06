(() => {
  'use strict';

  const modal = document.getElementById('careerInvadersModal');
  const canvas = document.getElementById('careerInvadersCanvas');
  if (!modal || !canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const closeBtn = document.getElementById('careerInvadersClose');
  const startBtn = document.getElementById('careerInvadersStart');
  const resumeBtn = document.getElementById('careerInvadersResume');
  const intelCloseBtn = document.getElementById('careerIntelClose');
  const overlay = document.getElementById('careerInvadersOverlay');
  const overlayTitle = document.getElementById('careerOverlayTitle');
  const overlayText = document.getElementById('careerOverlayText');
  const intelCard = document.getElementById('careerIntelCard');
  const scoreEl = document.getElementById('careerScore');
  const waveEl = document.getElementById('careerWave');
  const progressEl = document.getElementById('careerProgress');
  const livesEl = document.getElementById('careerLives');

  const W = 960;
  const H = 540;
  canvas.width = W;
  canvas.height = H;

  let experiences = [];
  let raf = 0;
  let last = 0;
  let running = false;
  let paused = true;
  let started = false;
  let score = 0;
  let wave = 1;
  let lives = 3;
  let careerIndex = 0;
  let careerSpawned = false;
  let careerTimer = 5;
  let enemyDirection = 1;
  let enemyStepTimer = 0;
  let shotCooldown = 0;
  let audioCtx = null;
  const keys = new Set();
  const stars = Array.from({ length: 85 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    s: Math.random() < .15 ? 2 : 1,
    v: 8 + Math.random() * 24
  }));

  const player = { x: W / 2 - 18, y: H - 58, w: 36, h: 22, speed: 290 };
  let bullets = [];
  let enemyBullets = [];
  let enemies = [];
  let particles = [];
  let careerShip = null;

  const defaultExperiences = [
    { empresa: 'TecBan', periodo: { inicio: '2020-01', fim: '2023-11' }, cargo: 'Senior Cybersecurity Engineer', descricao: 'Segurança ofensiva e operações de Red Team.', impactos: ['Mais de 50 vulnerabilidades críticas identificadas', '5 operações de Red Team realizadas', '55% de mitigação dos riscos'], tecnologias: ['Python', 'Burp Suite', 'Active Directory', 'BloodHound'] }
  ];

  const fmtPeriod = (p) => {
    if (!p) return 'PERÍODO NÃO INFORMADO';
    if (typeof p === 'string') return p.toUpperCase();
    return `${p.inicio || '?'} — ${p.fim || '?'}`.toUpperCase();
  };

  async function loadExperiences() {
    try {
      const response = await fetch('experiencias.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      experiences = Array.isArray(data) && data.length ? data : defaultExperiences;
    } catch (error) {
      console.warn('Career Invaders: usando dados de fallback.', error);
      experiences = defaultExperiences;
    }
    progressEl.textContent = `0/${experiences.length}`;
  }

  function tone(freq = 440, duration = .06, type = 'square', gain = .035, slide = 0) {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const vol = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), audioCtx.currentTime + duration);
      vol.gain.setValueAtTime(gain, audioCtx.currentTime);
      vol.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + duration);
      osc.connect(vol).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function resetEnemies() {
    enemies = [];
    const cols = 9;
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        enemies.push({
          x: 105 + c * 82,
          y: 82 + r * 48,
          w: 30,
          h: 20,
          row: r,
          alive: true,
          phase: (r + c) % 2
        });
      }
    }
    enemyDirection = 1;
    enemyStepTimer = 0;
  }

  function resetGame() {
    score = 0;
    wave = 1;
    lives = 3;
    careerIndex = 0;
    careerSpawned = false;
    careerTimer = 4.5;
    bullets = [];
    enemyBullets = [];
    particles = [];
    careerShip = null;
    player.x = W / 2 - player.w / 2;
    resetEnemies();
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = String(score).padStart(6, '0');
    waveEl.textContent = String(wave).padStart(2, '0');
    progressEl.textContent = `${careerIndex}/${experiences.length}`;
    livesEl.textContent = '◆'.repeat(Math.max(0, lives));
  }

  function startGame() {
    resetGame();
    started = true;
    paused = false;
    overlay.classList.remove('show');
    intelCard.classList.remove('show');
    canvas.focus();
    tone(160, .08, 'square', .04, 500);
  }

  function resumeGame() {
    paused = false;
    overlay.classList.remove('show');
    intelCard.classList.remove('show');
    canvas.focus();
  }

  function showStart() {
    paused = true;
    overlayTitle.textContent = 'CAREER INVADERS';
    overlayText.textContent = 'Elimine ameaças. Intercepte as naves douradas CAREER para recuperar os seis arquivos profissionais.';
    startBtn.hidden = false;
    resumeBtn.hidden = true;
    overlay.classList.add('show');
  }

  function showGameOver(victory = false) {
    paused = true;
    overlayTitle.textContent = victory ? 'MISSION COMPLETE' : 'SIGNAL LOST';
    overlayText.textContent = victory
      ? `${experiences.length} arquivos profissionais recuperados. Pontuação final: ${String(score).padStart(6, '0')}.`
      : `O perímetro foi comprometido. Arquivos recuperados: ${careerIndex}/${experiences.length}.`;
    startBtn.textContent = victory ? 'REPLAY MISSION' : 'RETRY MISSION';
    startBtn.hidden = false;
    resumeBtn.hidden = true;
    overlay.classList.add('show');
    tone(victory ? 660 : 90, .35, 'square', .05, victory ? 560 : -40);
  }

  function showIntel(exp) {
    paused = true;
    const impacts = (exp.impactos || []).map(i => `<li>${escapeHtml(i)}</li>`).join('');
    const tech = (exp.tecnologias || []).map(t => `<span>${escapeHtml(t)}</span>`).join('');
    intelCard.innerHTML = `
      <div class="intel-kicker">CAREER INTEL ${String(careerIndex).padStart(2, '0')}</div>
      <h2>${escapeHtml(exp.empresa || 'EMPRESA')}</h2>
      <h3>${escapeHtml(exp.cargo || 'CARGO')}</h3>
      <div class="intel-period">${escapeHtml(fmtPeriod(exp.periodo))}</div>
      <p>${escapeHtml(exp.descricao || '')}</p>
      <h4>IMPACT</h4>
      <ul>${impacts}</ul>
      <h4>TECH STACK</h4>
      <div class="intel-tech">${tech}</div>
      <button id="careerIntelCloseDynamic" type="button">CONTINUE MISSION</button>`;
    intelCard.classList.add('show');
    document.getElementById('careerIntelCloseDynamic').addEventListener('click', resumeGame, { once: true });
    tone(880, .09, 'square', .05, 440);
    setTimeout(() => tone(1320, .1, 'square', .04, -220), 90);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function spawnCareerShip() {
    if (careerIndex >= experiences.length || careerShip) return;
    careerSpawned = true;
    careerShip = {
      x: -78,
      y: 38 + Math.random() * 70,
      w: 66,
      h: 24,
      vx: 120 + wave * 10,
      label: 'CAREER'
    };
    tone(740, .08, 'square', .025, 80);
  }

  function shoot() {
    if (shotCooldown > 0 || paused || !started) return;
    bullets.push({ x: player.x + player.w / 2 - 2, y: player.y - 10, w: 4, h: 12, vy: -480 });
    shotCooldown = .18;
    tone(320, .045, 'square', .025, 330);
  }

  function enemyShoot() {
    const alive = enemies.filter(e => e.alive);
    if (!alive.length) return;
    const shooter = alive[Math.floor(Math.random() * alive.length)];
    enemyBullets.push({ x: shooter.x + shooter.w / 2 - 2, y: shooter.y + shooter.h, w: 4, h: 10, vy: 170 + wave * 12 });
    tone(95, .04, 'square', .012, 20);
  }

  function burst(x, y, gold = false) {
    const color = gold ? '#ffc857' : '#79ff9b';
    for (let i = 0; i < (gold ? 28 : 12); i++) {
      particles.push({ x, y, vx: (Math.random() - .5) * 180, vy: (Math.random() - .5) * 180, life: .35 + Math.random() * .35, color });
    }
  }

  function hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update(dt) {
    stars.forEach(s => { s.y += s.v * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.life -= dt; });
    particles = particles.filter(p => p.life > 0);

    if (paused || !started) return;

    shotCooldown = Math.max(0, shotCooldown - dt);
    careerTimer -= dt;

    let move = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) move -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) move += 1;
    player.x = Math.max(22, Math.min(W - player.w - 22, player.x + move * player.speed * dt));
    if (keys.has('Space')) shoot();

    bullets.forEach(b => b.y += b.vy * dt);
    enemyBullets.forEach(b => b.y += b.vy * dt);
    bullets = bullets.filter(b => b.y > -30);
    enemyBullets = enemyBullets.filter(b => b.y < H + 30);

    enemyStepTimer += dt;
    const aliveCount = enemies.filter(e => e.alive).length;
    const stepDelay = Math.max(.16, .55 - wave * .035 - (36 - aliveCount) * .007);
    if (enemyStepTimer >= stepDelay) {
      enemyStepTimer = 0;
      let edge = false;
      enemies.forEach(e => {
        if (!e.alive) return;
        e.x += enemyDirection * (9 + wave);
        e.phase ^= 1;
        if (e.x < 28 || e.x + e.w > W - 28) edge = true;
      });
      if (edge) {
        enemyDirection *= -1;
        enemies.forEach(e => { if (e.alive) e.y += 16; });
      }
      if (Math.random() < .35 + wave * .03) enemyShoot();
    }

    if (careerTimer <= 0 && !careerShip && careerIndex < experiences.length) spawnCareerShip();
    if (careerShip) {
      careerShip.x += careerShip.vx * dt;
      if (careerShip.x > W + 80) {
        careerShip = null;
        careerTimer = 5 + Math.random() * 4;
        careerSpawned = false;
      }
    }

    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      let consumed = false;
      if (careerShip && hit(b, careerShip)) {
        burst(careerShip.x + careerShip.w / 2, careerShip.y + careerShip.h / 2, true);
        bullets.splice(bi, 1);
        score += 1000;
        careerShip = null;
        careerIndex += 1;
        careerTimer = 5 + Math.random() * 3;
        careerSpawned = false;
        updateHud();
        showIntel(experiences[careerIndex - 1]);
        consumed = true;
        if (careerIndex >= experiences.length && enemies.every(e => !e.alive)) setTimeout(() => showGameOver(true), 150);
      }
      if (consumed) continue;
      for (const e of enemies) {
        if (e.alive && hit(b, e)) {
          e.alive = false;
          bullets.splice(bi, 1);
          burst(e.x + e.w / 2, e.y + e.h / 2);
          score += 100 + e.row * 25;
          updateHud();
          tone(150, .055, 'square', .02, -60);
          consumed = true;
          break;
        }
      }
    }

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      if (hit(enemyBullets[i], player)) {
        enemyBullets.splice(i, 1);
        lives -= 1;
        burst(player.x + player.w / 2, player.y + player.h / 2);
        updateHud();
        tone(80, .22, 'sawtooth', .045, -40);
        if (lives <= 0) showGameOver(false);
        else player.x = W / 2 - player.w / 2;
      }
    }

    if (enemies.some(e => e.alive && e.y + e.h >= player.y - 8)) showGameOver(false);

    if (enemies.every(e => !e.alive)) {
      if (careerIndex >= experiences.length) {
        showGameOver(true);
      } else {
        wave += 1;
        score += 500;
        resetEnemies();
        bullets = [];
        enemyBullets = [];
        careerTimer = 2.2;
        updateHud();
        tone(420, .12, 'square', .035, 360);
      }
    }
  }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawPlayer() {
    const x = Math.round(player.x), y = Math.round(player.y);
    rect(x + 14, y, 8, 5, '#ffc857');
    rect(x + 8, y + 5, 20, 5, '#79ff9b');
    rect(x + 3, y + 10, 30, 7, '#79ff9b');
    rect(x, y + 17, 36, 5, '#79ff9b');
    rect(x + 7, y + 17, 5, 5, '#051008');
    rect(x + 24, y + 17, 5, 5, '#051008');
  }

  function drawEnemy(e) {
    if (!e.alive) return;
    const x = Math.round(e.x), y = Math.round(e.y);
    const c = e.row === 0 ? '#ffc857' : '#79ff9b';
    rect(x + 8, y, 14, 4, c);
    rect(x + 4, y + 4, 22, 4, c);
    rect(x, y + 8, 30, 8, c);
    rect(x + 4, y + 16, 6, 4, c);
    rect(x + 20, y + 16, 6, 4, c);
    rect(x + 8, y + 9, 4, 4, '#050906');
    rect(x + 18, y + 9, 4, 4, '#050906');
    if (e.phase) { rect(x, y + 16, 4, 4, c); rect(x + 26, y + 16, 4, 4, c); }
  }

  function drawCareerShip() {
    if (!careerShip) return;
    const s = careerShip;
    rect(s.x + 10, s.y, 46, 4, '#ffc857');
    rect(s.x + 4, s.y + 4, 58, 6, '#ffc857');
    rect(s.x, s.y + 10, 66, 10, '#ffc857');
    rect(s.x + 8, s.y + 20, 12, 4, '#ff6b57');
    rect(s.x + 46, s.y + 20, 12, 4, '#ff6b57');
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#050906';
    ctx.fillText('CAREER', s.x + s.w / 2, s.y + 18);
  }

  function draw() {
    rect(0, 0, W, H, '#030704');
    stars.forEach(s => rect(s.x, s.y, s.s, s.s, s.s === 2 ? '#ffc857' : '#375c40'));

    ctx.strokeStyle = 'rgba(121,255,155,.10)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

    enemies.forEach(drawEnemy);
    drawCareerShip();
    bullets.forEach(b => rect(b.x, b.y, b.w, b.h, '#ffc857'));
    enemyBullets.forEach(b => rect(b.x, b.y, b.w, b.h, '#ff6b57'));
    particles.forEach(p => rect(p.x, p.y, 3, 3, p.color));
    drawPlayer();

    ctx.fillStyle = 'rgba(121,255,155,.7)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THREAT GRID // SHOOT: SPACE // MOVE: A D / ← →', 18, H - 14);
  }

  function frame(t) {
    if (!running) return;
    const dt = Math.min(.033, (t - last) / 1000 || 0);
    last = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  async function open() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('arcade-modal-open');
    await loadExperiences();
    if (!running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    started = false;
    resetGame();
    showStart();
    canvas.focus();
  }

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('arcade-modal-open');
    paused = true;
    keys.clear();
  }

  window.openCareerInvaders = open;
  closeBtn?.addEventListener('click', close);
  startBtn?.addEventListener('click', startGame);
  resumeBtn?.addEventListener('click', resumeGame);
  intelCloseBtn?.addEventListener('click', resumeGame);

  window.addEventListener('keydown', e => {
    if (!modal.classList.contains('open')) return;
    if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'Escape') { close(); return; }
    if (e.code === 'Enter' && overlay.classList.contains('show')) { startGame(); return; }
    keys.add(e.code);
    if (e.code === 'Space') shoot();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));

  modal.querySelectorAll('[data-invader]').forEach(btn => {
    const code = btn.dataset.invader;
    const start = () => { keys.add(code); if (code === 'Space') shoot(); };
    const stop = () => keys.delete(code);
    btn.addEventListener('pointerdown', e => { e.preventDefault(); start(); });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', stop);
  });
})();
