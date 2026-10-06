(function(){
  var pages=[].slice.call(document.querySelectorAll('[data-page]'));
  var routes=pages.map(function(p){return p.getAttribute('data-page')});
  var nav=document.getElementById('nav'),menuBtn=document.getElementById('menuBtn');
  var names={home:'Home',about:'About Us',team:'Meet the Team',contact:'Contact Us',arthrex:'Arthrex Product Range',echi:'e.CHI Catalogue',movmedix:'MovMedix Catalogue',careers:'Careers'};

  /* ---- Dropdown menus (disclosure pattern) ---- */
  var toggles=[].slice.call(document.querySelectorAll('.has-menu>button'));
  function closeAll(except){toggles.forEach(function(b){if(b!==except){b.setAttribute('aria-expanded','false');document.getElementById(b.getAttribute('aria-controls')).hidden=true;}})}
  function openMenu(b,focusFirst){closeAll(b);b.setAttribute('aria-expanded','true');var m=document.getElementById(b.getAttribute('aria-controls'));m.hidden=false;if(focusFirst){var a=m.querySelector('a');a&&a.focus();}}
  toggles.forEach(function(b){
    var m=document.getElementById(b.getAttribute('aria-controls'));
    b.addEventListener('click',function(){b.getAttribute('aria-expanded')==='true'?closeAll():openMenu(b,false)});
    b.addEventListener('keydown',function(e){if(e.key==='ArrowDown'){e.preventDefault();openMenu(b,true)}});
    m.addEventListener('keydown',function(e){
      var items=[].slice.call(m.querySelectorAll('a')),i=items.indexOf(document.activeElement);
      if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length].focus()}
      else if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length].focus()}
      else if(e.key==='Home'){e.preventDefault();items[0].focus()}
      else if(e.key==='End'){e.preventDefault();items[items.length-1].focus()}
    });
    var li=b.parentNode;
    li.addEventListener('focusout',function(e){if(!li.contains(e.relatedTarget)){b.setAttribute('aria-expanded','false');m.hidden=true}});
  });
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    var open=toggles.filter(function(b){return b.getAttribute('aria-expanded')==='true'})[0];
    if(open){closeAll();open.focus();}
    else if(nav.classList.contains('open')){setMobile(false);menuBtn.focus();}
  });
  document.addEventListener('click',function(e){if(!e.target.closest('.has-menu'))closeAll()});

  /* ---- Mobile menu ---- */
  function setMobile(o){nav.classList.toggle('open',o);menuBtn.setAttribute('aria-expanded',o)}
  menuBtn.addEventListener('click',function(){setMobile(!nav.classList.contains('open'))});

  /* ---- Router ---- */
  function show(route,scrollTo){
    if(routes.indexOf(route)<0)route='home';
    pages.forEach(function(p){p.hidden=p.getAttribute('data-page')!==route});
    document.querySelectorAll('[aria-current="page"].nav-link,.menu a[aria-current="page"]').forEach(function(a){a.removeAttribute('aria-current')});
    document.querySelectorAll('.nav-link.active').forEach(function(a){a.classList.remove('active')});
    if(route==='careers'){document.querySelector('.nav-link[data-route="careers"]').setAttribute('aria-current','page')}
    if(route==='about'||route==='team'||route==='contact'){document.getElementById('btn-about').classList.add('active');var am=document.querySelector('#menu-about a[data-route="'+route+'"]');am&&am.setAttribute('aria-current','page')}
    if(['arthrex','echi','movmedix'].indexOf(route)>-1){
      document.getElementById('btn-prod').classList.add('active');
      var a=document.querySelector('#menu-prod a[data-route="'+route+'"]');a&&a.setAttribute('aria-current','page');
    }
    var cta=document.getElementById('cta');if(cta)cta.hidden=(route==='contact');
    document.title=(names[route]||'Home')+' · Avana Medical Devices';
    closeAll();setMobile(false);
    if(scrollTo){var t=document.getElementById(scrollTo);if(t){t.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});t.setAttribute('tabindex','-1');t.focus({preventScroll:true});return}}
    window.scrollTo(0,0);
    var h=document.querySelector('[data-page="'+route+'"] h1');
    if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}
  }
  document.addEventListener('click',function(e){
    var a=e.target.closest('a[href^="#"]');if(!a)return;
    var r=a.getAttribute('data-route'),s=a.getAttribute('data-scroll');
    var href=a.getAttribute('href').slice(1);
    if(href==='main')return;
    e.preventDefault();
    if(s==='contact'){closeAll();setMobile(false);var c=document.getElementById('contact');c.scrollIntoView({behavior:'smooth'});c.setAttribute('tabindex','-1');c.focus({preventScroll:true});return}
    var route=r||(routes.indexOf(href)>-1?href:'home');
    if(s&&route==='home'&&!document.querySelector('[data-page="home"]').hidden){show('home',s);return}
    try{history.pushState(null,'','#'+route)}catch(err){location.hash=route}
    show(route,s);
  });
  window.addEventListener('popstate',function(){show(location.hash.slice(1)||'home')});
  window.addEventListener('hashchange',function(){show(location.hash.slice(1)||'home')});
  var init=location.hash.slice(1);if(routes.indexOf(init)>-1&&init!=='home'){pages.forEach(function(p){p.hidden=p.getAttribute('data-page')!==init})}
  show(routes.indexOf(init)>-1?init:'home');
  window.scrollTo(0,0);


  /* ---- Careers bloom ---- */
  (function(){
    var bloom=document.getElementById('bloom');if(!bloom)return;
    var svg=document.getElementById('bloomLines'),core=bloom.querySelector('.bloom-core');
    var nodes=[].slice.call(bloom.querySelectorAll('.bnode')).sort(function(a,b){return a.dataset.i-b.dataset.i});
    var NS='http://www.w3.org/2000/svg',played=false,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    function draw(){
      var B=bloom.getBoundingClientRect(),C=core.getBoundingClientRect();
      var cx=C.left+C.width/2-B.left,ct=C.top-B.top-10,cb=C.bottom-B.top+10;
      svg.setAttribute('viewBox','0 0 '+B.width+' '+B.height);svg.innerHTML='';
      var stacked=getComputedStyle(bloom.querySelector('.brow')).gridTemplateColumns.split(' ').length===1;
      nodes.forEach(function(n,k){
        var R=n.getBoundingClientRect(),d,ex,ey;
        var nx=R.left+R.width/2-B.left;
        if(stacked){var sx=14,ny=R.top-B.top+28;ex=R.left-B.left;ey=ny;d='M'+cx+' '+cb+' V'+(cb+14)+' H'+sx+' V'+ny+' H'+ex;}
        else if(R.bottom-B.top<=ct+12){ex=nx;ey=R.bottom-B.top;var my=(ey+ct)/2;d='M'+cx+' '+ct+' V'+my+' H'+nx+' V'+ey;}
        else{ex=nx;ey=R.top-B.top;var my2=(cb+ey)/2;d='M'+cx+' '+cb+' V'+my2+' H'+nx+' V'+ey;}
        var p=document.createElementNS(NS,'path');p.setAttribute('d',d);svg.appendChild(p);
        var dot=document.createElementNS(NS,'circle');dot.setAttribute('cx',ex);dot.setAttribute('cy',ey);dot.setAttribute('r',3.5);svg.appendChild(dot);
        var L=p.getTotalLength();n.style.setProperty('--d',(0.75+k*0.3+0.6)+'s');
        if(played||reduce){p.style.strokeDasharray='none';dot.style.opacity=1}
        else{p.style.strokeDasharray=L;p.style.strokeDashoffset=L;dot.style.opacity=0;p.dataset.k=k;}
      });
    }
    function play(){
      if(played)return;played=true;bloom.classList.add('play');
      [].forEach.call(svg.querySelectorAll('path'),function(p){var k=+p.dataset.k;
        p.style.transition='stroke-dashoffset .7s cubic-bezier(.5,0,.2,1) '+(0.75+k*0.3)+'s';
        requestAnimationFrame(function(){p.style.strokeDashoffset=0});});
      [].forEach.call(svg.querySelectorAll('circle'),function(c,k){c.style.transition='opacity .25s ease '+(0.75+k*0.3+0.65)+'s';requestAnimationFrame(function(){c.style.opacity=1});});
    }
    if(!reduce)bloom.classList.add('armed');else played=true;
    draw();
    var t;window.addEventListener('resize',function(){clearTimeout(t);t=setTimeout(function(){var was=played;draw();},120)});
    if('IntersectionObserver' in window&&!reduce){
      var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting&&!bloom.closest('[hidden]')){draw();play();io.disconnect()}})},{threshold:0,rootMargin:'0px 0px -25% 0px'});
      io.observe(bloom);
    } else play();
    /* when the Careers page is opened, layout exists only then: redraw */
    var pg=bloom.closest('[data-page]');if(pg)new MutationObserver(function(){if(!pg.hidden){requestAnimationFrame(draw)}}).observe(pg,{attributes:true,attributeFilter:['hidden']});
  })();


  /* ---- About Us / Meet the Team heroes: reveal on open ---- */
  [].forEach.call(document.querySelectorAll('.gl-hero'),function(hero){
    var pg=hero.closest('[data-page]');
    function reveal(){if(!pg.hidden){requestAnimationFrame(function(){hero.classList.add('in')})}else{hero.classList.remove('in')}}
    new MutationObserver(reveal).observe(pg,{attributes:true,attributeFilter:['hidden']});reveal();
  });


  /* ---- Contact: offices (Avana → cities; Chennai → 3 offices) ---- */
  (function(){
    var orbit=document.getElementById('orbit');if(!orbit)return;
    var core=document.getElementById('orbitCore'),svg=document.getElementById('orbitLines'),hint=document.getElementById('orbitHint'),
        hub=document.getElementById('chennaiHub'),hubHint=document.getElementById('chennaiHint');
    function el(k){return orbit.querySelector('[data-k="'+k+'"]')}
    var L1=['chennai','mumbai','bengaluru','delhi'].map(el),SUB=['corp','log','tech'].map(el),st={open:false,chennai:false};
    function mobile(){return matchMedia('(max-width:980px)').matches}
    function show(li,on,d){li.classList.toggle('show',on);li.style.setProperty('--d',(on?d:0)+'s');li.inert=!on;li.setAttribute('aria-hidden',on?'false':'true')}
    function apply(){
      L1.forEach(function(li,i){show(li,st.open,i*0.07)});
      SUB.forEach(function(li,i){show(li,st.open&&st.chennai,0.05+i*0.08)});
      orbit.classList.toggle('open',st.open);
      core.setAttribute('aria-expanded',st.open);hint.textContent=st.open?'Tap to close':'Tap to see our offices';
      hub.setAttribute('aria-expanded',st.open&&st.chennai);hubHint.textContent=st.chennai?'Tap to close':'Tap to see 3 offices';
      layout();
    }
    function layout(){
      if(mobile()){svg.innerHTML='';orbit.style.height='';core.style.top='';return}
      var W=orbit.clientWidth,cx=W/2,CR=125,w=270,gx=70,top=10,P={},paths=[],H;
      function h(k){return el(k).offsetHeight}
      var cyc=220,hubR=75,hubTop,hubCY,subTop=top,gap=36,sx0=cx-(3*w+2*gap)/2,subH=0;
      if(st.open){
        SUB.forEach(function(li){subH=Math.max(subH,li.offsetHeight)});
        hubTop=st.chennai?subTop+subH+90:top;hubCY=hubTop+hubR;P.chennai=[cx-90,hubTop];
        SUB.forEach(function(li,i){P[li.dataset.k]=[sx0+i*(w+gap),subTop]});
        cyc=hubTop+2*hubR+44+60+CR;
        P.mumbai=[cx-CR-gx-w,cyc-h('mumbai')/2+18];
        P.bengaluru=[cx+CR+gx,cyc-h('bengaluru')/2+18];
        P.delhi=[cx-w/2,cyc+CR+64];
        H=Math.max(P.mumbai[1]+h('mumbai'),P.bengaluru[1]+h('bengaluru'),P.delhi[1]+h('delhi'))+24;
        if(st.chennai)SUB.forEach(function(li,i){var x1=sx0+i*(w+gap)+w/2,y1=subTop+li.offsetHeight+10,y0=hubTop-14;
          paths.push('M'+x1+' '+y1+'C'+x1+' '+(y1+40)+' '+cx+' '+(y0-40)+' '+cx+' '+y0)});
        paths.push('M'+cx+' '+(hubTop+2*hubR+44)+'V'+(cyc-CR-12));
        paths.push('M'+(cx-CR-12)+' '+cyc+'H'+(cx-CR-gx+8));
        paths.push('M'+(cx+CR+12)+' '+cyc+'H'+(cx+CR+gx-8));
        paths.push('M'+cx+' '+(cyc+CR+12)+'V'+(P.delhi[1]-10));
      }else H=440;
      core.style.top=(cyc-CR)+'px';orbit.style.height=H+'px';
      L1.concat(SUB).forEach(function(li){
        var k=li.dataset.k,o=SUB.indexOf(li)>-1&&hubCY?[cx,hubCY]:[cx,cyc];
        li.style.setProperty('--hx',(o[0]-li.offsetWidth/2)+'px');li.style.setProperty('--hy',(o[1]-li.offsetHeight/2)+'px');
        if(P[k]){li.style.setProperty('--x',P[k][0]+'px');li.style.setProperty('--y',P[k][1]+'px')}
      });
      svg.setAttribute('viewBox','0 0 '+W+' '+H);
      svg.innerHTML=paths.map(function(d){return '<path d="'+d+'"/>'}).join('');
    }
    core.addEventListener('click',function(){st.open=!st.open;if(!st.open)st.chennai=false;apply()});
    hub.addEventListener('click',function(){st.chennai=!st.chennai;apply()});
    window.addEventListener('resize',layout);
    var pg=orbit.closest('[data-page]');new MutationObserver(function(){if(!pg.hidden)requestAnimationFrame(layout)}).observe(pg,{attributes:true,attributeFilter:['hidden']});
    apply();
  })();

  /* ---- Arthrex video ---- */
  var xv=document.getElementById('arthrexVideo'),xt=document.getElementById('arthrexToggle');
  xt.addEventListener('click',function(){var p=!xv.paused;if(p)xv.pause();else{var r=xv.play();r&&r.catch(function(){})}xt.setAttribute('aria-pressed',p);xt.setAttribute('aria-label',p?'Play background video':'Pause background video')});

  var ev=document.getElementById('echiVideo'),et=document.getElementById('echiToggle');
  et.addEventListener('click',function(){var p=!ev.paused;if(p)ev.pause();else{var r=ev.play();r&&r.catch(function(){})}et.setAttribute('aria-pressed',p);et.setAttribute('aria-label',p?'Play background video':'Pause background video')});

  var bgv=document.getElementById('aboutBg'),bgt=document.getElementById('aboutBgToggle');
  bgt.addEventListener('click',function(){var p=!bgv.paused;if(p)bgv.pause();else{var r=bgv.play();r&&r.catch(function(){})}bgt.setAttribute('aria-pressed',p);bgt.setAttribute('aria-label',p?'Play background video':'Pause background video')});

  var mmv=document.getElementById('mmVideo'),mmt=document.getElementById('mmToggle');
  mmt.addEventListener('click',function(){var p=!mmv.paused;if(p)mmv.pause();else{var r=mmv.play();r&&r.catch(function(){})}mmt.setAttribute('aria-pressed',p);mmt.setAttribute('aria-label',p?'Play background video':'Pause background video')});

  var tbv=document.getElementById('teamBg'),tbt=document.getElementById('teamBgToggle');
  tbt.addEventListener('click',function(){var p=!tbv.paused;if(p)tbv.pause();else{var r=tbv.play();r&&r.catch(function(){})}tbt.setAttribute('aria-pressed',p);tbt.setAttribute('aria-label',p?'Play background video':'Pause background video')});

  var cbv=document.getElementById('contactBg'),cbt=document.getElementById('contactBgToggle');
  cbt.addEventListener('click',function(){var p=!cbv.paused;if(p)cbv.pause();else{var r=cbv.play();r&&r.catch(function(){})}cbt.setAttribute('aria-pressed',p);cbt.setAttribute('aria-label',p?'Play background video':'Pause background video')});

  /* ---- About video ---- */
  var av=document.getElementById('aboutVideo'),at=document.getElementById('aboutToggle');
  /* keep both background videos looping without a stall */
  [['aboutVideo','aboutToggle'],['heroVideo','vidToggle'],['arthrexVideo','arthrexToggle'],['echiVideo','echiToggle'],['aboutBg','aboutBgToggle'],['mmVideo','mmToggle'],['teamBg','teamBgToggle'],['contactBg','contactBgToggle']].forEach(function(p){
    var v=document.getElementById(p[0]),t=document.getElementById(p[1]);if(!v)return;v.loop=true;
    function userPaused(){return t&&t.getAttribute('aria-pressed')==='true'}
    v.addEventListener('ended',function(){v.currentTime=0;var r=v.play();r&&r.catch(function(){})});
    v.addEventListener('pause',function(){if(!userPaused()&&!document.hidden){setTimeout(function(){if(v.paused&&!userPaused()){var r=v.play();r&&r.catch(function(){})}},150)}});
    document.addEventListener('visibilitychange',function(){if(!document.hidden&&v.paused&&!userPaused()){var r=v.play();r&&r.catch(function(){})}});
  });
  at.addEventListener('click',function(){var p=!av.paused;if(p)av.pause();else{var r=av.play();r&&r.catch(function(){})}at.setAttribute('aria-pressed',p);at.setAttribute('aria-label',p?'Play background video':'Pause background video')});

  /* ---- Hero video ---- */
  var hv=document.getElementById('heroVideo'),vt=document.getElementById('vidToggle');
  function setPaused(p){if(p){hv.pause()}else{var pr=hv.play();pr&&pr.catch(function(){})}vt.setAttribute('aria-pressed',p);vt.setAttribute('aria-label',p?'Play background video':'Pause background video')}
  vt.addEventListener('click',function(){setPaused(!hv.paused)});
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){hv.removeAttribute('autoplay');setPaused(true)}

})();
