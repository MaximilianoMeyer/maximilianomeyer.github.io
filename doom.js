(() => {
  'use strict';
  const modal = document.getElementById('doomModal');
  if (!modal) return;
  const canvas = document.getElementById('doomCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const hint = document.getElementById('doomHint');
  const card = document.getElementById('doomCard');
  const progress = document.getElementById('doomProgress');
  const map = [
    '1111111111111111','1000000000000001','1011110111110101','1020010100300101',
    '1010010100100101','1000010000100001','1110111110101101','1000100000100001',
    '1040101111100501','1000101000100001','1011101010111101','1000001000000001',
    '1011111111110101','1060000000000001','1000000000000001','1111111111111111'
  ].map(r => r.split('').map(Number));
  const terminals = [
    {x:3.5,y:3.5,index:0},{x:11.5,y:3.5,index:1},{x:2.5,y:8.5,index:2},
    {x:13.5,y:8.5,index:3},{x:2.5,y:13.5,index:4},{x:4.5,y:13.5,index:5}
  ];
  let experiences = [], running = false, raf = 0, last = 0;
  let player = {x:1.7,y:1.7,a:0};
  const keys = new Set(), visited = new Set();
  const FOV = Math.PI / 3, MAX_DIST = 24;

  fetch('experiencias.json').then(r => r.json()).then(d => experiences = d).catch(() => { experiences = []; });

  function resize(){
    const r = canvas.getBoundingClientRect();
    const scale = Math.min(1, window.devicePixelRatio || 1);
    canvas.width = Math.max(320, Math.floor(r.width * scale));
    canvas.height = Math.max(200, Math.floor(r.height * scale));
  }
  function solid(x,y){ const row=map[Math.floor(y)]; return !row || row[Math.floor(x)] === undefined || row[Math.floor(x)] === 1; }
  function move(dx,dy){
    const nx=player.x+dx, ny=player.y+dy;
    if(!solid(nx,player.y)) player.x=nx;
    if(!solid(player.x,ny)) player.y=ny;
  }
  function update(dt){
    const speed=dt*2.4, turn=dt*1.9;
    if(keys.has('ArrowLeft')||keys.has('q')) player.a-=turn;
    if(keys.has('ArrowRight')||keys.has('e')) player.a+=turn;
    let f=0,s=0;
    if(keys.has('w')||keys.has('ArrowUp')) f+=speed;
    if(keys.has('s')||keys.has('ArrowDown')) f-=speed;
    if(keys.has('a')) s-=speed;
    if(keys.has('d')) s+=speed;
    move(Math.cos(player.a)*f + Math.cos(player.a+Math.PI/2)*s, Math.sin(player.a)*f + Math.sin(player.a+Math.PI/2)*s);
    const near = nearestTerminal();
    hint.textContent = near && near.dist < 1.25 ? 'PRESSIONE F PARA ACESSAR O TERMINAL DE CARREIRA' : 'WASD: mover · setas/Q/E: olhar · F: interagir · ESC: sair';
  }
  function cast(angle){
    const step=0.025, ca=Math.cos(angle), sa=Math.sin(angle);
    for(let d=0;d<MAX_DIST;d+=step){ if(solid(player.x+ca*d,player.y+sa*d)) return d; }
    return MAX_DIST;
  }
  function render(){
    const w=canvas.width,h=canvas.height;
    const sky=ctx.createLinearGradient(0,0,0,h/2);sky.addColorStop(0,'#190607');sky.addColorStop(1,'#51200d');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h/2);
    const floor=ctx.createLinearGradient(0,h/2,0,h);floor.addColorStop(0,'#25120b');floor.addColorStop(1,'#030101');ctx.fillStyle=floor;ctx.fillRect(0,h/2,w,h/2);
    const z=[];
    for(let x=0;x<w;x+=2){
      const ray=player.a-FOV/2+(x/w)*FOV, raw=cast(ray), d=raw*Math.cos(ray-player.a);z[x]=d;
      const wall=Math.min(h*1.7,h/Math.max(.001,d));const y=(h-wall)/2;
      const shade=Math.max(24,210-d*12);ctx.fillStyle=`rgb(${Math.floor(shade)},${Math.floor(shade*.28)},${Math.floor(shade*.12)})`;ctx.fillRect(x,y,2,wall);
      if(Math.floor(raw*10)%2===0){ctx.fillStyle='rgba(255,190,90,.055)';ctx.fillRect(x,y,1,wall);}
    }
    const sprites=terminals.map(t=>{const dx=t.x-player.x,dy=t.y-player.y;return {...t,dist:Math.hypot(dx,dy),ang:Math.atan2(dy,dx)};}).sort((a,b)=>b.dist-a.dist);
    for(const s of sprites){
      let rel=s.ang-player.a;while(rel>Math.PI)rel-=Math.PI*2;while(rel<-Math.PI)rel+=Math.PI*2;
      if(Math.abs(rel)>FOV*.7) continue;
      const sx=(.5+rel/FOV)*w,size=Math.min(h*.9,h/Math.max(.2,s.dist));
      if(z[Math.max(0,Math.min(w-1,Math.floor(sx))) ] < s.dist-.2) continue;
      ctx.save();ctx.translate(sx,h/2);ctx.fillStyle='#120402';ctx.strokeStyle=visited.has(s.index)?'#5cff8a':'#ffb02e';ctx.lineWidth=Math.max(2,size*.035);ctx.shadowBlur=20;ctx.shadowColor=ctx.strokeStyle;ctx.fillRect(-size*.22,-size*.38,size*.44,size*.76);ctx.strokeRect(-size*.22,-size*.38,size*.44,size*.76);ctx.fillStyle=ctx.strokeStyle;ctx.font=`bold ${Math.max(10,size*.11)}px monospace`;ctx.textAlign='center';ctx.fillText('CAREER',0,-size*.08);ctx.fillText(String(s.index+1).padStart(2,'0'),0,size*.12);ctx.restore();
    }
    ctx.fillStyle='rgba(255,60,20,.05)';for(let y=0;y<h;y+=4)ctx.fillRect(0,y,w,1);
  }
  function nearestTerminal(){ return terminals.map(t=>({...t,dist:Math.hypot(t.x-player.x,t.y-player.y)})).sort((a,b)=>a.dist-b.dist)[0]; }
  function interact(){ const n=nearestTerminal(); if(n&&n.dist<1.25) showExperience(n.index); }
  function showExperience(i){
    const e=experiences[i]; if(!e){hint.textContent='experiencias.json ainda não carregou.';return;}
    visited.add(i);progress.textContent=`${visited.size}/6 TERMINAIS`;
    card.innerHTML=`<h2>${escapeHtml(e.empresa)}</h2><div class="doom-role">${escapeHtml(e.cargo)}</div><div class="doom-period">${escapeHtml(e.periodo.inicio)} — ${escapeHtml(e.periodo.fim)}</div><p>${escapeHtml(e.descricao)}</p><h3>IMPACTO</h3><ul>${e.impactos.map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul><h3>TECNOLOGIAS</h3><div class="doom-tags">${e.tecnologias.map(v=>`<span class="doom-tag">${escapeHtml(v)}</span>`).join('')}</div><div class="doom-card-actions"><button class="doom-action" id="doomContinue">CONTINUAR</button></div>`;
    card.classList.add('active');document.getElementById('doomContinue').onclick=()=>card.classList.remove('active');
  }
  function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function loop(ts){if(!running)return;const dt=Math.min(.04,(ts-last)/1000||0);last=ts;update(dt);render();raf=requestAnimationFrame(loop);}
  window.openDoom=function(){modal.classList.add('active');document.body.style.overflow='hidden';resize();running=true;last=performance.now();raf=requestAnimationFrame(loop);canvas.focus();};
  window.closeDoom=function(){running=false;cancelAnimationFrame(raf);modal.classList.remove('active');card.classList.remove('active');document.body.style.overflow='';};
  window.addEventListener('resize',()=>{if(running)resize();});
  document.addEventListener('keydown',e=>{if(!running)return;if(e.key==='Escape'){if(card.classList.contains('active'))card.classList.remove('active');else closeDoom();return;}if(e.key.toLowerCase()==='f')interact();keys.add(e.key.toLowerCase());keys.add(e.key);e.preventDefault();});
  document.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());keys.delete(e.key);});
  document.getElementById('doomClose').onclick=closeDoom;
  document.getElementById('doomInteract').onclick=interact;
  document.querySelectorAll('[data-doom-key]').forEach(b=>{const k=b.dataset.doomKey;const on=e=>{e.preventDefault();keys.add(k);};const off=e=>{e.preventDefault();keys.delete(k);};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off);});
})();
