/* SnapNote v3 — fiche terrain : projets, annotation photo (S Pen), matériel, dictée, PDF */
'use strict';
const APP_VERSION = '3.0.1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
const fmtDate = (t, time = true) => new Date(t).toLocaleString('fr-FR', time ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ================= Réglages ================= */
const DEF_SET = { fs: 1, width: 4, perPage: 2, dateTime: true, address: true, numbers: true, fingerDraw: false, symSize: 70, color: '#ff3b30', author: 'Raphaël Castellanos' };
const SET = (() => { try { return Object.assign({}, DEF_SET, JSON.parse(localStorage.getItem('sn3-settings') || '{}')); } catch { return { ...DEF_SET }; } })();
function saveSet() { try { localStorage.setItem('sn3-settings', JSON.stringify(SET)); } catch {} applySet(); }
function applySet() { document.documentElement.style.setProperty('--fs', [14, 16, 19, 23][SET.fs] + 'px'); }
applySet();

/* ================= Base de données ================= */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('snapnote3', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('projects', { keyPath: 'id' });
        d.createObjectStore('photos', { keyPath: 'id' }).createIndex('project', 'projectId');
        d.createObjectStore('icons', { keyPath: 'id' });
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  st(s, m = 'readonly') { return this.db.transaction(s, m).objectStore(s); },
  p(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  all(s) { return this.p(this.st(s).getAll()); },
  get(s, id) { return this.p(this.st(s).get(id)); },
  put(s, v) { return this.p(this.st(s, 'readwrite').put(v)); },
  del(s, id) { return this.p(this.st(s, 'readwrite').delete(id)); },
  photosOf(pid) { return this.p(this.st('photos').index('project').getAll(pid)).then(a => a.sort((x, y) => x.created - y.created)); }
};

/* ================= UI utilitaires ================= */
function toast(msg, ms = 2400) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
function busy(msg) {
  const b = document.createElement('div'); b.className = 'busy'; b.innerHTML = `<div>${esc(msg)}</div>`;
  document.body.appendChild(b);
  return { set: m => b.firstChild.textContent = m, done: () => b.remove() };
}
function modal(html, onMount) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="md">${html}</div>`;
  document.body.appendChild(ov);
  const close = () => { Dict.stop(); ov.remove(); };
  ov.addEventListener('pointerdown', e => { if (e.target === ov) close(); });
  onMount && onMount(ov.firstChild, close);
  return close;
}
function confirmBox(msg, ok = 'Supprimer') {
  return new Promise(res => {
    modal(`<h2>${esc(msg)}</h2><div class="foot"><button class="btn" data-a="0">Annuler</button><button class="btn p" data-a="1" style="background:var(--red)">${esc(ok)}</button></div>`,
      (m, close) => m.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (a) { close(); res(a.dataset.a === '1'); } }));
  });
}
function show(id) { $$('.view').forEach(v => v.classList.toggle('on', v.id === id)); }

/* ================= Symboles ================= */
const SYMIMG = {};
let ICONS = []; // icônes perso
function allSymbols() { return [...SYMBOLS, ...ICONS.map(c => ({ key: c.id, name: c.name, code: c.code, img: c.img, custom: true }))]; }
function symDef(key) { return allSymbols().find(s => s.key === key) || { key, name: 'Équipement', code: '?' }; }
function symUrl(def) { return def.custom ? def.img : symbolSvgUrl(def.svg); }
function loadSymImages() {
  return Promise.all(allSymbols().map(d => SYMIMG[d.key] ? null : new Promise(res => {
    const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = symUrl(d); SYMIMG[d.key] = im;
  })));
}

/* ================= Dictée vocale ================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const Dict = {
  rec: null, active: false, ta: null, btn: null, interim: null, last: null,
  supported: !!SR,
  mount(box) {
    const ta = $('#' + box.dataset.for);
    box.innerHTML = `<button class="btn sm mic">${ic('mic')}<span>Dicter</span></button>
      <button class="btn sm undo-d" disabled>${ic('undo')}Annuler la dictée</button>
      <button class="btn sm clr">${ic('trash')}Effacer</button>
      <div class="interim"></div>`;
    const mic = $('.mic', box), und = $('.undo-d', box);
    if (!this.supported) { mic.disabled = true; mic.lastChild.textContent = 'Dictée indispo'; }
    mic.onclick = () => this.toggle(ta, mic, $('.interim', box), und);
    und.onclick = () => this.undoLast(ta, und);
    $('.clr', box).onclick = async () => { if (!ta.value || await confirmBox('Effacer tout le texte ?', 'Effacer')) { ta.value = ''; ta.dispatchEvent(new Event('input')); } };
  },
  toggle(ta, btn, interim, und) {
    if (this.active && this.ta === ta) return this.stop();
    this.stop();
    this.ta = ta; this.btn = btn; this.interim = interim; this.undoBtn = und; this.active = true;
    btn.classList.add('rec'); btn.lastChild.textContent = 'Stop';
    this.start();
  },
  start() {
    const r = new SR(); this.rec = r;
    r.lang = 'fr-FR'; r.continuous = true; r.interimResults = true;
    r.onresult = e => {
      let tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) this.insert(res[0].transcript); else tmp += res[0].transcript;
      }
      if (this.interim) this.interim.textContent = tmp;
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { toast('Micro refusé : autorise-le dans Chrome'); this.stop(); }
      else if (e.error === 'network') { toast('Dictée : connexion nécessaire'); this.stop(); }
    };
    r.onend = () => { if (this.active && this.rec === r) { try { r.start(); } catch { this.stop(); } } };
    try { r.start(); } catch { this.stop(); }
  },
  stop() {
    this.active = false;
    if (this.rec) { const r = this.rec; this.rec = null; try { r.stop(); } catch {} }
    if (this.btn) { this.btn.classList.remove('rec'); this.btn.lastChild.textContent = 'Dicter'; }
    if (this.interim) this.interim.textContent = '';
  },
  clean(t) {
    t = ' ' + t.trim() + ' ';
    const rep = [[/\s+point à la ligne\s+/gi, '.\n'], [/\s+(à la ligne|nouvelle ligne)\s+/gi, '\n'], [/\s+virgule\s+/gi, ', '],
      [/\s+point d'interrogation\s+/gi, ' ? '], [/\s+point d'exclamation\s+/gi, ' ! '], [/\s+deux points\s+/gi, ' : '], [/\s+point final\s+/gi, '. ']];
    for (const [a, b] of rep) t = t.replace(a, b);
    return t.replace(/ +([,.])/g, '$1').replace(/\n +/g, '\n').trim();
  },
  insert(raw) {
    const ta = this.ta; if (!ta) return;
    let t = this.clean(raw); if (!t) return;
    const start = ta.selectionStart ?? ta.value.length, end = ta.selectionEnd ?? start;
    const before = ta.value.slice(0, start), after = ta.value.slice(end);
    const prev = before.trimEnd();
    if (!prev || /[.!?\n]$/.test(prev)) t = t[0].toUpperCase() + t.slice(1);
    if (before && !/[\s\n]$/.test(before) && !/^[,.]/.test(t)) t = ' ' + t;
    ta.value = before + t + after;
    const pos = before.length + t.length;
    ta.setSelectionRange(pos, pos);
    this.last = { ta, start: before.length, text: t };
    if (this.undoBtn) this.undoBtn.disabled = false;
    ta.dispatchEvent(new Event('input'));
  },
  undoLast(ta, btn) {
    const l = this.last;
    if (l && l.ta === ta && ta.value.substr(l.start, l.text.length) === l.text) {
      ta.value = ta.value.slice(0, l.start) + ta.value.slice(l.start + l.text.length);
      ta.setSelectionRange(l.start, l.start);
      ta.dispatchEvent(new Event('input'));
      toast('Dernière dictée retirée');
    } else toast('Rien à annuler');
    this.last = null; btn.disabled = true;
  }
};

/* ================= Géolocalisation → adresse ================= */
async function getAddress() {
  if (!navigator.geolocation || !navigator.onLine) return '';
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }));
    const { latitude: la, longitude: lo } = pos.coords;
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${lo}&accept-language=fr`);
    const j = await r.json(); const a = j.address || {};
    const street = [a.house_number, a.road].filter(Boolean).join(' ');
    const city = [a.postcode, a.city || a.town || a.village || a.municipality].filter(Boolean).join(' ');
    return [street, city].filter(Boolean).join(', ') || j.display_name || '';
  } catch { return ''; }
}

/* ================= Images ================= */
async function fileToPhoto(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const max = 2400, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
  return { blob, w, h, thumb: canvasThumb(c, 360) };
}
function canvasThumb(src, max) {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas'); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}
async function renderAnnotated(photo, maxDim, icons = true) {
  const bmp = await createImageBitmap(photo.blob);
  const k = Math.min(1, maxDim / Math.max(photo.w, photo.h));
  const c = document.createElement('canvas'); c.width = Math.round(photo.w * k); c.height = Math.round(photo.h * k);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.scale(k, k); x.drawImage(bmp, 0, 0, photo.w, photo.h); bmp.close && bmp.close();
  drawItems(x, (photo.items || []).filter(it => icons || it.type !== 'sym'), photo.w, photo.h, {});
  return c;
}
const blobToDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
const dataURLToBlob = async u => (await fetch(u)).blob();

/* ================= Dessin des éléments ================= */
function unitOf(W, H) { return Math.max(W, H) / 1000; }
function drawItems(ctx, items, W, H, o) {
  const u = unitOf(W, H);
  for (const it of items) {
    ctx.save();
    if (it.type === 'stroke') drawStroke(ctx, it, u);
    else if (it.type === 'arrow') drawArrow(ctx, it, u);
    else if (it.type === 'sym') drawSym(ctx, it, u);
    else if (it.type === 'text') drawText(ctx, it, u);
    ctx.restore();
    if (o.sel === it && it._bb) {
      const b = it._bb; ctx.save();
      ctx.strokeStyle = '#3d8bff'; ctx.lineWidth = 2.5 * u; ctx.setLineDash([8 * u, 6 * u]);
      ctx.strokeRect(b.x - 6 * u, b.y - 6 * u, b.w + 12 * u, b.h + 12 * u); ctx.restore();
    }
  }
}
function strokeW(it, p, u) { return it.w * u * (it.pen ? 0.35 + p * 1.3 : 1); }
function drawStroke(ctx, it, u) {
  const P = it.pts; if (!P.length) return;
  ctx.strokeStyle = ctx.fillStyle = it.color; ctx.lineCap = ctx.lineJoin = 'round';
  if (P.length === 1) { ctx.beginPath(); ctx.arc(P[0][0], P[0][1], strokeW(it, P[0][2], u) / 2, 0, 7); ctx.fill(); return; }
  if (!it.pen) { // largeur constante : un seul chemin lissé
    ctx.lineWidth = it.w * u; ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) { const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2; ctx.quadraticCurveTo(P[i][0], P[i][1], mx, my); }
    ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]); ctx.stroke(); return;
  }
  for (let i = 1; i < P.length; i++) { // stylet : largeur selon pression
    ctx.lineWidth = strokeW(it, (P[i - 1][2] + P[i][2]) / 2, u);
    ctx.beginPath(); ctx.moveTo(P[i - 1][0], P[i - 1][1]); ctx.lineTo(P[i][0], P[i][1]); ctx.stroke();
  }
}
function drawArrow(ctx, it, u) {
  const lw = it.w * u * 1.2, [x1, y1] = it.a, [x2, y2] = it.b;
  const ang = Math.atan2(y2 - y1, x2 - x1), hl = Math.max(lw * 4.5, 18 * u);
  ctx.strokeStyle = ctx.fillStyle = it.color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(ang) * hl * .6, y2 - Math.sin(ang) * hl * .6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hl * Math.cos(ang - .45), y2 - hl * Math.sin(ang - .45));
  ctx.lineTo(x2 - hl * Math.cos(ang + .45), y2 - hl * Math.sin(ang + .45)); ctx.closePath(); ctx.fill();
  it._bb = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawSym(ctx, it, u) {
  const s = it.s * u, x = it.x - s / 2, y = it.y - s / 2, def = symDef(it.key);
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = s * .12; ctx.shadowOffsetY = s * .04;
  ctx.fillStyle = 'rgba(255,255,255,.94)'; rr(ctx, x, y, s, s, s * .16); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#2b7bff'; ctx.lineWidth = Math.max(1.5, s * .035); ctx.stroke();
  const im = SYMIMG[it.key];
  if (im && im.complete && im.naturalWidth) {
    if (def.custom) { ctx.save(); rr(ctx, x + s * .07, y + s * .07, s * .86, s * .86, s * .1); ctx.clip(); ctx.drawImage(im, x + s * .07, y + s * .07, s * .86, s * .86); ctx.restore(); }
    else ctx.drawImage(im, x + s * .06, y + s * .06, s * .88, s * .88);
  }
  it._bb = { x, y, w: s, h: s };
  if (SET.numbers && it.n) {
    const label = def.code + it.n, fs = Math.max(10 * u, s * .27);
    ctx.font = `800 ${fs}px system-ui,sans-serif`;
    const tw = ctx.measureText(label).width + fs * .7, th = fs * 1.35;
    const bx = x + s - tw * .55, by = y - th * .45;
    ctx.fillStyle = '#1d6fe0'; rr(ctx, bx, by, tw, th, th / 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, fs * .1); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, bx + tw / 2, by + th / 2 + fs * .04);
  }
}
function drawText(ctx, it, u) {
  const fs = it.fs * u, lines = String(it.text).split('\n');
  ctx.font = `700 ${fs}px system-ui,sans-serif`; ctx.textBaseline = 'top';
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)), lh = fs * 1.22, pad = fs * .35;
  const h = lines.length * lh;
  ctx.fillStyle = it.color === '#ffffff' ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.88)';
  rr(ctx, it.x - pad, it.y - pad, w + pad * 2, h + pad * 2 - fs * .15, fs * .3); ctx.fill();
  ctx.fillStyle = it.color; lines.forEach((l, i) => ctx.fillText(l, it.x, it.y + i * lh));
  it._bb = { x: it.x - pad, y: it.y - pad, w: w + pad * 2, h: h + pad * 2 };
}

/* ================= ACCUEIL ================= */
let PROJECTS = [];
async function renderHome() {
  PROJECTS = (await DB.all('projects')).sort((a, b) => b.updated - a.updated);
  const q = $('#q').value.trim().toLowerCase();
  const list = PROJECTS.filter(p => !q || [p.name, p.client, p.site].join(' ').toLowerCase().includes(q));
  $('#plist').innerHTML = list.length ? list.map(p => `
    <button class="pcard glass" data-id="${p.id}">
      <div class="th" style="${p.cover ? `background-image:url(${p.cover})` : ''}">${p.cover ? '' : ic('camera')}</div>
      <div class="t"><b>${esc(p.name)}</b>
        <div class="mut">${esc([p.client, p.site].filter(Boolean).join(' · ') || 'Sans client')}</div>
        <span class="chip">${ic('image').replace('class="i"', 'class="i" style="width:14px;height:14px"')}${p.count || 0} photo${(p.count || 0) > 1 ? 's' : ''}</span>
        <span class="mut" style="margin-left:6px">${fmtDate(p.updated, false)}</span></div>
    </button>`).join('')
    : `<div class="empty glass" style="grid-column:1/-1">${q ? 'Aucun projet trouvé.' : 'Aucun projet pour l’instant.<br>Crée ton premier dossier avec <b>Nouveau projet</b>.'}</div>`;
}
$('#q').addEventListener('input', renderHome);
$('#plist').addEventListener('click', e => { const c = e.target.closest('.pcard'); if (c) openProject(c.dataset.id); });
$('#b-newproj').onclick = () => projectForm();
$('#b-settings').onclick = settingsModal;
$('#b-import').onclick = () => $('#f-snap').click();

function projectForm(p) {
  const isNew = !p; p = p || { name: '', client: '', site: '' };
  modal(`<h2>${isNew ? 'Nouveau projet' : 'Infos projet'}</h2>
    <div class="field"><label>Nom du projet *</label><input class="inp" id="pf-name" value="${esc(p.name)}" placeholder="ex. SDIS Le Thillot — contrôle d'accès"></div>
    <div class="field"><label>Client</label><input class="inp" id="pf-client" value="${esc(p.client)}"></div>
    <div class="field"><label>Site / adresse</label><div class="row" style="flex-wrap:nowrap"><input class="inp" id="pf-site" value="${esc(p.site)}"><button class="ib g" id="pf-loc" title="Me localiser">${ic('pin')}</button></div></div>
    <div class="foot"><button class="btn" data-x>Annuler</button><button class="btn p" id="pf-ok">${isNew ? 'Créer' : 'Enregistrer'}</button></div>`,
  (m, close) => {
    $('#pf-name', m).focus();
    $('[data-x]', m).onclick = close;
    $('#pf-loc', m).onclick = async () => { toast('Localisation…'); const a = await getAddress(); if (a) $('#pf-site', m).value = a; else toast('Adresse introuvable (réseau / GPS)'); };
    $('#pf-ok', m).onclick = async () => {
      const name = $('#pf-name', m).value.trim(); if (!name) { $('#pf-name', m).focus(); return; }
      Object.assign(p, { name, client: $('#pf-client', m).value.trim(), site: $('#pf-site', m).value.trim(), updated: Date.now() });
      if (isNew) Object.assign(p, { id: uid(), created: Date.now(), note: '', count: 0, cover: '' });
      await DB.put('projects', p); close();
      if (isNew) openProject(p.id); else { renderProjectHead(); renderHome(); }
    };
  });
}

/* ================= PROJET ================= */
let PRJ = null, PHOTOS = [];
async function openProject(id) {
  PRJ = await DB.get('projects', id); if (!PRJ) return;
  PHOTOS = await DB.photosOf(id);
  renderProjectHead(); renderPhotos(); renderMat();
  $('#p-note').value = PRJ.note || '';
  $('#x-mat').checked = PRJ.exportMat !== false;
  $('#x-icons').checked = PRJ.exportIcons !== false;
  show('project');
}
function renderProjectHead() {
  $('#p-title').textContent = PRJ.name;
  $('#p-sub').textContent = [PRJ.client, PRJ.site, 'créé le ' + fmtDate(PRJ.created, false)].filter(Boolean).join(' · ');
}
function renderPhotos() {
  $('#pgrid').innerHTML = PHOTOS.length ? PHOTOS.map((ph, i) => `
    <div class="ph" data-id="${ph.id}" style="background-image:url(${ph.thumb})">
      <span class="n">${i + 1}</span><button class="x" data-del="${ph.id}" title="Supprimer">${ic('trash')}</button>
      ${ph.note ? `<div class="nt">${esc(ph.note)}</div>` : ''}</div>`).join('')
    : `<div class="empty glass" style="grid-column:1/-1">Pas encore de photo.<br>Utilise <b>Photo</b> ou <b>Galerie</b>.</div>`;
}
function countMat(photos) {
  const m = {};
  for (const ph of photos) for (const it of ph.items || []) if (it.type === 'sym') m[it.key] = (m[it.key] || 0) + 1;
  return m;
}
function renderMat() {
  const m = countMat(PHOTOS), keys = Object.keys(m);
  $('#p-mat').innerHTML = keys.length ? keys.map(k => { const d = symDef(k); return `<div class="mat"><img src="${symUrl(d)}" alt=""><div>${esc(d.name)}<div class="mut">repère ${esc(d.code)}</div></div><span class="c">${m[k]}</span></div>`; }).join('')
    : '<p class="mut" style="margin:0">Pose des équipements sur tes photos : le décompte se fait tout seul ici et dans le PDF.</p>';
}
async function touchProject() {
  PRJ.updated = Date.now(); PRJ.count = PHOTOS.length;
  PRJ.cover = PHOTOS.length ? PHOTOS[PHOTOS.length - 1].thumb : '';
  await DB.put('projects', PRJ);
}
$('#b-back-home').onclick = () => { Dict.stop(); PRJ = null; renderHome(); show('home'); };
$('#b-pedit').onclick = () => projectForm(PRJ);
let noteT = null;
$('#p-note').addEventListener('input', () => { clearTimeout(noteT); noteT = setTimeout(async () => { if (!PRJ) return; PRJ.note = $('#p-note').value; await touchProject(); }, 500); });
$('#b-cam').onclick = () => $('#f-cam').click();
$('#b-gal').onclick = () => $('#f-gal').click();
$('#f-cam').onchange = e => addPhotos(e.target.files, true);
$('#f-gal').onchange = e => addPhotos(e.target.files, false);
async function addPhotos(files, openAfter) {
  files = [...(files || [])]; if (!files.length || !PRJ) return;
  const b = busy('Import des photos…');
  let addrP = SET.address ? getAddress() : Promise.resolve('');
  let last = null;
  try {
    for (let i = 0; i < files.length; i++) {
      b.set(`Import ${i + 1}/${files.length}…`);
      const r = await fileToPhoto(files[i]);
      const ph = { id: uid(), projectId: PRJ.id, created: Date.now() + i, takenAt: files[i].lastModified || Date.now(), ...r, items: [], note: '', address: '' };
      await DB.put('photos', ph); PHOTOS.push(ph); last = ph;
    }
    await touchProject();
  } catch (err) { toast('Erreur import : ' + err.message); }
  b.done(); $('#f-cam').value = ''; $('#f-gal').value = '';
  renderPhotos(); renderMat();
  addrP.then(async a => { if (!a) return; for (const ph of PHOTOS) if (!ph.address && Date.now() - ph.created < 120000) { ph.address = a; await DB.put('photos', ph); } if (PRJ && !PRJ.site) { PRJ.site = a; await DB.put('projects', PRJ); renderProjectHead(); } });
  if (openAfter && last) openEditor(last.id);
}
$('#pgrid').addEventListener('click', async e => {
  const d = e.target.closest('[data-del]');
  if (d) {
    e.stopPropagation();
    if (!await confirmBox('Supprimer cette photo et ses annotations ?')) return;
    await DB.del('photos', d.dataset.del); PHOTOS = PHOTOS.filter(p => p.id !== d.dataset.del);
    await touchProject(); renderPhotos(); renderMat(); return;
  }
  const c = e.target.closest('.ph'); if (c) openEditor(c.dataset.id);
});
$('#b-pdel').onclick = async () => {
  if (!await confirmBox(`Supprimer le projet « ${PRJ.name} » et ses ${PHOTOS.length} photos ?`)) return;
  for (const ph of PHOTOS) await DB.del('photos', ph.id);
  await DB.del('projects', PRJ.id); PRJ = null; renderHome(); show('home'); toast('Projet supprimé');
};

/* ================= ÉDITEUR ================= */
const cv = $('#cv'), ctx = cv.getContext('2d'), stage = $('#stage');
const COLORS = ['#ff3b30', '#ffcc00', '#2b7bff', '#2fd27a', '#ffffff', '#111111'];
const E = { ph: null, img: null, items: [], undo: [], redo: [], tool: 'pen', sym: 'lecteur', view: { s: 1, tx: 0, ty: 0 }, fit: 1, sel: null, penSeen: false, act: null, dirty: false };
const ptrs = new Map();

$('#swatches').innerHTML = COLORS.map(c => `<button class="sw" data-c="${c}" style="background:${c}" title="Couleur"></button>`).join('');
$('#swatches').addEventListener('click', e => { const b = e.target.closest('.sw'); if (!b) return; SET.color = b.dataset.c; saveSet(); markColor(); if (E.sel && 'color' in E.sel) { pushUndo(); E.sel.color = SET.color; changed(); } });
function markColor() { $$('.sw').forEach(s => s.classList.toggle('on', s.dataset.c === SET.color)); }
$('#e-width').oninput = e => { SET.width = +e.target.value; saveSet(); };

function renderSymPalette() {
  $('#syms').innerHTML = allSymbols().map(d => `<button class="sym ${d.key === E.sym ? 'on' : ''}" data-k="${d.key}"><img src="${symUrl(d)}" alt="">${esc(d.name)}</button>`).join('')
    + `<button class="sym" id="sym-add"><div style="width:52px;height:52px;display:grid;place-items:center;border:2px dashed var(--line);border-radius:10px">${ic('plus')}</div>Ajouter (photo)</button>`;
}
$('#syms').addEventListener('click', e => {
  if (e.target.closest('#sym-add')) return addCustomIcon();
  const b = e.target.closest('.sym'); if (!b) return;
  E.sym = b.dataset.k; renderSymPalette(); setTool('sym');
  if (innerWidth < 700) $('#ed-side').classList.remove('open');
  toast('Touche la photo pour poser : ' + symDef(E.sym).name, 1600);
});
$$('#ed-side .tabs button').forEach(b => b.onclick = () => sidePane(b.dataset.pane));
function sidePane(p) { $$('#ed-side .tabs button').forEach(x => x.classList.toggle('on', x.dataset.pane === p)); $$('#ed-side .pane').forEach(x => x.classList.toggle('on', x.id === 'pane-' + p)); }
$('#e-notebtn').onclick = () => { const s = $('#ed-side'); const open = !(s.classList.contains('open') && $('#pane-enote').classList.contains('on')); s.classList.toggle('open', open); sidePane('enote'); };

function setTool(t) {
  E.tool = t; E.sel = t === 'move' ? E.sel : null;
  $$('#ed-tools [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  if (t === 'sym' && innerWidth < 700) { $('#ed-side').classList.add('open'); sidePane('syms'); }
  else if (innerWidth < 700 && t !== 'sym') $('#ed-side').classList.remove('open');
  updSelbar(); draw();
}
$('#ed-tools').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) setTool(b.dataset.tool); });

async function openEditor(id) {
  const ph = PHOTOS.find(p => p.id === id); if (!ph) return;
  E.ph = ph; E.items = JSON.parse(JSON.stringify(ph.items || [])); E.undo = []; E.redo = []; E.sel = null; E.dirty = false;
  E.img = await createImageBitmap(ph.blob);
  $('#e-title').textContent = `Photo ${PHOTOS.indexOf(ph) + 1}/${PHOTOS.length} · ${PRJ.name}`;
  $('#e-note').value = ph.note || '';
  $('#e-width').value = SET.width; markColor(); renderSymPalette();
  $('#ed-side').classList.remove('open'); sidePane('syms');
  show('editor'); setTool(E.tool === 'move' || E.tool === 'eraser' ? 'pen' : E.tool);
  requestAnimationFrame(() => { resize(); fitView(); });
}
async function closeEditor() {
  Dict.stop();
  await saveEditor(true);
  E.img && E.img.close && E.img.close(); E.img = null; E.ph = null;
  renderPhotos(); renderMat(); show('project');
}
$('#e-back').onclick = closeEditor;
let saveT = null;
function changed() { E.dirty = true; draw(); updSelbar(); clearTimeout(saveT); saveT = setTimeout(() => saveEditor(false), 700); }
async function saveEditor(withThumb) {
  clearTimeout(saveT); const ph = E.ph; if (!ph) return;
  ph.items = cleanItems(E.items); ph.note = $('#e-note').value;
  if (withThumb && E.dirty) { const c = await renderAnnotated(ph, 720); ph.thumb = canvasThumb(c, 360); }
  await DB.put('photos', ph);
  if (withThumb) { E.dirty = false; await touchProject(); }
}
function cleanItems(items) { return JSON.parse(JSON.stringify(items, (k, v) => k.startsWith('_') ? undefined : v)); }
$('#e-note').addEventListener('input', () => { E.dirty = true; clearTimeout(saveT); saveT = setTimeout(() => saveEditor(false), 600); });

function pushUndo() { E.undo.push(JSON.stringify(cleanItems(E.items))); if (E.undo.length > 80) E.undo.shift(); E.redo = []; }
function restore(json) { E.items = JSON.parse(json); E.sel = null; changed(); }
$('#e-undo').onclick = () => { if (!E.undo.length) return; E.redo.push(JSON.stringify(cleanItems(E.items))); restore(E.undo.pop()); };
$('#e-redo').onclick = () => { if (!E.redo.length) return; E.undo.push(JSON.stringify(cleanItems(E.items))); restore(E.redo.pop()); };
$('#e-fit').onclick = () => fitView();

/* --- vue / rendu --- */
let dpr = 1, rafId = 0;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  const r = stage.getBoundingClientRect();
  cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
  draw();
}
function fitView() {
  if (!E.ph) return;
  const r = stage.getBoundingClientRect();
  const s = Math.min(r.width / E.ph.w, r.height / E.ph.h) * 0.97;
  E.fit = s; E.view = { s, tx: (r.width - E.ph.w * s) / 2, ty: (r.height - E.ph.h * s) / 2 };
  draw();
}
new ResizeObserver(() => { if (E.ph) { const wasFit = Math.abs(E.view.s - E.fit) < 1e-6; resize(); if (wasFit) fitView(); } }).observe(stage);
function draw() { if (rafId) return; rafId = requestAnimationFrame(() => { rafId = 0; paint(); }); }
function paint() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  if (!E.img) return;
  const v = E.view; ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.tx, dpr * v.ty);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(E.img, 0, 0, E.ph.w, E.ph.h);
  drawItems(ctx, E.items, E.ph.w, E.ph.h, { sel: E.sel });
  updSelbar();
}
function toImg(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - E.view.tx) / E.view.s, (e.clientY - r.top - E.view.ty) / E.view.s]; }
function toScr(x, y) { return [x * E.view.s + E.view.tx, y * E.view.s + E.view.ty]; }

/* --- sélection --- */
function distSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  let t = l ? ((px - a[0]) * dx + (py - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}
function hit(x, y, strokesToo = true) {
  const tol = 14 / E.view.s, u = unitOf(E.ph.w, E.ph.h);
  for (let i = E.items.length - 1; i >= 0; i--) {
    const it = E.items[i];
    if ((it.type === 'sym' || it.type === 'text') && it._bb) { const b = it._bb; if (x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol) return it; }
    if (!strokesToo) continue;
    if (it.type === 'arrow' && distSeg(x, y, it.a, it.b) < tol + it.w * u) return it;
    if (it.type === 'stroke') {
      const P = it.pts, lim = tol + it.w * u;
      if (P.length === 1 && Math.hypot(x - P[0][0], y - P[0][1]) < lim) return it;
      for (let k = 1; k < P.length; k++) if (distSeg(x, y, P[k - 1], P[k]) < lim) return it;
    }
  }
  return null;
}
function updSelbar() {
  const sb = $('#selbar'), it = E.sel;
  if (!it || E.tool !== 'move' || !it._bb || E.act) { sb.style.display = 'none'; return; }
  const b = it._bb, [sx, sy] = toScr(b.x + b.w / 2, b.y);
  const sizeable = it.type === 'sym' || it.type === 'text';
  sb.innerHTML = (sizeable ? `<button class="ib" data-a="minus">${ic('minus')}</button><button class="ib" data-a="plus">${ic('plus')}</button>` : '')
    + (it.type === 'text' ? `<button class="ib" data-a="edit">${ic('edit')}</button>` : '')
    + (it.type === 'sym' ? `<button class="ib" data-a="num" title="Renuméroter">#</button>` : '')
    + `<button class="ib" data-a="del" style="color:#ff8a8d">${ic('trash')}</button>`;
  const r = stage.getBoundingClientRect();
  sb.style.display = 'flex';
  sb.style.left = Math.max(110, Math.min(r.width - 110, sx)) + 'px';
  sb.style.top = Math.max(56, sy - 14) + 'px';
}
$('#selbar').addEventListener('pointerdown', e => e.stopPropagation());
$('#selbar').addEventListener('click', async e => {
  const a = e.target.closest('[data-a]')?.dataset.a, it = E.sel; if (!a || !it) return;
  if (a === 'del') { pushUndo(); E.items = E.items.filter(x => x !== it); E.sel = null; }
  else if (a === 'plus' || a === 'minus') { pushUndo(); const k = a === 'plus' ? 1.2 : 1 / 1.2; if (it.type === 'sym') it.s = Math.max(25, Math.min(400, it.s * k)); else it.fs = Math.max(12, Math.min(300, it.fs * k)); if (it.type === 'sym') { SET.symSize = it.s; saveSet(); } }
  else if (a === 'edit') { textModal(it.text, t => { pushUndo(); if (t) it.text = t; else { E.items = E.items.filter(x => x !== it); E.sel = null; } changed(); }); return; }
  else if (a === 'num') { const v = prompt('Numéro du repère ' + symDef(it.key).code, it.n); if (v !== null && +v > 0) { pushUndo(); it.n = Math.round(+v); } }
  changed();
});

/* --- numérotation par projet --- */
function nextNum(key) {
  let m = 0;
  for (const ph of PHOTOS) { const items = ph === E.ph ? E.items : ph.items || []; for (const it of items) if (it.type === 'sym' && it.key === key) m = Math.max(m, it.n || 0); }
  return m + 1;
}

/* --- pointeurs : stylet = dessin, doigts = zoom/déplacement --- */
function isDrawPtr(e) {
  if (e.pointerType === 'pen' || e.pointerType === 'mouse') return true;
  return !E.penSeen || SET.fingerDraw;
}
cv.addEventListener('pointerdown', e => {
  if (!E.ph) return;
  e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {}
  if (e.pointerType === 'pen' && !E.penSeen) { E.penSeen = true; const h = $('#penhint'); h.style.display = 'block'; setTimeout(() => h.style.display = 'none', 3200); }
  // rejet de paume : pendant un geste au stylet, les contacts du doigt/paume sont ignorés
  if (e.pointerType === 'touch' && E.act && E.act.ptype === 'pen') return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
  // le stylet reprend la main sur un zoom/déplacement au doigt (paume posée avant d'écrire)
  if (e.pointerType === 'pen' && E.act && E.act.ptype === 'touch') E.act = null;
  const touches = [...ptrs.entries()].filter(([, p]) => p.type === 'touch');
  if (e.pointerType === 'touch' && touches.length >= 2) { cancelAct(); startPinch(touches); E.act.ptype = 'touch'; return; }
  if (E.act && E.act.kind === 'pinch') return;
  if (e.pointerType === 'mouse' && e.button !== 0) startPan(e);
  else if (!isDrawPtr(e)) startPan(e);
  else { const eraserBtn = e.pointerType === 'pen' && (e.buttons & 32 || e.button === 5); startTool(eraserBtn ? 'eraser' : E.tool, e); }
  if (E.act) E.act.ptype = e.pointerType;
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.get(e.pointerId).x = e.clientX; ptrs.get(e.pointerId).y = e.clientY;
  const a = E.act; if (!a) return;
  if (a.kind === 'pinch') return movePinch();
  if (a.id !== e.pointerId) return;
  if (a.kind === 'pan') { E.view.tx = a.tx + e.clientX - a.x; E.view.ty = a.ty + e.clientY - a.y; draw(); return; }
  if (a.kind === 'stroke') {
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      const [x, y] = toImg(ev), last = a.it.pts[a.it.pts.length - 1];
      if (Math.hypot(x - last[0], y - last[1]) * E.view.s < 1.2) continue;
      a.it.pts.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, ev.pointerType === 'pen' ? +(ev.pressure || .5).toFixed(2) : .5]);
    }
    draw(); return;
  }
  const [x, y] = toImg(e);
  if (a.kind === 'arrow') { a.it.b = [x, y]; draw(); }
  else if (a.kind === 'drag') { const dx = x - a.x, dy = y - a.y; a.x = x; a.y = y; moveItem(a.it, dx, dy); a.moved = true; draw(); }
  else if (a.kind === 'erase') { eraseAt(x, y); }
});
const endPtr = e => {
  ptrs.delete(e.pointerId);
  const a = E.act; if (!a) return;
  if (a.kind === 'pinch') { if ([...ptrs.values()].filter(p => p.type === 'touch').length < 2) E.act = null; return; }
  if (a.id !== e.pointerId) return;
  E.act = null;
  if (a.kind === 'stroke') changed();
  else if (a.kind === 'arrow') { if (Math.hypot(a.it.b[0] - a.it.a[0], a.it.b[1] - a.it.a[1]) * E.view.s < 8) { E.items.pop(); E.undo.pop(); draw(); } else changed(); }
  else if (a.kind === 'drag') { if (a.moved || a.isNew) changed(); else { E.undo.pop(); draw(); updSelbar(); } }
  else if (a.kind === 'erase') { if (a.did) changed(); else E.undo.pop(); }
  else if (a.kind === 'text') { const [x, y] = a.p; textModal('', t => { if (!t) return; pushUndo(); E.items.push({ type: 'text', x, y, text: t, color: SET.color, fs: 34 }); changed(); }); }
  else updSelbar();
};
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', e => { if (E.act && E.act.kind === 'stroke' && E.act.id === e.pointerId) { cancelAct(); } endPtr(e); });
cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());

function startTool(tool, e) {
  const [x, y] = toImg(e);
  if (tool === 'pen') {
    pushUndo();
    const it = { type: 'stroke', color: SET.color, w: SET.width, pen: e.pointerType === 'pen', pts: [[x, y, e.pointerType === 'pen' ? +(e.pressure || .5).toFixed(2) : .5]] };
    E.items.push(it); E.act = { kind: 'stroke', id: e.pointerId, it }; draw();
  } else if (tool === 'arrow') {
    pushUndo(); const it = { type: 'arrow', color: SET.color, w: SET.width, a: [x, y], b: [x, y] };
    E.items.push(it); E.act = { kind: 'arrow', id: e.pointerId, it };
  } else if (tool === 'sym') {
    const ex = hit(x, y, false);
    if (ex && ex.type === 'sym') { pushUndo(); E.act = { kind: 'drag', id: e.pointerId, it: ex, x, y }; return; }
    pushUndo(); const it = { type: 'sym', key: E.sym, x, y, s: SET.symSize, n: nextNum(E.sym) };
    E.items.push(it); E.act = { kind: 'drag', id: e.pointerId, it, x, y, isNew: true }; draw();
  } else if (tool === 'text') {
    const ex = hit(x, y, false);
    if (ex && ex.type === 'text') { setTool('move'); E.sel = ex; textModal(ex.text, t => { pushUndo(); if (t) ex.text = t; else E.items = E.items.filter(i => i !== ex); E.sel = null; changed(); }); return; }
    E.act = { kind: 'text', id: e.pointerId, p: [x, y] };
  } else if (tool === 'move') {
    const it = hit(x, y, true); E.sel = it;
    if (it) { pushUndo(); E.act = { kind: 'drag', id: e.pointerId, it, x, y }; draw(); }
    else startPan(e);
  } else if (tool === 'eraser') {
    pushUndo(); E.act = { kind: 'erase', id: e.pointerId, did: false }; eraseAt(x, y);
  }
}
function moveItem(it, dx, dy) {
  if (it.type === 'stroke') it.pts.forEach(p => { p[0] += dx; p[1] += dy; });
  else if (it.type === 'arrow') { it.a[0] += dx; it.a[1] += dy; it.b[0] += dx; it.b[1] += dy; }
  else { it.x += dx; it.y += dy; }
}
function eraseAt(x, y) { const it = hit(x, y, true); if (it) { E.items = E.items.filter(i => i !== it); if (E.sel === it) E.sel = null; E.act.did = true; draw(); } }
function cancelAct() {
  const a = E.act; if (!a) return;
  if (a.kind === 'stroke' || a.kind === 'arrow' || (a.kind === 'drag' && a.isNew)) { E.items = E.items.filter(i => i !== a.it); E.undo.pop(); }
  else if (a.kind === 'drag' || a.kind === 'erase') { if (a.did || a.moved) { E.items = JSON.parse(E.undo.pop()); E.sel = null; } else E.undo.pop(); }
  E.act = null; draw();
}
function startPan(e) { E.act = { kind: 'pan', id: e.pointerId, x: e.clientX, y: e.clientY, tx: E.view.tx, ty: E.view.ty }; }
function startPinch(t) {
  const [a, b] = t.slice(-2).map(([, p]) => p), r = cv.getBoundingClientRect();
  E.act = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, c0: [(a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top], v0: { ...E.view }, ids: t.slice(-2).map(([id]) => id) };
}
function movePinch() {
  const a = E.act, P = a.ids.map(id => ptrs.get(id)); if (P.some(p => !p)) return;
  const r = cv.getBoundingClientRect(), d = Math.hypot(P[0].x - P[1].x, P[0].y - P[1].y);
  const c = [(P[0].x + P[1].x) / 2 - r.left, (P[0].y + P[1].y) / 2 - r.top];
  const s = Math.max(E.fit * 0.5, Math.min(E.fit * 10, a.v0.s * d / a.d0));
  const ix = (a.c0[0] - a.v0.tx) / a.v0.s, iy = (a.c0[1] - a.v0.ty) / a.v0.s;
  E.view = { s, tx: c[0] - ix * s, ty: c[1] - iy * s }; draw();
}
function zoomAt(sx, sy, k) {
  const v = E.view, s = Math.max(E.fit * 0.5, Math.min(E.fit * 10, v.s * k));
  const ix = (sx - v.tx) / v.s, iy = (sy - v.ty) / v.s;
  E.view = { s, tx: sx - ix * s, ty: sy - iy * s }; draw();
}

/* --- texte sur photo (avec dictée) --- */
function textModal(init, cb) {
  modal(`<h2>Texte sur la photo</h2><textarea class="inp" id="tm-t" style="min-height:110px">${esc(init)}</textarea><div class="dict" data-for="tm-t"></div>
    <div class="foot"><button class="btn" data-x>Annuler</button><button class="btn p" id="tm-ok">${ic('check')}Valider</button></div>`, (m, close) => {
    Dict.mount($('.dict', m)); const ta = $('#tm-t', m); ta.focus();
    $('[data-x]', m).onclick = close;
    $('#tm-ok', m).onclick = () => { const v = ta.value.trim(); close(); cb(v); };
  });
}

/* --- icône perso depuis une photo du produit --- */
function addCustomIcon() { $('#f-icon').click(); }
$('#f-icon').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' });
  const side = Math.min(bmp.width, bmp.height), c = document.createElement('canvas'); c.width = c.height = 256;
  c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  const img = c.toDataURL('image/jpeg', .85);
  modal(`<h2>Nouvelle icône matériel</h2><div class="row" style="margin-bottom:12px"><img src="${img}" style="width:90px;height:90px;border-radius:14px"><p class="mut" style="flex:1;margin:0">Cadre le produit au centre de la photo : l'icône est un carré recadré au milieu.</p></div>
    <div class="field"><label>Nom</label><input class="inp" id="ci-n" placeholder="ex. Caméra dôme"></div>
    <div class="field"><label>Repère (2-3 lettres)</label><input class="inp" id="ci-c" maxlength="4" placeholder="ex. CAM"></div>
    <div class="foot"><button class="btn" data-x>Annuler</button><button class="btn p" id="ci-ok">Ajouter</button></div>`, (m, close) => {
    $('[data-x]', m).onclick = close;
    $('#ci-ok', m).onclick = async () => {
      const name = $('#ci-n', m).value.trim(), code = $('#ci-c', m).value.trim().toUpperCase();
      if (!name || !code) return toast('Nom et repère obligatoires');
      const icn = { id: 'c_' + uid(), name, code, img }; await DB.put('icons', icn); ICONS.push(icn);
      await loadSymImages(); E.sym = icn.id; renderSymPalette(); close(); toast('Icône ajoutée');
    };
  });
};

/* ================= EXPORT PDF ================= */
async function jpegBytes(canvas, q = .82) { const b = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q)); return new Uint8Array(await b.arrayBuffer()); }
async function symJpeg(key) {
  const c = document.createElement('canvas'); c.width = c.height = 120; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 120, 120); const im = SYMIMG[key];
  if (im && im.naturalWidth) x.drawImage(im, 6, 6, 108, 108);
  return jpegBytes(c, .9);
}
async function buildPDF(project, photos) {
  const D = new SnapPDF.Doc(), M = 36, CW = D.W - M * 2, BLUE = [24, 86, 214], DARK = [20, 28, 46], GREY = [96, 106, 124];
  const fsNote = [9, 10, 11.5, 13][SET.fs];
  // --- page de garde
  D.addPage();
  D.rect(0, 0, D.W, 96, { fill: [10, 30, 82] }); D.rect(0, 96, D.W, 4, { fill: BLUE });
  D.text('FICHE TERRAIN', M, 40, { size: 11, bold: true, color: [140, 180, 255] });
  const tl = D.wrap(project.name, CW, 22, true).slice(0, 2);
  tl.forEach((l, i) => D.text(l, M, 66 + i * 24, { size: 22, bold: true, color: [255, 255, 255] }));
  let y = 130;
  const info = [['Client', project.client], ['Site', project.site], ['Date', fmtDate(Date.now())], ['Photos', String(photos.length)], ['Rédigé par', SET.author]].filter(r => r[1]);
  for (const [k, v] of info) { D.text(k, M, y, { size: 10, bold: true, color: GREY }); D.wrap(v, CW - 90, 11).slice(0, 2).forEach((l, i) => D.text(l, M + 90, y + i * 14, { size: 11, color: DARK })); y += v.length > 70 ? 32 : 20; }
  const newPageIfNeeded = need => { if (y + need > D.H - 50) { D.addPage(); y = 50; } };
  if (project.note) {
    y += 12; D.text('Note projet', M, y, { size: 13, bold: true, color: BLUE }); y += 8; D.line(M, y, M + CW, y, { color: [200, 210, 230] }); y += 16;
    for (const l of D.wrap(project.note, CW, fsNote + 1)) { newPageIfNeeded(16); D.text(l, M, y, { size: fsNote + 1, color: DARK }); y += (fsNote + 1) * 1.4; }
  }
  const withMat = project.exportMat !== false, withIcons = project.exportIcons !== false;
  const mat = countMat(photos), keys = Object.keys(mat);
  if (withMat && keys.length) {
    y += 16; newPageIfNeeded(60);
    D.text('Matériel relevé', M, y, { size: 13, bold: true, color: BLUE }); y += 8; D.line(M, y, M + CW, y, { color: [200, 210, 230] }); y += 8;
    let total = 0;
    for (const k of keys) {
      newPageIfNeeded(34); const d = symDef(k); total += mat[k];
      D.image(await symJpeg(k), 120, 120, M, y, 26, 26);
      D.text(d.name, M + 36, y + 17, { size: 11, color: DARK });
      D.text('repère ' + d.code, M + 260, y + 17, { size: 9, color: GREY });
      D.text(String(mat[k]), M + CW, y + 18, { size: 14, bold: true, color: BLUE, align: 'right' });
      y += 32; D.line(M, y - 3, M + CW, y - 3, { color: [230, 234, 242] });
    }
    D.text('Total équipements : ' + total, M + CW, y + 12, { size: 10, bold: true, color: GREY, align: 'right' });
  }
  // --- photos
  const per = SET.perPage, cols = per === 4 ? 2 : 1, rows = per === 1 ? 1 : 2;
  const top = 46, bottom = D.H - 40, gap = 16;
  const cellW = (CW - (cols - 1) * gap) / cols, cellH = (bottom - top - (rows - 1) * gap) / rows;
  const noteLines = per === 1 ? 12 : per === 2 ? 5 : 4, capH = 16 + noteLines * fsNote * 1.35;
  const maxDim = per === 1 ? 2000 : per === 2 ? 1500 : 1000;
  for (let i = 0; i < photos.length; i++) {
    const ph = photos[i], slot = i % per;
    if (slot === 0) { D.addPage(); D.text(project.name, M, 30, { size: 9, bold: true, color: GREY }); D.line(M, 36, M + CW, 36, { color: [220, 226, 236] }); }
    const cx = M + (slot % cols) * (cellW + gap), cy = top + Math.floor(slot / cols) * (cellH + gap);
    const c = await renderAnnotated(ph, maxDim, withIcons);
    const boxH = cellH - capH, k = Math.min(cellW / c.width, boxH / c.height);
    const w = c.width * k, h = c.height * k;
    D.image(await jpegBytes(c), c.width, c.height, cx + (cellW - w) / 2, cy, w, h);
    D.rect(cx + (cellW - w) / 2, cy, w, h, { stroke: [210, 216, 228], lw: .6 });
    let ty = cy + h + 14;
    const meta = [SET.dateTime ? fmtDate(ph.takenAt || ph.created) : '', SET.address ? ph.address : ''].filter(Boolean).join(' — ');
    D.text('Photo ' + (i + 1), cx, ty, { size: 10.5, bold: true, color: BLUE });
    if (meta) D.text(D.wrap(meta, cellW - 60, 8.5)[0], cx + 52, ty, { size: 8.5, color: GREY });
    ty += fsNote * 1.45;
    const nl = D.wrap(ph.note || '', cellW, fsNote);
    nl.slice(0, noteLines).forEach((l, j) => D.text(j === noteLines - 1 && nl.length > noteLines ? l + ' …' : l, cx, ty + j * fsNote * 1.35, { size: fsNote, color: DARK }));
  }
  // --- pieds de page
  const N = D.pages.length;
  for (let i = 0; i < N; i++) { D.setPage(i); D.text(`SnapNote — ${project.name}`, M, D.H - 18, { size: 7.5, color: [150, 158, 172] }); D.text(`${i + 1}/${N}`, D.W - M, D.H - 18, { size: 7.5, color: [150, 158, 172], align: 'right' }); }
  return D.output();
}
const safeName = s => (s || 'projet').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'projet';
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function shareOrDownload(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  download(blob, name);
}
async function exportPDF(share) {
  if (!PHOTOS.length && !PRJ.note) return toast('Rien à exporter pour l’instant');
  const b = busy('Création du PDF…');
  try {
    const pdf = await buildPDF(PRJ, PHOTOS);
    b.done();
    const name = `${safeName(PRJ.name)}_${new Date().toISOString().slice(0, 10)}.pdf`;
    share ? await shareOrDownload(pdf, name, PRJ.name) : download(pdf, name);
  } catch (e) { b.done(); toast('Erreur PDF : ' + e.message, 4000); console.error(e); }
}
$('#b-pdf').onclick = () => exportPDF(true);
for (const [sel, key] of [['#x-mat', 'exportMat'], ['#x-icons', 'exportIcons']]) {
  $(sel).onchange = async e => { PRJ[key] = e.target.checked; await DB.put('projects', PRJ); toast(e.target.checked ? 'Inclus dans le PDF' : 'Retiré du PDF', 1400); };
}
$('#b-pdfdl').onclick = () => exportPDF(false);

/* ================= SAUVEGARDE .snap (passage téléphone ⇄ tablette) ================= */
async function snapOf(projects) {
  const out = { app: 'SnapNote', v: 3, exported: Date.now(), projects: [], icons: [] };
  const iconIds = new Set();
  for (const p of projects) {
    const photos = await DB.photosOf(p.id), ph2 = [];
    for (const ph of photos) { const { blob, ...rest } = ph; ph2.push({ ...rest, image: await blobToDataURL(blob) }); (ph.items || []).forEach(it => it.type === 'sym' && it.key.startsWith('c_') && iconIds.add(it.key)); }
    out.projects.push({ project: p, photos: ph2 });
  }
  out.icons = ICONS.filter(i => iconIds.has(i.id));
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}
$('#b-snap').onclick = async () => {
  const b = busy('Préparation de la sauvegarde…');
  try { const blob = await snapOf([PRJ]); b.done(); await shareOrDownload(blob, `${safeName(PRJ.name)}.snap`, PRJ.name); }
  catch (e) { b.done(); toast('Erreur : ' + e.message); }
};
$('#f-snap').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const b = busy('Import…');
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== 'SnapNote' || !Array.isArray(j.projects)) throw new Error('fichier non reconnu');
    for (const icn of j.icons || []) if (!ICONS.find(i => i.id === icn.id)) { await DB.put('icons', icn); ICONS.push(icn); }
    let n = 0;
    for (const { project, photos } of j.projects) {
      const exists = await DB.get('projects', project.id);
      if (exists && exists.updated > project.updated) { b.done(); const ok = await confirmBox(`« ${project.name} » est plus récent sur cet appareil. Écraser quand même ?`, 'Écraser'); if (!ok) continue; }
      if (exists) for (const old of await DB.photosOf(project.id)) await DB.del('photos', old.id);
      for (const ph of photos) { const { image, ...rest } = ph; await DB.put('photos', { ...rest, blob: await dataURLToBlob(image) }); }
      await DB.put('projects', project); n++;
    }
    await loadSymImages(); b.done(); toast(n + ' projet(s) importé(s)'); renderHome();
  } catch (err) { b.done(); toast('Import impossible : ' + err.message, 4000); }
};

/* ================= RÉGLAGES ================= */
async function settingsModal() {
  let used = '';
  try { const est = await navigator.storage.estimate(); used = (est.usage / 1048576).toFixed(1) + ' Mo utilisés'; } catch {}
  modal(`<h2>Réglages</h2>
    <div class="field"><label>Rédigé par (PDF)</label><input class="inp" id="s-au" value="${esc(SET.author)}"></div>
    <div class="field"><label>Taille du texte des notes</label><div class="seg" id="s-fs">${['Petit', 'Moyen', 'Grand', 'Très grand'].map((t, i) => `<button data-v="${i}" class="${SET.fs === i ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    <div class="field"><label>Photos par page (PDF)</label><div class="seg" id="s-pp">${[1, 2, 4].map(v => `<button data-v="${v}" class="${SET.perPage === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>
    <div class="field"><label>Épaisseur de trait par défaut : <b id="s-wv">${SET.width}</b></label><input type="range" id="s-w" min="1" max="14" value="${SET.width}" style="accent-color:var(--acc)"></div>
    <label class="tg"><span>Date et heure sur les photos du PDF</span><input type="checkbox" id="s-dt" ${SET.dateTime ? 'checked' : ''}></label>
    <label class="tg"><span>Adresse GPS (n°, rue, CP, ville)<br><span class="mut">nécessite le réseau</span></span><input type="checkbox" id="s-ad" ${SET.address ? 'checked' : ''}></label>
    <label class="tg"><span>Numéroter les équipements (L1, L2, BP1…)</span><input type="checkbox" id="s-nb" ${SET.numbers ? 'checked' : ''}></label>
    <label class="tg"><span>Dessiner au doigt même avec le stylet<br><span class="mut">sinon, après le S Pen, le doigt zoome et déplace</span></span><input type="checkbox" id="s-fd" ${SET.fingerDraw ? 'checked' : ''}></label>
    <div class="field" style="margin-top:14px"><label>Icônes perso</label><div class="cicons">${ICONS.length ? ICONS.map(i => `<div class="r"><img src="${i.img}"><span style="flex:1">${esc(i.name)} <span class="mut">(${esc(i.code)})</span></span><button class="ib" data-delicon="${i.id}">${ic('trash')}</button></div>`).join('') : '<span class="mut">Ajoute-les depuis l’éditeur : Matériel → Ajouter (photo).</span>'}</div></div>
    <div class="field" style="margin-top:6px"><label>Sauvegarde complète</label><div class="row"><button class="btn sm" id="s-all">${ic('share')}Tout exporter (.snap)</button><button class="btn sm" id="s-imp">${ic('upload')}Importer</button></div></div>
    <p class="mut">SnapNote ${APP_VERSION} · ${used} · données stockées sur cet appareil uniquement</p>
    <div class="foot"><button class="btn p" data-x>Fermer</button></div>`, (m, close) => {
    $('[data-x]', m).onclick = close;
    const seg = (id, key) => $(id, m).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; SET[key] = +b.dataset.v; saveSet(); $$(id + ' button', m).forEach(x => x.classList.toggle('on', x === b)); });
    seg('#s-fs', 'fs'); seg('#s-pp', 'perPage');
    $('#s-au', m).oninput = e => { SET.author = e.target.value; saveSet(); };
    $('#s-w', m).oninput = e => { SET.width = +e.target.value; $('#s-wv', m).textContent = SET.width; saveSet(); };
    [['#s-dt', 'dateTime'], ['#s-ad', 'address'], ['#s-nb', 'numbers'], ['#s-fd', 'fingerDraw']].forEach(([id, k]) => $(id, m).onchange = e => { SET[k] = e.target.checked; saveSet(); });
    $('#s-imp', m).onclick = () => { close(); $('#f-snap').click(); };
    $('#s-all', m).onclick = async () => { const b = busy('Sauvegarde…'); try { const blob = await snapOf(await DB.all('projects')); b.done(); await shareOrDownload(blob, `SnapNote_sauvegarde_${new Date().toISOString().slice(0, 10)}.snap`, 'Sauvegarde SnapNote'); } catch (e) { b.done(); toast(e.message); } };
    m.addEventListener('click', async e => {
      const d = e.target.closest('[data-delicon]'); if (!d) return;
      if (!await confirmBox('Supprimer cette icône ? Les repères déjà posés resteront sans image.')) return;
      await DB.del('icons', d.dataset.delicon); ICONS = ICONS.filter(i => i.id !== d.dataset.delicon); d.closest('.r').remove();
    });
  });
}

/* ================= Navigation retour Android ================= */
history.replaceState({ v: 'root' }, '');
history.pushState({ v: 'app' }, '');
addEventListener('popstate', async () => {
  history.pushState({ v: 'app' }, '');
  const ov = $$('.ov').pop(); if (ov) { Dict.stop(); ov.remove(); return; }
  if ($('#editor').classList.contains('on')) { if ($('#ed-side').classList.contains('open')) $('#ed-side').classList.remove('open'); else await closeEditor(); }
  else if ($('#project').classList.contains('on')) $('#b-back-home').click();
});
addEventListener('visibilitychange', () => { if (document.hidden && E.ph) saveEditor(false); });

/* ================= Démarrage ================= */
(async () => {
  $$('.dict').forEach(d => Dict.mount(d));
  try { await DB.open(); } catch (e) { document.body.innerHTML = '<p style="padding:20px">Stockage indisponible : ' + esc(e.message) + '</p>'; return; }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}
  ICONS = await DB.all('icons');
  await loadSymImages();
  renderHome();
  if ('serviceWorker' in navigator) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !E.ph) location.reload(); });
  }
})();
