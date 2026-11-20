// Detailed animated internal cutaway renderer for all 15 plant machines (embedded in browser index.html)
export function renderMachineCutaway(machineId, modeIdx = 0, activePart = 0, lang = 'it', scope = 'mc') {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pfx = `${scope}-${machineId}-${modeIdx}`;
  const T = (it, en, zh) => (lang === 'it' ? it : lang === 'zh' ? zh : en);

  let gradSeq = 0;
  const defs = [
    ...['danger', 'link', 'warning', 'accent', 'success'].map(tone =>
      `<marker id="${pfx}-arr-${tone}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 1L9 5L0 9Z" fill="var(--cp-${tone})"/></marker>`
    )
  ];

  const makeGrad = (x1, y1, x2, y2, fromTone, toTone) => {
    const id = `${pfx}-g-${++gradSeq}`;
    defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
      `<stop offset="0%" stop-color="var(--cp-${fromTone})"/><stop offset="100%" stop-color="var(--cp-${toTone})"/></linearGradient>`);
    return `url(#${id})`;
  };

  const roundPath = pts => {
    if (pts.length < 2) return '';
    let out = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
      const dx1 = curr[0] - prev[0], dy1 = curr[1] - prev[1];
      const l1 = Math.hypot(dx1, dy1);
      let ex = curr[0], ey = curr[1], q = '';
      if (next) {
        const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1];
        const l2 = Math.hypot(dx2, dy2);
        const r = Math.min(10, l1 / 2.4, l2 / 2.4);
        if (r > 1.5 && (dx1 || dy1) && (dx2 || dy2)) {
          ex = curr[0] - Math.sign(dx1) * r;
          ey = curr[1] - Math.sign(dy1) * r;
          q = `Q${curr[0]} ${curr[1]} ${curr[0] + Math.sign(dx2) * r} ${curr[1] + Math.sign(dy2) * r}`;
        }
      }
      out += `L${ex} ${ey}${q}`;
    }
    return out;
  };

  const waterPipe = (pts, fromT, toT = fromT, opts = {}) => {
    const { thin = false, animated = true, speed = 56, marker = false, dim = false } = opts;
    const d = roundPath(pts);
    const stroke = dim ? 'var(--cp-border-strong)' : (fromT === toT ? `var(--cp-${fromT})` : makeGrad(pts[0][0], pts[0][1], pts.at(-1)[0], pts.at(-1)[1], fromT, toT));
    const cls = thin ? ' thin' : '';
    const anim = (animated && !dim) ? ` data-flow-path="1" data-fluid-kind="water" data-speed="${speed}" data-temp-start="${fromT}" data-temp-end="${toT}"` : '';
    const mEnd = (marker && !dim) ? ` marker-end="url(#${pfx}-arr-${toT})"` : '';
    return `<g opacity="${dim ? '.38' : '1'}"><path d="${d}" class="pipe-casing${cls}"/><path d="${d}" class="pipe-core${cls}" style="stroke:${stroke}"${anim}${mEnd}/><path d="${d}" class="pipe-sheen"/></g>`;
  };

  const refPipe = (pts, fromT, toT, phase = 'vapour', speed = 68) => {
    const d = roundPath(pts);
    const stroke = fromT === toT ? `var(--cp-${fromT})` : makeGrad(pts[0][0], pts[0][1], pts.at(-1)[0], pts.at(-1)[1], fromT, toT);
    return `<path d="${d}" class="ref-casing"/><path d="${d}" class="ref-channel"/>` +
      `<path d="${d}" class="ref-core ${phase}" style="stroke:${stroke}" data-flow-path="1" data-fluid-kind="ref" data-ref-phase="${phase}" data-speed="${speed}" data-temp-start="${fromT}" data-temp-end="${toT}"/>`;
  };

  const sandTrack = (pts, speed = 42) => {
    const d = roundPath(pts);
    return `<path d="${d}" fill="none" stroke="var(--cp-warning)" stroke-width="1.6" stroke-dasharray="3 6" opacity=".6" data-flow-path="1" data-fluid-kind="sand" data-speed="${speed}"/>`;
  };

  const heatWave = (x1, y1, x2, y2) =>
    `<path class="thermal-track" data-thermal-path="1" d="M${x1} ${y1}L${x2} ${y2}" marker-end="url(#${pfx}-arr-warning)"/>`;

  const rolePill = (cx, cy, label, tone = 'muted') => {
    const w = Math.max(82, label.length * 7.2 + 16);
    const fill = tone === 'muted' ? 'var(--cp-surface-soft)' : 'var(--cp-accent-soft)';
    const stroke = tone === 'muted' ? 'var(--cp-border-strong)' : `var(--cp-${tone})`;
    const textCol = tone === 'muted' ? 'var(--cp-text-muted)' : `var(--cp-${tone})`;
    return `<rect x="${cx - w / 2}" y="${cy - 10}" width="${w}" height="20" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>` +
      `<text class="svg-label" x="${cx}" y="${cy + 4}" font-size="11" font-weight="700" style="fill:${textCol}" text-anchor="middle">${esc(label)}</text>`;
  };

  const pin = (idx, x, y) => {
    if (scope === 'card') return '';
    const isAct = activePart === idx;
    return `<g class="part-pin${isAct ? ' active' : ''}" data-part-idx="${idx}" role="button" tabindex="0" aria-label="Part ${idx + 1}">` +
      `<circle cx="${x}" cy="${y}" r="18" fill="var(--cp-surface)" opacity="0"/>` +
      `<circle class="pin-ring" cx="${x}" cy="${y}" r="13.5"/>` +
      `<text class="pin-num" x="${x}" y="${y + 4.8}" font-size="13.5" text-anchor="middle">${idx + 1}</text></g>`;
  };

  const organBox = (idx, x, y, w, h, rx = 12) =>
    activePart === idx ? `<rect class="organ-focus" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>` : '';

  const plateStack = (x, y, w, h, nPlates = 6, vertical = true) => {
    let s = `<rect class="plate-pack" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>`;
    for (let i = 1; i < nPlates; i++) {
      if (vertical) {
        const px = x + (w * i) / nPlates;
        s += `<path d="M${px.toFixed(1)} ${y + 6}V${y + h - 6}" stroke="var(--cp-border-strong)" stroke-width="1.4" stroke-dasharray="6 4"/>`;
      } else {
        const py = y + (h * i) / nPlates;
        s += `<path d="M${x + 6} ${py.toFixed(1)}H${x + w - 6}" stroke="var(--cp-border-strong)" stroke-width="1.4" stroke-dasharray="6 4"/>`;
      }
    }
    return s;
  };

  const scrollUnit = (cx, cy, r = 28, rpm = 1.6) =>
    `<circle class="machine-card" cx="${cx}" cy="${cy}" r="${r}"/>` +
    `<path d="M${cx} ${cy - r + 8}a${r - 8} ${r - 8} 0 1 1 -${r - 10} ${r - 8}a${r - 15} ${r - 15} 0 1 0 ${r - 10} -${r - 17}" fill="none" stroke="var(--cp-border-strong)" stroke-width="2.2" stroke-linecap="round"/>` +
    `<g data-orbit="1" data-orbit-r="3.8" data-rpm="${rpm}">` +
    `<path d="M${cx} ${cy - r + 12}a${r - 12} ${r - 12} 0 1 1 -${r - 14} ${r - 12}a${r - 19} ${r - 19} 0 1 0 ${r - 14} -${r - 21}" fill="none" stroke="var(--cp-accent)" stroke-width="2.5" stroke-linecap="round"/></g>`;

  const impellerWheel = (cx, cy, r = 24, rpm = 1.4) =>
    `<circle class="machine-sub" cx="${cx}" cy="${cy}" r="${r}"/>` +
    `<g data-rotor="1" data-cx="${cx}" data-cy="${cy}" data-rpm="${rpm}">` +
    [0, 60, 120, 180, 240, 300].map(a =>
      `<path d="M${cx} ${cy}Q${cx + 10} ${cy - 8} ${cx + r - 3} ${cy}" fill="none" stroke="var(--cp-accent)" stroke-width="2.6" stroke-linecap="round" transform="rotate(${a} ${cx} ${cy})"/>`
    ).join('') +
    `<circle cx="${cx}" cy="${cy}" r="5" fill="var(--cp-accent)"/></g>`;

  const gauge = (cx, cy, lbl, ang = -35) =>
    `<circle class="machine-card" cx="${cx}" cy="${cy}" r="16"/>` +
    `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(ang * Math.PI / 180) * 11).toFixed(1)}" y2="${(cy + Math.sin(ang * Math.PI / 180) * 11).toFixed(1)}" stroke="var(--cp-danger)" stroke-width="2.2" stroke-linecap="round"/>` +
    `<text class="svg-label svg-temp" x="${cx}" y="${cy + 29}" font-size="11" text-anchor="middle">${esc(lbl)}</text>`;

  let body = '', pins = '', focus = '';

  if (machineId === 'hiref_msw') {
    const m = modeIdx;
    const gwActive = m !== 3, clActive = m !== 1, recActive = m === 1 || m === 3;
    body += `<rect class="machine-card" x="62" y="18" width="716" height="404" rx="20"/>`;
    body += `<rect class="machine-sub" x="316" y="32" width="208" height="80" rx="14"/>`;
    body += scrollUnit(374, 72, 27, 1.8) + scrollUnit(466, 72, 27, 1.8);
    body += `<rect class="machine-card" x="342" y="136" width="156" height="56" rx="12"/>`;
    body += `<text class="svg-label svg-temp" x="420" y="160" font-size="12.5" text-anchor="middle">V4V + VD</text>`;
    body += `<text class="svg-label svg-sub" x="420" y="179" font-size="11" text-anchor="middle">${esc(T('Inversione / Recupero', '4-Way & Recovery', '四通换向与热回收阀'))}</text>`;
    body += refPipe([[384, 136], [384, 112]], 'link', 'link', 'vapour');
    body += refPipe([[456, 112], [456, 136]], 'danger', 'danger', 'vapour');

    body += plateStack(100, 126, 62, 190, 5, true);
    body += plateStack(678, 126, 62, 190, 5, true);
    body += plateStack(336, 344, 168, 52, 6, false);

    const evapLbl = T('EVAPORATORE', 'EVAPORATOR', '蒸发器');
    const condLbl = T('CONDENSATORE', 'CONDENSER', '冷凝器');
    const stbyLbl = T('STAND-BY', 'STANDBY', '待机');
    body += rolePill(131, 106, m <= 1 ? evapLbl : (m === 2 ? condLbl : stbyLbl), m <= 1 ? 'link' : (m === 2 ? 'danger' : 'muted'));
    body += rolePill(709, 106, m === 0 ? condLbl : (m === 1 ? stbyLbl : evapLbl), m === 0 ? 'danger' : (m === 1 ? 'muted' : 'link'));
    body += rolePill(420, 326, recActive ? condLbl : stbyLbl, recActive ? 'danger' : 'muted');

    body += waterPipe([[14, 148], [112, 148], [112, 294], [14, 294]], 'link', m === 2 ? 'danger' : 'link', { thin: true, dim: !gwActive });
    body += `<text class="svg-label svg-temp" x="131" y="76" font-size="12" text-anchor="middle">${esc(gwActive ? (m === 2 ? '16 → 21 °C' : '16 → 11 °C') : 'Falda 16 °C')}</text>`;
    body += waterPipe([[826, 294], [728, 294], [728, 148], [826, 148]], m === 0 ? 'link' : 'danger', m === 0 ? 'danger' : 'link', { thin: true, dim: !clActive });
    body += `<text class="svg-label svg-temp" x="709" y="76" font-size="12" text-anchor="middle">${esc(m === 0 ? '40 → 45 °C' : (clActive ? '18 → 13 °C' : 'Clima 2-tubi'))}</text>`;
    body += waterPipe([[236, 434], [356, 434], [356, 384], [484, 384], [484, 434], [604, 434]], 'link', 'danger', { thin: true, dim: !recActive });
    body += `<text class="svg-label svg-temp" x="672" y="438" font-size="12" text-anchor="middle">35 → 40 °C (PC1)</text>`;

    body += `<rect class="machine-card" x="342" y="242" width="156" height="52" rx="12"/>`;
    body += `<rect x="354" y="252" width="32" height="32" rx="6" fill="var(--cp-danger)" fill-opacity=".28" stroke="var(--cp-danger)" stroke-width="1.6"/>` +
      `<text class="svg-label svg-temp" x="370" y="272" font-size="11" text-anchor="middle">RL</text>`;
    body += `<path class="machine-sub" d="M424 254L464 282V254L424 282Z"/>` +
      `<text class="svg-label svg-temp" x="480" y="272" font-size="10.5" text-anchor="middle">EEV</text>`;

    if (m === 0) {
      body += refPipe([[162, 152], [342, 152]], 'link', 'link', 'vapour');
      body += refPipe([[498, 152], [678, 152]], 'danger', 'danger', 'vapour');
      body += refPipe([[678, 268], [498, 268]], 'danger', 'danger', 'liquid');
      body += refPipe([[342, 268], [162, 268]], 'link', 'link', 'mixture');
      body += heatWave(88, 220, 146, 220) + heatWave(694, 220, 752, 220);
    } else if (m === 1) {
      body += refPipe([[162, 152], [342, 152]], 'link', 'link', 'vapour');
      body += refPipe([[498, 174], [576, 174], [576, 368], [504, 368]], 'danger', 'danger', 'vapour');
      body += refPipe([[476, 344], [476, 294]], 'danger', 'danger', 'liquid');
      body += refPipe([[342, 268], [162, 268]], 'link', 'link', 'mixture');
      body += heatWave(88, 220, 146, 220) + heatWave(420, 356, 420, 404);
    } else if (m === 2) {
      body += refPipe([[678, 152], [498, 152]], 'link', 'link', 'vapour');
      body += refPipe([[342, 152], [162, 152]], 'danger', 'danger', 'vapour');
      body += refPipe([[162, 268], [342, 268]], 'danger', 'danger', 'liquid');
      body += refPipe([[498, 268], [678, 268]], 'link', 'link', 'mixture');
      body += heatWave(752, 220, 694, 220) + heatWave(146, 220, 88, 220);
    } else {
      body += refPipe([[678, 152], [498, 152]], 'link', 'link', 'vapour');
      body += refPipe([[342, 174], [264, 174], [264, 368], [336, 368]], 'danger', 'danger', 'vapour');
      body += refPipe([[364, 344], [364, 294]], 'danger', 'danger', 'liquid');
      body += refPipe([[498, 268], [678, 268]], 'link', 'link', 'mixture');
      body += heatWave(752, 220, 694, 220) + heatWave(420, 356, 420, 404);
    }
    focus += organBox(0, 310, 26, 220, 92) + organBox(1, 336, 130, 168, 68) + organBox(2, 92, 118, 656, 284) + organBox(3, 336, 236, 168, 64);
    pins += pin(0, 296, 68) + pin(1, 518, 140) + pin(2, 656, 136) + pin(3, 320, 246);
  } else if (machineId === 'hiref_ksw') {
    const partLoad = modeIdx === 1;
    body += `<rect class="machine-card" x="56" y="24" width="728" height="402" rx="20"/>`;
    body += `<text class="svg-label svg-sub" x="420" y="48" font-size="13" text-anchor="middle">${esc(T('Secondo stadio PC1 · Circuito R134a / R513A per alta condensazione (fino a 80 °C)', 'PC1 High-Temp Stage · R134a / R513A Circuit for up to 80 °C Supply', 'PC1 二级高温水源热泵 · R134a / R513A 高冷凝温度专用回路'))}</text>`;
    body += plateStack(136, 118, 68, 224, 6);
    body += plateStack(636, 118, 68, 224, 6);
    body += rolePill(170, 98, T('EVAP. ~32 °C', 'EVAP. ~32 °C', '蒸发 ~32 °C'), 'warning');
    body += rolePill(670, 98, T('COND. ~74 °C', 'COND. ~74 °C', '冷凝 ~74 °C'), 'danger');
    body += waterPipe([[18, 146], [150, 146], [150, 314], [18, 314]], 'warning', 'link', { thin: true });
    body += `<text class="svg-label svg-temp" x="170" y="74" font-size="12.5" text-anchor="middle">40 → 35 °C</text>`;
    body += `<text class="svg-label svg-sub" x="170" y="366" font-size="11.5" text-anchor="middle">P05 · 26 m³/h</text>`;
    body += waterPipe([[822, 314], [690, 314], [690, 146], [822, 146]], 'warning', 'danger', { thin: true });
    body += `<text class="svg-label svg-temp" x="670" y="74" font-size="12.5" text-anchor="middle">65 → 70 °C</text>`;
    body += `<text class="svg-label svg-sub" x="670" y="366" font-size="11.5" text-anchor="middle">P04 → 2×SC1</text>`;
    body += `<rect class="machine-sub" x="312" y="70" width="216" height="92" rx="14"/>`;
    body += scrollUnit(370, 116, 30, 1.9) + scrollUnit(470, 116, 30, partLoad ? 0 : 1.9);
    if (partLoad) body += `<text class="svg-label svg-sub" x="470" y="156" font-size="10.5" text-anchor="middle">50% OFF</text>`;
    body += `<rect class="machine-sub" x="336" y="318" width="44" height="54" rx="8"/>` +
      `<text class="svg-label svg-temp" x="358" y="350" font-size="11.5" text-anchor="middle">RL</text>`;
    body += `<path class="machine-card" d="M416 330L464 360V330L416 360Z"/>` +
      `<text class="svg-label svg-temp" x="440" y="382" font-size="11.5" text-anchor="middle">EEV</text>`;
    body += refPipe([[192, 146], [192, 110], [312, 110]], 'warning', 'warning', 'vapour');
    body += refPipe([[528, 110], [648, 110], [648, 146]], 'danger', 'danger', 'vapour');
    body += refPipe([[648, 314], [648, 345], [464, 345]], 'danger', 'danger', 'liquid');
    body += refPipe([[416, 345], [380, 345]], 'danger', 'danger', 'liquid');
    body += refPipe([[336, 345], [192, 345], [192, 314]], 'link', 'warning', 'mixture');
    body += heatWave(122, 230, 184, 230) + heatWave(656, 230, 718, 230);
    body += `<rect class="machine-sub" x="296" y="210" width="248" height="62" rx="12"/>` +
      `<text class="svg-label svg-title" x="420" y="236" font-size="14" text-anchor="middle">COP ~4,9 · 180,5 kW</text>` +
      `<text class="svg-label svg-sub" x="420" y="258" font-size="12" text-anchor="middle">${esc(T('Rapporto compressione ridotto', 'Low compression ratio via 40 °C source', '40 °C 中温进水大幅降低压缩比'))}</text>`;
    focus += organBox(0, 126, 110, 88, 240) + organBox(1, 306, 64, 228, 104) + organBox(2, 626, 110, 88, 240) + organBox(3, 328, 310, 152, 82);
    pins += pin(0, 224, 152) + pin(1, 292, 86) + pin(2, 614, 152) + pin(3, 492, 320);
  } else if (machineId === 'dab_ss6') {
    const running = modeIdx === 0;
    body += `<rect class="aquifer-fill" x="148" y="54" width="544" height="374" rx="18"/>`;
    body += `<rect class="machine-card" x="308" y="24" width="224" height="408" rx="10"/>`;
    for (const sy of [266, 296, 326, 356, 386]) {
      body += `<line x1="302" y1="${sy}" x2="314" y2="${sy}" stroke="var(--cp-link)" stroke-width="4"/>` +
        `<line x1="526" y1="${sy}" x2="538" y2="${sy}" stroke="var(--cp-link)" stroke-width="4"/>`;
    }
    body += `<rect class="machine-sub" x="366" y="74" width="108" height="336" rx="12"/>`;
    body += `<line x1="478" y1="54" x2="478" y2="360" stroke="var(--cp-accent)" stroke-width="3" stroke-dasharray="6 3"/>`;
    body += `<rect class="machine-card" x="378" y="302" width="84" height="96" rx="8"/>`;
    for (let fy = 316; fy <= 384; fy += 13) body += `<line x1="386" y1="${fy}" x2="454" y2="${fy}" stroke="var(--cp-border-strong)" stroke-width="1.8"/>`;
    body += `<text class="svg-label svg-title" x="420" y="355" font-size="13" text-anchor="middle">TR Motor</text>`;
    body += `<rect class="plate-pack" x="378" y="258" width="84" height="38" rx="4"/>`;
    for (let sx = 388; sx <= 452; sx += 10) body += `<line x1="${sx}" y1="263" x2="${sx}" y2="291" stroke="var(--cp-accent)" stroke-width="1.6"/>`;
    body += `<line x1="420" y1="118" x2="420" y2="302" stroke="var(--cp-border-strong)" stroke-width="3.5"/>`;
    for (const sy of [230, 190, 150]) {
      body += `<rect class="machine-card" x="378" y="${sy - 16}" width="84" height="32" rx="6"/>`;
      body += `<g data-rotor="1" data-cx="420" data-cy="${sy}" data-rpm="${running ? 2.2 : 0}">` +
        `<path d="M392 ${sy + 7}L420 ${sy - 9}L448 ${sy + 7}Z" fill="var(--cp-accent)" opacity=".88"/></g>`;
    }
    const vY = running ? 92 : 109;
    body += `<path d="M386 113h68" stroke="var(--cp-border-strong)" stroke-width="3.2"/>` +
      `<path d="M398 ${vY}h44l-8 -10h-28Z" fill="var(--cp-accent)"/>`;
    body += waterPipe([[216, 360], [344, 360], [344, 277], [420, 277], [420, 16]], 'link', 'link', { thin: true, animated: running, marker: running });
    body += waterPipe([[624, 360], [496, 360], [496, 277], [420, 277]], 'link', 'link', { thin: true, animated: running });
    body += `<text class="svg-label svg-title" x="222" y="94" font-size="14.5" text-anchor="middle">${esc(T('Falda ~16 °C', 'Aquifer ~16 °C', '地下含水层 ~16 °C'))}</text>`;
    body += `<text class="svg-label svg-temp" x="614" y="156" font-size="13.5" text-anchor="middle">930 kPa (9,3 bar)</text>`;
    body += `<text class="svg-label svg-sub" x="612" y="294" font-size="10.5" text-anchor="middle">${esc(running ? T('L’acqua raffredda il motore TR', 'Inflow cools TR motor shell', '吸入井水贴壁冷却电机') : T('Valvola chiusa · Colonna piena', 'Check valve shut · Riser held', '止回阀闭合保压'))}</text>`;
    focus += organBox(0, 370, 296, 100, 108) + organBox(1, 370, 252, 100, 48) + organBox(2, 370, 128, 100, 122) + organBox(3, 376, 74, 88, 46);
    pins += pin(0, 336, 350) + pin(1, 336, 276) + pin(2, 336, 190) + pin(3, 336, 96);
  } else if (machineId === 'nobel_nic') {
    const purging = modeIdx === 1;
    body += `<rect class="machine-card" x="326" y="54" width="188" height="84" rx="10"/>`;
    body += `<path class="machine-card" d="M326 132h188L452 332h-64Z"/>`;
    body += `<path d="M352 396v28M488 396v28" stroke="var(--cp-border-strong)" stroke-width="6" stroke-linecap="round"/>`;
    body += `<rect class="machine-sub" x="318" y="332" width="204" height="68" rx="32"/>`;
    body += `<rect class="machine-card" x="396" y="42" width="48" height="114" rx="6"/>`;
    body += waterPipe([[102, 102], [344, 102]], 'link', 'link', { marker: true });
    const spiralPts = [[346, 108], [488, 134], [358, 182], [468, 228], [382, 276], [442, 314], [420, 360]];
    body += `<path d="${roundPath(spiralPts)}" fill="none" stroke="var(--cp-link)" stroke-width="3" opacity=".55" data-flow-path="1" data-fluid-kind="water" data-temp-start="link" data-temp-end="link"/>`;
    body += sandTrack(spiralPts, 48);
    body += `<path d="M346 388q74 -24 148 0Z" fill="var(--cp-warning)" opacity="${purging ? '.35' : '.82'}"/>`;
    body += `<rect class="machine-card" x="522" y="354" width="32" height="24" rx="4"/>`;
    if (purging) {
      body += waterPipe([[500, 366], [690, 366]], 'warning', 'warning', { thin: true, marker: true });
      body += sandTrack([[420, 372], [690, 366]], 64);
    }
    body += waterPipe([[420, 304], [420, 62], [696, 62]], 'link', 'link', { marker: true });
    body += `<text class="svg-label svg-title" x="176" y="66" font-size="13.5" text-anchor="middle">${esc(T('Ingresso tangenziale DN125', 'Tangential inlet DN125', 'DN125 切向加速进水'))}</text>`;
    body += `<text class="svg-label svg-title" x="632" y="42" font-size="13.5" text-anchor="middle">${esc(T('Acqua depurata → 2×T7', 'Clean vortex → 2×T7', '净水内涡流 → 2×T7'))}</text>`;
    body += `<text class="svg-label svg-sub" x="676" y="218" font-size="12" text-anchor="middle">${esc(T('Inox AISI 304 · >50 µm', 'AISI 304 · >50 µm grit', 'AISI 304 锥体除砂 (>50 µm)'))}</text>`;
    body += `<text class="svg-label svg-sub" x="646" y="340" font-size="12" text-anchor="middle">${esc(T('Valvola a sfera 1" spurgo', '1" purge ball valve', '1" 底部排砂球阀'))}</text>`;
    focus += organBox(0, 236, 78, 120, 50) + organBox(1, 320, 134, 200, 198) + organBox(2, 312, 326, 248, 80, 32) + organBox(3, 388, 36, 64, 126);
    pins += pin(0, 272, 102) + pin(1, 502, 218) + pin(2, 296, 366) + pin(3, 474, 88);
  } else if (machineId === 'nobel_ml') {
    const flushing = modeIdx === 1;
    body += `<rect x="284" y="96" width="232" height="82" rx="18" fill="var(--cp-warning)" fill-opacity=".22" stroke="var(--cp-border-strong)" stroke-width="2.2"/>`;
    body += `<rect class="machine-card" x="304" y="178" width="192" height="184" rx="22"/>`;
    body += gauge(352, 62, 'P1', -30) + gauge(448, 62, 'P2', flushing ? -80 : -32);
    body += `<path d="M464 62H614V138" fill="none" stroke="var(--cp-accent)" stroke-width="1.8" stroke-dasharray="4 3"/>`;
    body += `<rect class="machine-card" x="562" y="138" width="164" height="92" rx="12"/>` +
      `<rect class="machine-sub" x="578" y="152" width="132" height="36" rx="6"/>` +
      `<text class="svg-label svg-temp" x="644" y="175" font-size="12" text-anchor="middle">${flushing ? 'ML/AP: WASH ON' : 'ML/AP: ΔP OK'}</text>` +
      `<text class="svg-label svg-sub" x="644" y="212" font-size="11.5" text-anchor="middle">${esc(T('Quadro ΔP / Timer', 'ΔP / Timer Controller', 'ML/AP 压差电脑控制箱'))}</text>`;
    body += `<rect class="plate-pack" x="334" y="192" width="132" height="154" rx="10"/>`;
    for (let my = 210; my <= 330; my += 20) body += `<line x1="340" y1="${my}" x2="460" y2="${my}" stroke="var(--cp-border-strong)" stroke-width="1.2" stroke-dasharray="4 4"/>`;
    body += `<line x1="400" y1="186" x2="400" y2="356" stroke="var(--cp-accent)" stroke-width="3.5"/>`;
    body += `<g data-rotor="1" data-cx="400" data-cy="268" data-rpm="${flushing ? 3.2 : 0}">` +
      `<path d="M352 268h96M400 226v84" stroke="var(--cp-accent)" stroke-width="3.2" stroke-linecap="round"/>` +
      `<circle cx="352" cy="268" r="4.5" fill="var(--cp-link)"/><circle cx="448" cy="268" r="4.5" fill="var(--cp-link)"/></g>`;
    body += waterPipe([[84, 136], [356, 136], [356, 250], [444, 250], [444, 136], [536, 136]], 'link', 'link', { thin: true, marker: true });
    body += `<rect class="machine-sub" x="376" y="362" width="48" height="32" rx="6"/>`;
    if (flushing) {
      body += waterPipe([[400, 268], [400, 426], [568, 426]], 'warning', 'warning', { thin: true, marker: true });
      body += sandTrack([[400, 236], [400, 426], [568, 426]], 62);
      body += `<text class="svg-label svg-title" x="668" y="408" font-size="13" text-anchor="middle">${esc(T('Getti Turboclean → Scarico Ø50', 'Turboclean jets → Ø50 drain', 'Turboclean 高压水射流排污'))}</text>`;
    }
    body += `<text class="svg-label svg-title" x="166" y="114" font-size="13.5" text-anchor="middle">${esc(T('Ingresso DN100 (65 m³/h)', 'DN100 inlet (65 m³/h)', 'DN100 进水 (65 m³/h)'))}</text>`;
    focus += organBox(0, 278, 38, 244, 142) + organBox(1, 326, 186, 148, 166) + organBox(2, 344, 218, 112, 100) + organBox(3, 368, 356, 364, 78);
    pins += pin(0, 304, 62) + pin(1, 300, 268) + pin(2, 400, 206) + pin(3, 352, 382);
  } else if (machineId === 'elbi_dl') {
    const surge = modeIdx === 0;
    body += waterPipe([[90, 404], [750, 404]], 'link', 'link', { marker: true });
    body += waterPipe([[420, 404], [420, 336]], 'link', 'link', { thin: true, speed: surge ? 50 : 26 });
    body += `<circle cx="420" cy="404" r="6" fill="var(--cp-link)" stroke="var(--cp-surface)" stroke-width="2"/>`;
    body += `<path d="M332 332v56M508 332v56" stroke="var(--cp-border-strong)" stroke-width="6" stroke-linecap="round"/>`;
    body += `<rect class="machine-card" x="298" y="44" width="244" height="298" rx="76"/>`;
    body += `<rect class="machine-sub" x="406" y="26" width="28" height="22" rx="4"/>`;
    body += gauge(574, 112, '2,5 bar', -25);
    const bw = surge ? 84 : 58;
    body += `<g data-pulse="1" data-cx="420" data-cy="194" data-amp="${surge ? 0.055 : 0.025}">` +
      `<path d="M408 48h24Q${420 + bw} 194 436 336h-32Q${420 - bw} 194 408 48Z" fill="var(--cp-link)" fill-opacity=".25" stroke="var(--cp-accent)" stroke-width="3.2"/></g>`;
    body += `<text class="svg-label svg-sub" x="172" y="138" font-size="12.5" text-anchor="middle">${esc(T('Camera gas (2,5 bar)', 'Gas cushion (2.5 bar)', '外腔 2.5 bar 预充气垫'))}</text>`;
    body += `<text class="svg-label svg-title" x="668" y="176" font-size="13.5" text-anchor="middle">${esc(T('Membrana a tutta altezza', 'Full-height bladder', '上下锚定全容积胶囊'))}</text>`;
    body += `<text class="svg-label svg-temp" x="668" y="218" font-size="14" text-anchor="middle">DL 1000 · 10 bar</text>`;
    body += `<text class="svg-label svg-sub" x="656" y="380" font-size="12.5" text-anchor="middle">${esc(T('Derivazione a T (G 2" Top-Pro)', 'Side-branch T (G 2" Top-Pro)', 'G 2" Top-Pro 防腐旁路法兰'))}</text>`;
    focus += organBox(0, 304, 52, 232, 280, 70) + organBox(1, 336, 44, 168, 296, 40) + organBox(2, 290, 36, 260, 312, 80) + organBox(3, 376, 336, 88, 78);
    pins += pin(0, 326, 112) + pin(1, 420, 148) + pin(2, 276, 218) + pin(3, 462, 370);
  } else if (machineId === 'dab_dcm') {
    const isHalf = modeIdx === 1, isStandby = modeIdx === 2;
    const rpm1 = isHalf ? 0.65 : 2.1, rpm2 = isStandby ? 0 : (isHalf ? 0.65 : 2.1);
    body += waterPipe([[66, 250], [220, 250], [220, 158], [556, 158], [556, 250], [774, 250]], 'danger', 'danger', { speed: isHalf ? 30 : 68, marker: true });
    body += waterPipe([[220, 250], [220, 342], [556, 342], [556, 250]], 'danger', 'danger', { animated: !isStandby, speed: isHalf ? 30 : 68, dim: isStandby });
    for (const [idx, cy, rpm, hzTxt] of [[0, 158, rpm1, isHalf ? 'ΔP-c · 25 Hz (~15% kW)' : 'ΔP-c · 50 Hz (100%)'], [1, 342, rpm2, isStandby ? '0 Hz · STAND-BY' : (isHalf ? 'ΔP-c · 25 Hz (~15% kW)' : 'ΔP-c · 50 Hz (100%)')]]) {
      body += `<rect class="machine-card" x="276" y="${cy - 50}" width="96" height="44" rx="8"/>` +
        `<text class="svg-label svg-temp" x="324" y="${cy - 23}" font-size="12" text-anchor="middle">MCE/C</text>`;
      body += `<rect class="plate-pack" x="374" y="${cy - 12}" width="14" height="24" rx="3"/>`;
      body += `<circle class="machine-card" cx="424" cy="${cy}" r="38"/>` + impellerWheel(424, cy, 28, rpm);
      body += `<text class="svg-label svg-sub" x="424" y="${cy + (idx === 0 ? -64 : 58)}" font-size="12.5" text-anchor="middle">${esc(hzTxt)}</text>`;
    }
    const flapAngle = isStandby ? 38 : 0;
    body += `<circle class="machine-card" cx="556" cy="250" r="24"/>` +
      `<line x1="556" y1="228" x2="556" y2="272" stroke="var(--cp-accent)" stroke-width="4.2" stroke-linecap="round" transform="rotate(${flapAngle} 556 250)"/>`;
    body += `<text class="svg-label svg-title" x="136" y="206" font-size="13.5" text-anchor="middle">${esc(T('Flangia PN16 aspirazione', 'PN16 inline suction', 'PN16 同轴进水法兰'))}</text>`;
    body += `<text class="svg-label svg-title" x="686" y="206" font-size="13.5" text-anchor="middle">${esc(T('Mandata ΔP-c costante', 'Constant ΔP-c delivery', 'ΔP-c 恒压差出水'))}</text>`;
    focus += organBox(0, 270, 102, 108, 56) + organBox(1, 378, 112, 92, 92) + organBox(2, 64, 218, 712, 64) + organBox(3, 524, 218, 64, 64);
    pins += pin(0, 256, 128) + pin(1, 484, 132) + pin(2, 146, 298) + pin(3, 598, 250);
  } else if (machineId === 'dab_evoplus') {
    const isCharge = modeIdx === 1;
    const tone = isCharge ? 'danger' : 'warning';
    body += waterPipe([[236, 412], [236, 230], [236, 48]], tone, tone, { speed: isCharge ? 66 : 36, marker: true });
    body += `<rect x="192" y="152" width="92" height="156" rx="22" fill="var(--cp-warning)" fill-opacity=".18" stroke="var(--cp-border-strong)" stroke-width="2.2"/>`;
    body += impellerWheel(238, 230, 30, isCharge ? 2.2 : 1.15);
    body += `<rect class="machine-card" x="284" y="130" width="266" height="200" rx="18"/>`;
    body += `<rect class="machine-card" x="550" y="114" width="116" height="232" rx="16"/>` +
      `<rect class="machine-sub" x="568" y="148" width="80" height="44" rx="6"/>` +
      `<text class="svg-label svg-temp" x="608" y="175" font-size="12" text-anchor="middle">EVOPLUS</text>` +
      `<text class="svg-label svg-sub" x="608" y="222" font-size="11.5" text-anchor="middle">${isCharge ? '16 m³/h' : '0,34 kW'}</text>`;
    body += `<rect class="machine-sub" x="314" y="146" width="204" height="36" rx="6"/>` +
      `<rect class="machine-sub" x="314" y="278" width="204" height="36" rx="6"/>`;
    body += `<text class="svg-label svg-sub" x="416" y="169" font-size="12" text-anchor="middle">${esc(T('Avvolgimenti statore ECM (asciutti)', 'Dry ECM stator windings', '外部干燥 ECM 定子绕组'))}</text>`;
    body += `<rect x="282" y="190" width="246" height="80" rx="12" fill="var(--cp-link)" fill-opacity=".16" stroke="var(--cp-accent)" stroke-width="2.8" stroke-dasharray="7 3"/>`;
    body += `<rect class="plate-pack" x="304" y="218" width="14" height="24" rx="3"/><rect class="plate-pack" x="502" y="218" width="14" height="24" rx="3"/>`;
    body += `<line x1="238" y1="230" x2="520" y2="230" stroke="var(--cp-border-strong)" stroke-width="5"/>`;
    body += `<g data-pulse="1" data-cx="412" data-cy="230" data-amp="0.025"><rect class="tag-pill-bg" x="348" y="206" width="128" height="48" rx="8"/>` +
      `<text class="svg-label svg-title" x="412" y="235" font-size="12.5" text-anchor="middle">${esc(T('Rotore bagnato PM', 'Wet PM Rotor', '水浸润滑永磁转子'))}</text></g>`;
    body += `<text class="svg-label svg-temp" x="118" y="88" font-size="13.5" text-anchor="middle">${isCharge ? 'P01 → S2 (60 °C)' : 'ACR · 48 °C (P02/P03)'}</text>`;
    focus += organBox(0, 280, 184, 254, 92) + organBox(1, 340, 200, 144, 60) + organBox(2, 306, 138, 222, 184) + organBox(3, 186, 146, 104, 168);
    pins += pin(0, 526, 204) + pin(1, 412, 256) + pin(2, 416, 114) + pin(3, 174, 230);
  } else if (machineId === 'spade_ambra') {
    const inspectMode = modeIdx === 1;
    body += `<path d="M326 364v54M514 364v54" stroke="var(--cp-border-strong)" stroke-width="6" stroke-linecap="round"/>`;
    body += `<rect class="machine-card" x="286" y="76" width="268" height="296" rx="22"/>`;
    const lidY = inspectMode ? 48 : 62;
    body += `<rect class="machine-sub" x="272" y="${lidY}" width="296" height="20" rx="6"/>`;
    for (const bx of [292, 346, 494, 548]) body += `<circle cx="${bx}" cy="${lidY + 10}" r="3.5" fill="var(--cp-border-strong)"/>`;
    body += gauge(248, 178, 'P1', -35);
    body += gauge(248, 304, 'P2', inspectMode ? -75 : -30);
    body += `<line x1="290" y1="296" x2="550" y2="296" stroke="var(--cp-accent)" stroke-width="4"/>`;
    for (const cx of [332, 390, 450, 508]) {
      body += `<rect class="plate-pack" x="${cx - 18}" y="138" width="36" height="158" rx="8"/>`;
      body += `<line x1="${cx}" y1="146" x2="${cx}" y2="312" stroke="var(--cp-link)" stroke-width="2.4" stroke-dasharray="4 4"/>`;
    }
    body += `<text class="svg-label svg-title" x="420" y="114" font-size="13" text-anchor="middle">${esc(T('Multicartuccia 50 µm', '50 µm Cartridges', '50 µm 聚酯多滤芯束'))}</text>`;
    body += waterPipe([[68, 114], [306, 114]], 'link', 'link');
    body += waterPipe([[420, 298], [420, 340], [748, 340]], 'link', 'link', { marker: true, speed: inspectMode ? 28 : 58 });
    if (inspectMode) {
      body += waterPipe([[356, 372], [356, 426], [204, 426]], 'warning', 'warning', { thin: true, marker: true });
      body += sandTrack([[350, 372], [350, 420], [204, 420]], 52);
    }
    body += `<text class="svg-label svg-title" x="166" y="94" font-size="13.5" text-anchor="middle">${esc(T('Ingresso DN100 (66 m³/h)', 'DN100 inlet (66 m³/h)', 'DN100 自来水进水'))}</text>`;
    body += `<text class="svg-label svg-title" x="668" y="318" font-size="13.5" text-anchor="middle">${esc(T('Filtrata 50 µm → 2×S1', '50 µm clean → 2×S1', '50 µm 净水 → 2×S1'))}</text>`;
    focus += organBox(0, 266, 18, 308, 70) + organBox(1, 306, 122, 228, 176) + organBox(2, 286, 286, 268, 34) + organBox(3, 224, 276, 336, 152);
    pins += pin(0, 582, 58) + pin(1, 574, 206) + pin(2, 574, 276) + pin(3, 286, 396);
  } else if (machineId === 'dab_nkve') {
    const dualPeak = modeIdx === 1;
    body += `<rect class="machine-card" x="56" y="106" width="144" height="264" rx="18"/>`;
    body += `<rect class="aquifer-fill" x="68" y="162" width="120" height="196" rx="10"/>`;
    body += `<text class="svg-label svg-title" x="128" y="136" font-size="14.5" text-anchor="middle">2 × S1</text>`;
    body += `<text class="svg-label svg-sub" x="128" y="264" font-size="13" text-anchor="middle">4.000 L</text>`;
    body += waterPipe([[200, 336], [536, 336]], 'link', 'link');
    body += waterPipe([[356, 336], [356, 114], [768, 114]], 'link', 'link', { marker: true, speed: dualPeak ? 74 : 46 });
    body += waterPipe([[516, 336], [516, 114], [768, 114]], 'link', 'link', { animated: dualPeak, dim: !dualPeak, speed: 74 });
    for (const [idx, cx, active] of [[0, 356, true], [1, 516, dualPeak]]) {
      body += `<rect class="machine-card" x="${cx - 38}" y="52" width="76" height="44" rx="8"/>` +
        `<text class="svg-label svg-temp" x="${cx}" y="79" font-size="12" text-anchor="middle">MCE/P</text>`;
      body += `<rect class="machine-sub" x="${cx - 30}" y="138" width="60" height="176" rx="8"/>`;
      for (const sy of [282, 242, 202, 162]) {
        body += `<g data-rotor="1" data-cx="${cx}" data-cy="${sy}" data-rpm="${active ? 2.2 : 0}">` +
          `<path d="M${cx - 18} ${sy + 5}L${cx} ${sy - 7}L${cx + 18} ${sy + 5}Z" fill="var(--cp-accent)"/></g>`;
      }
      if (!active && idx === 1) body += `<text class="svg-label svg-sub" x="${cx}" y="382" font-size="12" text-anchor="middle">STAND-BY</text>`;
    }
    body += `<rect class="machine-card" x="640" y="148" width="54" height="86" rx="22"/>` +
      `<line x1="667" y1="114" x2="667" y2="148" stroke="var(--cp-border-strong)" stroke-width="4"/>`;
    body += `<text class="svg-label svg-temp" x="688" y="88" font-size="14" text-anchor="middle">GP1: 7,3 bar · GP2: 4,3 bar</text>`;
    focus += organBox(0, 48, 98, 160, 280) + organBox(1, 318, 132, 76, 188) + organBox(2, 310, 46, 252, 56) + organBox(3, 626, 102, 144, 140);
    pins += pin(0, 128, 86) + pin(1, 304, 224) + pin(2, 436, 74) + pin(3, 714, 188);
  } else if (machineId === 'spade_corallo') {
    const regen = modeIdx === 1;
    body += `<rect x="278" y="42" width="124" height="54" rx="10" fill="var(--cp-warning)" fill-opacity=".22" stroke="var(--cp-border-strong)" stroke-width="2.2"/>`;
    body += `<text class="svg-label svg-temp" x="340" y="28" font-size="13" text-anchor="middle">CLACK 1"1/2</text>`;
    body += `<rect class="machine-card" x="248" y="96" width="184" height="308" rx="46"/>`;
    body += `<rect x="264" y="152" width="152" height="222" rx="20" fill="var(--cp-warning)" fill-opacity=".26" stroke="var(--cp-warning)" stroke-width="2"/>`;
    body += `<rect class="machine-sub" x="332" y="96" width="16" height="282" rx="4"/>`;
    body += `<text class="svg-label svg-title" x="340" y="428" font-size="13" text-anchor="middle">${esc(T('Resine 200 L (Na⁺)', '200 L Resin (Na⁺)', '200 L 阳离子树脂'))}</text>`;
    body += `<rect class="machine-card" x="486" y="14" width="84" height="38" rx="8"/>` +
      `<line x1="528" y1="52" x2="528" y2="68" stroke="var(--cp-accent)" stroke-width="2.5"/>` +
      `<circle cx="528" cy="68" r="6" fill="var(--cp-surface)" stroke="var(--cp-accent)" stroke-width="2.2"/>` +
      `<text class="svg-label svg-temp" x="528" y="38" font-size="11.5" text-anchor="middle">Pulse INOX</text>`;
    body += `<path class="machine-card" d="M532 178h168l-12 224H544Z"/>`;
    body += `<rect class="aquifer-fill" x="548" y="256" width="136" height="136" rx="8"/>`;
    body += `<rect class="machine-sub" x="558" y="192" width="18" height="196" rx="4"/>`;
    body += `<text class="svg-label svg-title" x="616" y="428" font-size="13" text-anchor="middle">${esc(T('Tino salamoia 340 L', '340 L Brine tank', '340 L 溶盐箱'))}</text>`;
    body += `<text class="svg-label svg-temp" x="626" y="332" font-size="13.5" text-anchor="middle">NaCl + H₂O</text>`;

    if (!regen) {
      body += waterPipe([[68, 68], [296, 68], [296, 368], [340, 368], [340, 68], [768, 68]], 'link', 'success', { thin: true, marker: true });
      body += `<text class="svg-label svg-title" x="158" y="50" font-size="13" text-anchor="middle">${esc(T('Acqua dura (Ca²⁺, Mg²⁺)', 'Hard water (Ca²⁺, Mg²⁺)', '含钙镁硬水'))}</text>`;
      body += `<text class="svg-label svg-title" x="676" y="50" font-size="13" text-anchor="middle">${esc(T('Addolcita → T3/T4 → S2', 'Softened → T3/T4 → S2', '软化水 → T3/T4 → S2'))}</text>`;
    } else {
      body += waterPipe([[567, 356], [567, 128], [376, 128], [376, 368], [340, 368], [340, 128], [124, 128]], 'warning', 'warning', { thin: true, marker: true });
      body += sandTrack([[334, 348], [334, 134], [124, 134]], 54);
      body += `<text class="svg-label svg-title" x="166" y="108" font-size="13" text-anchor="middle">${esc(T('Scarico rigenerazione', 'Regeneration drain', '再生置换废液排走'))}</text>`;
    }
    focus += organBox(0, 272, 36, 136, 64) + organBox(1, 242, 100, 196, 308, 46) + organBox(2, 526, 172, 180, 236) + organBox(3, 478, 10, 100, 72);
    pins += pin(0, 256, 68) + pin(1, 452, 252) + pin(2, 712, 286) + pin(3, 528, 98);
  } else if (machineId === 'dab_micra') {
    const lowLevel = modeIdx === 1;
    body += `<rect class="machine-card" x="78" y="138" width="356" height="268" rx="18"/>`;
    const waterTop = lowLevel ? 344 : 210;
    body += `<rect class="aquifer-fill" x="92" y="${waterTop}" width="328" height="${392 - waterTop}" rx="10"/>`;
    body += waterPipe([[62, 92], [164, 92], [164, 168]], 'link', 'link', { thin: true, animated: !lowLevel });
    body += `<rect class="plate-pack" x="136" y="158" width="56" height="36" rx="6"/>`;
    body += `<rect class="machine-sub" x="278" y="218" width="44" height="164" rx="8"/>`;
    for (const sy of [342, 308, 274]) {
      body += `<g data-rotor="1" data-cx="300" data-cy="${sy}" data-rpm="${lowLevel ? 0 : 3.2}">` +
        `<path d="M286 ${sy + 4}L300 ${sy - 6}L314 ${sy + 4}Z" fill="var(--cp-accent)"/></g>`;
    }
    body += `<rect class="machine-card" x="506" y="108" width="136" height="86" rx="14"/>`;
    body += `<rect class="machine-sub" x="522" y="118" width="104" height="38" rx="6"/>` +
      `<text class="svg-label svg-temp" x="574" y="142" font-size="12" text-anchor="middle">Active Driver</text>`;
    body += `<text class="svg-label svg-sub" x="574" y="178" font-size="11.5" text-anchor="middle">130 Hz · 4,8 bar</text>`;
    body += `<rect class="plate-pack" x="518" y="194" width="112" height="22" rx="5"/>`;
    body += waterPipe([[300, 218], [300, 96], [476, 96], [476, 205], [768, 205]], 'link', 'success', { thin: true, animated: !lowLevel, marker: !lowLevel });
    if (lowLevel) {
      body += waterPipe([[434, 290], [372, 290]], 'link', 'link', { thin: true, marker: true });
      body += `<text class="svg-label svg-title" x="590" y="294" font-size="13" text-anchor="middle">${esc(T('Reintegro soccorso (non potabile)', 'Backup non-potable make-up', '低液位保护与非饮用水补水'))}</text>`;
    }
    body += `<text class="svg-label svg-title" x="288" y="76" font-size="14" text-anchor="middle">${esc(T('Vasca piovana 3.500 L', '3,500 L Rainwater tank', '3,500 L 雨水蓄水池'))}</text>`;
    body += `<text class="svg-label svg-title" x="718" y="176" font-size="13.5" text-anchor="middle">${esc(T('Irrigazione giardino', 'Garden irrigation', '公共绿地喷灌'))}</text>`;
    focus += organBox(0, 72, 132, 368, 280) + organBox(1, 268, 210, 64, 178) + organBox(2, 498, 102, 152, 120) + organBox(3, 648, 150, 136, 78);
    pins += pin(0, 114, 184) + pin(1, 344, 304) + pin(2, 574, 242) + pin(3, 736, 238);
  } else if (machineId === 'plate_hx') {
    const isSC1 = modeIdx === 1;
    body += `<rect class="machine-card" x="196" y="38" width="448" height="374" rx="18"/>`;
    const xs = [260, 324, 388, 452, 516, 580];
    for (const px of xs) {
      body += `<path d="M${px} 108l7 16l-7 16l7 16l-7 16l7 16l-7 16l7 16l-7 16l7 16l-7 16l7 16l-7 16l7 16l-7 16" fill="none" stroke="var(--cp-border-strong)" stroke-width="3"/>`;
    }
    body += waterPipe([[68, 62], [548, 62]], 'danger', 'danger', { thin: true });
    for (const cx of [292, 420, 548]) body += waterPipe([[cx, 62], [cx, 388]], 'danger', isSC1 ? 'warning' : 'link', { thin: true });
    body += waterPipe([[548, 388], [68, 388]], 'link', 'link', { thin: true, marker: true });

    body += waterPipe([[772, 352], [356, 352]], 'link', 'link', { thin: true });
    for (const cx of [356, 484]) {
      body += waterPipe([[cx, 352], [cx, 96]], 'link', 'danger', { thin: true });
      body += heatWave(cx - 28, 226, cx - 4, 226);
    }
    body += waterPipe([[356, 96], [772, 96]], 'danger', 'danger', { thin: true, marker: true });

    body += `<text class="svg-label svg-temp" x="126" y="46" font-size="12.5" text-anchor="middle">${isSC1 ? 'PC1 · 70 °C' : 'P08 · Centrale'}</text>`;
    body += `<text class="svg-label svg-temp" x="126" y="416" font-size="12.5" text-anchor="middle">${isSC1 ? 'Ritorno · 65 °C' : 'Ritorno PC2'}</text>`;
    body += `<text class="svg-label svg-temp" x="716" y="78" font-size="12.5" text-anchor="middle">${isSC1 ? 'Potabile · 60 °C' : 'P09 · Torri AP'}</text>`;
    body += `<text class="svg-label svg-temp" x="716" y="378" font-size="12.5" text-anchor="middle">${isSC1 ? 'Da P01 · 55 °C' : 'Ritorno AP'}</text>`;
    focus += organBox(0, 250, 102, 340, 246) + organBox(1, 276, 56, 48, 338) + organBox(2, 340, 90, 160, 268) + organBox(3, 190, 34, 460, 382);
    pins += pin(0, 232, 226) + pin(1, 292, 148) + pin(2, 484, 148) + pin(3, 616, 226);
  } else if (machineId === 'dhw_storage') {
    const isS3Mode = modeIdx === 1;
    if (!isS3Mode) {
      const strat = makeGrad(0, 82, 0, 360, 'danger', 'link');
      for (const [cx, zoneLbl] of [[222, 'S2 MP'], [378, 'S2 BP']]) {
        body += `<rect class="machine-card" x="${cx - 66}" y="64" width="132" height="312" rx="46"/>`;
        body += `<rect x="${cx - 54}" y="80" width="108" height="280" rx="38" fill="${strat}" fill-opacity=".28" stroke="var(--cp-border-strong)"/>`;
        body += `<line x1="${cx - 28}" y1="338" x2="${cx + 28}" y2="338" stroke="var(--cp-border-strong)" stroke-width="3.5" stroke-linecap="round"/>`;
        body += `<text class="svg-label svg-temp" x="${cx}" y="128" font-size="15.5" text-anchor="middle">60 °C</text>`;
        body += `<text class="svg-label svg-title" x="${cx}" y="174" font-size="13.5" text-anchor="middle">${zoneLbl}</text>`;
        body += `<text class="svg-label svg-sub" x="${cx}" y="196" font-size="12.5" text-anchor="middle">3.000 L</text>`;
        body += `<text class="svg-label svg-temp" x="${cx}" y="316" font-size="13.5" text-anchor="middle">~15–25 °C</text>`;
      }
      body += waterPipe([[36, 118], [168, 118]], 'danger', 'danger', { thin: true, marker: true });
      body += waterPipe([[168, 326], [36, 326]], 'warning', 'link', { thin: true, marker: true });
      body += `<text class="svg-label svg-sub" x="96" y="98" font-size="12" text-anchor="middle">SC1 → 60 °C</text>`;
      body += `<text class="svg-label svg-sub" x="96" y="352" font-size="12" text-anchor="middle">P01 → 55 °C</text>`;

      body += `<rect class="machine-card" x="546" y="136" width="156" height="164" rx="22"/>`;
      body += `<g data-pulse="1" data-cx="624" data-cy="218" data-amp="0.06">` +
        `<rect class="tag-pill-bg" x="586" y="182" width="76" height="72" rx="12"/>` +
        `<text class="svg-label svg-title" x="624" y="223" font-size="12.5" text-anchor="middle">Wax 48°</text></g>`;
      body += waterPipe([[222, 80], [222, 42], [378, 42]], 'danger', 'danger', { thin: true });
      body += waterPipe([[378, 80], [378, 42], [492, 42], [492, 218], [546, 218]], 'danger', 'danger', { thin: true });
      body += waterPipe([[222, 420], [222, 360]], 'link', 'link', { thin: true });
      body += waterPipe([[222, 420], [378, 420], [378, 360]], 'link', 'link', { thin: true });
      body += waterPipe([[378, 420], [624, 420], [624, 300]], 'link', 'link', { thin: true });
      body += waterPipe([[624, 62], [624, 136]], 'warning', 'warning', { thin: true });
      body += waterPipe([[702, 218], [806, 218]], 'warning', 'warning', { marker: true });
      body += `<text class="svg-label svg-temp" x="762" y="196" font-size="14" text-anchor="middle">ACP · 48 °C</text>`;
      body += `<text class="svg-label svg-sub" x="624" y="44" font-size="12.5" text-anchor="middle">ACR (~46 °C)</text>`;
      body += `<text class="svg-label svg-sub" x="520" y="404" font-size="12.5" text-anchor="middle">AFP (~15 °C)</text>`;
      focus += organBox(0, 148, 56, 304, 328, 48) + organBox(1, 30, 88, 138, 256) + organBox(2, 538, 128, 172, 180) + organBox(3, 464, 30, 84, 204);
      pins += pin(0, 222, 246) + pin(1, 102, 222) + pin(2, 680, 158) + pin(3, 518, 112);
    } else {
      body += `<rect class="machine-card" x="260" y="78" width="128" height="224" rx="44"/>`;
      body += `<rect class="machine-card" x="452" y="78" width="128" height="224" rx="44"/>`;
      body += `<text class="svg-label svg-title" x="324" y="192" font-size="15" text-anchor="middle">S3 #1 · 2.000 L</text>`;
      body += `<text class="svg-label svg-title" x="516" y="192" font-size="15" text-anchor="middle">S3 #2 · 2.000 L</text>`;
      body += waterPipe([[74, 120], [212, 120], [212, 52], [516, 52], [516, 78]], 'danger', 'danger', { thin: true });
      body += waterPipe([[212, 120], [260, 120]], 'danger', 'danger', { thin: true });
      body += waterPipe([[324, 302], [324, 332], [636, 332], [636, 120], [768, 120]], 'danger', 'danger', { thin: true, marker: true });
      body += waterPipe([[516, 302], [516, 332]], 'danger', 'danger', { thin: true });
      body += waterPipe([[768, 396], [74, 396]], 'link', 'link', { marker: true });
      body += `<text class="svg-label svg-sub" x="420" y="382" font-size="13.5" text-anchor="middle">${esc(T('Ritorno diretto alle PC2 (bypassa i serbatoi S3)', 'Direct return to PC2 (bypasses S3 buffers)', '回水干管直接返回 PC2（旁通 S3 水箱）'))}</text>`;
      focus += organBox(0, 252, 70, 144, 240, 44) + organBox(1, 444, 70, 144, 240, 44) + organBox(2, 68, 372, 706, 46) + organBox(3, 196, 40, 456, 304);
      pins += pin(0, 324, 128) + pin(1, 516, 128) + pin(2, 160, 396) + pin(3, 636, 224);
    }
  } else if (machineId === 'radiant_module') {
    const summer = modeIdx === 1;
    body += `<rect class="machine-card" x="48" y="56" width="284" height="346" rx="18"/>`;
    body += `<text class="svg-label svg-title" x="190" y="84" font-size="14.5" text-anchor="middle">${esc(T('Modulo d’utenza alloggio', 'Apartment Satellite Box', '住户分户水力计量箱'))}</text>`;
    body += `<rect class="machine-sub" x="76" y="118" width="90" height="42" rx="8"/>` +
      `<text class="svg-label svg-temp" x="121" y="144" font-size="12.5" text-anchor="middle">M-bus kWh</text>`;
    body += `<circle class="machine-card" cx="256" cy="214" r="19"/><text class="svg-label svg-title" x="256" y="219" font-size="12.5" text-anchor="middle">M</text>`;
    body += impellerWheel(256, 286, 19, 1.5);

    body += `<rect class="machine-card" x="372" y="56" width="420" height="346" rx="18"/>`;
    body += `<rect class="machine-sub" x="414" y="82" width="336" height="74" rx="12"/>`;
    body += `<text class="svg-label svg-title" x="582" y="112" font-size="14" text-anchor="middle">${esc(T('Deumidificatore d’alloggio', 'Apartment Dehumidifier', '户内等温除湿机'))}</text>`;
    body += `<text class="svg-label svg-sub" x="582" y="136" font-size="12" text-anchor="middle">${esc(summer ? T('Alimentato a 13 °C · Asciuga l’aria sotto rugiada', 'Fed at 13 °C · Dries air below dew point', '13 °C 直供盘管 · 深度除湿防结露') : T('Spento in riscaldamento invernale', 'Idle during winter heating', '冬季供暖期停机'))}</text>`;

    body += `<rect class="plate-pack" x="396" y="266" width="372" height="112" rx="10"/>`;
    const inT = summer ? 'link' : 'danger', outT = summer ? 'danger' : 'link';
    body += waterPipe([[14, 139], [76, 139]], inT, inT, { thin: true });
    body += waterPipe([[166, 139], [256, 139], [256, 195]], inT, inT, { thin: true });
    if (summer) body += waterPipe([[206, 139], [206, 108], [414, 108]], 'link', 'link', { thin: true });
    body += waterPipe([[196, 366], [196, 214], [237, 214]], outT, outT, { thin: true, speed: 32 });
    const coilPts = [[275, 286], [420, 286], [740, 286], [740, 316], [420, 316], [420, 346], [740, 346], [740, 366], [14, 366]];
    body += waterPipe(coilPts, inT, outT, { thin: true });
    for (const hx of [472, 582, 692]) {
      body += summer ? heatWave(hx, 202, hx, 256) : heatWave(hx, 256, hx, 196);
    }
    body += `<text class="svg-label svg-temp" x="582" y="234" font-size="16" text-anchor="middle">${summer ? '13° → Mix 18 → 23 °C' : '42° → Mix 38 → 33 °C'}</text>`;
    focus += organBox(0, 70, 110, 102, 58) + organBox(1, 186, 188, 98, 126) + organBox(2, 390, 260, 384, 124) + organBox(3, 408, 76, 348, 86);
    pins += pin(0, 121, 184) + pin(1, 294, 248) + pin(2, 426, 252) + pin(3, 434, 118);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" class="vector-map machine-cutaway" data-machine="${esc(machineId)}" viewBox="0 0 840 450" role="group">` +
    `<defs>${defs.join('')}</defs>` +
    `<g class="cutaway-focus">${focus}</g>` +
    `<g class="cutaway-body">${body}</g>` +
    `<g class="flow-layer" aria-hidden="true"></g>` +
    `<g class="cutaway-pins">${pins}</g>` +
    `</svg>`;
}
