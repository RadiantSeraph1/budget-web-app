// Tiny dependency-free SVG charts. Colours come from CSS variables so dark mode works.
(function (root) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function compact(n, prefix = '') {
    const a = Math.abs(n), sign = n < 0 ? '-' : '';
    if (a >= 1e6) return sign + prefix + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (a >= 1e3) return sign + prefix + Math.round(a / 1e3) + 'k';
    return sign + prefix + Math.round(a);
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  // series: [{ name, color, dashed?, points: [[x, y], ...] }]; hline: { y, label }
  function line(series, opt = {}) {
    const w = 720, h = 250, L = 72, R = 12, T = 10, B = 26;
    const fmtY = opt.fmtY || compact, fmtX = opt.fmtX || (x => x);
    const pts = series.flatMap(s => s.points);
    if (!pts.length) return '<p class="note">Nothing to chart yet.</p>';
    const xMin = Math.min(...pts.map(p => p[0])), xMax = Math.max(...pts.map(p => p[0]));
    let yMax = Math.max(...pts.map(p => p[1]), opt.hline ? opt.hline.y : 0);
    let yMin = Math.min(0, ...pts.map(p => p[1]));
    yMax = niceMax(yMax);
    const X = x => L + (xMax === xMin ? 0 : (x - xMin) / (xMax - xMin)) * (w - L - R);
    const Y = y => T + (1 - (y - yMin) / (yMax - yMin || 1)) * (h - T - B);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = yMin + (yMax - yMin) * i / 4;
      g += `<line class="grid" x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${esc(fmtY(v))}</text>`;
    }
    for (let i = 0; i <= 4; i++) {
      const v = xMin + (xMax - xMin) * i / 4;
      g += `<text class="tick" x="${X(v)}" y="${h - 8}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}">${esc(fmtX(v))}</text>`;
    }
    if (opt.hline) g += `<line x1="${L}" x2="${w - R}" y1="${Y(opt.hline.y)}" y2="${Y(opt.hline.y)}" stroke="var(--bad)" stroke-dasharray="5 4"/>` +
      `<text class="tick" x="${w - R}" y="${Y(opt.hline.y) - 4}" text-anchor="end" fill="var(--bad)">${esc(opt.hline.label)}</text>`;
    series.forEach(s => {
      if (!s.points.length) return;
      const d = s.points.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('');
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2"${s.dashed ? ' stroke-dasharray="6 4"' : ''}/>`;
      if (s.points.length <= 24) g += s.points.map(p => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="2.8" fill="${s.color}"/>`).join('');
    });
    const legend = series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(opt.label || 'chart')}">${g}</svg><div class="legend">${legend}</div>`;
  }

  // slices: [{ name, color, value }]
  function donut(slices, centre) {
    const total = slices.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
    let off = 25, out = '';
    slices.forEach(s => {
      const p = Math.max(0, s.value) / total * 100;
      out += `<circle r="15.9155" cx="21" cy="21" fill="none" stroke="${s.color}" stroke-width="6" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${off}"><title>${esc(s.name)}</title></circle>`;
      off -= p;
    });
    return `<svg class="donut" viewBox="0 0 42 42" role="img" aria-label="Budget split">${out}` +
      `<text x="21" y="21.8" text-anchor="middle" class="donut-t">${esc(centre)}</text></svg>`;
  }

  root.Charts = { line, donut, compact };
})(this);
