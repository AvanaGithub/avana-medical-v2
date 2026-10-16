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
  lazy('about-section.mp4?v=2', ['aboutVideo'], ['aboutToggle']);

  // Brand pages
  lazy('arthrex.mp4', ['arthrexVideo'], ['arthrexToggle'], ['arthrex']);
  lazy(pick('echi', 2), ['echiVideo'], ['echiToggle'], ['echi']);
  lazy(pick('movmedix', 2), ['mmVideo'], ['mmToggle'], ['movmedix']);

  // Meet the Team: Arthro Knee 2026 event video (full 92 s, muted web versions of "Arthroknee Post Event Video Final.mp4":
  // 1080p for large screens, 720p for phones). Bump "?v=" whenever a file is replaced, so browsers don't show a cached copy.
  // (About Us now plays the Marina Beach film, see js/about-leaders.js)
  lazy(pick('about-arthroknee', 3), ['teamBg'], ['teamBgToggle'], ['team']);

  // Contact: abstract background video
  lazy('page-background.mp4', ['contactBg'], ['contactBgToggle'], ['contact'], ['contactBg']);
})();
