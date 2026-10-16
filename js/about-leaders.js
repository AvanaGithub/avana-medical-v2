/* About Us (Purpose / Mission / Vision over the Marina Beach film) and Meet our Leaders slider, from the MD's October 2026 design. */
  /* ---- Meet our Leaders: people slider, halftone portraits, full bio alongside ---- */
  (function(){
    var sec=document.getElementById('leaders');if(!sec)return;
    var page=sec.closest('[data-page]'), track=sec.querySelector('.lt-track'), slide=sec.querySelector('.lt-slide'),
        orig=[].slice.call(track.children), n=orig.length, subs=[].slice.call(sec.querySelectorAll('.lt-sub-item')),
        cnt=sec.querySelector('[data-pagi-count]'), bar=sec.querySelector('.lt-line-inner'),
        wide=matchMedia('(min-width:768px)'), still=matchMedia('(prefers-reduced-motion: reduce)'),
        pos=0, loop=false, real=-1, drawn=false;
    function pad(k){return k<10?'0'+k:''+k}
    // copies before and after the real cards make the loop endless on laptops and tablets
    var pre=document.createDocumentFragment(), post=document.createDocumentFragment();
    orig.forEach(function(li){
      [0,1].forEach(function(k){var c=li.cloneNode(true);c.classList.add('lt-clone');c.setAttribute('aria-hidden','true');c.setAttribute('inert','');
        [].forEach.call(c.querySelectorAll('[id]'),function(e){e.removeAttribute('id')});(k?post:pre).appendChild(c)});
    });
    track.insertBefore(pre,track.firstChild);track.appendChild(post);
    var all=[].slice.call(track.children), clones=all.filter(function(li){return li.classList.contains('lt-clone')});
    // halftone dot portrait in Avana gold, drawn from each photo
    function halftone(img,cv){
      var W=cv.width,H=cv.height,p=10,gw=Math.ceil(W/p),gh=Math.ceil(H/p),s=document.createElement('canvas');s.width=gw;s.height=gh;
      var sx=s.getContext('2d');sx.drawImage(img,0,0,gw,gh);var d=sx.getImageData(0,0,gw,gh).data,x=cv.getContext('2d');
      x.clearRect(0,0,W,H);x.fillStyle='#B27F0D';
      for(var j=0;j<gh;j++)for(var i=0;i<gw;i++){var k=(j*gw+i)*4,L=(.2126*d[k]+.7152*d[k+1]+.0722*d[k+2])/255,t=Math.pow(Math.max(0,Math.min(1,(.92-L)/.8)),1.15);
        x.globalAlpha=.2+.8*t;x.beginPath();x.arc(i*p+p/2,j*p+p/2,p*.5*(.13+.47*Math.sqrt(t)),0,6.2832);x.fill()}
    }
    function drawAll(){if(drawn)return;drawn=true;all.forEach(function(li){var img=li.querySelector('.lt-img'),cv=li.querySelector('.lt-mask');
      function go(){try{halftone(img,cv)}catch(e){}}if(img.complete&&img.naturalWidth)go();else img.addEventListener('load',go,{once:true})})}
    function step(){var a=all.filter(function(li){return li.offsetParent!==null});return a.length>1?a[1].getBoundingClientRect().left-a[0].getBoundingClientRect().left:0}
    function maxShift(){var vis=orig,last=vis[vis.length-1];return Math.max(0,(last.offsetLeft+last.offsetWidth)-(orig[0].offsetLeft)-slide.clientWidth)}
    function render(anim){
      track.classList.toggle('no-anim',!anim||still.matches);
      var s=step(), x;
      if(loop)x=-pos*s;else x=-Math.min(pos*s,maxShift());
      track.style.transform='translate3d('+x+'px,0,0)';
      var r=((pos%n)+n)%n;
      if(r!==real){real=r;
        all.forEach(function(li){li.classList.toggle('active',+li.getAttribute('data-i')===r)});
        subs.forEach(function(sb,k){sb.classList.toggle('active',k===r)});
        cnt.textContent=pad(r+1);bar.style.transform='scaleX('+((r+1)/n)+')';
      }
      if(arrows){arrows[0].disabled=!loop&&pos<=0;arrows[1].disabled=!loop&&pos>=n-1}
    }
    function normalize(){if(!loop)return;if(pos<n||pos>=2*n){pos=((pos%n)+n)%n+n;render(false);void track.offsetWidth}}
    function go(d){normalize();if(loop)pos+=d;else pos=Math.max(0,Math.min(n-1,pos+d));render(true)}
    track.addEventListener('transitionend',function(e){if(e.target===track)normalize()});
    function setMode(){loop=wide.matches;clones.forEach(function(c){c.style.display=loop?'':'none'});pos=loop?n+(real<0?0:real):Math.max(real,0);render(false)}
    wide.addEventListener?wide.addEventListener('change',setMode):wide.addListener(setMode);
    addEventListener('resize',function(){render(false)});
    var arrows=[].slice.call(sec.querySelectorAll('.lt-arrow'));
    arrows.forEach(function(b){b.addEventListener('click',function(){go(+b.getAttribute('data-dir'))})});
    // drag or swipe the row
    var sx0=0,dx=0,base=0,down=false,moved=false;
    slide.addEventListener('pointerdown',function(e){if(e.button!==0)return;down=true;moved=false;dx=0;sx0=e.clientX;normalize();
      var m=/translate3d\((-?[\d.]+)px/.exec(track.style.transform);base=m?+m[1]:0;track.classList.add('no-anim')});
    addEventListener('pointermove',function(e){if(!down)return;dx=e.clientX-sx0;if(Math.abs(dx)>6&&!moved){moved=true;slide.classList.add('dragging');try{slide.setPointerCapture(e.pointerId)}catch(err){}}
      if(moved)track.style.transform='translate3d('+(base+dx)+'px,0,0)'});
    function end(){if(!down)return;down=false;slide.classList.remove('dragging');
      if(moved&&Math.abs(dx)>40){var s=step()||1,k=Math.max(1,Math.round(Math.abs(dx)/s));go(dx<0?k:-k)}else render(true)}
    addEventListener('pointerup',end);addEventListener('pointercancel',end);
    slide.addEventListener('click',function(e){if(moved){e.preventDefault();e.stopPropagation();moved=false}},true);
    track.addEventListener('click',function(e){var li=e.target.closest('.lt-item');if(!li||li.classList.contains('active')||e.target.closest('a'))return;
      var k=all.indexOf(li);if(loop){normalize();go(k-pos)}else go(+li.getAttribute('data-i')-pos)});
    slide.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){e.preventDefault();go(1)}else if(e.key==='ArrowLeft'){e.preventDefault();go(-1)}});
    // first view: reveal, draw portraits, size the row
    // every bio sits between the top and bottom of the photos: one text size, chosen so the longest bio still fits
    var subMain=sec.querySelector('.lt-sub-main'), descs=[].slice.call(sec.querySelectorAll('.lt-sub-desc')), wideBio=matchMedia('(min-width:1280px)');
    function fitBios(){
      subMain.style.removeProperty('--bio-fs');
      if(!wideBio.matches||page.hidden)return;
      var avail=subMain.clientHeight, fs=parseFloat(getComputedStyle(descs[0]).fontSize);
      function over(){return descs.some(function(d){return d.getBoundingClientRect().height>avail-4})}
      while(over()&&fs>13){fs-=.25;subMain.style.setProperty('--bio-fs',fs+'px')}
    }
    var fitT;addEventListener('resize',function(){clearTimeout(fitT);fitT=setTimeout(fitBios,120)});
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitBios);
    function onShow(){if(page.hidden)return;drawAll();setMode();fitBios()}
    new MutationObserver(onShow).observe(page,{attributes:true,attributeFilter:['hidden']});
    if('IntersectionObserver' in window){new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)sec.classList.add('in')})},{threshold:.12}).observe(sec)}else sec.classList.add('in');
    slide.setAttribute('tabindex','0');
    onShow();
  })();

  /* ---- About Us: Purpose / Mission / Vision pinned scroll section ---- */
  (function(){
    var wrap=document.getElementById('pmv');if(!wrap)return;
    var page=wrap.closest('[data-page]'), stage=document.getElementById('pmvStage'), list=document.getElementById('pmvList'),
        prog=document.getElementById('pmvProg'), items=[].slice.call(wrap.querySelectorAll('.pmv-item')), bgBox=stage.querySelector('.pmv-bg'),
        n=items.length, cur=-1, ticking=false;
    // each statement becomes masked words that rise in one after another
    items.forEach(function(it){
      var d=it.querySelector('.pmv-desc'), words=d.textContent.trim().split(/\s+/);
      d.innerHTML='<span class="sr-only">'+d.textContent.trim()+'</span>'+words.map(function(w,k){return '<span class="w" aria-hidden="true"><span style="--d:'+(0.03*(k+1)).toFixed(2)+'s">'+w+'</span></span>'}).join(' ');
    });
    function update(){
      ticking=false;
      if(page.hidden||innerWidth<768)return;
      var r=wrap.getBoundingClientRect(), range=wrap.offsetHeight-innerHeight;
      var p=range>0?Math.min(1,Math.max(0,-r.top/range)):0;
      var i=Math.min(n-1,Math.floor(p*n)), o=p*n-i; if(p>=1)o=1;
      items.forEach(function(it,t){it.style.setProperty('--p',(t<i?0:t===i?100*(1-o):100).toFixed(2)+'%')});
      if(i!==cur){
        cur=i;
        items.forEach(function(it,t){it.classList.toggle('active',t===i);it.classList.toggle('past',t<i);it.classList.toggle('far',t<i-1)});
        list.style.setProperty('--index',i);
      }
      prog.style.width=(p*100).toFixed(2)+'%';
    }
    function onScroll(){if(!ticking){ticking=true;requestAnimationFrame(function(){update();solid()})}}
    var head=document.querySelector('header.main');
    function solid(){head.classList.toggle('ov-solid',!page.hidden&&wrap.getBoundingClientRect().bottom<innerHeight-2)}
    addEventListener('scroll',onScroll,{passive:true});
    addEventListener('resize',onScroll);
    // the film: HD for laptops and desktops, a sharp portrait cut for phones; loaded only once About Us is opened
    var film=document.getElementById('pmvFilm'), mHost=document.getElementById('pmvMFilm'),
        phone=matchMedia('(max-width:767px)'), still=matchMedia('(prefers-reduced-motion: reduce)'), onScreen=false, wanted=false;
    function srcFor(){return phone.matches?'videos/pmv-waves-phone.mp4':'videos/pmv-waves-hd.mp4'}
    function play(){if(!wanted||still.matches||!onScreen)return;var q=film.play();q&&q.catch(function(){})}
    function place(){
      var host=phone.matches?mHost:bgBox;if(film.parentNode!==host)host.appendChild(film);
      if(wanted){var want=srcFor();if(film.getAttribute('src')!==want){var t=film.currentTime||0;film.setAttribute('src',want);film.addEventListener('loadedmetadata',function f(){film.removeEventListener('loadedmetadata',f);try{film.currentTime=t%(film.duration||8.5)}catch(e){}});}}
      play();
    }
    phone.addEventListener?phone.addEventListener('change',place):phone.addListener(place);
    film.loop=true;film.addEventListener('ended',function(){film.currentTime=0;play()});
    function onShow(){
      if(page.hidden){film.pause();head.classList.remove('ov-solid');return}
      if(!wanted){wanted=true;film.preload='auto'}
      place();cur=-1;update();solid();
    }
    new MutationObserver(onShow).observe(page,{attributes:true,attributeFilter:['hidden']});
    onShow();
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){es.forEach(function(e){onScreen=e.isIntersecting;onScreen?play():film.pause()})}).observe(wrap);
      new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)stage.classList.add('seen')})},{threshold:.25}).observe(stage);
      var mWrap=wrap.querySelector('.pmv-m'), io=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle('in',e.isIntersecting)})},{threshold:.35});
      mWrap.classList.add('anim');[].forEach.call(wrap.querySelectorAll('.pmv-m-card'),function(c){io.observe(c)});
    }else{onScreen=true;stage.classList.add('seen');play()}
  })();


