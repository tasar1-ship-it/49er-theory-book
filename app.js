/* Advanced Olympic 49er Sailing Theory — reading, marking and export.
   Everything is stored on this device. Nothing leaves it until Export.
   With the marks storage repairs of 26 September 2026. */
(function () {
  'use strict';

  // If this file is ever included twice on one page, every listener would be
  // attached twice and the walkthrough would speak each line twice. Run once.
  if (window.__k49booted) return;
  window.__k49booted = true;

  var D = window.BOOKDATA || { SRC: {}, WSRC: {}, BOOK: [] };
  var MK = 'k49.marks.v1';
  var PF = 'k49.prefs.v1';
  var SIZES = ['17px', '20px', '23px', '26px'];
  var THEMES = ['light', 'sepia', 'dark'];
  var THEME_LABEL = { light: 'Bright', sepia: 'Sepia', dark: 'Dark' };
  var NEEDS = ['A worked example', 'A diagram', 'Explain it more simply',
               'More depth', 'A drill to practise it', 'A source to read'];

  // ------------------------------------------------------------- storage
  function readJSON(k, d) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
    catch (e) { return d; }
  }
  /* A refused write says Not saved, as a refused mark does. quiet leaves
     the message to the caller, which knows what it was that was not saved. */
  function writeJSON(k, v, quiet) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { if (!quiet) toast('Not saved: this device refused to store it'); return false; }
  }

  /* Repairs of 26 September 2026. Marks used to be read once when a page
     opened and the whole list written back on every change. A second tab,
     or a page Safari kept from before a swipe back, still held its old list
     and wrote it over the newer one, and the marks made in between were
     gone. Now every change reads the newest list first, and a list that
     cannot be read is parked under its own name, k49.marks.v1.damaged.<time>,
     instead of being written over. */
  var hold = false;                               // a damaged list could not be parked: write nothing
  function loadMarks() {
    var raw;
    try { raw = localStorage.getItem(MK); }
    catch (e) { return null; }                    // storage refused: keep what is in memory
    if (!raw) { hold = false; return []; }        // nothing stored, so nothing to protect
    try {
      var v = JSON.parse(raw);
      if (Array.isArray(v)) { hold = false; return v; }
    } catch (e) { /* damaged */ }
    hold = !park(raw);
    return [];
  }
  function park(raw) {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf(MK + '.damaged.') === 0 && localStorage.getItem(k) === raw) return true;
      }
      localStorage.setItem(MK + '.damaged.' + Date.now(), raw);
      return true;
    } catch (e) { return false; }
  }
  var marks = loadMarks() || [];
  function latest() {
    var cur = loadMarks();
    if (cur) marks = cur;
    return marks;
  }
  function mutate(fn) {
    var cur = loadMarks();
    if (cur) marks = cur;
    var r = fn(marks);
    /* a list that could not be read again just now is never written back */
    if (cur) saveMarks(); else saved = false;
    return r;
  }
  /* A note or request another tab has deleted is added again with the edit,
     because the reader has just typed it. A colour tap passes no fallback,
     so a mark deleted elsewhere stays deleted. */
  function updateMark(id, patch, fallback) {
    return mutate(function (L) {
      var m = null;
      for (var i = 0; i < L.length; i++) if (L[i].id === id) { m = L[i]; break; }
      if (!m && fallback) { m = fallback; L.push(m); }
      if (m) for (var k in patch) if (patch.hasOwnProperty(k)) m[k] = patch[k];
      return m;
    });
  }
  /* What the page shows is compared with what storage holds now, so a change
     made in another tab, or before a swipe back, is drawn when the page is
     looked at again. A chapter is drawn again only when the list changed.
     The Marks page is drawn again every time, because its state line also
     tells of the last backup, which another tab can take while the list
     stays the same. The reading settings are taken up again at the same
     moments (syncPrefs, with the settings below), and coming back to the
     book also asks whether a new build is out (checkForUpdate, at the end). */
  var drawn = null;
  function refresh() {
    latest();
    if (JSON.stringify(marks) !== drawn) renderAll();
    showMarksPage();
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted) { syncPrefs(); refresh(); } });
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key === MK || e.key === BK) refresh();   // BK, the backup record, is set below
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    syncPrefs(); refresh(); checkForUpdate();
  });

  /* Best-effort storage can be evicted when a site has not been opened for
     a while. Persistent mode is not evicted. Safari decides, and opening
     the book from the home-screen icon rather than a Safari tab is what
     makes it say yes, so the answer is recorded and shown to the reader
     rather than assumed. */
  var persisted = null;
  if (navigator.storage && navigator.storage.persist) {
    (navigator.storage.persisted ? navigator.storage.persisted()
       : Promise.resolve(false))
      .then(function (already) {
        return already ? true : navigator.storage.persist();
      })
      .then(function (ok) {
        persisted = !!ok;
        showMarksPage();
      })
      .catch(function () { persisted = false; });
  }

  /* Shown inside another page, as a frame from another site, the book is
     given storage by Safari and the other iOS browsers that is thrown away
     when that page closes. Say so, rather than let marks vanish. */
  var framed = false;
  try { framed = window.self !== window.top; } catch (e) { framed = true; }
  var UA = navigator.userAgent || '';
  var webkit = /(CriOS|FxiOS|EdgiOS)/.test(UA) ||
    (/AppleWebKit/.test(UA) && !/(Chrome|Chromium|Edg|OPR|Android)\//.test(UA));
  var fragile = framed && webkit;
  var BROWSER = /(CriOS|FxiOS|EdgiOS)/.test(UA) || !webkit ? 'This browser' : 'Safari';
  /* opened from the Home Screen icon */
  var standalone = navigator.standalone === true ||
    !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  var HERE = /iPhone|Android.+Mobile/.test(UA) ? 'this phone' :
    (/iPad/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1)) ? 'this iPad' :
    'this computer';

  /* The reading settings: text size, background, voice, Cards or Notes.
     As with the marks, a change is written into the settings as storage
     holds them now, one field at a time, so a page kept from before a swipe
     back, or a second tab, cannot bring back an older choice; and a page that
     is looked at again takes up a choice made elsewhere. */
  function loadPrefs() {
    var p = readJSON(PF, {});
    if (!p || typeof p !== 'object' || Array.isArray(p)) p = {};
    if (p.size == null) p.size = 1;
    if (!p.theme) {
      // follow the iPad's own appearance until the reader chooses otherwise
      p.theme = (window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    return p;
  }
  var prefs = loadPrefs();
  function setPref(name, value) {
    var p = readJSON(PF, {});
    if (!p || typeof p !== 'object' || Array.isArray(p)) p = {};
    p[name] = value;
    prefs[name] = value;
    return writeJSON(PF, p);
  }
  function syncPrefs() {
    var view = marksView();
    prefs = loadPrefs();
    applyPrefs();
    if (marksView() !== view) showMarksPage();
  }

  /* The four highlight colours and what each one is for. One list, used by
     the selection tool, the mark sheet, the marks page and the export, so a
     colour cannot mean one thing on the page and another in the email. */
  var KINDS = [
    { k: 'yellow', label: 'Important' },
    { k: 'blue',   label: 'Do not understand' },
    { k: 'green',  label: 'Agreed' },
    { k: 'red',    label: 'Disagree' }
  ];
  function kindLabel(k) {
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].k === k) return KINDS[i].label;
    return '';
  }
  function dotHTML(k) {
    return '<span class="mk-dot"' + (k ? ' data-k="' + esc(k) + '"' : '') + '></span>';
  }

  /* saved says whether the last change reached storage, so the reader is
     told the truth instead of a cheerful toast over a failed write */
  var saved = true;
  function saveMarks() {
    if (hold) { saved = false; return false; }
    try { localStorage.setItem(MK, JSON.stringify(marks)); saved = true; }
    catch (e) { saved = false; }
    return saved;
  }
  function said(msg) {
    toast(saved ? msg : hold ? 'Not saved: marks cannot be saved here right now'
                             : 'Not saved: this device refused to store it');
  }
  function uid() {
    return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // --------------------------------------------------------------- prefs
  function applyPrefs() {
    document.documentElement.style.setProperty('--fs', SIZES[prefs.size] || SIZES[1]);
    THEMES.forEach(function (t) { document.body.classList.remove('t-' + t); });
    document.body.classList.add('t-' + (prefs.theme || 'light'));
    var mb = document.getElementById('btn-mode');
    if (mb) mb.textContent = prefs.theme === 'dark' ? 'Bright' : 'Dark';
  }
  applyPrefs();

  // --------------------------------------------------------------- chrome
  var toastEl = document.createElement('div');
  toastEl.className = 'toast';
  document.body.appendChild(toastEl);
  var toastT, warnUntil = 0;
  function toast(msg) {
    /* A 'Not saved' warning is given its full time on screen. A message that
       arrives while it shows, such as the mail link's or a copy's, waits
       until it has gone instead of covering it. */
    var notSaved = String(msg).indexOf('Not saved') === 0;
    var wait = warnUntil - Date.now();
    if (wait > 0 && !notSaved) {
      setTimeout(function () { toast(msg); }, wait + 50);
      return;
    }
    if (notSaved) warnUntil = Date.now() + 1900;
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 1900);
  }

  var scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = '<div class="sheet"></div>';
  document.body.appendChild(scrim);
  var sheet = scrim.firstChild;
  scrim.addEventListener('click', function (e) { if (e.target === scrim) closeSheet(); });

  function openSheet(html) {
    sheet.innerHTML = html;
    scrim.classList.add('on');
    sheet.scrollTop = 0;
  }
  function closeSheet() { scrim.classList.remove('on'); sheet.innerHTML = ''; }

  // handed out so the navigation module, which lives outside this closure,
  // can reuse the same sheet rather than building a second one
  window.__bookSheet = { open: openSheet, close: closeSheet, el: sheet };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ---------------------------------------------------- reading settings
  function readingSheet() {
    openSheet(
      '<h3>Reading</h3><p class="meta">Applies on this device only.</p>' +
      '<div class="setrow"><span>Text size</span><div class="seg" id="seg-size">' +
      SIZES.map(function (s, i) {
        return '<button data-i="' + i + '" aria-pressed="' + (prefs.size === i) +
          '" style="font-size:' + (12 + i * 2) + 'px">A</button>';
      }).join('') + '</div></div>' +
      '<div class="setrow"><span>Background</span><div class="seg" id="seg-theme">' +
      THEMES.map(function (t) {
        return '<button data-t="' + t + '" aria-pressed="' + (prefs.theme === t) + '">' +
          THEME_LABEL[t] + '</button>';
      }).join('') + '</div></div>' +
      voiceControl() +
      '<div class="row"><button class="btn btn-p" data-close="1">Done</button></div>');

    var sel = sheet.querySelector('#sel-voice');
    if (sel) sel.addEventListener('change', function () {
      setPref('voice', sel.value || '');
      sampleVoice();
    });

    sheet.querySelector('#seg-size').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      setPref('size', +b.dataset.i); applyPrefs(); readingSheet();
    });
    sheet.querySelector('#seg-theme').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      setPref('theme', b.dataset.t); applyPrefs(); readingSheet();
    });
  }

  function voiceControl() {
    if (!('speechSynthesis' in window)) return '';
    var vs = spokenVoices().slice().sort(function (a, b) { return voiceScore(b) - voiceScore(a); });
    if (!vs.length) {
      return '<label>Voice for the walkthrough</label>' +
        '<p class="meta">No voices have loaded yet. Press ' + esc(tourIdle) +
        ' once, then come back here.</p>';
    }
    var best = pickVoice();
    var opts = '<option value="">Best available (' + esc(best ? best.name : 'default') + ')</option>' +
      vs.map(function (v) {
        return '<option value="' + esc(v.voiceURI) + '"' +
          (prefs.voice === v.voiceURI ? ' selected' : '') + '>' +
          esc(v.name) + ' (' + esc(v.lang) + ')</option>';
      }).join('');
    return '<label for="sel-voice">Voice for the walkthrough</label>' +
      '<select id="sel-voice">' + opts + '</select>' +
      '<p class="meta">A woman\'s voice, so the male voices are left out of this list. ' +
      'Pick one and it speaks a line so you can hear it. For a much ' +
      'better voice, download an Enhanced or Premium English voice on this iPad under ' +
      'Settings, Accessibility, Spoken Content, Voices, then come back here.</p>';
  }

  // ------------------------------------------------------------ tag cards
  function tagSheet(kind, n) {
    var rec, title, sub;
    if (kind === 's') {
      rec = D.SRC[n];
      title = 'Source S' + n;
      sub = 'Checked against the source on 8 September 2026.';
    } else {
      var key = document.querySelector('article') &&
        document.querySelector('article').dataset.key;
      var txt = D.WSRC[key] && D.WSRC[key][n];
      rec = txt ? { t: txt.replace(/\s*https?:\/\/\S+\s*$/, ''), u: (txt.match(/https?:\/\/\S+/g) || []) } : null;
      title = 'Source W' + n;
      sub = 'Fetched while this chapter was written.';
    }
    if (!rec) { toast('No entry for that tag'); return; }
    var urls = (rec.u || []).map(function (u) {
      return '<a class="su" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + '</a>';
    }).join('');
    openSheet(
      '<h3>' + esc(title) + '</h3><p class="meta">' + esc(sub) + '</p>' +
      '<p>' + esc(rec.t) + '</p>' + urls +
      '<div class="row">' +
      '<button class="btn btn-p" data-close="1">Close</button></div>');
  }

  /* ------------------------------------------------- explanation panels */
  function paras(t) {
    return String(t || '').split('\n').filter(function (s) { return s.trim(); })
      .map(function (s) { return '<p>' + esc(s.trim()) + '</p>'; }).join('');
  }

  function panelSheet(kind, id, el) {
    var rec = kind === 'g' ? (D.GLOSS || {})[id] : (D.LOCAL || {})[id];
    if (!rec) { toast('That explanation is missing'); return; }
    var sec = el && el.closest('[data-sec]');
    var secnum = sec ? sec.dataset.sec : (rec.s || '');
    openSheet(
      '<h3>' + esc(rec.t) + '</h3>' +
      '<p class="meta">' + (kind === 'g' ? 'What this means' : 'Why this works') +
      (secnum ? ' &middot; section ' + esc(secnum) : '') + '</p>' +
      paras(rec.b) +
      '<div class="row">' +
      '<button class="btn" id="pn-ask">Still not clear</button>' +
      (kind === 'g' ? '<a class="btn" href="glossary.html#' + esc(id) + '">All terms</a>' : '') +
      '<button class="btn btn-p" data-close="1">Close</button></div>');
    sheet.querySelector('#pn-ask').addEventListener('click', function () {
      askAboutPanel(rec.t, secnum);
    });
  }

  function askAboutPanel(title, secnum) {
    openSheet(
      '<h3>Ask for a better explanation</h3>' +
      '<p class="meta">' + esc(title) + (secnum ? ' &middot; section ' + esc(secnum) : '') + '</p>' +
      '<label>What would help here?</label><div class="chips" id="pn-needs">' +
      NEEDS.map(function (n) {
        return '<button class="chip" data-n="' + esc(n) + '" aria-pressed="false">' + esc(n) + '</button>';
      }).join('') + '</div>' +
      '<label>Anything more specific</label>' +
      '<textarea id="pn-t" placeholder="Optional. Say which part does not land."></textarea>' +
      '<div class="row"><button class="btn" data-close="1">Cancel</button>' +
      '<button class="btn" id="pn-ok">Save</button>' +
      '<button class="btn btn-p" id="pn-send">Save and email</button></div>');

    var pneed = '';
    var pn = sheet.querySelector('#pn-needs');
    if (pn) pn.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      var on = c.getAttribute('aria-pressed') === 'true';
      Array.prototype.forEach.call(pn.querySelectorAll('.chip'), function (x) {
        x.setAttribute('aria-pressed', 'false');
      });
      c.setAttribute('aria-pressed', on ? 'false' : 'true');
      pneed = on ? '' : c.dataset.n;
    });

    function commitPanel() {
      var mk = {
        id: uid(), ch: chNum, key: chKey, sec: secnum || chNum, scope: 'panel',
        block: '', start: 0, end: 0, raw: '', quote: title,
        type: 'request', need: pneed || 'Explain it more simply',
        note: sheet.querySelector('#pn-t').value.trim(), ts: Date.now()
      };
      mutate(function (L) { L.push(mk); });
      renderAll(); closeSheet(); said('Request saved');
      return mk;
    }
    sheet.querySelector('#pn-ok').addEventListener('click', commitPanel);
    sheet.querySelector('#pn-send').addEventListener('click', function () {
      emailRequest(commitPanel());
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) { closeSheet(); return; }
    var g = e.target.closest('.gl');
    if (g) { e.preventDefault(); panelSheet('g', g.dataset.g, g); return; }
    var lb = e.target.closest('.lmb');
    if (lb) { e.preventDefault(); panelSheet('l', lb.dataset.l, lb); return; }
    var t = e.target.closest('a.tg');
    if (t) {
      e.preventDefault();
      if (t.dataset.s) tagSheet('s', t.dataset.s);
      else if (t.dataset.w) tagSheet('w', t.dataset.w);
      return;
    }
    var m = e.target.closest('mark.hl');
    if (m) { e.preventDefault(); markSheet(m.dataset.id); }
  });

  var rb = document.getElementById('btn-read');
  if (rb) rb.addEventListener('click', readingSheet);
  var modeb = document.getElementById('btn-mode');
  if (modeb) modeb.addEventListener('click', function () {
    setPref('theme', prefs.theme === 'dark' ? 'light' : 'dark');
    applyPrefs();
  });
  var mb = document.getElementById('btn-marks');
  if (mb) mb.addEventListener('click', function () { location.href = 'marks.html'; });

  // ---------------------------------------------------------- page setup
  var article = document.querySelector('article.ch');
  var chNum = article ? article.dataset.ch : null;
  var chKey = article ? article.dataset.key : null;

  // wrap tables so a wide appendix table scrolls rather than breaking the page
  Array.prototype.forEach.call(document.querySelectorAll('.wrap table'), function (tb) {
    if (tb.parentNode.classList.contains('tscroll')) return;
    var w = document.createElement('div');
    w.className = 'tscroll';
    tb.parentNode.insertBefore(w, tb);
    w.appendChild(tb);
  });

  // ------------------------------------------------------- text anchoring
  function blockText(el) {
    if (el._txt == null) el._txt = el.textContent;
    return el._txt;
  }

  function offsetIn(el, node, off) {
    var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var n, total = 0;
    while ((n = walk.nextNode())) {
      if (n === node) return total + off;
      total += n.nodeValue.length;
    }
    return -1;
  }

  /* The readable quote for a range of the block's text, with the source-tag
     chips left out, so an exported passage reads as the book reads. */
  function sliceClean(el, start, end) {
    var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var n, pos = 0, out = '';
    while ((n = walk.nextNode())) {
      var len = n.nodeValue.length, a = pos, b = pos + len;
      pos = b;
      if (b <= start) continue;
      if (a >= end) break;
      if (n.parentNode && n.parentNode.closest && n.parentNode.closest('.tg')) continue;
      out += n.nodeValue.slice(Math.max(0, start - a), Math.min(len, end - a));
    }
    return out.replace(/\s+/g, ' ').replace(/\s+([,.;:)])/g, '$1').trim();
  }

  function wrapRange(el, start, end, attrs) {
    var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var n, pos = 0, targets = [];
    while ((n = walk.nextNode())) {
      var len = n.nodeValue.length, a = pos, b = pos + len;
      if (b > start && a < end) {
        targets.push({ node: n, from: Math.max(0, start - a), to: Math.min(len, end - a) });
      }
      pos = b;
      if (pos >= end) break;
    }
    targets.forEach(function (t) {
      var node = t.node;
      if (t.to < node.nodeValue.length) node.splitText(t.to);
      if (t.from > 0) node = node.splitText(t.from);
      var m = document.createElement('mark');
      m.className = attrs.cls;
      m.dataset.id = attrs.id;
      if (attrs.k) m.dataset.k = attrs.k;
      node.parentNode.insertBefore(m, node);
      m.appendChild(node);
    });
    return targets.length > 0;
  }

  /* Where a marked passage sits now. The saved place first. If a later build
     has changed the paragraph or added one before it, the same words nearest
     the old place in the same paragraph. Failing that, a passage of a dozen
     letters or more is looked for in the same section, then in the chapter,
     and used only if it occurs there once. A mark that cannot be placed is
     still kept, and still listed on the Marks page. */
  function locate(mk) {
    var raw = mk.raw;
    if (typeof raw !== 'string' || !raw) return null;
    var el = null;
    try { el = article.querySelector('[data-b="' + cssq(mk.block) + '"]'); } catch (e) { /* odd name */ }
    if (el) {
      var full = blockText(el);
      if (full.slice(mk.start, mk.end) === raw) return { el: el, s: mk.start };
      var near = nearest(full, raw, +mk.start || 0);
      if (near >= 0) return { el: el, s: near };
    }
    if (raw.length < 12) return null;
    var blocks = Array.prototype.slice.call(article.querySelectorAll('[data-b]'));
    var sec = String(mk.block || '').split(':')[0];
    var inSec = blocks.filter(function (b) { return b.dataset.b.split(':')[0] === sec; });
    return only(inSec, raw) || only(blocks, raw);
  }
  function only(blocks, raw) {
    var hits = [];
    blocks.forEach(function (b) {
      var t = blockText(b), k = t.indexOf(raw);
      while (k >= 0 && hits.length < 2) { hits.push({ el: b, s: k }); k = t.indexOf(raw, k + 1); }
    });
    return hits.length === 1 ? hits[0] : null;
  }
  function nearest(full, raw, at) {
    var best = -1, j = full.indexOf(raw);
    while (j >= 0) {
      if (best < 0 || Math.abs(j - at) < Math.abs(best - at)) best = j;
      j = full.indexOf(raw, j + 1);
    }
    return best;
  }

  function renderMark(mk) {
    if (!article || mk.ch !== chNum || mk.scope === 'chapter') return false;
    var at = locate(mk);
    if (!at) return false;
    var cls = 'hl' + (mk.note ? ' has-note' : '') + (mk.type === 'request' ? ' is-request' : '');
    return wrapRange(at.el, at.s, at.s + mk.raw.length, { cls: cls, id: mk.id, k: mk.k || '' });
  }

  function cssq(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  function renderAll() {
    drawn = JSON.stringify(marks);
    if (!article) return;
    Array.prototype.forEach.call(article.querySelectorAll('mark.hl'), function (m) {
      var p = m.parentNode;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
      p.normalize();
    });
    var orphans = 0;
    marks.forEach(function (mk) {
      if (mk.ch === chNum && mk.scope !== 'chapter' && mk.scope !== 'panel') {
        if (!renderMark(mk)) orphans++;
      }
    });
    if (orphans) console.warn(orphans + ' mark(s) could not be placed in this chapter');
    var btn = document.getElementById('ask-chapter');
    if (btn) {
      var has = marks.some(function (m) { return m.ch === chNum && m.scope === 'chapter'; });
      btn.classList.toggle('has', has);
      btn.querySelector('.askbtn-l').textContent = has ? 'Request sent to the list' : 'Request more detail';
    }
  }

  // ------------------------------------------------------ selection tool
  var tool = document.createElement('div');
  tool.className = 'seltool';
  tool.innerHTML = '<span class="dots">' +
    KINDS.map(function (x) {
      return '<button class="dot" data-k="' + x.k + '" aria-label="' +
             x.label + '"></button>';
    }).join('') + '</span>' +
    '<button data-a="note">Note</button>' +
    '<button data-a="request">Ask</button>' +
    '<button data-a="copy">Copy</button>';
  document.body.appendChild(tool);

  var pending = null;

  function hideTool() { tool.classList.remove('on'); pending = null; }

  function onSelect() {
    if (!article) return;
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { hideTool(); return; }
    var r = sel.getRangeAt(0);
    var host = r.commonAncestorContainer;
    if (host.nodeType === 3) host = host.parentNode;
    var block = host.closest('[data-b]');
    if (!block || !article.contains(block)) { hideTool(); return; }

    var start = offsetIn(block, r.startContainer, r.startOffset);
    var end = offsetIn(block, r.endContainer, r.endOffset);
    if (start < 0 || end < 0 || end - start < 2) { hideTool(); return; }

    // snap to whole words, so an exported quote never begins or ends mid-word
    var txt = blockText(block), word = /[A-Za-z0-9À-ɏ'’-]/;
    while (start > 0 && word.test(txt.charAt(start - 1))) start--;
    while (end < txt.length && word.test(txt.charAt(end))) end++;

    var sec = block.closest('[data-sec]');
    pending = {
      block: block.dataset.b,
      sec: sec ? sec.dataset.sec : (block.dataset.b || '').split(':')[0],
      start: start, end: end,
      raw: txt.slice(start, end),
      quote: sliceClean(block, start, end)
    };

    var rect = r.getBoundingClientRect();
    tool.classList.add('on');
    var tw = tool.offsetWidth, th = tool.offsetHeight;
    var left = Math.min(Math.max(8, rect.left + rect.width / 2 - tw / 2), window.innerWidth - tw - 8);
    var top = rect.bottom + 10;
    if (top + th > window.innerHeight - 8) top = Math.max(8, rect.top - th - 10);
    tool.style.left = left + 'px';
    tool.style.top = top + 'px';
  }

  document.addEventListener('selectionchange', function () { setTimeout(onSelect, 10); });
  document.addEventListener('scroll', function () { if (pending) hideTool(); }, true);

  tool.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || !pending) return;
    var a = b.dataset.a;
    var p = pending;
    if (a === 'copy') {
      copy(p.quote); hideTool(); window.getSelection().removeAllRanges(); return;
    }
    if (b.dataset.k) {
      addMark(p, 'highlight', '', '', b.dataset.k);
      hideTool(); window.getSelection().removeAllRanges(); return;
    }
    hideTool();
    window.getSelection().removeAllRanges();
    composeSheet(p, a);
  });

  function addMark(p, type, note, need, k) {
    var mk = {
      id: uid(), ch: chNum, key: chKey, sec: p.sec, block: p.block,
      start: p.start, end: p.end, raw: p.raw, quote: p.quote,
      type: type, note: note || '', need: need || '', k: k || '',
      ts: Date.now()
    };
    mutate(function (L) { L.push(mk); });
    renderAll();
    said(type === 'request' ? 'Request saved' : type === 'note' ? 'Note saved'
         : (kindLabel(k) || 'Highlighted'));
    return mk;
  }

  function composeSheet(p, type, existing) {
    var isReq = type === 'request';
    openSheet(
      '<h3>' + (isReq ? 'Ask for more detail' : 'Add a note') + '</h3>' +
      '<p class="meta">Section ' + esc(p.sec) + '</p>' +
      '<div class="quote">' + esc(p.quote) + '</div>' +
      (isReq ? '<label>What do you need here?</label><div class="chips" id="needs">' +
        NEEDS.map(function (n) {
          return '<button class="chip" data-n="' + esc(n) + '" aria-pressed="' +
            (existing && existing.need === n) + '">' + esc(n) + '</button>';
        }).join('') + '</div>' : '') +
      '<label>' + (isReq ? 'Anything more specific' : 'Your note') + '</label>' +
      '<textarea id="cmp-t" placeholder="' +
      (isReq ? 'Optional. What exactly is unclear?' : 'What you want to remember about this passage') +
      '">' + esc(existing ? existing.note : '') + '</textarea>' +
      '<div class="row">' +
      (existing ? '<button class="btn btn-d" id="cmp-del">Delete</button>' : '') +
      '<button class="btn" data-close="1">Cancel</button>' +
      '<button class="btn' + (isReq ? '' : ' btn-p') + '" id="cmp-ok">Save</button>' +
      (isReq ? '<button class="btn btn-p" id="cmp-send">Save and email</button>' : '') +
      '</div>');

    var need = existing ? existing.need : '';
    var needsEl = sheet.querySelector('#needs');
    if (needsEl) needsEl.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      var on = c.getAttribute('aria-pressed') === 'true';
      Array.prototype.forEach.call(needsEl.querySelectorAll('.chip'), function (x) {
        x.setAttribute('aria-pressed', 'false');
      });
      c.setAttribute('aria-pressed', on ? 'false' : 'true');
      need = on ? '' : c.dataset.n;
    });

    function commit() {
      var txt = sheet.querySelector('#cmp-t').value.trim();
      var mk;
      if (existing) {
        mk = updateMark(existing.id, { note: txt, need: need, ed: Date.now() }, existing);
        renderAll(); showMarksPage();
        said('Saved');
      } else {
        mk = addMark(p, type, txt, need);
      }
      closeSheet();
      return mk;
    }
    sheet.querySelector('#cmp-ok').addEventListener('click', commit);
    var send = sheet.querySelector('#cmp-send');
    if (send) send.addEventListener('click', function () { emailRequest(commit()); });
    var del = sheet.querySelector('#cmp-del');
    if (del) del.addEventListener('click', function () { removeMark(existing.id); closeSheet(); });
  }

  function removeMark(id) {
    mutate(function (L) {
      for (var i = L.length - 1; i >= 0; i--) if (L[i].id === id) L.splice(i, 1);
    });
    renderAll(); said('Removed');
    showMarksPage();
  }

  function markSheet(id) {
    var mk = latest().filter(function (m) { return m.id === id; })[0];
    if (!mk) { renderAll(); return; }             // deleted in another tab
    openSheet(
      '<h3>' + (mk.type === 'request' ? 'Your request' : mk.note ? 'Your note'
        : (kindLabel(mk.k) || 'Highlight')) + '</h3>' +
      '<p class="meta">Section ' + esc(mk.sec) + (mk.need ? ' &middot; ' + esc(mk.need) : '') + '</p>' +
      '<div class="kpick">' + KINDS.map(function (x) {
        return '<button data-k="' + x.k + '" aria-label="' + x.label +
               '" aria-pressed="' + (mk.k === x.k) + '"></button>';
      }).join('') + '</div>' +
      '<div class="quote">' + esc(mk.quote) + '</div>' +
      (mk.note ? '<p>' + esc(mk.note) + '</p>' : '') +
      '<div class="row">' +
      '<button class="btn btn-d" id="ms-del">Delete</button>' +
      '<button class="btn" id="ms-edit">' + (mk.type === 'request' ? 'Edit request' : 'Edit note') + '</button>' +
      (mk.type === 'request' ? '<button class="btn" id="ms-mail">Email it</button>' : '') +
      '<button class="btn btn-p" data-close="1">Close</button></div>');
    /* the colour is changed on the newest stored copy of this mark, never by
       writing back a list this page read earlier. A colour tap is one touch,
       not typed text, so it does not bring back a mark deleted meanwhile in
       another tab: the sheet closes and says so. */
    var kp = sheet.querySelector('.kpick');
    if (kp) kp.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var nk = (mk.k === b.dataset.k) ? '' : b.dataset.k;
      var got = updateMark(mk.id, { k: nk, ed: Date.now() });
      if (!got) {
        closeSheet(); renderAll(); showMarksPage();
        toast('That mark was already deleted');
        return;
      }
      mk = got;
      Array.prototype.forEach.call(kp.querySelectorAll('button'), function (x) {
        x.setAttribute('aria-pressed', String(x.dataset.k === mk.k));
      });
      renderAll(); showMarksPage();
      said(kindLabel(mk.k) || 'Colour removed');
    });
    sheet.querySelector('#ms-del').addEventListener('click', function () { removeMark(id); closeSheet(); });
    var msm = sheet.querySelector('#ms-mail');
    if (msm) msm.addEventListener('click', function () { closeSheet(); emailRequest(mk); });
    sheet.querySelector('#ms-edit').addEventListener('click', function () {
      composeSheet(mk, mk.type === 'request' ? 'request' : 'note', mk);
    });
  }

  /* ------------------------------------------------ figures that move
     A figure with an animated companion carries it in a <template>. The
     template is cloned into the sheet on a tap, which is what starts it, and
     cloned again on Replay. */
  function animSheet(fig) {
    var tpl = fig.querySelector('template.figanim');
    if (!tpl) return;
    var cap = fig.querySelector('figcaption');
    openSheet(
      '<h3>' + esc(fig.dataset.animTitle || 'The same figure, moving') + '</h3>' +
      '<div class="animwrap" id="an-box"></div>' +
      '<div class="an-row"><button class="btn" id="an-again">Play it again</button>' +
      '<button class="btn btn-p" data-close="1">Close</button></div>');
    var box = sheet.querySelector('#an-box');

    function run() {
      box.innerHTML = '';
      box.appendChild(tpl.content.cloneNode(true));
    }
    run();
    sheet.querySelector('#an-again').addEventListener('click', run);
  }

  if (article) article.addEventListener('click', function (e) {
    /* a tap on a source tag, a concept link or a mark inside the caption is
       that thing's tap, not the figure's */
    if (e.target.closest('a, button, mark')) return;
    var fig = e.target.closest('figure.fig.hasanim');
    if (fig) { e.preventDefault(); animSheet(fig); }
  });

  // -------------------------------------------------- chapter ask button
  var askBtn = document.getElementById('ask-chapter');
  if (askBtn) askBtn.addEventListener('click', function () {
    var existing = latest().filter(function (m) {
      return m.ch === chNum && m.scope === 'chapter';
    })[0];
    var need = existing ? existing.need : '';
    openSheet(
      '<h3>Request more detail</h3>' +
      '<p class="meta">Chapter ' + esc(askBtn.dataset.ch) + '. ' + esc(askBtn.dataset.title) + '</p>' +
      '<label>What do you need in this chapter?</label><div class="chips" id="needs">' +
      NEEDS.map(function (n) {
        return '<button class="chip" data-n="' + esc(n) + '" aria-pressed="' +
          (need === n) + '">' + esc(n) + '</button>';
      }).join('') + '</div>' +
      '<label>Anything more specific</label>' +
      '<textarea id="cmp-t" placeholder="Which part of the chapter, and what is missing?">' +
      esc(existing ? existing.note : '') + '</textarea>' +
      '<div class="row">' +
      (existing ? '<button class="btn btn-d" id="cmp-del">Delete</button>' : '') +
      '<button class="btn" data-close="1">Cancel</button>' +
      '<button class="btn" id="cmp-ok">Save</button>' +
      '<button class="btn btn-p" id="cmp-send">Save and email</button></div>');

    var needsEl = sheet.querySelector('#needs');
    needsEl.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      var on = c.getAttribute('aria-pressed') === 'true';
      Array.prototype.forEach.call(needsEl.querySelectorAll('.chip'), function (x) {
        x.setAttribute('aria-pressed', 'false');
      });
      c.setAttribute('aria-pressed', on ? 'false' : 'true');
      need = on ? '' : c.dataset.n;
    });
    function commitChapter() {
      var txt = sheet.querySelector('#cmp-t').value.trim();
      var mk;
      if (existing) mk = updateMark(existing.id, { note: txt, need: need, ed: Date.now() }, existing);
      else {
        mk = {
          id: uid(), ch: chNum, key: chKey, sec: chNum, scope: 'chapter',
          block: '', start: 0, end: 0, raw: '', quote: '',
          type: 'request', note: txt, need: need, ts: Date.now()
        };
        mutate(function (L) { L.push(mk); });
      }
      renderAll(); closeSheet(); said('Request saved');
      return mk;
    }
    sheet.querySelector('#cmp-ok').addEventListener('click', commitChapter);
    sheet.querySelector('#cmp-send').addEventListener('click', function () {
      emailRequest(commitChapter());
    });
    var del = sheet.querySelector('#cmp-del');
    if (del) del.addEventListener('click', function () {
      if (existing) removeMark(existing.id);
      closeSheet();
    });
  });

  // ----------------------------------------------------------- marks page
  function chTitle(ch) {
    var c = D.BOOK.filter(function (x) { return x.num === ch; })[0];
    return c ? c.num + '. ' + c.title : 'Chapter ' + ch;
  }
  function secTitle(ch, sec) {
    var c = D.BOOK.filter(function (x) { return x.num === ch; })[0];
    if (!c) return '';
    var s = c.sections.filter(function (x) { return x.num === sec; })[0];
    return s ? s.title : '';
  }
  function order() {
    var idx = {};
    D.BOOK.forEach(function (c, i) { idx[c.num] = i; });
    return marks.slice().sort(function (a, b) {
      var d = (idx[a.ch] == null ? 99 : idx[a.ch]) - (idx[b.ch] == null ? 99 : idx[b.ch]);
      if (d) return d;
      return String(a.sec).localeCompare(String(b.sec), undefined, { numeric: true }) ||
             a.ts - b.ts;
    });
  }

  /* Redraws the Marks page when this is the Marks page, and does nothing
     anywhere else, so every change can simply call it. */
  function showMarksPage() { if (document.getElementById('mk-list')) renderMarksPage(); }

  /* ------------------------------------------------ one filter, two views
     Both views read the select through this, so Cards and Notes can never
     disagree about what the reader asked to see. */
  function filteredRows() {
    var f = (document.getElementById('mk-filter') || {}).value || 'all';
    return order().filter(function (m) {
      if (f === 'all') return true;
      if (f.slice(0, 2) === 'k:') return (m.k || '') === f.slice(2);
      return m.type === f;
    });
  }

  /* Where a mark sits in the book. One function, so a passage in the notes
     view and the same passage's card cannot lead to two different places. */
  function markHref(m) {
    return 'ch' + esc(m.key || m.ch) + '.html#' +
      (m.scope === 'chapter' ? '' : 'sec-' + String(m.sec).replace(/\./g, '-'));
  }

  /* A request, written as one line that begins with what he asked for. */
  function askLine(m) {
    var bits = [];
    if (m.need) bits.push(m.need);
    if (m.note) bits.push(m.note);
    if (!bits.length) bits.push('More detail here');
    return '<b>Asked:</b> ' + esc(bits.join('. '));
  }

  /* ------------------------------------------- cards, or continuous notes
     Conrad asked to see everything he has marked together, reading as a page
     of notes rather than as a stack of cards. It is a second view of the one
     page, not a second page, so the filter, the backup, the restore and the
     export keep working on the same marks and there is still one place to
     look. The choice rides in the prefs his text size and background already
     live in, so the iPad opens where he left it. */
  function marksView() {
    return prefs.mkview === 'notes' ? 'notes' : 'cards';
  }

  function setMarksView(v) {
    setPref('mkview', v === 'notes' ? 'notes' : 'cards');
    renderMarksPage();
  }

  /* The switch is put into the page by the app rather than by the builder,
     at the end of the tools row next to the filter. Built once, on the first
     render, and only re-pressed after that. */
  function viewSwitch() {
    var tools = document.querySelector('.marks-tools');
    if (!tools) return;
    var seg = document.getElementById('mk-view');
    if (!seg) {
      seg = document.createElement('div');
      seg.id = 'mk-view';
      seg.className = 'seg mk-view';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', 'How to show what you have marked');
      seg.innerHTML =
        '<button type="button" data-v="cards">Cards</button>' +
        '<button type="button" data-v="notes">Notes</button>';
      tools.appendChild(seg);
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (b) setMarksView(b.dataset.v);
      });
    }
    var now = marksView();
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.v === now));
    });
  }

  /* Every existing caller still calls renderMarksPage, and this is the only
     place that decides what that means, so no call site can draw the wrong
     view after a delete, a restore, a colour change or a filter. It reads the
     newest stored list first, so both views show what storage holds now. */
  function renderMarksPage() {
    latest();
    viewSwitch();
    if (marksView() === 'notes') renderNotesView();
    else renderCardsView();
  }

  /* -------------------------------------------------------- the notes view
     The same rows, in the same order, under the same chapter headings, set as
     reading matter: the section number and title as a light subheading, then
     the marked sentences one under another, each wearing the colour it wears
     in the book. A note he wrote sits underneath its passage, indented. A
     request says what he asked for. Consecutive passages from one section run
     on under the one subheading rather than repeating it.

     Nothing here carries a Delete button. This is the view that reads and
     Cards is the view that edits, so a passage is not surrounded by controls
     he is not using. Tapping one opens it where it sits in the book, which is
     also where its colour and its note can be changed, and the closing line
     says so. */
  function renderNotesView() {
    var list = document.getElementById('mk-list');
    if (!list) return;
    var st = document.getElementById('mk-state');
    if (st) st.innerHTML = backupState();

    var rows = filteredRows();
    if (!rows.length) {
      list.innerHTML = '<p class="empty">Nothing to read here yet. Highlight a ' +
        'passage while you are reading and it appears on this page.</p>';
      return;
    }

    var out = [], tail = [], lastCh = null, lastSec = null;

    /* A request about a whole chapter has no passage to lift out. Rather than
       let it fall out of a view that is made of passages, it is held back and
       set at the end of its own chapter under a heading that says what it
       is. */
    function flushTail() {
      if (!tail.length) return;
      out.push('<h3 class="nv-ask-h">Questions about this chapter as a whole</h3>');
      out.push(tail.join(''));
      tail = [];
    }

    rows.forEach(function (m) {
      if (m.ch !== lastCh) {
        flushTail();
        out.push('<h2 class="parth">' + esc(chTitle(m.ch)) + '</h2>');
        lastCh = m.ch;
        lastSec = null;
      }
      if (!m.quote) {
        tail.push('<a class="nv-whole" href="' + markHref(m) + '">' +
                  askLine(m) + '</a>');
        return;
      }
      if (m.sec !== lastSec) {
        out.push('<h3 class="nv-sec"><span class="nv-secn">' + esc(m.sec) +
                 '</span><span class="nv-sect">' + esc(secTitle(m.ch, m.sec)) +
                 '</span></h3>');
        lastSec = m.sec;
      }
      out.push('<a class="nv-q' + (m.type === 'request' ? ' is-request' : '') +
               '" href="' + markHref(m) + '"' +
               (m.k ? ' data-k="' + esc(m.k) + '"' : '') + '>' +
               esc(m.quote) + '</a>');
      if (m.type === 'request') out.push('<p class="nv-ask">' + askLine(m) + '</p>');
      else if (m.note) out.push('<p class="nv-n">' + esc(m.note) + '</p>');
    });
    flushTail();

    list.innerHTML = out.join('') +
      '<p class="nv-foot">This page is for reading. To change a colour, edit a ' +
      'note or delete a mark, tap the passage to open it in the book, or press ' +
      'Cards above.</p>';
  }

  function renderCardsView() {
    var list = document.getElementById('mk-list');
    if (!list) return;
    /* the state line first, so its warnings show when nothing is listed too */
    var st = document.getElementById('mk-state');
    if (st) st.innerHTML = backupState();
    var rows = filteredRows();
    if (!rows.length) {
      list.innerHTML = '<p class="empty">Nothing marked yet. Select any passage while ' +
        'reading to highlight it, add a note, or ask for more detail.</p>';
      return;
    }
    var out = [], lastCh = null;
    rows.forEach(function (m) {
      if (m.ch !== lastCh) {
        out.push('<h2 class="parth">' + esc(chTitle(m.ch)) + '</h2>');
        lastCh = m.ch;
      }
      var kind = m.type === 'request' ? 'request' : m.type === 'note' ? 'note' : 'highlight';
      var label = m.scope === 'chapter' ? 'Whole chapter' : 'Section ' + m.sec;
      out.push(
        '<div class="mk" data-id="' + esc(m.id) + '">' +
        '<div class="mk-h"><span class="mk-s">' + esc(label) + '</span>' +
        '<span class="mk-c">' + esc(secTitle(m.ch, m.sec)) + '</span>' +
        '<span class="mk-k ' + kind + '">' + dotHTML(m.k) +
          esc(m.need || kindLabel(m.k) || kind) + '</span></div>' +
        (m.quote ? '<div class="mk-q">' + esc(m.quote) + '</div>' : '') +
        (m.note ? '<p class="mk-n"><b>' +
          (m.type === 'request' ? 'Asked' : 'Note') + ':</b> ' + esc(m.note) + '</p>' : '') +
        '<div class="mk-a">' +
        '<a href="' + markHref(m) + '">Open in the book</a>' +
        '<button data-del="' + esc(m.id) + '">Delete</button>' +
        '</div></div>');
    });
    list.innerHTML = '<div class="mk-key">' + KINDS.map(function (x) {
      return '<span>' + dotHTML(x.k) + esc(x.label) + '</span>';
    }).join('') + '</div>' + out.join('');
  }

  /* ----------------------------------------------------------- backup
     One envelope, versioned, so a file written today can still be read
     after the marks themselves gain a field. Back up puts a copy of every
     mark in iCloud Drive. Restore reads that copy, or the text of any Email
     to Ronald, Export or Copy all, since its last line is the same list.
     Restoring only adds: nothing already here is removed or replaced by an
     older copy. */
  var BK = 'k49.backup.v1';
  var BACKUP_KIND = '49er theory book marks';
  var MARKER = '--- machine-readable copy below, leave it in place ---';

  function backupJSON() {
    var o = {
      kind: BACKUP_KIND, v: 1, build: D.BUILD || '',
      saved: new Date().toISOString(), count: marks.length, marks: marks
    };
    var dmg = damagedList();
    if (dmg.length) o.damaged = dmg;              // unreadable older lists, kept for recovery by hand
    return JSON.stringify(o, null, 1);
  }

  /* Only the fields the book writes, of the kinds it writes them. A pasted
     or hand-edited file cannot then hang a chapter or break the Marks page.
     The colour is kept when it is one of the four. A passage, quote or note
     is kept whole up to 100,000 characters, far past anything typed in the
     note box, so a long note comes back as it went. */
  var TYPES = { highlight: 1, note: 1, request: 1 };
  function clean(m) {
    if (!m || typeof m !== 'object') return null;
    if (typeof m.id !== 'string' || !/^m[0-9a-z]{4,40}$/.test(m.id)) return null;   // as uid() makes them
    if (typeof m.type !== 'string' || !TYPES.hasOwnProperty(m.type)) return null;
    var scope = m.scope === 'chapter' || m.scope === 'panel' ? m.scope : undefined;
    var str = function (v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; };
    var num = function (v) { return typeof v === 'number' && isFinite(v) ? v : 0; };
    /* a request made on the glossary or words page has no chapter: keep its null */
    var place = function (v, n) { return v === null ? null : str(v, n); };
    var out = {
      id: m.id, ch: place(m.ch, 8), key: place(m.key, 8), sec: place(m.sec, 12),
      block: str(m.block, 24), start: num(m.start), end: num(m.end),
      raw: str(m.raw, 100000), quote: str(m.quote, 100000),
      type: m.type, note: str(m.note, 100000), need: str(m.need, 80),
      k: typeof m.k === 'string' && kindLabel(m.k) ? m.k : '',
      ts: num(m.ts)
    };
    if (scope) out.scope = scope;
    else if (!out.raw) return null;               // a passage mark needs its words
    if (typeof m.ed === 'number' && isFinite(m.ed)) out.ed = m.ed;
    return out;
  }

  /* Union by id, and where the same mark exists on both sides the newer
     one wins (its edit time if it has one, else the time it was made).
     Nothing already here is dropped: a restore can only add. An incoming
     entry that clean() refuses is left out and counted, once however many
     copies of it the text holds, so the reader is told. */
  function mergeMarks(incoming) {
    var added = 0, updated = 0, dropped = 0, bad = Object.create(null);
    mutate(function (L) {
      var at = Object.create(null);
      L.forEach(function (m, i) { at[m.id] = i; });
      incoming.forEach(function (x) {
        var m = clean(x);
        if (!m) {
          var sig = typeof x === 'string' ? 's' + x : 'j' + JSON.stringify(x);
          if (!bad[sig]) { bad[sig] = 1; dropped++; }
          return;
        }
        var i = at[m.id];
        if (i == null) { at[m.id] = L.length; L.push(m); added++; }
        else if ((m.ed || m.ts || 0) > (L[i].ed || L[i].ts || 0)) { L[i] = m; updated++; }
      });
    });
    return { added: added, updated: updated, dropped: dropped, kept: marks.length };
  }

  /* A backup file, a bare list, or a whole pasted email thread. Every copy
     of the list in the text is read, since a reply thread quotes older ones,
     and all of them are merged. Mail can wrap the long line, quote it with >
     (once or several times) or add a signature under it; each of those is
     undone before a copy is given up. */
  function listOf(s) {
    try {
      var o = JSON.parse(s);
      if (Array.isArray(o)) return o;
      if (o && Array.isArray(o.marks)) return o.marks;
    } catch (e) { /* not this shape */ }
    return null;
  }

  /* One copy, as it stands, or with the line breaks mail put into it taken
     out in four ways: as the words need (unwrap, below), first reading a
     line that ends in a hyphen as a word broken at its hyphen and then not;
     joined straight up; and as spaces. When more than one way reads, the
     one whose marks fit best is kept, the first of equals. lead is how far
     into its line the copy starts. */
  function parseList(s, lead) {
    var whole = listOf(s);
    if (whole || s.indexOf('\n') < 0) return whole;
    var tries = [s.replace(/\r?\n/g, ''), s.replace(/\r?\n/g, ' ')], best = null, score = -1;
    try {
      tries.unshift(unwrap(s, lead || 0, true), unwrap(s, lead || 0, false));
    } catch (e) { /* the plain joins still run */ }
    for (var n = 0; n < tries.length; n++) {
      var list = listOf(tries[n]), f = 0;
      if (!list) continue;
      try { f = fit(list); } catch (e) { f = 0; }
      if (f > score) { best = list; score = f; }
    }
    return best;
  }

  /* A mail program that wraps a line at a space takes the space out, so
     joining the lines straight up runs two words together. Here a break
     inside the words of a passage, a quote, a note or a need becomes a
     space again, unless a space is still there beside it (mail that keeps
     it at the end of the line) or the line runs the full width of lines cut
     at a set length. The lines count as cut only on evidence: a break after
     a line of the full width that falls where no space can have been taken
     out. That is inside a field name, inside a value that never holds a
     space (the fields in BARE), inside an escape such as \" or \n, or
     between two letters or digits outside the text, as inside a number or
     null. Lines wrapped at spaces often reach the same full width as well,
     so that alone proves nothing. A copy of only two lines counts as cut:
     a list of marks is too long to wrap into two lines at a mail width, so
     its one break is a limit on line length. A break anywhere else, such as
     between two fields, is only taken out.
     With hyphens set, a line that ends in a letter and a hyphen, followed
     by a line that starts with a letter, is a word that mail broke at its
     own hyphen (crew- / control): no space was taken out there, so none is
     added. Without hyphens, the same break is read as a wrap at a space
     after the hyphen (pre- / and post-start). parseList reads both ways. */
  var WORDS = { raw: 1, quote: 1, note: 1, need: 1 };
  var BARE = { id: 1, ch: 1, key: 1, sec: 1, block: 1, type: 1, k: 1, scope: 1 };
  function unwrap(s, lead, hyphens) {
    var lines = s.split(/\r?\n/), full = 0, cut = lines.length === 2, out = '', pass, i, c;
    var str, esc, hex, key, name, words, stack, last;
    var width = function (j) { return lines[j].length + (j === 0 ? lead : 0); };
    var letter = function (x) { return x.toLowerCase() !== x.toUpperCase(); };
    var alnum = function (x) { return /[0-9A-Za-z]/.test(x); };
    for (i = 0; i < lines.length - 1; i++) full = Math.max(full, width(i));
    /* The first pass only looks for that evidence; the second writes. */
    for (pass = 0; pass < 2; pass++) {
      out = ''; str = false; esc = false; hex = 0; key = false; name = ''; words = false;
      stack = []; last = '';
      for (i = 0; i < lines.length; i++) {
        var line = lines[i], end = out.charAt(out.length - 1);
        if (i > 0 && !pass && width(i - 1) === full &&
            (str ? esc || hex || key || BARE.hasOwnProperty(name)
                 : alnum(end) && alnum(line.charAt(0)))) cut = true;
        var atHyphen = hyphens && end === '-' &&
          letter(out.charAt(out.length - 2)) && letter(line.charAt(0));
        if (i > 0 && pass && words && !esc && !hex && (width(i - 1) < full || !cut) &&
            !atHyphen && end !== ' ' && line.charAt(0) !== ' ') out += ' ';
        for (c = 0; c < line.length; c++) {
          var ch = line.charAt(c);
          out += ch;
          if (str) {
            if (hex) hex--;
            else if (esc) { esc = false; if (ch === 'u') hex = 4; }
            else if (ch === '\\') esc = true;
            else if (ch === '"') { str = false; words = false; last = ch; }
            else if (key) name += ch;
          } else if (ch === '"') {
            str = true;
            key = stack[stack.length - 1] === '{' && (last === '{' || last === ',');
            if (key) name = '';
            words = !key && WORDS.hasOwnProperty(name);
          } else if (ch === '{' || ch === '[') { stack.push(ch); last = ch; }
          else if (ch === '}' || ch === ']') { stack.pop(); last = ch; }
          else if (ch !== ' ' && ch !== '\t') last = ch;
        }
      }
    }
    return out;
  }

  /* How well a list reads as marks: a point for each entry clean() takes,
     and one more for each of these: a passage exactly as long as the place
     it was taken from; a quote that is its passage tidied the way
     sliceClean tidies it (a passage with a source tag in it matches in no
     reading, so it counts for none); a need that is one of the six. One off
     for each field the book never writes. A wrong join costs a point. */
  var FIELDS = { id: 1, ch: 1, key: 1, sec: 1, block: 1, start: 1, end: 1, raw: 1, quote: 1,
                 type: 1, note: 1, need: 1, k: 1, ts: 1, ed: 1, scope: 1 };
  function fit(list) {
    var n = 0;
    list.forEach(function (m) {
      if (!clean(m)) return;
      n++;
      var raw = typeof m.raw === 'string' ? m.raw : '';
      if (raw && m.end - m.start === raw.length) n++;
      if (raw && m.quote === raw.replace(/\s+/g, ' ').replace(/\s+([,.;:)])/g, '$1').trim()) n++;
      if (m.need && NEEDS.indexOf(m.need) >= 0) n++;
      Object.keys(m).forEach(function (f) { if (!FIELDS.hasOwnProperty(f)) n--; });
    });
    return n;
  }
  function usable(m) { return !!clean(m); }

  /* Where the [ or { at i is closed, reading strings the way JSON reads
     them; -1 if it never is. Line breaks are passed over: JSON has none
     inside a string, so each one there was put in by mail, and one that
     falls between a backslash and the sign it escapes must not stand in
     for that sign, as unwrap does not let it either. */
  function closing(t, i) {
    var depth = 0, str = false, esc = false;
    for (var j = i; j < t.length; j++) {
      var c = t.charAt(j);
      if (c === '\n' || c === '\r') continue;
      if (str) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') str = false;
      } else if (c === '"') str = true;
      else if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') { depth--; if (!depth) return j; }
    }
    return -1;
  }

  function copiesIn(t) {
    if (!t) return null;
    var whole = parseList(t);
    if (whole) return whole;
    var found = [], parts = t.split(MARKER), i, list;
    for (i = 1; i < parts.length; i++) {
      var seg = parts[i].trim(), k = seg.indexOf(']');
      list = null;
      while (k >= 0 && !list) {                   // the list ends at one of its ] signs
        list = parseList(seg.slice(0, k + 1));
        k = seg.indexOf(']', k + 1);
      }
      if (list) found = found.concat(list);
    }
    /* No marker line, as in a backup file pasted into a mail, or nothing
       read after one: every [ and { is tried as the start of a copy, and a
       copy ends where its own brackets close, so words or a signature on
       either side do not spoil it, and a second copy is read too. A list
       without a single mark in it is not taken for a copy. */
    if (!found.length) {
      for (i = 0; i < t.length; i++) {
        var ch = t.charAt(i);
        if (ch !== '[' && ch !== '{') continue;
        var end = closing(t, i);
        if (end < 0) continue;
        list = parseList(t.slice(i, end + 1), i - t.lastIndexOf('\n', i) - 1);
        if (list && list.some(usable)) { found = found.concat(list); i = end; }
      }
    }
    return found.length ? found : null;
  }

  /* A mail program quotes a whole block of lines, so the > signs come off a
     line only when the line above or below it is quoted too. A lone line
     that begins with > is a wrapped line of the list itself, whose words
     happen to start with one (TWS > 14 kn), and keeps it. Only when that
     reads nothing do the > signs come off every line. */
  var QUOTED = /^[ \t]*(?:>[ \t]?)+/;
  function marksFromText(text) {
    var t = String(text || ''), lines = t.split('\n');
    var some = lines.map(function (x, i) {
      return QUOTED.test(x) && (QUOTED.test(lines[i - 1] || '') || QUOTED.test(lines[i + 1] || ''))
        ? x.replace(QUOTED, '') : x;
    }).join('\n');
    var all = t.replace(/^[ \t]*(?:>[ \t]?)+/gm, '');
    return copiesIn(some.trim()) || (all !== some ? copiesIn(all.trim()) : null);
  }

  /* The existing Export already reaches iCloud Drive through the share
     sheet, so backing up uses the same road rather than a second one. A
     backup that did not happen says so. */
  function shareFile(name, text, mime, done) {
    if (navigator.share) {
      var payload = { title: name, text: text };
      if (navigator.canShare && window.File) {
        try {
          var file = new File([text], name, { type: mime });
          if (navigator.canShare({ files: [file] })) payload = { files: [file], title: name };
        } catch (e) { /* fall through to text share */ }
      }
      navigator.share(payload).then(function () { if (done) done(); }, function (err) {
        if (err && err.name === 'AbortError') { toast('Not saved'); return; }
        cannotSave();
      });
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    if (done) done();
  }

  /* Some copies of the book, such as one shown inside another page, are not
     allowed to save a file. The email carries the same list. */
  function cannotSave() {
    openSheet('<h3>This copy cannot save a file</h3>' +
      '<p>Press Email to Ronald instead. The email carries all your marks, and Restore ' +
      'can read them from it later.</p>' +
      '<div class="row"><button class="btn" data-close="1">Close</button>' +
      '<button class="btn btn-p" id="cs-mail">Email to Ronald</button></div>');
    sheet.querySelector('#cs-mail').addEventListener('click', function () {
      closeSheet(); mailAll();
    });
  }

  /* The time of the last backup has its own record, k49.backup.v1, rather
     than riding in the prefs, which a page writes back from the copy it read
     when it opened. A backup taken before that record existed is still found
     in the prefs, where the earlier engine kept it. Says whether the record
     was stored, so Back up does not claim a backup this page cannot see. */
  function noteBackup() {
    var ok = writeJSON(BK, { ts: Date.now(), n: marks.length }, true);
    showMarksPage();
    return ok;
  }

  /* The lists that could not be read: those parked under their own names,
     and, while one could not be parked, the one still under the marks key,
     so that Back up can take it off the device. */
  function damagedList() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf(MK + '.damaged.') === 0) out.push(localStorage.getItem(k));
      }
      var raw = hold ? localStorage.getItem(MK) : null;
      if (raw && out.indexOf(raw) < 0) out.push(raw);
    } catch (e) { /* storage refused */ }
    return out;
  }

  function backupState() {
    var b = readJSON(BK, null) || prefs.backup, out = [];
    var newest = 0;
    marks.forEach(function (m) { if ((m.ts || 0) > newest) newest = m.ts || 0; });
    var since = marks.filter(function (m) {
      return !b || (m.ed || m.ts || 0) > b.ts;
    }).length;
    var here = 'T' + HERE.slice(1);               // This iPad, This phone or This computer
    if (!marks.length) {
      out.push('Nothing marked yet.');
    } else if (!b) {
      out.push('<b>' + (marks.length === 1 ? 'This mark is'
                        : 'These ' + marks.length + ' marks are') +
               ' the only copy.</b> Tap Back up to put one in iCloud Drive.');
    } else if (since) {
      out.push('<b>' + since + ' mark' + (since === 1 ? '' : 's') +
               ' since the last backup</b>, which was ' + when(b.ts) + '.');
    } else {
      out.push('Backed up ' + when(b.ts) + '. Nothing new since.');
    }
    if (fragile) {
      out.push('<span class="warn">' + BROWSER + ' forgets marks made in this copy of ' +
               'the book when it closes. Press Back up after reading. When the book is on ' +
               'your Home Screen, read it there and press Restore once.</span>');
    } else if (persisted === false && !standalone) {
      out.push('<span class="warn">' + here + ' has not given the book ' +
               'permanent storage. Open it from the home-screen icon rather ' +
               'than a Safari tab, and back up.</span>');
    } else if (persisted === false) {
      out.push('<span class="warn">' + here + ' has not given the book ' +
               'permanent storage. Back up after reading.</span>');
    }
    if (hold) {
      out.push('<span class="warn">Marks cannot be saved here right now. Tell Ronald.</span>');
    } else if (damagedList().length) {
      out.push('<span class="warn">An older list of marks could not be read. It is kept ' +
               'safe and goes into every Back up. Tell Ronald.</span>');
    }
    return out.join(' ');
  }

  function when(ts) {
    var d = new Date(ts), now = Date.now();
    var days = Math.floor((now - ts) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return days + ' days ago';
    return 'on ' + d.toLocaleDateString('en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function restoreSheet() {
    openSheet(
      '<h3>Put marks back</h3>' +
      '<p class="meta">Restoring only adds. Nothing already on this iPad is ' +
      'removed or overwritten by an older copy, so a mark deleted after the ' +
      'backup was taken will come back.</p>' +
      '<div class="row"><button class="btn btn-p" id="rs-file">' +
      'Choose a backup file</button></div>' +
      '<label>Or paste the text of an export email</label>' +
      '<textarea id="rs-t" placeholder="Paste the whole email, including the ' +
      'machine-readable line at the bottom. A reply thread works too, even ' +
      'with its lines wrapped or quoted."></textarea>' +
      '<div class="row"><button class="btn" data-close="1">Cancel</button>' +
      '<button class="btn btn-p" id="rs-ok">Put them back</button></div>');
    sheet.querySelector('#rs-file').addEventListener('click', function () {
      var fi = document.getElementById('mk-file');
      closeSheet();
      if (fi) fi.click();
    });
    sheet.querySelector('#rs-ok').addEventListener('click', function () {
      applyRestore(sheet.querySelector('#rs-t').value);
    });
  }

  function applyRestore(text) {
    var incoming = marksFromText(text);
    if (!incoming) { toast('No marks found in that'); return; }
    var r = mergeMarks(incoming);
    var msg = (r.added + r.updated === 0 ? 'Nothing new to restore'
               : r.added + ' restored, ' + r.updated + ' updated, ' + r.kept + ' in all') +
              (r.dropped ? ', ' + r.dropped + ' could not be read' : '');
    if (saved) {
      closeSheet();
      renderAll();
      showMarksPage();
    } else {
      /* nothing reached storage: the pasted text stays in the sheet to try
         again, and this page goes back to the list storage holds */
      latest();
    }
    said(msg);
  }

  function exportText() {
    var lines = ['49er theory book — marks and requests',
                 'Exported ' + new Date().toLocaleDateString('en-GB',
                   { day: 'numeric', month: 'long', year: 'numeric' }),
                 'Build ' + (D.BUILD || ''), ''];
    var lastCh = null;
    order().forEach(function (m) {
      if (m.ch !== lastCh) { lines.push('', '## ' + chTitle(m.ch), ''); lastCh = m.ch; }
      var head = m.scope === 'chapter' ? 'Whole chapter' : m.sec + ' ' + secTitle(m.ch, m.sec);
      lines.push(head + '  [' +
        (m.need || kindLabel(m.k) || m.type).toUpperCase() + ']');
      if (m.quote) lines.push('    "' + m.quote + '"');
      if (m.note) lines.push('    ' + (m.type === 'request' ? 'Asked: ' : 'Note: ') + m.note);
      lines.push('');
    });
    lines.push('', '--- machine-readable copy below, leave it in place ---', '');
    lines.push(JSON.stringify(marks));
    return lines.join('\n');
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Copied'); },
        function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Copied'); }
    catch (e) { toast('Copy failed, select the text manually'); }
    document.body.removeChild(ta);
  }

  /* A page cannot send mail itself. These open the Mail app with everything
     written, so the reader types Ronald in the To line and taps send. Nothing is transmitted
     from the device by the page. */
  function openMail(subject, body) {
    var url = 'mailto:?subject=' + encodeURIComponent(subject) +
              '&body=' + encodeURIComponent(body);
    if (url.length > 1900) {
      copy(body);
      url = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' +
        encodeURIComponent('The full list is on the clipboard. Paste it here, then send.\n\n');
      toast('Too long for a mail link, so it is copied. Paste it in.');
    }
    window.location.href = url;
  }

  function requestBody(mk) {
    var L = ['49er theory book, request for more detail', ''];
    L.push('Chapter: ' + chTitle(mk.ch));
    if (mk.scope === 'chapter') L.push('Scope: the whole chapter');
    else L.push('Section: ' + mk.sec + ' ' + secTitle(mk.ch, mk.sec));
    if (mk.need) L.push('Needs: ' + mk.need);
    if (mk.quote) L.push('', 'Passage:', '"' + mk.quote + '"');
    if (mk.note) L.push('', 'Asked:', mk.note);
    L.push('', 'Build ' + (D.BUILD || ''));
    return L.join('\n');
  }

  /* Email to Ronald, from the Marks page or from the sheet that says this
     copy cannot save a file. It reads the newest stored list first. */
  function mailAll() {
    if (!latest().length) { toast('Nothing to email yet'); return; }
    var reqs = marks.filter(function (m) { return m.type === 'request'; }).length;
    openMail('49er theory book, ' + marks.length + ' marks and ' + reqs + ' requests',
             exportText());
  }

  function emailRequest(mk) {
    var where = mk.scope === 'chapter' ? 'chapter ' + mk.ch : 'section ' + mk.sec;
    openMail('49er theory book, request on ' + where, requestBody(mk));
  }

  /* ------------------------------------------------- the vocabulary page
     203 entries is more than anyone scrolls. The box filters on the headword
     and on the other names the same thing goes by, since a reader looking
     something up here has usually heard it called the other one. */
  if (document.body.dataset.page === 'words') {
    var wq = document.getElementById('wd-q');
    var wlist = document.getElementById('wd-list');
    var wcount = document.getElementById('wd-count');
    var witems = wlist ? wlist.querySelectorAll('.witem') : [];
    var wletters = wlist ? wlist.querySelectorAll('.wletter') : [];

    var runWordFilter = function () {
      var q = (wq.value || '').trim().toLowerCase();
      var shown = 0;
      Array.prototype.forEach.call(witems, function (el) {
        var hit = !q || (el.dataset.k || '').indexOf(q) >= 0;
        el.hidden = !hit;
        if (hit) shown++;
      });
      /* a letter with nothing left under it is noise */
      Array.prototype.forEach.call(wletters, function (h) {
        var any = false, n = h.nextElementSibling;
        while (n && !n.classList.contains('wletter')) {
          if (n.classList.contains('witem') && !n.hidden) { any = true; break; }
          n = n.nextElementSibling;
        }
        h.hidden = !any;
      });
      if (wcount) {
        wcount.textContent = !q ? witems.length + ' words'
          : shown === 0 ? 'No word here matches that'
          : shown === 1 ? '1 word' : shown + ' words';
      }
    };

    if (wq) {
      wq.addEventListener('input', runWordFilter);
      wq.addEventListener('search', runWordFilter);
      runWordFilter();
    }
    var wclear = document.getElementById('wd-clear');
    if (wclear) wclear.addEventListener('click', function () {
      wq.value = '';
      runWordFilter();
      wq.focus();
    });
  }

  if (document.body.dataset.page === 'marks') {
    renderMarksPage();
    var fl = document.getElementById('mk-filter');
    if (fl) fl.addEventListener('change', renderMarksPage);
    document.getElementById('mk-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]');
      if (b) removeMark(b.dataset.del);
    });
    var bk = document.getElementById('mk-backup');
    if (bk) bk.addEventListener('click', function () {
      /* a device holding only an unreadable older list can still back it up */
      if (!latest().length && !damagedList().length) { toast('Nothing to back up yet'); return; }
      var name = '49er-marks-' + new Date().toISOString().slice(0, 10) + '.json';
      shareFile(name, backupJSON(), 'application/json', function () {
        /* the file is saved; Backed up is said only if its date was stored too */
        toast(noteBackup() ? 'Backed up'
              : 'Not saved: the date of this backup. The file itself is saved.');
      });
    });

    var rs = document.getElementById('mk-restore');
    var fi = document.getElementById('mk-file');
    if (rs) rs.addEventListener('click', restoreSheet);
    if (fi) fi.addEventListener('change', function () {
      var f = fi.files && fi.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { applyRestore(r.result); fi.value = ''; };
      r.onerror = function () { toast('That file could not be read'); fi.value = ''; };
      r.readAsText(f);
    });

    document.getElementById('mk-copy').addEventListener('click', function () {
      if (!latest().length) { toast('Nothing to copy yet'); return; }
      copy(exportText());
    });
    document.getElementById('mk-email').addEventListener('click', mailAll);
    document.getElementById('mk-export').addEventListener('click', function () {
      if (!latest().length) { toast('Nothing to export yet'); return; }
      var text = exportText();
      var name = '49er-marks-' + new Date().toISOString().slice(0, 10) + '.txt';
      if (navigator.share) {
        var payload = { title: '49er theory book marks', text: text };
        if (navigator.canShare && window.File) {
          try {
            var file = new File([text], name, { type: 'text/plain' });
            if (navigator.canShare({ files: [file] })) payload = { files: [file], title: name };
          } catch (e) { /* fall through to text share */ }
        }
        navigator.share(payload).catch(function () { copy(text); });
      } else {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
        a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        toast('Exported');
      }
    });
  }

  /* ------------------------------------------------- spoken walkthrough
     Read aloud with the browser's own speech synthesis: no service, no key,
     works offline. Split into short utterances because iOS truncates long
     ones, and queued so each sentence starts the next. */
  var TOUR = [
    'Hello, Conrad. This is the 49er theory book, built so you can work on it rather than only read it. Six things worth knowing.',
    'One. Any word with a dotted underline has an explanation behind it. Tap it and a short panel opens, in plain language, with no formulas.',
    'Two. If the panel still does not land, tap Still not clear, and choose what would help: a worked example, a diagram, a simpler explanation, more depth, a drill, or a source to read.',
    'Three. The small blue tags are the sources. Touch one and the citation appears over the page. Close it and you are back exactly where you were.',
    'Four. Select any passage with your finger and four choices appear: highlight it, write a note on it, ask for more detail, or copy it.',
    'Five. Everything you mark stays on this iPad. Open Marks when you are ready, and press Email to Ronald. Mail opens already written, and you tap send.',
    'Six. Anything in grey italic that reads crew value is a number for your own logbook. It was left blank rather than guessed.',
    'That is everything. Start marking.'
  ];

  var speaking = false;

  /* Voice choice. The best-sounding iOS voices are the Enhanced and Premium
     ones, and they exist only if the reader has downloaded them under
     Settings, Accessibility, Spoken Content, Voices. Rank what is present and
     let the reader override it, because only they can hear the result. */
  var FEMALE = new RegExp('(Serena|Kate|Martha|Stephanie|Samantha|Karen|Moira|Tessa|' +
    'Fiona|Allison|Ava|Susan|Zoe|Nicky|Joelle|Catherine|Emily|Sara|Female)', 'i');
  var BETTER = /(Premium|Enhanced|Neural|Natural|Siri)/i;
  /* The walkthrough is read by a woman, so the male voices are taken out of the
     list altogether rather than ranked below the female ones: ranking loses if
     the list arrives late and the platform default speaks first. */
  var MALE = new RegExp('\\b(Aaron|Albert|Alex|Arthur|Bruce|Daniel|Eddy|Fred|Gordon|Grandpa|'
    + 'Jacques|Jamie|Junior|Lee|Nathan|Oliver|Ralph|Reed|Rishi|Rocko|Thomas|Tom|Xander|'
    + 'David|Mark|George|Ryan|Guy|Male|Man)\\b', 'i');

  function englishVoices() {
    var vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    return vs.filter(function (v) { return /^en/i.test(v.lang); });
  }

  function spokenVoices() {
    var vs = englishVoices().filter(function (v) { return !MALE.test(v.name); });
    /* only if this iPad carries no female English voice at all */
    return vs.length ? vs : englishVoices();
  }

  /* iOS fills the voice list asynchronously, and until it does getVoices()
     returns nothing and the platform speaks in its own default voice, which is
     often male. That is why the first press sounded male and the second did
     not. Ask for the list early and keep asking. */
  function warmVoices() {
    if (!window.speechSynthesis) return;
    try { speechSynthesis.getVoices(); } catch (e) {}
  }

  function whenVoices(cb) {
    if (spokenVoices().length) { cb(); return; }
    warmVoices();
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (spokenVoices().length || tries > 15) { clearInterval(iv); cb(); }
    }, 60);
  }

  function voiceScore(v) {
    /* Naturalness first: the iPad's Siri and Premium voices are far easier to
       follow than the older compact ones, so they outrank a female name. */
    var s = 0;
    /* iOS names its Siri voices by number, so the name does not say whether
       the voice is a woman's. A named female Enhanced voice is preferred over
       an unnamed Siri one rather than the other way round. */
    if (/Siri/i.test(v.name)) s += (FEMALE.test(v.name) ? 220 : 40);
    else if (/Premium/i.test(v.name)) s += 170;
    else if (/(Enhanced|Neural|Natural)/i.test(v.name)) s += 150;
    if (FEMALE.test(v.name)) s += 90;
    if (/(Compact|eSpeak|Albert|Zarvox|Trinoids|Whisper|Bad News|Good News)/i.test(v.name)) s -= 400;
    if (/^en[-_]GB/i.test(v.lang)) s += 25;
    else if (/^en[-_](US|AU|IE|NZ|ZA)/i.test(v.lang)) s += 12;
    if (v.localService) s += 5;
    return s;
  }

  function pickVoice() {
    var vs = spokenVoices();
    if (!vs.length) return null;
    if (prefs.voice) {
      var chosen = vs.filter(function (v) { return v.voiceURI === prefs.voice; })[0];
      if (chosen) return chosen;
    }
    return vs.slice().sort(function (a, b) { return voiceScore(b) - voiceScore(a); })[0];
  }

  function sampleVoice() {
    if (!('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); } catch (e) {}
    var u = new SpeechSynthesisUtterance('Hello, Conrad. This is the 49er theory book.');
    var v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-GB'; }
    speechSynthesis.speak(u);
  }

  if (window.speechSynthesis) {
    warmVoices();
    speechSynthesis.onvoiceschanged = warmVoices;
    window.addEventListener('load', warmVoices);
    document.addEventListener('pointerdown', warmVoices, true);
    document.addEventListener('touchstart', warmVoices, true);
  }

  var tourBtn = document.getElementById('btn-tour');
  /* whatever the builder wrote on the button is the name of this thing,
     and it is what goes back when the walkthrough stops */
  var tourIdle = (function () {
    var l = tourBtn && tourBtn.querySelector('.tourbtn-l');
    return l ? l.textContent : '';
  })();

  function setTourBtn(on) {
    if (!tourBtn) return;
    tourBtn.classList.toggle('playing', on);
    tourBtn.querySelector('.tourbtn-l').textContent = on ? 'Stop' : tourIdle;
    tourBtn.querySelector('.tourbtn-i').innerHTML = on ? '&#9632;' : '&#9654;';
  }

  function stopTour() {
    speaking = false;
    try { speechSynthesis.cancel(); } catch (e) {}
    setTourBtn(false);
  }

  function startTour() {
    speaking = true;
    setTourBtn(true);
    var i = 0;
    function next() {
      if (!speaking || i >= TOUR.length) { stopTour(); return; }
      /* resolved per line, so a list that arrives late still corrects itself */
      var voice = pickVoice();
      var u = new SpeechSynthesisUtterance(TOUR[i++]);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-GB'; }
      u.rate = 0.92; u.pitch = 1; u.volume = 1;
      u.onend = next;
      u.onerror = function () { stopTour(); };
      speechSynthesis.speak(u);
    }
    if (spokenVoices().length) { next(); return; }
    /* A silent line spoken inside the press keeps iOS's gesture requirement
       satisfied and is itself what makes the list appear. */
    try {
      var warm = new SpeechSynthesisUtterance(' ');
      warm.volume = 0;
      speechSynthesis.speak(warm);
    } catch (e) {}
    whenVoices(next);
  }

  if (tourBtn) tourBtn.addEventListener('click', function () {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      // no speech on this browser: show the same walkthrough as text instead
      openSheet('<h3>How this book works</h3>' +
        '<p class="meta">This browser cannot read aloud, so here it is in writing.</p>' +
        TOUR.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') +
        '<div class="row"><button class="btn btn-p" data-close="1">Close</button></div>');
      return;
    }
    if (speaking) { stopTour(); return; }
    startTour();
  });

  window.addEventListener('pagehide', function () { if (speaking) stopTour(); });

  /* The warning for a copy of the book shown inside another page, once per
     visit, under the top bar so every page shows it. app.css has no rules of
     its own for it, so it wears the Marks page's state-line box and the
     book's own button, and brings the one print rule it needs: a printed
     page leaves it out, as app.css leaves out the bar above it. */
  if (fragile) {
    var seen = false;
    try { seen = sessionStorage.getItem('k49.fragile.v1') === '1'; } catch (e) {}
    var bar = document.querySelector('header.bar');
    if (bar && !seen) {
      var fwrap = document.createElement('div');
      fwrap.className = 'wrap framewrap';
      fwrap.style.paddingTop = '14px';
      fwrap.style.paddingBottom = '0';
      fwrap.innerHTML = '<div class="framenote mk-state"><p style="margin:0 0 10px"><b>' + BROWSER +
        ' may forget your marks in this copy of the book.</b> Press Back up on the Marks page ' +
        'after reading. When the book is on your Home Screen, read it there and press ' +
        'Restore once.</p>' +
        '<button class="btn" type="button">OK</button></div>';
      bar.parentNode.insertBefore(fwrap, bar.nextSibling);
      var fprint = document.createElement('style');
      fprint.textContent = '@media print { .framewrap { display: none !important; } }';
      (document.head || document.documentElement).appendChild(fprint);
      fwrap.querySelector('button').addEventListener('click', function () {
        try { sessionStorage.setItem('k49.fragile.v1', '1'); } catch (e) {}
        if (fwrap.parentNode) fwrap.parentNode.removeChild(fwrap);
      });
    }
  }

  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline is optional */ });
    });
  }

  /* A book left open on the Home Screen is brought back rather than loaded
     again, and only a page load makes the browser look for a new build.
     Coming back to the book asks for that look, so a repaired engine is
     fetched without waiting for another page to be opened. Nothing is
     reloaded: the next page opened runs it. */
  function checkForUpdate() {
    try {
      if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistration) return;
      navigator.serviceWorker.getRegistration().then(function (r) {
        if (r) return r.update();
      }).catch(function () { /* offline: the next page load looks */ });
    } catch (e) { /* not available in this copy */ }
  }
})();


/* ------------------------------------------------------------------ moving about
   Build 10. Conrad asked for it to be easier to go back and forth. A chapter
   runs to about 29,000 pixels and the only section list was collapsed at the
   very top, so this puts the list behind the chapter title in the sticky bar,
   keeps that title showing which section is under the reader, and draws a
   progress line. It reads the sections and the chapter links out of the page
   that is already built, so the builder did not have to learn anything new. */
(function () {
  var api = window.__bookSheet;
  var btn = document.getElementById('btn-jump');
  var secs = [].slice.call(document.querySelectorAll('section.sec[data-sec]'));
  if (!api || !btn || !secs.length) {
    /* nothing to jump to on this page, so the title is not a control and
       must not wear a caret that says it is */
    if (btn) {
      var c = btn.querySelector('.caret');
      if (c && c.parentNode) c.parentNode.removeChild(c);
      btn.style.cursor = 'default';
      btn.setAttribute('aria-disabled', 'true');
      btn.removeAttribute('aria-label');
    }
    return;
  }

  var nowEl = btn.querySelector('.now');
  var chapterTitle = btn.getAttribute('data-chapter') || '';
  var current = null;

  function titleOf(s) {
    var t = s.querySelector('h2 .sectitle');
    return t ? t.textContent.trim() : (s.getAttribute('data-sec') || '');
  }

  var prog = document.createElement('div');
  prog.className = 'prog';
  document.body.appendChild(prog);

  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = (h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0) + '%';
    var y = window.scrollY + 90, found = null;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].getBoundingClientRect().top + window.scrollY <= y) found = secs[i];
    }
    if (found !== current) {
      current = found;
      if (nowEl) nowEl.textContent = current ? current.getAttribute('data-sec') : '';
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });
  onScroll();

  function pagerHtml() {
    var links = [].slice.call(document.querySelectorAll('.pager a'));
    var prev = null, next = null;
    links.forEach(function (a) {
      if (/^Previous/i.test(a.textContent)) prev = a;
      else if (/^Next/i.test(a.textContent)) next = a;
    });
    function one(a, label) {
      if (!a) return '<a class="none">' + label + '</a>';
      return '<a href="' + a.getAttribute('href') + '">' +
             a.textContent.replace(/^(Previous|Next):\s*/i, label + ' ') + '</a>';
    }
    return '<div class="jump-x">' + one(prev, '←') + one(next, '→') + '</div>';
  }

  /* bound once, not once per opening, or the handlers stack up every time the
     reader opens the list and the page jumps several times on one tap */
  api.el.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('.jump a[href^="#"]') : null;
    if (!a) return;
    e.preventDefault();
    var id = a.getAttribute('href').slice(1);
    api.close();
    if (id === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var t = document.getElementById(id);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  btn.addEventListener('click', function () {
    var rows = secs.map(function (s) {
      var on = (s === current) ? ' class="on"' : '';
      return '<li><a href="#' + s.id + '"' + on + '><span class="n">' +
             s.getAttribute('data-sec') + '</span><span>' + titleOf(s) +
             '</span></a></li>';
    }).join('');
    api.open(
      '<div class="jump"><h3>' + chapterTitle + '</h3>' +
      '<ol class="jump-l">' + rows + '</ol>' +
      '<hr class="jump-rule">' + pagerHtml() +
      '<div class="jump-x" style="margin-top:8px">' +
      '<a href="./">All chapters</a><a href="#top">Top of chapter</a>' +
      '</div></div>');
  });
})();
