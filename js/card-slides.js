/* Careers "Life at Avana" cards: each card fades through its own set of photos.
   Markup: <div class="bimg slides" data-slides> with one <img> per photo; the first has class "on".
   To change a card's photos, add or remove <img> tags inside its data-slides block in index.html. */
(function(){
  var DELAY = 4500;        // ms each photo stays on screen
  var STAGGER = 1500;      // offset between cards so they don't change together
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;      // keep the first photo only

  [].forEach.call(document.querySelectorAll('[data-slides]'), function(box, n){
    var imgs = [].slice.call(box.querySelectorAll('img'));
    if (imgs.length < 2) return;
    var i = 0, timer = null, visible = false, hovered = false;

    // Load the remaining photos up front so each fade is smooth
    imgs.forEach(function(img){ img.loading = 'eager'; });

    function next(){
      imgs[i].classList.remove('on');
      i = (i + 1) % imgs.length;
      imgs[i].classList.add('on');
    }
    function run(){
      stop();
      if (!visible || hovered || document.hidden) return;
      timer = setTimeout(function tick(){ next(); timer = setTimeout(tick, DELAY); }, DELAY + n * STAGGER);
    }
    function stop(){ clearTimeout(timer); timer = null; }

    // Only cycle while the card is on screen (and its page is open)
    if ('IntersectionObserver' in window){
      new IntersectionObserver(function(es){ visible = es[0].isIntersecting; run(); }).observe(box);
    } else { visible = true; run(); }

    box.addEventListener('mouseenter', function(){ hovered = true; stop(); });
    box.addEventListener('mouseleave', function(){ hovered = false; run(); });
    document.addEventListener('visibilitychange', run);
  });
})();
