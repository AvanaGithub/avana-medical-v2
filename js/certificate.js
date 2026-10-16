/* About Us: the ISO 13485 certificate in a view-only viewer. The pages are images served by the server
   (/certificates/iso-13485/<page>); there is no PDF to download, and saving or dragging the pages is switched off.
   (Nothing on a web page can stop a screenshot; the pages carry a "for viewing only" watermark.) */
(function () {
  var dlg = document.getElementById('certDialog');
  if (!dlg) return;
  var pages = document.getElementById('certPages');

  function load() {
    if (pages.childElementCount) return;
    var n = Number(pages.getAttribute('data-pages')) || 1;
    for (var i = 1; i <= n; i++) {
      var fig = document.createElement('figure');
      fig.className = 'cert-page';
      var img = new Image();
      img.alt = 'ISO 13485:2016 certificate, page ' + i + ' of ' + n;
      img.src = '/certificates/iso-13485/' + i;
      img.draggable = false;
      fig.appendChild(img);
      var shield = document.createElement('span');          // sits over the image so long-press / right-click "save image" has nothing to grab
      shield.className = 'cert-shield';
      fig.appendChild(shield);
      pages.appendChild(fig);
    }
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-cert]')) { e.preventDefault(); load(); dlg.showModal(); pages.scrollTop = 0; }
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-cert-close]')) dlg.close(); });
  dlg.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  dlg.addEventListener('dragstart', function (e) { e.preventDefault(); });
  // Ctrl/Cmd+S or Ctrl/Cmd+P while the viewer is open does nothing
  document.addEventListener('keydown', function (e) {
    if (dlg.open && (e.ctrlKey || e.metaKey) && /^[sp]$/i.test(e.key)) e.preventDefault();
  });
})();
