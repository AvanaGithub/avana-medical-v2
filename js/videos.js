/* Background videos.
   Each video loads only when its page is first shown (the home page videos load at once).
   Files live in /videos. To change a video, replace the .mp4 file with one of the same name. */
(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function start(v, toggleIds){
    if (reduce){
      v.removeAttribute('autoplay');
      toggleIds.forEach(function(id){ var t = document.getElementById(id); if (t) t.setAttribute('aria-pressed','true'); });
    } else {
      var p = v.play(); p && p.catch(function(){});
    }
  }

  // Load [videoIds] with file when any of [pages] is shown
  function lazy(file, videoIds, toggleIds, pages, playIds){
    var done = false;
    function load(){
      if (done) return; done = true;
      videoIds.forEach(function(id){ var v = document.getElementById(id); if (v) v.src = 'videos/' + file; });
      (playIds || videoIds).forEach(function(id){ var v = document.getElementById(id); if (v) start(v, toggleIds); });
    }
    if (!pages){ load(); return; }
    pages.forEach(function(r){
      var pg = document.querySelector('[data-page="' + r + '"]');
      if (!pg) return;
      if (!pg.hidden) load();
      new MutationObserver(function(){
        if (pg.hidden) return;
        load();
        // Page background videos may have been paused while their page was hidden
        var vv = pg.querySelector('video.gl-bgvid');
        if (vv && vv.paused && !reduce){ var q = vv.play(); q && q.catch(function(){}); }
      }).observe(pg, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  // Home page
  (function(){
    var v = document.getElementById('heroVideo');
    if (v){ v.src = 'videos/hero.mp4'; if (!reduce){ var p = v.play(); p && p.catch(function(){}); } }
  })();
  lazy('about-section.mp4', ['aboutVideo'], ['aboutToggle']);

  // Brand pages
  lazy('arthrex.mp4', ['arthrexVideo'], ['arthrexToggle'], ['arthrex']);
  lazy('echi.mp4', ['echiVideo'], ['echiToggle'], ['echi']);
  lazy('movmedix.mp4', ['mmVideo'], ['mmToggle'], ['movmedix']);

  // About Us: Arthro Knee 2026 event video (full 92 s, muted web version of "Arthroknee Post Event Video Final.mp4")
  // "?v=2": bump the number whenever the file is replaced, so browsers don't keep showing a cached copy
  lazy('about-arthroknee.mp4?v=2', ['aboutBg'], ['aboutBgToggle'], ['about']);

  // Meet the Team, Contact and News & Events share one background video.
  // evVideo is the "Knee Surgery Academic Programme" card on News & Events; main.js plays it only while it is on screen.
  lazy('page-background.mp4', ['teamBg','contactBg','eventsBg','evVideo'], ['teamBgToggle','contactBgToggle','eventsBgToggle'], ['team','contact','events'], ['teamBg','contactBg','eventsBg']);
})();
