/* SnapNote — mini générateur PDF sans dépendance (A4, Helvetica, images JPEG) */
'use strict';
const SnapPDF = (() => {
  // Largeurs Helvetica (AFM) pour les caractères 32..126, en 1/1000 em
  const W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,
    667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    278,278,278,469,556,333,
    556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,
    334,260,334,584];
  const SPECIAL = { '’': '\x92', '‘': '\x91', '“': '\x93', '”': '\x94', '–': '\x96', '—': '\x97',
    '…': '...', '€': '\x80', 'œ': '\x9C', 'Œ': '\x8C', '•': '\x95', ' ': ' ', ' ': ' ' };

  function enc(str) {
    let out = '';
    for (const ch of String(str)) {
      if (SPECIAL[ch] !== undefined) { out += SPECIAL[ch]; continue; }
      const c = ch.codePointAt(0);
      if (c === 10 || c === 13 || c === 9) { out += ' '; continue; }
      if (c < 32) continue;
      if (c < 256) { out += ch; continue; }
      const base = ch.normalize('NFD')[0];
      out += (base && base.codePointAt(0) < 256) ? base : '?';
    }
    return out;
  }
  function charW(code) {
    if (code >= 32 && code <= 126) return W[code - 32];
    if (code >= 192) {
      const b = String.fromCharCode(code).normalize('NFD').charCodeAt(0);
      if (b >= 32 && b <= 126) return W[b - 32];
    }
    return 556;
  }
  function textWidth(str, size, bold) {
    const s = enc(str); let w = 0;
    for (let i = 0; i < s.length; i++) w += charW(s.charCodeAt(i));
    return w / 1000 * size * (bold ? 1.06 : 1);
  }
  function esc(s) { return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  const n = v => (Math.round(v * 100) / 100).toString();

  class Doc {
    constructor() {
      this.W = 595.28; this.H = 841.89;
      this.pages = []; this.images = []; this.cur = null;
    }
    addPage() { this.cur = { ops: [], imgs: [] }; this.pages.push(this.cur); return this; }
    setPage(i) { this.cur = this.pages[i]; }
    color(c) { return c.map(v => n(v / 255)).join(' '); }
    text(str, x, y, o = {}) {
      const size = o.size || 11, font = o.bold ? 'F2' : 'F1', col = o.color || [20, 24, 32];
      let xx = x;
      if (o.align === 'right') xx = x - textWidth(str, size, o.bold);
      if (o.align === 'center') xx = x - textWidth(str, size, o.bold) / 2;
      this.cur.ops.push(`BT /${font} ${n(size)} Tf ${this.color(col)} rg ${n(xx)} ${n(this.H - y)} Td (${esc(enc(str))}) Tj ET`);
    }
    wrap(str, maxW, size, bold) {
      const lines = [];
      for (const para of String(str || '').split(/\r?\n/)) {
        const words = para.split(/\s+/).filter(Boolean);
        if (!words.length) { lines.push(''); continue; }
        let line = '';
        for (const w of words) {
          const t = line ? line + ' ' + w : w;
          if (textWidth(t, size, bold) <= maxW) { line = t; continue; }
          if (line) lines.push(line);
          if (textWidth(w, size, bold) > maxW) { // mot trop long : on coupe
            let part = '';
            for (const ch of w) { if (textWidth(part + ch, size, bold) > maxW) { lines.push(part); part = ''; } part += ch; }
            line = part;
          } else line = w;
        }
        lines.push(line);
      }
      return lines;
    }
    rect(x, y, w, h, o = {}) {
      const ops = [];
      if (o.fill) ops.push(`${this.color(o.fill)} rg`);
      if (o.stroke) ops.push(`${this.color(o.stroke)} RG ${n(o.lw || 0.8)} w`);
      ops.push(`${n(x)} ${n(this.H - y - h)} ${n(w)} ${n(h)} re ${o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'}`);
      this.cur.ops.push(ops.join(' '));
    }
    line(x1, y1, x2, y2, o = {}) {
      this.cur.ops.push(`${this.color(o.color || [180, 186, 196])} RG ${n(o.lw || 0.6)} w ${n(x1)} ${n(this.H - y1)} m ${n(x2)} ${n(this.H - y2)} l S`);
    }
    image(bytes, pw, ph, x, y, w, h) {
      const id = this.images.length;
      this.images.push({ bytes, pw, ph });
      this.cur.imgs.push(id);
      this.cur.ops.push(`q ${n(w)} 0 0 ${n(h)} ${n(x)} ${n(this.H - y - h)} cm /Im${id} Do Q`);
    }
    output() {
      const parts = []; const offs = []; let pos = 0;
      const push = (d) => { const u = typeof d === 'string' ? Uint8Array.from(d, c => c.charCodeAt(0) & 255) : d; parts.push(u); pos += u.length; };
      const obj = (num, body) => { offs[num] = pos; push(`${num} 0 obj\n`); body(); push('\nendobj\n'); };
      push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      const imgBase = 5, pageBase = imgBase + this.images.length;
      const pageIds = this.pages.map((_, i) => pageBase + i * 2);
      obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
      obj(2, () => push(`<< /Type /Pages /Count ${this.pages.length} /Kids [${pageIds.map(i => i + ' 0 R').join(' ')}] >>`));
      obj(3, () => push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
      obj(4, () => push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
      this.images.forEach((im, i) => obj(imgBase + i, () => {
        push(`<< /Type /XObject /Subtype /Image /Width ${im.pw} /Height ${im.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);
        push(im.bytes); push('\nendstream');
      }));
      this.pages.forEach((p, i) => {
        const pid = pageIds[i], cid = pid + 1;
        const xo = p.imgs.length ? `/XObject << ${p.imgs.map(k => `/Im${k} ${imgBase + k} 0 R`).join(' ')} >>` : '';
        obj(pid, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(this.W)} ${n(this.H)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xo} >> /Contents ${cid} 0 R >>`));
        const content = p.ops.join('\n');
        obj(cid, () => { push(`<< /Length ${content.length} >>\nstream\n`); push(content); push('\nendstream'); });
      });
      const total = pageBase + this.pages.length * 2;
      const xref = pos;
      let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
      for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
      push(x);
      push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
      return new Blob(parts, { type: 'application/pdf' });
    }
  }
  return { Doc, textWidth, enc };
})();
if (typeof module !== 'undefined') module.exports = SnapPDF;
