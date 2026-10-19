/* Background videos.
   Each video loads only when its page is first shown (the home page videos load at once).
   Files live in /videos. To change a video, replace the .mp4 file with one of the same name. */
(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function start(v){
    if (reduce) v.removeAttribute('autoplay');
    else { var p = v.play(); p && p.catch(function(){}); }
  }

  // Load [videoIds] with file when any of [pages] is shown
  function lazy(file, videoIds, pages, playIds){
    var done = false;
    function load(){
      if (done) return; done = true;
      videoIds.forEach(function(id){ var v = document.getElementById(id); if (v) v.src = 'videos/' + file; });
      (playIds || videoIds).forEach(function(id){ var v = document.getElementById(id); if (v) start(v); });
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

  // Large screens on a normal connection get the full-HD version of a video; phones and data-saver get the lighter one
  var conn = navigator.connection || {};
  var hd = window.matchMedia('(min-width: 1024px)').matches && !conn.saveData && !/(^|-)2g$/.test(conn.effectiveType || '');
  function pick(name, v) { return name + (hd ? '-1080' : '-720') + '.mp4?v=' + v; }

  // Home page
  (function(){
    var v = document.getElementById('heroVideo');
    if (v){ v.src = 'videos/' + pick('hero', 2);   // Arthrex ACL reconstruction film (HD)
      if (!reduce){ var p = v.play(); p && p.catch(function(){}); } }
  })();
  lazy('about-section.mp4?v=2', ['aboutVideo']);

  // Brand pages
  lazy(pick('arthrex', 2), ['arthrexVideo'], ['arthrex']);
  lazy(pick('echi', 2), ['echiVideo'], ['echi']);
  lazy(pick('movmedix', 2), ['mmVideo'], ['movmedix']);

  // Meet our Leaders: the same Arthro Knee 2026 montage as the Contact page (the browser downloads it once for both).
  // Bump "?v=" whenever a file is replaced, so browsers don't show a cached copy. About Us plays the Marina Beach film (js/about-leaders.js).
  lazy(pick('page-background', 2), ['teamBg'], ['team']);

  // Contact: Arthro Knee 2026 montage (same 8 shots as the old page-background.mp4, re-cut from the HD original)
  lazy(pick('page-background', 2), ['contactBg'], ['contact'], ['contactBg']);
})();
