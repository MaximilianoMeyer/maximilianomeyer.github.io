(() => {
  'use strict';
  const modal = document.getElementById('certRoadModal');
  const canvas = document.getElementById('certRoadCanvas');
  const card = document.getElementById('certRoadCard');
  const closeBtn = document.getElementById('certRoadClose');
  if (!modal || !canvas || !card || !closeBtn) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const W = 960, H = 480;
  canvas.width = W; canvas.height = H;

  const certs = [
    { code:'DCPT', name:'Desec Certified Penetration Tester', issuer:'Desec Security', year:'OFFENSIVE SECTOR 01' },
    { code:'CEH', name:'Certified Ethical Hacker', issuer:'EC-Council', year:'THREAT SECTOR 02' },
    { code:'CRTA', name:'Certified Red Team Analyst', issuer:'CyberWarFare Labs', year:'ADVERSARY SECTOR 03' },
    { code:'MCRTA', name:'Multi-Cloud Red Team Analyst', issuer:'CyberWarFare Labs', year:'CLOUD SECTOR 04' }
  ];

  const keys = { left:false, right:false, boost:false };
  let running=false, raf=0, last=0, roadTime=0, carX=0, speed=36, passed=0, active=-1;
  let musicTimer=null, musicStep=0;
  let audioCtx=null;
  const signs = certs.map((c,i)=>({ cert:c, z:1400+i*1050, side:i%2===0?-1:1, shown:false }));

  function audio(){
    if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freq,duration=.07,type='square',gain=.035,delay=0){
    try{const a=audio(),o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(gain,a.currentTime+delay);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+delay+duration);o.connect(g);g.connect(a.destination);o.start(a.currentTime+delay);o.stop(a.currentTime+delay+duration);}catch(_e){}
  }
  function startupSound(){[196,247,294,392].forEach((f,i)=>tone(f,.09,'square',.025,i*.07));}
  function signSound(){tone(880,.08);tone(1174,.1,'square',.03,.09);}
  function engineTick(){ if(Math.floor(roadTime*8)%11===0) tone(46+speed*.22,.022,'sawtooth',.004); }
  function startMusic(){
    stopMusic(); musicStep=0;
    // Trilha original de corrida 16-bit: arpejo, baixo e pulso rítmico sintetizados.
    const bass=[82.41,82.41,98,110,73.42,82.41,65.41,73.42];
    const lead=[329.63,392,493.88,587.33,493.88,392,349.23,392,440,523.25,659.25,523.25,440,392,329.63,293.66];
    musicTimer=setInterval(()=>{
      if(!running)return;
      const s=musicStep++;
      tone(bass[s%bass.length],.15,'square',.010);
      tone(lead[s%lead.length],.07,'square',.007,.025);
      if(s%2===1)tone(lead[(s+4)%lead.length]/2,.055,'triangle',.005,.085);
      if(s%4===0)tone(62,.025,'square',.004,.12);
    },150);
  }
  function stopMusic(){if(musicTimer){clearInterval(musicTimer);musicTimer=null;}}

  function pixelRect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function drawSky(){
    pixelRect(0,0,W,H,'#07110b');
    // stars
    for(let i=0;i<80;i++){const x=(i*137+Math.floor(roadTime*4))%W,y=(i*73)%235;pixelRect(x,y,i%5===0?2:1,i%7===0?2:1,i%9===0?'#ffc857':'#79ff9b');}
    // sun
    const sx=730,sy=120,r=72;ctx.fillStyle='#ffc857';ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();
    for(let y=sy-r+10;y<sy+r;y+=12) pixelRect(sx-r-3,y,r*2+6,5,'#07110b');
    // mountains
    ctx.fillStyle='#16271a';ctx.beginPath();ctx.moveTo(0,260);for(let x=0;x<=W;x+=80){const y=180+((x/80)%3)*35;ctx.lineTo(x,y);}ctx.lineTo(W,310);ctx.lineTo(0,310);ctx.fill();
    ctx.fillStyle='#0b190e';ctx.beginPath();ctx.moveTo(0,285);for(let x=0;x<=W;x+=64){ctx.lineTo(x,225+((x/64)%4)*18);}ctx.lineTo(W,330);ctx.lineTo(0,330);ctx.fill();
  }
  function drawRoad(){
    const horizon=270;
    pixelRect(0,horizon,W,H-horizon,'#0b130d');
    ctx.fillStyle='#1d2820';ctx.beginPath();ctx.moveTo(390,horizon);ctx.lineTo(570,horizon);ctx.lineTo(900,H);ctx.lineTo(60,H);ctx.closePath();ctx.fill();
    // edges
    ctx.strokeStyle='#ffc857';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(390,horizon);ctx.lineTo(60,H);ctx.moveTo(570,horizon);ctx.lineTo(900,H);ctx.stroke();
    // moving center stripes
    for(let i=0;i<12;i++){
      const z=((i*130+(roadTime*speed*7))%1500)+30;
      const p=1-Math.min(z/1500,1), yy=horizon+p*p*(H-horizon), ww=3+p*14, hh=3+p*30;
      pixelRect(W/2-ww/2,yy,ww,hh,'#dfe8d9');
    }
    // roadside grid
    ctx.strokeStyle='rgba(121,255,155,.12)';ctx.lineWidth=1;
    for(let i=0;i<9;i++){const y=horizon+i*i*4.3;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  }
  function drawCar(){
    const x=W/2+carX*145,y=438,bob=Math.sin(roadTime*14)*2;
    // shadow
    pixelRect(x-62,y+55,124,10,'#020302');
    // wheels
    pixelRect(x-55,y+24+bob,18,34,'#020302');pixelRect(x+37,y+24+bob,18,34,'#020302');
    // body pixel car
    pixelRect(x-52,y+8+bob,104,38,'#d09b25');
    pixelRect(x-35,y-13+bob,70,28,'#ffc857');
    pixelRect(x-25,y-7+bob,22,17,'#153321');pixelRect(x+5,y-7+bob,22,17,'#153321');
    pixelRect(x-58,y+20+bob,12,18,'#ffc857');pixelRect(x+46,y+20+bob,12,18,'#ffc857');
    pixelRect(x-40,y+38+bob,18,7,'#ff6b57');pixelRect(x+22,y+38+bob,18,7,'#ff6b57');
    pixelRect(x-8,y+35+bob,16,7,'#071109');
  }
  function project(z,side){
    const max=1500,p=1-Math.max(0,Math.min(1,z/max));
    const y=278+p*p*225,scale=.18+p*.92;
    const x=W/2+side*(95+p*300);
    return {x,y,scale,p};
  }
  function drawSign(s,index){
    const q=project(s.z,s.side); if(s.z>1500||s.z<-80)return;
    const bw=142*q.scale,bh=76*q.scale,post=76*q.scale;
    pixelRect(q.x-4*q.scale,q.y,8*q.scale,post,'#78806f');
    pixelRect(q.x-bw/2,q.y-bh,bw,bh,'#132217');
    ctx.strokeStyle=index===active?'#ffffff':'#ffc857';ctx.lineWidth=Math.max(2,4*q.scale);ctx.strokeRect(Math.round(q.x-bw/2),Math.round(q.y-bh),Math.round(bw),Math.round(bh));
    ctx.fillStyle='#ffc857';ctx.font=`${Math.max(7,Math.floor(19*q.scale))}px "Share Tech Mono"`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s.cert.code,q.x,q.y-bh*.58);
    ctx.fillStyle='#79ff9b';ctx.font=`${Math.max(5,Math.floor(8*q.scale))}px "Share Tech Mono"`;ctx.fillText('CERT SIGNAL',q.x,q.y-bh*.25);
  }
  function showCert(index){
    if(index<0||index>=certs.length)return;
    active=index;const c=certs[index];
    card.innerHTML=`<div class="code">${c.code}</div><h3>${c.name}</h3><p>${c.year}</p><p class="issuer">ISSUER // ${c.issuer}<br>STATUS // VERIFIED ARCHIVE</p>`;
    card.classList.remove('show');void card.offsetWidth;card.classList.add('show');
    document.getElementById('roadSector').textContent=String(index+1).padStart(2,'0');
    signSound();
    setTimeout(()=>{if(active===index){card.classList.remove('show');active=-1;}},4300);
  }
  function reset(){roadTime=0;carX=0;speed=35;passed=0;active=-1;signs.forEach((s,i)=>{s.z=1400+i*1050;s.shown=false;});card.classList.remove('show');updateHud();}
  function updateHud(){document.getElementById('roadSpeed').textContent=String(Math.round(speed)).padStart(3,'0');document.getElementById('roadProgress').textContent=`${passed}/${certs.length}`;}
  function update(dt){
    const target=keys.boost?46:26;speed+=(target-speed)*Math.min(1,dt*2.4);
    if(keys.left)carX-=dt*1.05;if(keys.right)carX+=dt*1.05;carX=Math.max(-1,Math.min(1,carX));
    roadTime+=dt;
    signs.forEach((s,i)=>{
      s.z-=speed*dt*1.75;
      if(!s.shown&&s.z<190){s.shown=true;passed=Math.min(certs.length,passed+1);showCert(i);}
      if(s.z<-220){s.z+=certs.length*1050;s.shown=false;if(passed>=certs.length){passed=0;}}
    });
    updateHud();engineTick();
  }
  function draw(){drawSky();drawRoad();signs.slice().sort((a,b)=>b.z-a.z).forEach(s=>drawSign(s,signs.indexOf(s)));drawCar();}
  function loop(ts){if(!running)return;const dt=Math.min(.035,(ts-last)/1000||0);last=ts;update(dt);draw();raf=requestAnimationFrame(loop);}

  window.openCertRoad=function(){
    reset();modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';running=true;last=performance.now();startupSound();startMusic();canvas.focus();raf=requestAnimationFrame(loop);
  };
  function close(){running=false;stopMusic();cancelAnimationFrame(raf);modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';card.classList.remove('show');}
  closeBtn.addEventListener('click',close);
  modal.addEventListener('click',e=>{if(e.target===modal)close();});
  window.addEventListener('keydown',e=>{
    if(!modal.classList.contains('open'))return;
    if(e.key==='Escape'){close();return;}
    if(e.key==='ArrowLeft')keys.left=true;if(e.key==='ArrowRight')keys.right=true;if(e.code==='Space'){keys.boost=true;e.preventDefault();}
  });
  window.addEventListener('keyup',e=>{if(e.key==='ArrowLeft')keys.left=false;if(e.key==='ArrowRight')keys.right=false;if(e.code==='Space')keys.boost=false;});
  document.querySelectorAll('[data-road]').forEach(btn=>{
    const action=btn.dataset.road;
    const on=()=>{keys[action]=true;audio();};const off=()=>keys[action]=false;
    btn.addEventListener('pointerdown',on);btn.addEventListener('pointerup',off);btn.addEventListener('pointercancel',off);btn.addEventListener('pointerleave',off);
  });
  draw();
})();
