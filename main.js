(() => {
    'use strict';
    const $ = (s, c = document) => c.querySelector(s),
        $$ = (s, c = document) => [...c.querySelectorAll(s)];
    const body = document.body;
    const menu = $('#menuBtn'),
        links = $('#navLinks');
    menu.addEventListener('click', () => {
        const open = links.classList.toggle('open');
        menu.setAttribute('aria-expanded', open)
    });
    $$('#navLinks a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
    const canvas = $('#bgCanvas'),
        ctx = canvas.getContext('2d');
    let pts = [],
        paused = false;

    function resize() {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
        pts = Array.from({
            length: innerWidth < 700 ? 28 : 65
        }, () => ({
            x: Math.random() * innerWidth,
            y: Math.random() * innerHeight,
            vx: (Math.random() - .5) * .25,
            vy: (Math.random() - .5) * .25
        }))
    }

    function draw() {
        if (!paused) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of pts) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                ctx.fillStyle = 'rgba(121,255,155,.45)';
                ctx.fillRect(p.x, p.y, 1.5, 1.5)
            }
            for (let i = 0; i < pts.length; i++)
                for (let j = i + 1; j < pts.length; j++) {
                    const a = pts[i],
                        b = pts[j],
                        d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < 115) {
                        ctx.strokeStyle = `rgba(121,255,155,${(1-d/115)*.12})`;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke()
                    }
                }
        }
        requestAnimationFrame(draw)
    }
    resize();
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => paused = document.hidden);
    draw();
    let fx = localStorage.getItem('fx') || 'high';
    const fxBtn = $('[data-fx]');

    function setFx(v) {
        fx = v;
        body.classList.remove('fx-low', 'fx-off');
        if (v !== 'high') body.classList.add('fx-' + v);
        fxBtn.textContent = 'FX: ' + v.toUpperCase();
        localStorage.setItem('fx', v)
    }
    fxBtn.addEventListener('click', () => setFx(fx === 'high' ? 'low' : fx === 'low' ? 'off' : 'high'));
    setFx(fx);
    let audio = localStorage.getItem('siteAudio') !== 'off';
    const audioBtn = $('[data-audio]');

    function setAudio() {
        audioBtn.textContent = 'AUDIO: ' + (audio ? 'ON' : 'OFF');
        localStorage.setItem('siteAudio', audio ? 'on' : 'off')
    }
    audioBtn.addEventListener('click', () => {
        audio = !audio;
        setAudio()
    });
    setAudio();
    fetch('experiencias.json').then(r => r.json()).then(data => {
        const t = $('#timeline');
        data.sort((a, b) => String(b.periodo.inicio).localeCompare(a.periodo.inicio)).forEach((e, i) => {
            const b = document.createElement('button');
            b.className = 'timeline-card';
            b.setAttribute('aria-expanded', 'false');
            b.innerHTML = `<div class="closed"><small>FILE ${String(i+1).padStart(2,'0')}</small><h3>${e.cargo}</h3><p class="company">${e.empresa}</p><p>${e.periodo.inicio} — ${e.periodo.fim}</p><p>${e.descricao}</p></div><div class="details"><div><strong>IMPACT</strong><ul>${e.impactos.map(x=>`<li>${x}</li>`).join('')}</ul></div><div><strong>TECHNOLOGY</strong><div class="chips">${e.tecnologias.map(x=>`<span>${x}</span>`).join('')}</div></div></div>`;
            b.addEventListener('click', () => {
                const will = b.getAttribute('aria-expanded') !== 'true';
                $$('.timeline-card').forEach(x => x.setAttribute('aria-expanded', 'false'));
                b.setAttribute('aria-expanded', String(will));
                if (will) unlock('career_archive')
            });
            t.appendChild(b)
        })
    }).catch(() => {
        $('#timeline').textContent = 'Não foi possível carregar experiencias.json.'
    });
    const achievements = [
        ['first_contact', 'FIRST CONTACT', 'Visitou o portfólio'],
        ['deep_scan', 'DEEP SCAN', 'Visitou projetos e capacidades'],
        ['career_archive', 'ARCHIVE OPEN', 'Expandiu um card da carreira'],
        ['career_invader', 'CAREER INVADER', 'Abriu o Career Invaders'],
        ['road_runner', 'ROAD RUNNER', 'Abriu o Cert Road'],
        ['full_clearance', 'FULL CLEARANCE', 'Desbloqueou todas as conquistas principais']
    ];
    let unlocked = new Set(JSON.parse(localStorage.getItem('achievements') || '[]'));
    const grid = $('#achievementGrid'),
        toast = $('#toast');

    function render() {
        grid.innerHTML = achievements.map(([id, n, d]) => `<article class="${unlocked.has(id)?'':'locked'}"><strong>${unlocked.has(id)?'✓':'?'} ${n}</strong><span>${d}</span></article>`).join('')
    }

    function unlock(id) {
        if (unlocked.has(id)) return;
        unlocked.add(id);
        if (['first_contact', 'deep_scan', 'career_archive', 'career_invader', 'road_runner'].every(x => unlocked.has(x))) unlocked.add('full_clearance');
        localStorage.setItem('achievements', JSON.stringify([...unlocked]));
        render();
        const a = achievements.find(x => x[0] === id);
        if (a) {
            toast.textContent = `ACHIEVEMENT UNLOCKED // ${a[1]}`;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000)
        }
    }
    render();
    unlock('first_contact');
    const obs = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting && (e.target.id === 'operations' || e.target.id === 'capabilities')) unlock('deep_scan')
    }), {
        threshold: .35
    });
    obs.observe($('#operations'));
    obs.observe($('#capabilities'));

    function openCareer() {
        unlock('career_invader');
        const w = window.open('career-invaders.html', 'careerInvaders', 'popup=yes,width=1440,height=900,resizable=yes,scrollbars=no');
        if (!w) location.href = 'career-invaders.html'
    }
    $$('[data-career]').forEach(b => b.addEventListener('click', openCareer));
    $$('[data-cert]').forEach(b => b.addEventListener('click', () => {
        unlock('road_runner');
        window.openCertRoad?.()
    }));
})();
