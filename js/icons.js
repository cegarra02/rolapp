/* ============================================================
   Storym — Line icon system (vanilla, no deps)
   Lucide-style strokes: 24×24, fill none, stroke currentColor,
   width 2, round caps/joins. Replaces the app's emoji icons.

   USAGE
   • Markup:  <i data-icon="send"></i>     (auto-swapped to <svg>)
              <i data-icon="gem" data-size="18"></i>
   • JS:      el.innerHTML = STORYM.icon('heart', { size: 16 });
   • Colors:  inherits currentColor → set `color` in CSS.

   The MutationObserver keeps swapping <i data-icon> nodes that the
   app injects dynamically, so module code can emit them freely.
   ============================================================ */
(function () {
  // inner SVG markup per icon (paths use 24×24 viewBox)
  var P = {
    // nav
    search:   '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
    compass:  '<circle cx="12" cy="12" r="9"/><polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5" fill="currentColor" stroke="none"/>',
    users:    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    masks:    '<path d="M3 5s2-1 4.5-1S12 5 12 5v6a4.5 4.5 0 0 1-9 0z"/><path d="M12 7s2-1 4.5-1S21 7 21 7v6a4.5 4.5 0 0 1-9 0"/>',
    message:  '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z"/>',
    user:     '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    swords:   '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="4" y2="20"/>',
    // actions
    plus:     '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    check:    '<polyline points="20 6 9 17 4 12"/>',
    arrowLeft:'<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    dots:     '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>',
    send:     '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    edit:     '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    x:        '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    chevronR: '<polyline points="9 18 15 12 9 6"/>',
    chevronD: '<polyline points="6 9 12 15 18 9"/>',
    sliders:  '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    // personality / chat formatting
    heart:    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    flame:    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    sparkles: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" fill="currentColor" stroke="none"/>',
    quote:    '<path d="M7 7h4v6a4 4 0 0 1-4 4"/><path d="M15 7h4v6a4 4 0 0 1-4 4"/>',
    parens:   '<path d="M9 4a10 10 0 0 0 0 16"/><path d="M15 4a10 10 0 0 1 0 16"/>',
    // currency / shop
    gem:      '<path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/><path d="m12 22 4-13-3-6"/><path d="m12 22-4-13 3-6"/>',
    gift:     '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5" rx="1"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    crown:    '<path d="M2 6l4 11h12l4-11-6 6-4-7-4 7z"/><line x1="5" y1="21" x2="19" y2="21"/>',
    play:     '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none"/>',
    zap:      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    // system / status
    flag:     '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    award:    '<circle cx="12" cy="8" r="6"/><polyline points="8.5 13.5 7 22 12 19 17 22 15.5 13.5"/>',
    info:     '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="11"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    shield:   '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    refresh:  '<polyline points="23 4 23 10 17 10"/><path d="M20.5 14a9 9 0 1 1-2-9.5L23 8"/>',
    pause:    '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    alert:    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    image:    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    trash:    '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    broom:    '<path d="M19.4 3.6 13 10"/><path d="M11.5 7.5 16.5 12.5"/><path d="M16.5 12.5c-1.5-1.5-4-1.5-5.5 0L4 19.8a1 1 0 0 0 .2 1.6c2.4 1.3 5.5.9 7.5-1.1l4.8-4.8c1.5-1.5 1.5-4 0-5.5z" fill="none"/><path d="m7 15-2 5"/><path d="m11 17-1.5 4"/>',
    palette:  '<path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .9-1.8 1.9-1.8H16a6 6 0 0 0 6-6c0-4.4-4.5-8-10-8z"/><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none"/>',
    logout:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    globe:    '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    star:     '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3"/>',
    male:     '<circle cx="10" cy="14" r="6"/><line x1="14.5" y1="9.5" x2="21" y2="3"/><polyline points="16 3 21 3 21 8"/>',
    female:   '<circle cx="12" cy="8" r="6"/><line x1="12" y1="14" x2="12" y2="22"/><line x1="9" y1="19" x2="15" y2="19"/>',
    hourglass:'<path d="M6 2h12"/><path d="M6 22h12"/><path d="M6 2c0 4 4 5.5 6 8 2-2.5 6-4 6-8"/><path d="M6 22c0-4 4-5.5 6-8 2 2.5 6 4 6 8"/>',
    bell:     '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    moon:     '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  };
  // emoji → icon-name fallback map (so leftover emoji still convert if wrapped)
  var EMOJI = { '🔍':'search','🧭':'compass','🎭':'masks','💬':'message','👤':'user','⚔':'swords','⚔️':'swords','🗡️':'swords','🗡':'swords','➕':'plus','✓':'check','💾':'check','✕':'x','❌':'x','←':'arrowLeft','⋮':'dots','➤':'send','✎':'edit','✏️':'edit','💎':'gem','🎁':'gift','👑':'crown','📺':'play','⚡':'zap','📌':'flag','🏅':'award','ℹ️':'info','🛡️':'shield','🔄':'refresh','⏸':'pause','⚠️':'alert','🖼️':'image','🗑':'trash','🗑️':'trash','🎨':'palette','🌐':'globe','⚙':'sliders','⚙️':'sliders','♂':'male','♀':'female','⏳':'hourglass','🔥':'flame','❤️':'heart','😶':'user','🌶️':'sparkles','✦':'sparkles','🔔':'bell','⭐':'star' };

  function svg(name, opts) {
    opts = opts || {};
    var inner = P[name] || P[EMOJI[name]] || '';
    var size = opts.size || 22;
    var sw = opts.stroke || 2;
    return '<svg class="ic ic-' + name + '" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  function swap(el) {
    if (el.dataset.iconDone) return;
    var name = el.getAttribute('data-icon');
    var size = parseInt(el.getAttribute('data-size'), 10) || (parseInt(getComputedStyle(el).fontSize, 10) || 22);
    var sw = parseFloat(el.getAttribute('data-stroke')) || 2;
    if (!P[name] && EMOJI[name]) name = EMOJI[name];
    if (!P[name]) return;
    el.innerHTML = svg(name, { size: size, stroke: sw });
    el.dataset.iconDone = '1';
    el.classList.add('icon');
  }

  function scan(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(swap);
    convertEmoji(root || document.body);
  }

  // Convert emoji → line icons inside any text node (incl. mixed labels like
  // "✎ Editar", "📌 Hitos", "💬 123") WITHOUT touching user content (chat
  // bubbles, inputs) or toasts. Surrounding text is preserved.
  var SKIP = '.bubble,.messages,.msg,.chat-input,.bubble-time,input,textarea,[contenteditable],.rw-toast,.toast,#toast,script,style';
  var EKEYS = Object.keys(EMOJI).sort(function (a, b) { return b.length - a.length; });
  var ERE = new RegExp('(' + EKEYS.map(function (e) {
    return e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('|') + ')', 'g');

  function convertEmoji(root) {
    if (!root || (root.nodeType !== 1 && root.nodeType !== 9)) return;
    if (root.nodeType === 1 && root.closest && root.closest(SKIP)) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !ERE.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (!p || p.dataset.iconDone || p.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], cur;
    while ((cur = walker.nextNode())) nodes.push(cur);
    nodes.forEach(function (n) {
      var text = n.nodeValue;
      ERE.lastIndex = 0;
      if (!ERE.test(text)) return;
      var sz = parseInt(getComputedStyle(n.parentElement).fontSize, 10) || 18;
      var frag = document.createDocumentFragment();
      var last = 0, m;
      ERE.lastIndex = 0;
      while ((m = ERE.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var span = document.createElement('span');
        span.className = 'icon';
        span.dataset.iconDone = '1';
        span.innerHTML = svg(EMOJI[m[0]], { size: sz });
        frag.appendChild(span);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
  }

  // expose
  window.STORYM = window.STORYM || {};
  window.STORYM.icon = svg;
  window.STORYM.iconNames = Object.keys(P);
  window.STORYM.scanIcons = scan;

  // initial + live
  if (document.readyState !== 'loading') scan();
  else document.addEventListener('DOMContentLoaded', function () { scan(); });
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      for (var j = 0; j < m.addedNodes.length; j++) {
        var n = m.addedNodes[j];
        if (n.nodeType !== 1) continue;
        if (n.hasAttribute && n.hasAttribute('data-icon')) swap(n);
        if (n.querySelectorAll) n.querySelectorAll('[data-icon]').forEach(swap);
        if (n.closest && !n.closest(SKIP)) convertEmoji(n);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
