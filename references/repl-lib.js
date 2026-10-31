// elliott-wave-report · REPL helper library
// 사용법: 이 파일 내용을 REPL에 붙여넣고 아래 함수들을 그대로 쓴다.

async function yq(sym, interval, range) {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}&includePrePost=false`;
  const r = await fetch(u);
  return await r.json();
}

function norm(j) {
  const r = j.chart.result[0], q = r.indicators.quote[0], out = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    if (q.open[i] == null || q.close[i] == null) continue;
    out.push({ t: r.timestamp[i], o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume?.[i] ?? 0 });
  }
  return { meta: r.meta, bars: out };
}

function zigzag(bars, pct) {
  const pts = []; let dir = 0, ext = bars[0], extIdx = 0;
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    if (dir >= 0) {
      if (b.h >= ext.h) { ext = { h: b.h, l: ext.l ?? b.l, t: b.t, i }; extIdx = i; }
      else if (b.l <= ext.h * (1 - pct)) { pts.push({ type: "H", price: ext.h, t: ext.t }); dir = -1; ext = { h: ext.h, l: b.l, t: b.t, i }; extIdx = i; }
    }
    if (dir <= 0) {
      if (b.l <= ext.l) { ext = { l: b.l, h: ext.h ?? b.h, t: b.t, i }; extIdx = i; }
      else if (b.h >= ext.l * (1 + pct)) { pts.push({ type: "L", price: ext.l, t: ext.t }); dir = 1; ext = { l: ext.l, h: b.h, t: b.t, i }; extIdx = i; }
    }
  }
  pts.push(dir >= 0 ? { type: "H", price: ext.h, t: ext.t, cur: true } : { type: "L", price: ext.l, t: ext.t, cur: true });
  return pts;
}

function rsi(bars, n = 14) {
  const out = new Array(bars.length).fill(null); let g = 0, l = 0;
  for (let i = 1; i < bars.length; i++) {
    const d = bars[i].c - bars[i - 1].c, up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } }
    else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
  }
  return out;
}

function atr(bars, n = 14) {
  const tr = bars.map((b, i) => i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)));
  const out = new Array(bars.length).fill(null); let a = null;
  for (let i = 0; i < tr.length; i++) {
    if (i === n - 1) { a = tr.slice(0, n).reduce((x, y) => x + y, 0) / n; out[i] = a; }
    else if (i >= n) { a = (a * (n - 1) + tr[i]) / n; out[i] = a; }
  }
  return out;
}

// 일별 3배 복리 환산: ETF(now) x (Xtarget / Xnow)^3
function lev3(etfNow, xNow, xTarget, drag = 1.0) {
  return etfNow * Math.pow(xTarget / xNow, 3) * drag;
}
// 캔들 차트 SVG. o = {bars,w,h,ml,mr,mt,mb,log,ymin,ymax,ticks,title,zones,lines,labels,notes}
// zones: [{lo,hi,label,color,fill}]  lines: [{price,label,color,dash}]  labels: [{date,price,text,dir,size,color,dy,sub,connect}]
function mkChart(o) {
  const { bars, w = 1400, h = 860, ml = 8, mr = 250, mt = 40, mb = 46, log = true, labels = [], lines = [], zones = [], notes = [], title = "" } = o;
  const pr = w - mr, ph = h - mt - mb, ymin = o.ymin, ymax = o.ymax;
  const fy = log ? p => mt + (Math.log(ymax) - Math.log(p)) / (Math.log(ymax) - Math.log(ymin)) * ph
                 : p => mt + (ymax - p) / (ymax - ymin) * ph;
  const bw = (pr - ml) / bars.length, fx = i => ml + (i + 0.5) * bw;
  const ds = t => new Date(t * 1000).toISOString().slice(0, 10);
  const idx = d => bars.findIndex(b => ds(b.t) === d);
  const S = [];
  S.push(`<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Noto Serif KR, serif">`);
  S.push(`<rect width="${w}" height="${h}" fill="#fff"/>`);
  if (title) S.push(`<text x="${ml}" y="20" font-size="15" font-weight="700" fill="#101a2b">${title}</text>`);
  for (const g of (o.ticks || [])) {
    const y = fy(g); if (y < mt - 2 || y > h - mb + 2) continue;
    S.push(`<line x1="${ml}" y1="${y.toFixed(1)}" x2="${pr}" y2="${y.toFixed(1)}" stroke="#eef1f5"/>`);
    S.push(`<text x="${w - 46}" y="${(y + 5).toFixed(1)}" font-size="13" text-anchor="end" fill="#9aa5b4">${g}</text>`);
  }
  for (const z of zones) {
    const y1 = fy(z.hi), y2 = fy(z.lo);
    S.push(`<rect x="${ml}" y="${y1.toFixed(1)}" width="${pr - ml}" height="${(y2 - y1).toFixed(1)}" fill="${z.fill}"/>`);
    if (z.label) S.push(`<text x="${pr + 8}" y="${((y1 + y2) / 2 + 5).toFixed(1)}" font-size="14" font-weight="700" fill="${z.color}">${z.label}</text>`);
  }
  for (const L of lines) {
    const y = fy(L.price);
    S.push(`<line x1="${ml}" y1="${y.toFixed(1)}" x2="${pr}" y2="${y.toFixed(1)}" stroke="${L.color}" stroke-width="1.3" stroke-dasharray="${L.dash || "6 5"}"/>`);
    if (L.label) S.push(`<text x="${pr + 8}" y="${(y - 6).toFixed(1)}" font-size="13" fill="${L.color}">${L.label}</text>`);
  }
  const cw = Math.max(1.6, bw * 0.55);
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], x = fx(i), up = b.c >= b.o, c = up ? "#1f6f5c" : "#b23b3b";
    S.push(`<line x1="${x.toFixed(1)}" y1="${fy(b.h).toFixed(1)}" x2="${x.toFixed(1)}" y2="${fy(b.l).toFixed(1)}" stroke="${c}" stroke-width="1"/>`);
    const yo = fy(Math.max(b.o, b.c)), yc = fy(Math.min(b.o, b.c));
    S.push(`<rect x="${(x - cw / 2).toFixed(1)}" y="${yo.toFixed(1)}" width="${cw.toFixed(1)}" height="${Math.max(1, yc - yo).toFixed(1)}" fill="${c}"/>`);
  }
  const conn = [...labels].filter(l => l.connect !== false).sort((a, b) => a.date < b.date ? -1 : 1);
  const pts = conn.map(l => { const i = idx(l.date); return i < 0 ? null : { x: fx(i), y: fy(l.price) }; }).filter(Boolean);
  if (pts.length > 1) S.push(`<polyline points="${pts.map(p => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ")}" fill="none" stroke="#2b3a4f" stroke-width="1.8" stroke-dasharray="7 5" opacity="0.7"/>`);
  for (const l of labels) {
    const i = idx(l.date); if (i < 0) continue;
    const x = fx(i), y = fy(l.price), col = l.color || "#101a2b";
    S.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${l.r || 3.6}" fill="${col}" stroke="#fff" stroke-width="1.2"/>`);
    const dy = l.dy !== undefined ? l.dy : (l.dir > 0 ? -14 : 22);
    if (l.text) S.push(`<text x="${(x + (l.dx || 0)).toFixed(1)}" y="${(y + dy).toFixed(1)}" font-size="${l.size || 18}" font-weight="${l.weight || 900}" text-anchor="${l.anchor || "middle"}" fill="${col}" paint-order="stroke" stroke="#fff" stroke-width="4" stroke-linejoin="round">${l.text}</text>`);
    if (l.sub) S.push(`<text x="${(x + (l.dx || 0)).toFixed(1)}" y="${(y + dy + (l.dir > 0 ? -17 : 17)).toFixed(1)}" font-size="11.5" text-anchor="${l.anchor || "middle"}" fill="#6b7a90" paint-order="stroke" stroke="#fff" stroke-width="3.5">${l.sub}</text>`);
  }
  for (const n of notes) S.push(`<text x="${n.x}" y="${n.y}" font-size="${n.size || 13}" font-weight="${n.weight || 400}" fill="${n.color || "#4a5666"}">${n.text}</text>`);
  const mon = {};
  for (let i = 0; i < bars.length; i++) { const d = new Date(bars[i].t * 1000); const k = d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0"); if (mon[k] === undefined) mon[k] = i; }
  const keys = Object.keys(mon), step = keys.length >= 12 ? 3 : (keys.length >= 9 ? 2 : 1);
  keys.forEach((k, j) => { if (j % step !== 0) return; const x = fx(mon[k]);
    S.push(`<line x1="${x.toFixed(1)}" y1="${h - mb}" x2="${x.toFixed(1)}" y2="${h - mb + 5}" stroke="#c8cfd8"/>`);
    S.push(`<text x="${x.toFixed(1)}" y="${h - mb + 20}" font-size="12" fill="#9aa5b4">${k}</text>`); });
  S.push("</svg>");
  return S.join("");
}
// 가격 레벨을 네모 박스 콜아웃으로 감싼다. cfg = {w,h,mt,mb,ymin,ymax,log,mr}
// items = [{price, text, color, size, h}]
function boxify(svg, cfg, items) {
  const { w, h, mt, mb, ymin, ymax, log = true, mr = 240 } = cfg;
  const pr = w - mr;
  const fy = log ? p => mt + (Math.log(ymax) - Math.log(p)) / (Math.log(ymax) - Math.log(ymin)) * (h - mt - mb)
                 : p => mt + (ymax - p) / (ymax - ymin) * (h - mt - mb);
  const out = [];
  for (const it of items) {
    const y = fy(it.price), fs = it.size || 11.5, bh = it.h || 25;
    const wd = [...it.text].reduce((s, ch) => s + (ch.charCodeAt(0) > 127 ? fs * 1.02 : fs * 0.53), 0) + 18;
    const x = pr + 8;
    out.push(`<rect x="${x}" y="${(y - bh / 2).toFixed(1)}" width="${wd.toFixed(1)}" height="${bh}" rx="3" fill="#fff" stroke="${it.color}" stroke-width="1.3"/>`);
    out.push(`<text x="${x + 9}" y="${(y + fs * 0.36).toFixed(1)}" font-size="${fs}" font-weight="700" fill="${it.color}">${it.text}</text>`);
  }
  return svg.replace("</svg>", out.join("") + "</svg>");
}

// 주문표 계산: rows = [{id,side,px,w}], capital = 계좌
function tradeMath(rows, capital, stops, tps) {
  const calc = rows.map(r => ({ ...r, amt: capital * r.w, sh: capital * r.w / r.px }));
  const side = {};
  for (const r of calc) { side[r.side] = side[r.side] || { amt: 0, sh: 0 }; side[r.side].amt += r.amt; side[r.side].sh += r.sh; }
  for (const k of Object.keys(side)) side[k].avg = side[k].amt / side[k].sh;
  const res = {};
  for (const k of Object.keys(side)) {
    const avg = side[k].avg, stop = stops[k], sh = side[k].sh;
    const risk = (avg - stop) * sh;
    const rows2 = tps[k].map(t => ({ ...t, r: (t.p - avg) / (avg - stop), sh: sh * t.w }));
    const rew = rows2.reduce((s, t) => s + t.sh * (t.p - avg), 0);
    const wR = rows2.reduce((s, t) => s + t.w * t.r, 0);
    res[k] = { avg: +avg.toFixed(2), sh: +sh.toFixed(1), risk: +risk.toFixed(0), rew: +rew.toFixed(0), wR: +wR.toFixed(2), tps: rows2.map(t => ({ p: t.p, w: t.w, r: +t.r.toFixed(2), sh: +t.sh.toFixed(1) })) };
  }
  const risk = Object.values(res).reduce((s, x) => s + x.risk, 0);
  const rew = Object.values(res).reduce((s, x) => s + x.rew, 0);
  res.total = { risk, rew, pctRisk: +(100 * risk / capital).toFixed(2), pctRew: +(100 * rew / capital).toFixed(2), R: +(rew / risk).toFixed(2), beWin: +(100 * risk / (risk + rew)).toFixed(1) };
  return res;
}

// 거래일 달력(미국 공휴일 최소 세트). n일 뒤 영업일
function addSessions(fromISO, n, holidays = ["2026-11-26", "2026-12-25"]) {
  const hol = new Set(holidays), d = new Date(fromISO + "T00:00:00Z"); let c = 0;
  while (c < n) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(), s = d.toISOString().slice(0, 10); if (w !== 0 && w !== 6 && !hol.has(s)) c++; }
  return d.toISOString().slice(0, 10);
}