(function () {
  var root = document.documentElement;
  var langs = (root.getAttribute('data-langs') || 'en').split(',');

  // Language toggle (only when the report has more than one language).
  function setLang(l) {
    root.setAttribute('data-lang', l);
    root.setAttribute('lang', l);
    var bs = document.querySelectorAll('[data-set-lang]');
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String(bs[i].getAttribute('data-set-lang') === l));
  }
  var l = langs[0];
  try {
    var saved = localStorage.getItem('report-lang');
    var nav = (navigator.language || '').slice(0, 2);
    l = langs.indexOf(saved) > -1 ? saved : (langs.indexOf(nav) > -1 ? nav : langs[0]);
  } catch (e) {}
  setLang(l);

  // Open the collapsed issue block that contains a target id.
  function openFor(id) {
    var el = id && document.getElementById(id); if (!el) return;
    var sec = el.closest('.issue'), d = sec && sec.querySelector('.issue-d');
    if (d) d.open = true;
  }
  openFor(location.hash.slice(1));
  window.addEventListener('hashchange', function () { openFor(location.hash.slice(1)); });

  // Screenshot viewer (modal).
  var lb = document.getElementById('lb'), stage = document.getElementById('lb-stage'),
      lbImg = document.getElementById('lb-img'), lbCap = document.getElementById('lb-cap');
  var group = [], idx = 0;
  function show() {
    var f = group[idx], im = f.querySelector('img'), cap = f.querySelector('figcaption');
    lbImg.src = im.src; lbImg.alt = im.alt;
    var art = f.closest('article'), title = art ? art.querySelector('h3') : null;
    lbCap.innerHTML = (title ? title.innerHTML + ' &middot; ' : '') + cap.innerHTML;
    stage.className = 'lb-stage fit'; stage.scrollTop = 0;
    lb.querySelector('[data-lb=prev]').disabled = idx === 0;
    lb.querySelector('[data-lb=next]').disabled = idx === group.length - 1;
  }
  function openLb(f) {
    var shots = f.closest('.shots');
    group = shots ? [].slice.call(shots.querySelectorAll('figure')) : [f];
    idx = Math.max(0, group.indexOf(f)); show();
    if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
  }
  function step(d) { var n = idx + d; if (n >= 0 && n < group.length) { idx = n; show(); } }
  function toggleZoom() { stage.className = stage.className.indexOf('full') > -1 ? 'lb-stage fit' : 'lb-stage full'; }
  document.addEventListener('keydown', function (e) {
    if (!lb.open) return;
    if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1);
  });

  // Sidebar: highlight the case in view; drawer on narrow screens.
  var toc = document.getElementById('toc');
  var tocLinks = [].slice.call(toc.querySelectorAll('.toc-case'));
  var byId = {}; tocLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var a = byId[en.target.id]; if (!a) return;
        tocLinks.forEach(function (x) { x.classList.remove('cur'); }); a.classList.add('cur');
        var r = a.getBoundingClientRect(), tr = toc.getBoundingClientRect();
        if (r.top < tr.top || r.bottom > tr.bottom) a.scrollIntoView({ block: 'nearest' });
      });
    }, { rootMargin: '-15% 0px -75% 0px' });
    [].forEach.call(document.querySelectorAll('article.case'), function (el) { io.observe(el); });
  }

  document.addEventListener('click', function (e) {
    var c = function (sel) { return e.target.closest && e.target.closest(sel); };
    var t;
    if ((t = c('[data-toc]'))) { toc.classList.toggle('show', t.getAttribute('data-toc') === 'open'); return; }
    if (c('.toc a')) toc.classList.remove('show');
    if ((t = c('[data-set-lang]'))) {
      var v = t.getAttribute('data-set-lang'); setLang(v);
      try { localStorage.setItem('report-lang', v); } catch (e2) {}
      return;
    }
    if ((t = c('[data-all]'))) {
      var ds = document.querySelectorAll('.issue-d');
      for (var k = 0; k < ds.length; k++) ds[k].open = t.getAttribute('data-all') === 'open';
      return;
    }
    if ((t = c('a[href^="#"]'))) {
      var id = t.getAttribute('href').slice(1); openFor(id);
      var f = document.getElementById(id);
      if (f && f.tagName === 'FIGURE') {
        e.preventDefault();
        [].forEach.call(document.querySelectorAll('figure.hit'), function (x) { x.classList.remove('hit'); });
        f.classList.add('hit');
        f.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
    }
    if ((t = c('.shot'))) { openLb(t.closest('figure')); return; }
    if ((t = c('[data-lb]'))) {
      var act = t.getAttribute('data-lb');
      if (act === 'close') lb.close(); else if (act === 'zoom') toggleZoom(); else step(act === 'next' ? 1 : -1);
      return;
    }
    if (e.target === lb || e.target === stage) lb.close();
    if (e.target === lbImg) toggleZoom();
  });
})();
