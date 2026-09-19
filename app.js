/* Advanced Olympic 49er Sailing Theory — reading, marking and export.
   Everything is stored on this device. Nothing leaves it until Export. */
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
  var EMAIL = 'tasar1@me.com';
  var NEEDS = ['A worked example', 'A diagram', 'Explain it more simply',
               'More depth', 'A drill to practise it', 'A source to read'];

  // ------------------------------------------------------------- storage
  function readJSON(k, d) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
    catch (e) { return d; }
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { toast('Could not save on this device'); return false; }
  }
  var marks = readJSON(MK, []);

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
        if (document.body.dataset.page === 'marks') renderMarksPage();
      })
      .catch(function () { persisted = false; });
  }
  var prefs = readJSON(PF, {});
  if (prefs.size == null) prefs.size = 1;
  if (!prefs.theme) {
    // follow the iPad's own appearance until the reader chooses otherwise
    prefs.theme = (window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
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

  function saveMarks() { writeJSON(MK, marks); }
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
  var toastT;
  function toast(msg) {
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
      prefs.voice = sel.value || '';
      writeJSON(PF, prefs);
      sampleVoice();
    });

    sheet.querySelector('#seg-size').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      prefs.size = +b.dataset.i; writeJSON(PF, prefs); applyPrefs(); readingSheet();
    });
    sheet.querySelector('#seg-theme').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      prefs.theme = b.dataset.t; writeJSON(PF, prefs); applyPrefs(); readingSheet();
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
      '<p class="meta">A woman\'s voice, so the male voices are left out of this list. '
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
      marks.push(mk); saveMarks(); renderAll(); closeSheet(); toast('Request saved');
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
    prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark';
    writeJSON(PF, prefs);
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

  function renderMark(mk) {
    if (!article || mk.ch !== chNum || mk.scope === 'chapter') return false;
    var el = article.querySelector('[data-b="' + cssq(mk.block) + '"]');
    if (!el) return false;
    var full = blockText(el);
    var s = mk.start, e = mk.end;
    if (full.slice(s, e) !== mk.raw) {
      var i = full.indexOf(mk.raw);
      if (i < 0) return false;
      s = i; e = i + mk.raw.length;
    }
    var cls = 'hl' + (mk.note ? ' has-note' : '') + (mk.type === 'request' ? ' is-request' : '');
    return wrapRange(el, s, e, { cls: cls, id: mk.id, k: mk.k || '' });
  }

  function cssq(s) { return String(s).replace(/"/g, '\\"'); }

  function renderAll() {
    if (!article) return;
    Array.prototype.forEach.call(article.querySelectorAll('mark.hl'), function (m) {
      var p = m.parentNode;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
      p.normalize();
    });
    var orphans = 0;
    marks.forEach(function (mk) {
      if (mk.ch === chNum && mk.scope !== 'chapter') { if (!renderMark(mk)) orphans++; }
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
    marks.push(mk);
    saveMarks();
    renderAll();
    toast(type === 'request' ? 'Request saved' : type === 'note' ? 'Note saved'
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
        existing.note = txt; existing.need = need; saveMarks(); renderAll();
        toast('Saved'); mk = existing;
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
    marks = marks.filter(function (m) { return m.id !== id; });
    saveMarks(); renderAll(); toast('Removed');
    if (document.body.dataset.page === 'marks') renderMarksPage();
  }

  function markSheet(id) {
    var mk = marks.filter(function (m) { return m.id === id; })[0];
    if (!mk) return;
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
    var kp = sheet.querySelector('.kpick');
    if (kp) kp.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      mk.k = (mk.k === b.dataset.k) ? '' : b.dataset.k;
      Array.prototype.forEach.call(kp.querySelectorAll('button'), function (x) {
        x.setAttribute('aria-pressed', String(x.dataset.k === mk.k));
      });
      saveMarks(); renderAll();
      if (document.body.dataset.page === 'marks') renderMarksPage();
      toast(kindLabel(mk.k) || 'Colour removed');
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
    var existing = marks.filter(function (m) {
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
      var mk = existing;
      if (existing) { existing.note = txt; existing.need = need; }
      else {
        mk = {
          id: uid(), ch: chNum, key: chKey, sec: chNum, scope: 'chapter',
          block: '', start: 0, end: 0, raw: '', quote: '',
          type: 'request', note: txt, need: need, ts: Date.now()
        };
        marks.push(mk);
      }
      saveMarks(); renderAll(); closeSheet(); toast('Request saved');
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

  function renderMarksPage() {
    var list = document.getElementById('mk-list');
    if (!list) return;
    var f = (document.getElementById('mk-filter') || {}).value || 'all';
    var rows = order().filter(function (m) {
      if (f === 'all') return true;
      if (f.slice(0, 2) === 'k:') return (m.k || '') === f.slice(2);
      return m.type === f;
    });
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
        '<a href="ch' + esc(m.key || m.ch) + '.html#' +
        (m.scope === 'chapter' ? '' : 'sec-' + String(m.sec).replace(/\./g, '-')) +
        '">Open in the book</a>' +
        '<button data-del="' + esc(m.id) + '">Delete</button>' +
        '</div></div>');
    });
    var st = document.getElementById('mk-state');
    if (st) st.innerHTML = backupState();
    list.innerHTML = '<div class="mk-key">' + KINDS.map(function (x) {
      return '<span>' + dotHTML(x.k) + esc(x.label) + '</span>';
    }).join('') + '</div>' + out.join('');
  }

  /* ----------------------------------------------------------- backup
     One envelope, versioned, so a file written today can still be read
     after the marks themselves gain a field. */
  var BACKUP_KIND = '49er theory book marks';

  function backupJSON() {
    return JSON.stringify({
      kind: BACKUP_KIND, v: 1, build: D.BUILD || '',
      saved: new Date().toISOString(), count: marks.length, marks: marks
    }, null, 1);
  }

  /* Union by id, and where the same mark exists on both sides the newer
     one wins. Nothing is dropped: a restore can only add. */
  function mergeMarks(incoming) {
    if (!incoming || !incoming.length) return { added: 0, updated: 0, kept: marks.length };
    var byId = {}, added = 0, updated = 0;
    marks.forEach(function (m) { byId[m.id] = m; });
    incoming.forEach(function (m) {
      if (!m || !m.id) return;
      var have = byId[m.id];
      if (!have) { byId[m.id] = m; added++; }
      else if ((m.ts || 0) > (have.ts || 0)) { byId[m.id] = m; updated++; }
    });
    marks = Object.keys(byId).map(function (k) { return byId[k]; });
    saveMarks();
    return { added: added, updated: updated, kept: marks.length };
  }

  /* Accepts a backup file, a bare array, or the whole text of an export
     email, which carries its machine-readable copy on the last line. That
     last case is what makes every export already sent recoverable. */
  function marksFromText(text) {
    var t = String(text || '').trim();
    if (!t) return null;
    var tries = [t];
    var i = t.lastIndexOf('[');
    if (i > 0) tries.push(t.slice(i));
    var j = t.indexOf('{');
    if (j > 0) tries.push(t.slice(j));
    for (var n = 0; n < tries.length; n++) {
      try {
        var o = JSON.parse(tries[n]);
        if (Array.isArray(o)) return o;
        if (o && Array.isArray(o.marks)) return o.marks;
      } catch (e) { /* try the next shape */ }
    }
    return null;
  }

  /* The existing Export already reaches iCloud Drive through the share
     sheet, so backing up uses the same road rather than a second one. */
  function shareFile(name, text, mime, done) {
    if (navigator.share) {
      var payload = { title: name, text: text };
      if (navigator.canShare && window.File) {
        try {
          var file = new File([text], name, { type: mime });
          if (navigator.canShare({ files: [file] })) payload = { files: [file], title: name };
        } catch (e) { /* fall through to text share */ }
      }
      navigator.share(payload).then(function () { if (done) done(); },
                                    function () { copy(text); });
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    if (done) done();
  }

  function noteBackup() {
    prefs.backup = { ts: Date.now(), n: marks.length };
    writeJSON(PF, prefs);
    if (document.body.dataset.page === 'marks') renderMarksPage();
  }

  function backupState() {
    var b = prefs.backup, out = [];
    var newest = 0;
    marks.forEach(function (m) { if ((m.ts || 0) > newest) newest = m.ts || 0; });
    var since = marks.filter(function (m) {
      return !b || (m.ts || 0) > b.ts;
    }).length;
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
    if (persisted === false) {
      out.push('<span class="warn">This iPad has not given the book ' +
               'permanent storage. Open it from the home-screen icon rather ' +
               'than a Safari tab, and back up.</span>');
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
      'machine-readable line at the bottom"></textarea>' +
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
    closeSheet();
    renderAll();
    if (document.body.dataset.page === 'marks') renderMarksPage();
    toast(r.added + ' put back, ' + r.updated + ' updated, ' + r.kept + ' in all');
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
     written and addressed, so the reader taps send. Nothing is transmitted
     from the device by the page. */
  function openMail(subject, body) {
    var url = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) +
              '&body=' + encodeURIComponent(body);
    if (url.length > 1900) {
      copy(body);
      url = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' +
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

  function emailRequest(mk) {
    var where = mk.scope === 'chapter' ? 'chapter ' + mk.ch : 'section ' + mk.sec;
    openMail('49er theory book, request on ' + where, requestBody(mk));
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
      if (!marks.length) { toast('Nothing to back up yet'); return; }
      var name = '49er-marks-' + new Date().toISOString().slice(0, 10) + '.json';
      shareFile(name, backupJSON(), 'application/json', function () {
        noteBackup(); toast('Backed up');
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
      if (!marks.length) { toast('Nothing to copy yet'); return; }
      copy(exportText());
    });
    document.getElementById('mk-email').addEventListener('click', function () {
      if (!marks.length) { toast('Nothing to email yet'); return; }
      var reqs = marks.filter(function (m) { return m.type === 'request'; }).length;
      openMail('49er theory book, ' + marks.length + ' marks and ' + reqs + ' requests',
               exportText());
    });
    document.getElementById('mk-export').addEventListener('click', function () {
      if (!marks.length) { toast('Nothing to export yet'); return; }
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

  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline is optional */ });
    });
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
