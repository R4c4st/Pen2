/* SnapNote — pictogrammes matériel (dessins vectoriels réalistes, viewBox 100x100) */
'use strict';
const SYMBOLS = [
  {
    key: 'lecteur', name: 'Lecteur STid', code: 'L',
    svg: `<defs>
      <linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a505a"/><stop offset="1" stop-color="#0c0e11"/></linearGradient>
      <linearGradient id="h" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <radialGradient id="l"><stop offset="0" stop-color="#bff4ff"/><stop offset="1" stop-color="#18b6ff"/></radialGradient></defs>
      <rect x="29" y="7" width="42" height="86" rx="10" fill="#000" opacity=".25" transform="translate(2 2)"/>
      <rect x="29" y="7" width="42" height="86" rx="10" fill="url(#b)" stroke="#000" stroke-width="1.2"/>
      <rect x="32" y="10" width="17" height="80" rx="7" fill="url(#h)"/>
      <rect x="39" y="16" width="22" height="4.5" rx="2.2" fill="url(#l)"/>
      <circle cx="44" cy="56" r="3.2" fill="#a9b2bd"/>
      <path d="M50 47.5a10 10 0 0 1 0 17M55.5 42.5a16 16 0 0 1 0 27" stroke="#a9b2bd" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="85" r="1.6" fill="#2a2e34"/>`
  },
  {
    key: 'eden', name: 'Centrale Eden', code: 'CE',
    svg: `<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f9fb"/><stop offset="1" stop-color="#c3c9d1"/></linearGradient></defs>
      <rect x="11" y="11" width="78" height="76" rx="6" fill="#000" opacity=".18" transform="translate(2 2)"/>
      <rect x="11" y="11" width="78" height="76" rx="6" fill="url(#b)" stroke="#858c96" stroke-width="1.4"/>
      <rect x="17" y="17" width="66" height="64" rx="3" fill="none" stroke="#a5acb5" stroke-width="1"/>
      <rect x="55" y="23" width="22" height="11" rx="1.5" fill="#1d4fa3"/>
      <path d="M58 27h16M58 30.5h10" stroke="#fff" stroke-width="1.4"/>
      <g stroke="#8d949d" stroke-width="2.2" stroke-linecap="round"><path d="M24 26h22M24 31h22M24 36h22M24 41h22M24 46h22"/></g>
      <rect x="24" y="56" width="52" height="16" rx="2" fill="#e3e7ec" stroke="#b2b8c0"/>
      <circle cx="62" cy="64" r="2.4" fill="#2bd46a"/><circle cx="70" cy="64" r="2.4" fill="#ffad1f"/>
      <path d="M29 64h22" stroke="#9aa1aa" stroke-width="1.6"/>
      <g fill="#4b5058"><rect x="24" y="87" width="8" height="6" rx="1"/><rect x="46" y="87" width="8" height="6" rx="1"/><rect x="68" y="87" width="8" height="6" rx="1"/></g>`
  },
  {
    key: 'ventouse', name: 'Ventouse', code: 'V',
    svg: `<defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfcfd"/><stop offset=".5" stop-color="#c9ced4"/><stop offset="1" stop-color="#8b929a"/></linearGradient>
      <linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7dbe0"/><stop offset="1" stop-color="#7d848c"/></linearGradient></defs>
      <path d="M90 40c8 0 8-22-3-27" stroke="#1d1f22" stroke-width="3" fill="none" stroke-linecap="round"/>
      <rect x="14" y="22" width="72" height="6" rx="1.5" fill="#5f656d"/>
      <rect x="9" y="28" width="82" height="24" rx="3.5" fill="url(#m)" stroke="#6f767e" stroke-width="1.2"/>
      <path d="M12 33h76" stroke="#fff" stroke-opacity=".8" stroke-width="1.2"/>
      <circle cx="18" cy="40" r="2.6" fill="#ff3b30"/>
      <rect x="13" y="58" width="74" height="15" rx="2.5" fill="url(#p)" stroke="#6b727a" stroke-width="1.2"/>
      <circle cx="26" cy="65.5" r="2.3" fill="#4d535a"/><circle cx="50" cy="65.5" r="2.3" fill="#4d535a"/><circle cx="74" cy="65.5" r="2.3" fill="#4d535a"/>
      <path d="M30 79h40" stroke="#2b7bff" stroke-width="2" stroke-dasharray="3 3"/>`
  },
  {
    key: 'bbg', name: 'Bris de glace vert', code: 'BG',
    svg: `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fd476"/><stop offset="1" stop-color="#0b7432"/></linearGradient></defs>
      <rect x="13" y="13" width="74" height="74" rx="9" fill="#000" opacity=".2" transform="translate(2 2)"/>
      <rect x="13" y="13" width="74" height="74" rx="9" fill="url(#g)" stroke="#075f28" stroke-width="1.2"/>
      <rect x="27" y="25" width="46" height="46" rx="2.5" fill="#f6fbf7" stroke="#cdd9d1"/>
      <g stroke="#dfe8e2" stroke-width="1.4"><path d="M29 41l12-12M29 55l26-26M33 67l36-36M47 67l22-22M61 67l8-8"/></g>
      <path d="M43 34h14v28H43z" fill="none" stroke="#12873e" stroke-width="2.4"/>
      <path d="M49 48h14M58 43l5 5-5 5" stroke="#12873e" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="78" cy="79" r="2.4" fill="#063d1b"/>`
  },
  {
    key: 'bp', name: 'Bouton poussoir', code: 'BP',
    svg: `<defs><linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd5dc"/></linearGradient>
      <radialGradient id="g" cx=".4" cy=".35"><stop offset="0" stop-color="#7dffa8"/><stop offset=".55" stop-color="#22b455"/><stop offset="1" stop-color="#0d6e31"/></radialGradient></defs>
      <rect x="15" y="15" width="70" height="70" rx="9" fill="#000" opacity=".18" transform="translate(2 2)"/>
      <rect x="15" y="15" width="70" height="70" rx="9" fill="url(#w)" stroke="#aeb5bd" stroke-width="1.2"/>
      <circle cx="50" cy="46" r="21" fill="#e2e6ea" stroke="#b5bcc4"/>
      <circle cx="50" cy="46" r="17" fill="url(#g)"/>
      <ellipse cx="44" cy="39" rx="7" ry="4" fill="#fff" opacity=".45"/>
      <text x="50" y="78" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="9.5" fill="#26303b">SORTIE</text>`
  },
  {
    key: 'ir', name: 'Détecteur IR', code: 'IR',
    svg: `<defs><linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9cfd6"/></linearGradient>
      <linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5d4a75"/><stop offset="1" stop-color="#140f1c"/></linearGradient></defs>
      <path d="M24 12h52a8 8 0 0 1 8 8v36c0 19-16 33-34 33S16 75 16 56V20a8 8 0 0 1 8-8z" fill="#000" opacity=".18" transform="translate(2 2)"/>
      <path d="M24 12h52a8 8 0 0 1 8 8v36c0 19-16 33-34 33S16 75 16 56V20a8 8 0 0 1 8-8z" fill="url(#w)" stroke="#a9b0b8" stroke-width="1.2"/>
      <rect x="30" y="47" width="40" height="27" rx="13" fill="url(#l)"/>
      <path d="M36 54c6-3 22-3 28 0" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none" stroke-linecap="round"/>
      <g stroke="#3a2f47" stroke-width=".8"><path d="M40 49v23M50 47v27M60 49v23"/></g>
      <circle cx="50" cy="27" r="3" fill="#ff3b30"/><circle cx="49" cy="26" r="1" fill="#fff" opacity=".8"/>`
  },
  {
    key: 'clavier', name: 'Clavier', code: 'K',
    svg: `<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4b525c"/><stop offset="1" stop-color="#16191d"/></linearGradient>
      <linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cdd3da"/></linearGradient></defs>
      <rect x="18" y="6" width="64" height="88" rx="7" fill="#000" opacity=".22" transform="translate(2 2)"/>
      <rect x="18" y="6" width="64" height="88" rx="7" fill="url(#b)" stroke="#0b0c0e" stroke-width="1.2"/>
      <rect x="26" y="13" width="48" height="13" rx="2" fill="#9fe8c4"/>
      <path d="M30 19.5h22" stroke="#2c6b4d" stroke-width="2"/>
      <g fill="url(#k)">
        <rect x="27" y="32" width="13" height="11" rx="2"/><rect x="43.5" y="32" width="13" height="11" rx="2"/><rect x="60" y="32" width="13" height="11" rx="2"/>
        <rect x="27" y="46" width="13" height="11" rx="2"/><rect x="43.5" y="46" width="13" height="11" rx="2"/><rect x="60" y="46" width="13" height="11" rx="2"/>
        <rect x="27" y="60" width="13" height="11" rx="2"/><rect x="43.5" y="60" width="13" height="11" rx="2"/><rect x="60" y="60" width="13" height="11" rx="2"/>
        <rect x="27" y="74" width="13" height="11" rx="2"/><rect x="43.5" y="74" width="13" height="11" rx="2"/><rect x="60" y="74" width="13" height="11" rx="2"/></g>
      <g font-family="Arial,Helvetica,sans-serif" font-size="7.5" font-weight="700" fill="#2a3038" text-anchor="middle">
        <text x="33.5" y="40.5">1</text><text x="50" y="40.5">2</text><text x="66.5" y="40.5">3</text>
        <text x="33.5" y="54.5">4</text><text x="50" y="54.5">5</text><text x="66.5" y="54.5">6</text>
        <text x="33.5" y="68.5">7</text><text x="50" y="68.5">8</text><text x="66.5" y="68.5">9</text>
        <text x="33.5" y="83">*</text><text x="50" y="82.5">0</text><text x="66.5" y="82.5">#</text></g>`
  },
  {
    key: 'sirene', name: 'Sirène', code: 'S',
    svg: `<defs><linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c7cdd4"/></linearGradient>
      <linearGradient id="r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a7a"/><stop offset=".5" stop-color="#ef2a1c"/><stop offset="1" stop-color="#9e130a"/></linearGradient></defs>
      <rect x="15" y="26" width="70" height="64" rx="9" fill="#000" opacity=".18" transform="translate(2 2)"/>
      <rect x="15" y="26" width="70" height="64" rx="9" fill="url(#w)" stroke="#a7aeb6" stroke-width="1.2"/>
      <rect x="28" y="9" width="44" height="22" rx="8" fill="url(#r)" stroke="#8a0f08"/>
      <path d="M33 15h26" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/>
      <g stroke="#9ba3ac" stroke-width="2.2" stroke-linecap="round"><path d="M28 48h44M28 55h44M28 62h44M28 69h44M28 76h44"/></g>
      <circle cx="74" cy="83" r="1.8" fill="#2bd46a"/>`
  },
  {
    key: 'centrale', name: 'Centrale alarme', code: 'CA',
    svg: `<defs><linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c6ccd3"/></linearGradient>
      <clipPath id="c"><rect x="12" y="9" width="76" height="82" rx="6"/></clipPath></defs>
      <rect x="12" y="9" width="76" height="82" rx="6" fill="#000" opacity=".18" transform="translate(2 2)"/>
      <rect x="12" y="9" width="76" height="82" rx="6" fill="url(#w)"/>
      <rect x="12" y="9" width="76" height="16" fill="#1a5fb4" clip-path="url(#c)"/>
      <path d="M20 17h26" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="12" y="9" width="76" height="82" rx="6" fill="none" stroke="#a5acb4" stroke-width="1.2"/>
      <rect x="22" y="33" width="56" height="14" rx="2" fill="#20262d"/>
      <path d="M26 40h26" stroke="#7ee0ff" stroke-width="2"/>
      <circle cx="28" cy="58" r="3" fill="#2bd46a"/><circle cx="40" cy="58" r="3" fill="#ffc21f"/><circle cx="52" cy="58" r="3" fill="#ff3b30"/><circle cx="64" cy="58" r="3" fill="#2b7bff"/>
      <g stroke="#a7aeb6" stroke-width="2" stroke-linecap="round"><path d="M22 72h30M22 78h30M22 84h30"/></g>
      <circle cx="70" cy="79" r="5" fill="#d9dee4" stroke="#9aa1a9"/><path d="M70 76.5v5" stroke="#4b5058" stroke-width="1.6"/>`
  },
  {
    key: 'contact', name: 'Contact de porte', code: 'C',
    svg: `<defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c3c9d0"/></linearGradient></defs>
      <rect x="6" y="64" width="88" height="6" rx="1" fill="#b08a5a"/>
      <rect x="6" y="70" width="88" height="3" fill="#8a6a42"/>
      <rect x="12" y="38" width="32" height="20" rx="5" fill="url(#w)" stroke="#9fa7b0" stroke-width="1.2"/>
      <rect x="16" y="45" width="24" height="5" rx="2" fill="#4a5059"/>
      <rect x="56" y="38" width="32" height="20" rx="5" fill="url(#w)" stroke="#9fa7b0" stroke-width="1.2"/>
      <circle cx="62" cy="48" r="2" fill="#6b727b"/><circle cx="82" cy="48" r="2" fill="#6b727b"/>
      <path d="M88 48c7 0 7-18 0-24" stroke="#d8dce1" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M88 48c7 0 7-18 0-24" stroke="#8d949c" stroke-width="1" fill="none"/>
      <path d="M46 48h8" stroke="#2b7bff" stroke-width="2" stroke-dasharray="2 2"/>
      <path d="M47 30l3-4 3 4M47 66l3 4 3-4" stroke="#2b7bff" stroke-width="1.6" fill="none"/>`
  }
];

function symbolSvgUrl(svgInner) {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">${svgInner}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}
