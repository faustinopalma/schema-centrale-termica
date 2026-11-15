// Detailed animated internal cutaway renderer for all 15 plant machines (embedded in browser index.html)
export function renderMachineCutaway(machineId, modeIdx = 0, activePart = 0, lang = 'it') {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pfx = `mc-${machineId}-${modeIdx}`;
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
    const { thin = false, animated = true, speed = 56, marker = false } = opts;
    const d = roundPath(pts);
    const stroke = fromT === toT ? `var(--cp-${fromT})` : makeGrad(pts[0][0], pts[0][1], pts.at(-1)[0], pts.at(-1)[1], fromT, toT);
    const cls = thin ? ' thin' : '';
    const anim = animated ? ` data-flow-path="1" data-fluid-kind="water" data-speed="${speed}" data-temp-start="${fromT}" data-temp-end="${toT}"` : '';
    const mEnd = marker ? ` marker-end="url(#${pfx}-arr-${toT})"` : '';
    return `<path d="${d}" class="pipe-casing${cls}"/><path d="${d}" class="pipe-core${cls}" style="stroke:${stroke}"${anim}${mEnd}/><path d="${d}" class="pipe-sheen"/>`;
  };

  const refPipe = (pts, fromT, toT, phase = 'vapour', speed = 68) => {
    const d = roundPath(pts);
    const stroke = fromT === toT ? `var(--cp-${fromT})` : makeGrad(pts[0][0], pts[0][1], pts.at(-1)[0], pts.at(-1)[1], fromT, toT);
    return `<path d="${d}" class="ref-casing"/><path d="${d}" class="ref-channel"/>` +
      `<path d="${d}" class="ref-core ${phase}" style="stroke:${stroke}" data-flow-path="1" data-fluid-kind="ref" data-ref-phase="${phase}" data-speed="${speed}" data-temp-start="${fromT}" data-temp-end="${toT}"/>`;
  };

  const sandTrack = (pts, speed = 42) => {
    const d = roundPath(pts);
    return `<path d="${d}" fill="none" stroke="var(--cp-warning)" stroke-width="1.6" stroke-dasharray="3 6" opacity=".55" data-flow-path="1" data-fluid-kind="sand" data-speed="${speed}"/>`;
  };

  const heatWave = (x1, y1, x2, y2) =>
    `<path class="thermal-track" data-thermal-path="1" d="M${x1} ${y1}L${x2} ${y2}" marker-end="url(#${pfx}-arr-warning)"/>`;

  const pin = (idx, x, y) => {
    const isAct = activePart === idx;
    return `<g class="part-pin${isAct ? ' active' : ''}" data-part-idx="${idx}" role="button" tabindex="0" aria-label="Part ${idx + 1}">` +
      `<circle cx="${x}" cy="${y}" r="18" fill="var(--cp-surface)" opacity="0"/>` +
      `<circle class="pin-ring" cx="${x}" cy="${y}" r="13.5"/>` +
      `<text class="pin-num" x="${x}" y="${y + 4.8}" font-size="13.5" text-anchor="middle">${idx + 1}</text></g>`;
  };

  const organBox = (idx, x, y, w, h, rx = 12) =>
    activePart === idx ? `<rect class="organ-focus" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>` : '';

  const plateStack = (x, y, w, h, nPlates = 6) => {
    let s = `<rect class="plate-pack" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>`;
    for (let i = 1; i < nPlates; i++) {
      const px = x + (w * i) / nPlates;
      s += `<path d="M${px.toFixed(1)} ${y + 6}V${y + h - 6}" stroke="var(--cp-border-strong)" stroke-width="1.4" stroke-dasharray="6 4"/>`;
    }
    return s;
  };

  const scrollUnit = (cx, cy, r = 34, rpm = 1.6) =>
    `<circle class="machine-card" cx="${cx}" cy="${cy}" r="${r}"/>` +
    `<path d="M${cx} ${cy - r + 9}a${r - 9} ${r - 9} 0 1 1 -${r - 11} ${r - 9}a${r - 17} ${r - 17} 0 1 0 ${r - 11} -${r - 19}" fill="none" stroke="var(--cp-border-strong)" stroke-width="2.4" stroke-linecap="round"/>` +
    `<g data-orbit="1" data-orbit-r="4.2" data-rpm="${rpm}">` +
    `<path d="M${cx} ${cy - r + 14}a${r - 14} ${r - 14} 0 1 1 -${r - 16} ${r - 14}a${r - 22} ${r - 22} 0 1 0 ${r - 16} -${r - 24}" fill="none" stroke="var(--cp-accent)" stroke-width="2.8" stroke-linecap="round"/></g>`;

  const impellerWheel = (cx, cy, r = 24, rpm = 1.4) =>
    `<circle class="machine-sub" cx="${cx}" cy="${cy}" r="${r}"/>` +
    `<g data-rotor="1" data-cx="${cx}" data-cy="${cy}" data-rpm="${rpm}">` +
    [0, 60, 120, 180, 240, 300].map(a =>
      `<path d="M${cx} ${cy}Q${cx + 10} ${cy - 8} ${cx + r - 3} ${cy}" fill="none" stroke="var(--cp-accent)" stroke-width="2.6" stroke-linecap="round" transform="rotate(${a} ${cx} ${cy})"/>`
    ).join('') +
    `<circle cx="${cx}" cy="${cy}" r="5" fill="var(--cp-accent)"/></g>`;

  let body = '', pins = '', focus = '';

  if (machineId === 'hiref_msw') {
    const isSummer = modeIdx === 1, isRecov = modeIdx === 2;
    body += `<rect class="machine-card" x="48" y="24" width="744" height="402" rx="20"/>`;
    body += `<text class="svg-label svg-sub" x="420" y="50" font-size="13.5" text-anchor="middle">${esc(T(' Involucro ermetico PC2 · Circuito frigorifero sigillato R410A', 'PC2 Hermetic Cabinet · Sealed R410A Refrigerant Loop', 'PC2 密封机组外壳 · 独立 R410A 气液相变回路'))}</text>`;
    // Left HX (Groundwater), Right HX (Building HVAC), Bottom-center 3rd HX (40/35 Recovery)
    body += plateStack(130, 108, 68, 210, 5);
    body += plateStack(642, 108, 68, 210, 5);
    body += plateStack(340, 336, 160, 52, 7);
    focus += organBox(0, 118, 98, 92, 230) + organBox(1, 316, 62, 208, 98) + organBox(2, 630, 98, 92, 230) + organBox(3, 326, 250, 188, 148);
    // Water streams (isolated outside the refrigerant loop)
    body += waterPipe([[18, 134], [145, 134], [145, 292], [18, 292]], 'link', isSummer ? 'danger' : 'link', { thin: true, speed: isRecov ? 22 : 56 });
    body += `<text class="svg-label svg-temp" x="62" y="122" font-size="13" text-anchor="middle">${isSummer ? '16→21 °C' : '16→11 °C'}</text>`;
    body += waterPipe([[822, 292], [695, 292], [695, 134], [822, 134]], isSummer || isRecov ? 'danger' : 'link', isSummer || isRecov ? 'link' : 'danger', { thin: true });
    body += `<text class="svg-label svg-temp" x="776" y="122" font-size="13" text-anchor="middle">${isSummer || isRecov ? '13 / 18 °C' : '45 / 40 °C'}</text>`;
    body += waterPipe([[250, 412], [355, 412], [355, 372], [485, 372], [485, 412], [590, 412]], 'link', 'danger', { thin: true, animated: isRecov || !isSummer, speed: isRecov ? 62 : 34 });
    body += `<text class="svg-label svg-temp" x="420" y="408" font-size="12.5" text-anchor="middle">35 → 40 °C (→ PC1)</text>`;

    // Tandem Scroll compressors top
    body += scrollUnit(372, 110, 32, 1.8) + scrollUnit(468, 110, 32, 1.8);
    // EEV stepper valve at y=276
    body += `<path class="machine-card" d="M396 262L444 290V262L396 290Z"/>` +
      `<g data-recip="1" data-dx="0" data-dy="3"><path d="M420 240v28" stroke="var(--cp-accent)" stroke-width="3" stroke-linecap="round"/><rect class="tag-pill-bg" x="404" y="226" width="32" height="16" rx="5"/></g>`;

    if (!isSummer && !isRecov) {
      // Winter: Evap left -> Scrolls -> Condenser right -> EEV -> Evap left
      body += refPipe([[182, 134], [182, 96], [338, 96]], 'link', 'link', 'vapour');
      body += refPipe([[502, 96], [658, 96], [658, 140]], 'danger', 'danger', 'vapour');
      body += refPipe([[658, 286], [658, 276], [444, 276]], 'danger', 'danger', 'liquid');
      body += refPipe([[396, 276], [182, 276], [182, 290]], 'link', 'link', 'mixture');
      body += heatWave(118, 212, 174, 212) + heatWave(664, 212, 722, 212);
    } else if (isSummer) {
      // Summer: Evap right -> Scrolls -> Condenser left -> EEV -> Evap right
      body += refPipe([[658, 134], [658, 96], [502, 96]], 'link', 'link', 'vapour');
      body += refPipe([[338, 96], [182, 96], [182, 140]], 'danger', 'danger', 'vapour');
      body += refPipe([[182, 286], [182, 276], [396, 276]], 'danger', 'danger', 'liquid');
      body += refPipe([[444, 276], [658, 276], [658, 290]], 'link', 'link', 'mixture');
      body += heatWave(722, 212, 664, 212) + heatWave(174, 212, 118, 212);
    } else {
      // Summer + Total Recovery into 3rd HX (bottom): Evap right -> Scrolls -> 3rd HX -> EEV -> Evap right
      body += refPipe([[658, 134], [658, 96], [502, 96]], 'link', 'link', 'vapour');
      body += refPipe([[338, 96], [286, 96], [286, 352], [340, 352]], 'danger', 'danger', 'vapour');
      body += refPipe([[500, 352], [546, 352], [546, 276], [444, 276]], 'danger', 'danger', 'liquid');
      body += refPipe([[444, 276], [658, 276], [658, 290]], 'link', 'link', 'mixture');
      body += heatWave(722, 212, 664, 212) + heatWave(420, 326, 420, 368);
    }
    pins += pin(0, 164, 92) + pin(1, 420, 66) + pin(2, 676, 92) + pin(3, 324, 344);
  } else if (machineId === 'hiref_ksw') {
    const partLoad = modeIdx === 1;
    body += `<rect class="machine-card" x="56" y="28" width="728" height="394" rx="20"/>`;
    body += `<text class="svg-label svg-sub" x="420" y="54" font-size="13.5" text-anchor="middle">${esc(T('Secondo stadio ad alta temperatura PC1 · Salto ridotto 40 °C → 70 °C', 'PC1 High-Temperature Second Stage · Low-ratio lift 40 °C → 70 °C', 'PC1 二级高温水源热泵 · 40 °C → 70 °C 低压比高效升温'))}</text>`;
    body += plateStack(138, 118, 72, 224, 6);
    body += plateStack(630, 118, 72, 224, 6);
    focus += organBox(0, 126, 108, 96, 244) + organBox(1, 314, 72, 212, 104) + organBox(2, 618, 108, 96, 244) + organBox(3, 358, 304, 124, 86);
    // Warm 40->35 source left, Hot 65->70 primary right
    body += waterPipe([[20, 144], [154, 144], [154, 316], [20, 316]], 'warning', 'link', { thin: true });
    body += `<text class="svg-label svg-temp" x="72" y="130" font-size="13.5" text-anchor="middle">40 → 35 °C</text>`;
    body += `<text class="svg-label svg-sub" x="72" y="344" font-size="12" text-anchor="middle">P05 · S3</text>`;
    body += waterPipe([[820, 316], [686, 316], [686, 144], [820, 144]], 'warning', 'danger', { thin: true });
    body += `<text class="svg-label svg-temp" x="768" y="130" font-size="13.5" text-anchor="middle">65 → 70 °C</text>`;
    body += `<text class="svg-label svg-sub" x="768" y="344" font-size="12" text-anchor="middle">P04 → 2×SC1</text>`;
    // Scrolls (second scroll stops in mode 1 part-load!)
    body += scrollUnit(370, 124, 33, 1.9) + scrollUnit(470, 124, 33, partLoad ? 0 : 1.9);
    if (partLoad) {
      body += `<text class="svg-label svg-sub" x="470" y="174" font-size="11.5" text-anchor="middle">STAND-BY (50%)</text>`;
    }
    body += `<path class="machine-card" d="M394 334L446 364V334L394 364Z"/>`;
    body += refPipe([[194, 144], [194, 112], [335, 112]], 'warning', 'warning', 'vapour');
    body += refPipe([[505, 112], [646, 112], [646, 148]], 'danger', 'danger', 'vapour');
    body += refPipe([[646, 312], [646, 349], [446, 349]], 'danger', 'danger', 'liquid');
    body += refPipe([[394, 349], [194, 349], [194, 312]], 'link', 'warning', 'mixture');
    body += heatWave(124, 230, 188, 230) + heatWave(652, 230, 716, 230);
    body += `<rect class="machine-sub" x="292" y="216" width="256" height="64" rx="12"/>` +
      `<text class="svg-label svg-title" x="420" y="243" font-size="14.5" text-anchor="middle">COP ~4,9 · 180,5 kW</text>` +
      `<text class="svg-label svg-sub" x="420" y="265" font-size="12.5" text-anchor="middle">${esc(T('Evaporazione alta (~32 °C) grazie a PC2', 'High ~32 °C evaporation thanks to PC2', '借力 PC2 预热实现 ~32 °C 高温蒸发'))}</text>`;
    pins += pin(0, 174, 102) + pin(1, 420, 74) + pin(2, 666, 102) + pin(3, 420, 382);
  } else if (machineId === 'dab_ss6') {
    const running = modeIdx === 0;
    // Aquifer ground & vertical slotted borehole casing
    body += `<rect class="aquifer-fill" x="150" y="58" width="540" height="368" rx="18"/>`;
    body += `<rect class="machine-card" x="310" y="26" width="220" height="404" rx="10"/>`;
    // Slotted screen perforations on well casing
    for (const sy of [260, 290, 320, 350, 380]) {
      body += `<line x1="304" y1="${sy}" x2="316" y2="${sy}" stroke="var(--cp-link)" stroke-width="4"/>` +
        `<line x1="524" y1="${sy}" x2="536" y2="${sy}" stroke="var(--cp-link)" stroke-width="4"/>`;
    }
    // Submersible pump stainless cylinder inside well
    body += `<rect class="machine-sub" x="366" y="76" width="108" height="332" rx="12"/>`;
    // 1) Bottom TR motor (y=298..398)
    body += `<rect class="machine-card" x="378" y="302" width="84" height="94" rx="8"/>`;
    for (let fy = 316; fy <= 382; fy += 13) body += `<line x1="386" y1="${fy}" x2="454" y2="${fy}" stroke="var(--cp-border-strong)" stroke-width="2"/>`;
    body += `<text class="svg-label svg-title" x="420" y="354" font-size="13" text-anchor="middle">TR Motor</text>`;
    // 2) Suction strainer (y=258..298)
    body += `<rect class="plate-pack" x="378" y="260" width="84" height="36" rx="4"/>`;
    for (let sx = 388; sx <= 452; sx += 10) body += `<line x1="${sx}" y1="265" x2="${sx}" y2="291" stroke="var(--cp-accent)" stroke-width="1.6"/>`;
    // 3) 3 stacked mixed-flow impeller stages (y=132..252)
    for (const [idx, sy] of [[0, 232], [1, 192], [2, 152]]) {
      body += `<rect class="machine-card" x="378" y="${sy - 16}" width="84" height="32" rx="6"/>`;
      body += `<g data-rotor="1" data-cx="420" data-cy="${sy}" data-rpm="${running ? 2.2 : 0}">` +
        `<path d="M394 ${sy + 6}L420 ${sy - 9}L446 ${sy + 6}Z" fill="var(--cp-accent)" opacity=".85"/></g>`;
      if (idx === 2) body += `<text class="svg-label svg-temp" x="598" y="${sy + 5}" font-size="13.5">930 kPa (9,3 bar)</text>`;
    }
    // 4) Built-in check valve at top (y=86..124)
    const valveY = running ? 94 : 110;
    body += `<path d="M388 114h64" stroke="var(--cp-border-strong)" stroke-width="3"/>` +
      `<path d="M398 ${valveY}h44l-8 -10h-28Z" fill="var(--cp-accent)"/>`;
    // Flow paths when running
    body += waterPipe([[220, 355], [344, 355], [344, 278], [420, 278], [420, 18]], 'link', 'link', { thin: true, animated: running, marker: running });
    body += waterPipe([[620, 355], [496, 355], [496, 278], [420, 278]], 'link', 'link', { thin: true, animated: running });
    body += `<text class="svg-label svg-title" x="225" y="96" font-size="15" text-anchor="middle">${esc(T('Falda ~16 °C', 'Aquifer ~16 °C', '地下含水层 ~16 °C'))}</text>`;
    body += `<text class="svg-label svg-sub" x="635" y="295" font-size="12.5" text-anchor="middle">${esc(T('Raffreddamento motore', 'Motor cooling sleeve', '水流贴壁冷却潜水电机'))}</text>`;
    if (!running) {
      body += `<text class="svg-label svg-title" x="635" y="106" font-size="14" text-anchor="middle">${esc(T('Valvola chiusa · Colonna piena', 'Check valve shut · Riser held', '止回阀闭合 · 锁住立管水柱'))}</text>`;
    }
    focus += organBox(0, 370, 296, 100, 106) + organBox(1, 370, 254, 100, 46) + organBox(2, 370, 130, 100, 122) + organBox(3, 376, 76, 88, 48);
    pins += pin(0, 336, 350) + pin(1, 336, 278) + pin(2, 336, 192) + pin(3, 336, 98);
  } else if (machineId === 'nobel_nic') {
    const purging = modeIdx === 1;
    // Tangential inlet top-left -> cylinder -> long converging cone -> bottom grit tank -> top clean vortex finder
    body += `<path class="machine-card" d="M310 68h220v74L456 326h-72L310 142Z"/>`;
    body += `<rect class="machine-sub" x="332" y="326" width="176" height="68" rx="22"/>`;
    body += `<rect class="machine-card" x="394" y="34" width="52" height="118" rx="8"/>`;
    // Incoming tangential pipe
    body += waterPipe([[110, 98], [336, 98]], 'link', 'link', { marker: true });
    // Helical outer vortex path + sand grains spiralling down cone wall
    const spiralPts = [[338, 104], [496, 126], [344, 174], [476, 218], [372, 266], [448, 306], [420, 352]];
    body += `<path d="${roundPath(spiralPts)}" fill="none" stroke="var(--cp-link)" stroke-width="3.2" opacity=".55" data-flow-path="1" data-fluid-kind="water" data-temp-start="link" data-temp-end="link"/>`;
    body += sandTrack(spiralPts, 48);
    // Settled sand pile in bottom chamber
    body += `<path d="M352 384q68 -26 136 0Z" fill="var(--cp-warning)" opacity="${purging ? '.35' : '.8'}"/>`;
    if (purging) {
      body += waterPipe([[420, 384], [420, 436], [560, 436]], 'warning', 'warning', { thin: true, marker: true });
      body += sandTrack([[420, 376], [420, 436], [560, 436]], 64);
    }
    // Inner clean upward vortex exiting top to 2xT7
    body += waterPipe([[420, 302], [420, 44], [690, 44]], 'link', 'link', { marker: true });
    body += `<text class="svg-label svg-title" x="180" y="78" font-size="14.5" text-anchor="middle">${esc(T('Ingresso tangenziale 108 m³/h', 'Tangential inlet 108 m³/h', '切向进水 108 m³/h'))}</text>`;
    body += `<text class="svg-label svg-title" x="620" y="30" font-size="14.5" text-anchor="middle">${esc(T('Acqua depurata → 2×T7', 'Clean vortex → 2×T7', '净水内涡流 → 2×T7'))}</text>`;
    body += `<text class="svg-label svg-sub" x="668" y="220" font-size="12.5" text-anchor="middle">${esc(T('Forza centrifuga → parete', 'Centrifugal force → wall', '离心力将重砂甩向锥壁'))}</text>`;
    focus += organBox(0, 230, 74, 120, 52) + organBox(1, 304, 140, 232, 186) + organBox(2, 324, 322, 192, 78) + organBox(3, 386, 28, 68, 130);
    pins += pin(0, 268, 98) + pin(1, 500, 216) + pin(2, 316, 360) + pin(3, 468, 62);
  } else if (machineId === 'nobel_ml') {
    const flushing = modeIdx === 1;
    // Top gearmotor + filter vessel + cylindrical 100um screen + 2 pressure gauges + bottom flush valve
    body += `<rect class="machine-card" x="346" y="32" width="148" height="48" rx="10"/>`;
    body += `<text class="svg-label svg-title" x="420" y="61" font-size="13.5" text-anchor="middle">Motor 10–30 W</text>`;
    body += `<rect class="machine-card" x="292" y="88" width="256" height="270" rx="22"/>`;
    body += `<rect class="plate-pack" x="342" y="114" width="156" height="216" rx="10"/>`;
    // Fine 100 um mesh hatch
    for (let my = 132; my <= 314; my += 22) body += `<line x1="348" y1="${my}" x2="492" y2="${my}" stroke="var(--cp-border-strong)" stroke-width="1.2" stroke-dasharray="4 4"/>`;
    // Central rotating brush shaft
    body += `<line x1="420" y1="80" x2="420" y2="358" stroke="var(--cp-accent)" stroke-width="4"/>`;
    body += `<g data-rotor="1" data-cx="420" data-cy="222" data-rpm="${flushing ? 2.4 : 0}">` +
      `<line x1="348" y1="222" x2="492" y2="222" stroke="var(--cp-accent)" stroke-width="3.5"/>` +
      `<circle cx="350" cy="222" r="5" fill="var(--cp-accent)"/><circle cx="490" cy="222" r="5" fill="var(--cp-accent)"/></g>`;
    // Differential pressure gauges P1 & P2
    for (const [gx, lbl, ang] of [[246, 'P1', -35], [594, 'P2', flushing ? -75 : -30]]) {
      body += `<circle class="machine-card" cx="${gx}" cy="116" r="22"/>` +
        `<line x1="${gx}" y1="116" x2="${gx + Math.cos(ang * Math.PI / 180) * 14}" y2="${116 + Math.sin(ang * Math.PI / 180) * 14}" stroke="var(--cp-danger)" stroke-width="2.4"/>` +
        `<text class="svg-label svg-temp" x="${gx}" y="154" font-size="12" text-anchor="middle">${lbl}</text>`;
    }
    // Main water flow through 100 um screen
    body += waterPipe([[110, 186], [360, 186], [480, 256], [730, 256]], 'link', 'link', { marker: true });
    if (flushing) {
      body += waterPipe([[420, 330], [420, 424], [585, 424]], 'warning', 'warning', { thin: true, marker: true });
      body += sandTrack([[420, 200], [420, 424], [585, 424]], 60);
      body += `<text class="svg-label svg-title" x="625" y="406" font-size="13.5" text-anchor="middle">${esc(T('Scarico impurità (ΔP)', ' Automatic ΔP flush drain', 'ΔP 触发自动排污'))}</text>`;
    }
    body += `<text class="svg-label svg-title" x="180" y="168" font-size="14" text-anchor="middle">${esc(T('Da T6 · 65 m³/h', 'From T6 · 65 m³/h', '来自 T6 · 65 m³/h'))}</text>`;
    body += `<text class="svg-label svg-title" x="660" y="236" font-size="14" text-anchor="middle">${esc(T('Filtrata 100 µm → PC2', '100 µm clean → PC2', '100 µm 净水 → PC2'))}</text>`;
    focus += organBox(0, 334, 108, 172, 228) + organBox(1, 218, 88, 404, 72) + organBox(2, 338, 26, 164, 60) + organBox(3, 382, 354, 76, 78);
    pins += pin(0, 342, 314) + pin(1, 246, 84) + pin(2, 512, 54) + pin(3, 382, 392);
  } else if (machineId === 'elbi_dl') {
    const surge = modeIdx === 0;
    // Main groundwater pipe at bottom + side-branch T into vertical 1,000 L bladder vessel
    body += waterPipe([[90, 396], [750, 396]], 'link', 'link', { marker: true });
    body += waterPipe([[420, 396], [420, 326]], 'link', 'link', { thin: true, animated: true, speed: surge ? 48 : 26 });
    body += `<circle cx="420" cy="396" r="6" fill="var(--cp-link)" stroke="var(--cp-surface)" stroke-width="2"/>`;
    // Steel shell on legs
    body += `<path d="M332 332v52M508 332v52" stroke="var(--cp-border-strong)" stroke-width="6" stroke-linecap="round"/>`;
    body += `<rect class="machine-card" x="298" y="42" width="244" height="296" rx="88"/>`;
    // Top gas precharge valve & compressible gas zone
    body += `<rect class="machine-sub" x="408" y="24" width="24" height="20" rx="4"/>`;
    body += `<text class="svg-label svg-sub" x="420" y="88" font-size="13.5" text-anchor="middle">${esc(T('Cuscino gas precaricato (N₂ / Aria)', 'Pre-charged gas cushion (N₂ / Air)', '顶部预充可压缩气垫'))}</text>`;
    // Pulsing replaceable butyl bladder inside
    const bTop = surge ? 116 : 158;
    body += `<g data-pulse="1" data-cx="420" data-cy="260" data-amp="${surge ? 0.065 : 0.03}">` +
      `<path d="M332 324Q322 ${bTop} 420 ${bTop}Q518 ${bTop} 508 324Z" fill="var(--cp-link)" fill-opacity=".22" stroke="var(--cp-accent)" stroke-width="3.4"/></g>`;
    body += `<text class="svg-label svg-title" x="420" y="248" font-size="15" text-anchor="middle">${esc(T('Membrana in butile · Acqua', 'Butyl bladder · Water', '丁基橡胶囊 · 隔离井水'))}</text>`;
    body += `<text class="svg-label svg-temp" x="656" y="190" font-size="15" text-anchor="middle">1.000 L · 10 bar</text>`;
    body += `<text class="svg-label svg-sub" x="656" y="372" font-size="13" text-anchor="middle">${esc(T('Linea principale verso PC2', 'Main header toward PC2', '通往 PC2 的地下水主干管'))}</text>`;
    focus += organBox(0, 312, 50, 216, 74) + organBox(1, 322, 118, 196, 206) + organBox(2, 290, 36, 260, 308, 88) + organBox(3, 378, 336, 84, 74);
    pins += pin(0, 276, 82) + pin(1, 514, 218) + pin(2, 276, 190) + pin(3, 458, 368);
  } else if (machineId === 'dab_dcm') {
    const isHalf = modeIdx === 1, isStandby = modeIdx === 2;
    const rpm1 = isHalf ? 0.65 : 2.1, rpm2 = isStandby ? 0 : (isHalf ? 0.65 : 2.1);
    // Collinear horizontal header left -> split twin inline volutes -> flapper check valve -> right outlet
    body += waterPipe([[66, 250], [220, 250], [220, 158], [556, 158], [556, 250], [774, 250]], 'danger', 'danger', { speed: isHalf ? 30 : 68, marker: true });
    body += waterPipe([[220, 250], [220, 342], [556, 342], [556, 250]], 'danger', 'danger', { animated: !isStandby, speed: isHalf ? 30 : 68 });
    // Top MCE/C inverter drives + twin centrifugal impellers
    for (const [idx, cy, rpm, hzTxt] of [[0, 158, rpm1, isHalf ? '25 Hz · ~15% kW' : '50 Hz · 100%'], [1, 342, rpm2, isStandby ? '0 Hz · RISERVA' : (isHalf ? '25 Hz · ~15% kW' : '50 Hz · 100%')]]) {
      body += `<rect class="machine-card" x="284" y="${cy - 54}" width="88" height="44" rx="8"/>` +
        `<text class="svg-label svg-temp" x="328" y="${cy - 27}" font-size="12" text-anchor="middle">MCE/C</text>`;
      body += `<circle class="machine-card" cx="418" cy="${cy}" r="38"/>` + impellerWheel(418, cy, 28, rpm);
      body += `<text class="svg-label svg-sub" x="418" y="${cy + (idx === 0 ? -48 : 58)}" font-size="13" text-anchor="middle">${esc(hzTxt)}</text>`;
    }
    // Automatic flapper check valve at right union (x=556, y=250)
    const flapAngle = isStandby ? 36 : 0;
    body += `<circle class="machine-card" cx="556" cy="250" r="24"/>` +
      `<line x1="556" y1="228" x2="556" y2="272" stroke="var(--cp-accent)" stroke-width="4" stroke-linecap="round" transform="rotate(${flapAngle} 556 250)"/>`;
    body += `<text class="svg-label svg-title" x="132" y="226" font-size="14" text-anchor="middle">${esc(T('Aspirazione in-line', 'Inline suction', '同轴法兰进水'))}</text>`;
    body += `<text class="svg-label svg-title" x="688" y="226" font-size="14" text-anchor="middle">${esc(T('Mandata Δp regolata', 'Δp regulated supply', 'Δp 变频恒压出水'))}</text>`;
    focus += organBox(0, 276, 96, 104, 60) + organBox(1, 372, 112, 92, 92) + organBox(2, 64, 218, 712, 64) + organBox(3, 524, 218, 64, 64);
    pins += pin(0, 276, 124) + pin(1, 468, 124) + pin(2, 146, 278) + pin(3, 594, 250);
  } else if (machineId === 'dab_evoplus') {
    const isCharge = modeIdx === 1;
    const tone = isCharge ? 'danger' : 'warning';
    // Sanitary bronze housing left + stainless-steel sealed rotor can + dry ECM stator outer coils
    body += waterPipe([[74, 232], [270, 232]], tone, tone, { speed: isCharge ? 66 : 36 });
    body += waterPipe([[270, 232], [270, 112], [690, 112]], tone, tone, { speed: isCharge ? 66 : 36, marker: true });
    // Sanitary volute
    body += `<rect class="machine-card" x="228" y="156" width="92" height="152" rx="20"/>`;
    body += impellerWheel(274, 232, 30, isCharge ? 2.1 : 1.1);
    // Dry stator outer housing
    body += `<rect class="machine-card" x="320" y="134" width="276" height="196" rx="18"/>`;
    // Dry copper/ECM stator coils top & bottom
    body += `<rect class="machine-sub" x="348" y="150" width="190" height="36" rx="6"/>` +
      `<rect class="machine-sub" x="348" y="278" width="190" height="36" rx="6"/>`;
    body += `<text class="svg-label svg-sub" x="443" y="173" font-size="12.5" text-anchor="middle">${esc(T('Statore ECM asciutto', 'Dry ECM stator coils', '外部干燥 ECM 定子绕组'))}</text>`;
    // Hermetic thin stainless separation can (canotto inox)
    body += `<rect x="318" y="194" width="234" height="76" rx="12" fill="var(--cp-link)" fill-opacity=".14" stroke="var(--cp-accent)" stroke-width="3" stroke-dasharray="7 3"/>`;
    // Wet permanent-magnet rotor + shaft spinning inside water
    body += `<line x1="274" y1="232" x2="532" y2="232" stroke="var(--cp-border-strong)" stroke-width="5"/>`;
    body += `<g data-pulse="1" data-cx="440" data-cy="232" data-amp="0.03"><rect class="tag-pill-bg" x="382" y="208" width="116" height="48" rx="8"/>` +
      `<text class="svg-label svg-title" x="440" y="237" font-size="13" text-anchor="middle">${esc(T('Rotore bagnato', 'Wet PM Rotor', '水中永磁转子'))}</text></g>`;
    body += `<text class="svg-label svg-temp" x="625" y="88" font-size="14" text-anchor="middle">${isCharge ? 'P01 · 16 m³/h (60 °C)' : 'P02/P03 · 3,6 m³/h (48 °C)'}</text>`;
    focus += organBox(0, 314, 188, 244, 88) + organBox(1, 374, 202, 132, 60) + organBox(2, 340, 142, 208, 180) + organBox(3, 220, 148, 108, 168);
    pins += pin(0, 566, 212) + pin(1, 440, 256) + pin(2, 558, 164) + pin(3, 222, 164);
  } else if (machineId === 'spade_ambra') {
    const backwash = modeIdx === 1;
    // Deep-bed cylindrical quartz vessel
    body += `<rect class="machine-card" x="276" y="42" width="288" height="356" rx="56"/>`;
    // 1) Upper diffuser dome
    body += `<path class="machine-sub" d="M366 96h108l-20 22h-68Z"/>`;
    // 2) Deep graded quartz sand layer (pulsing upward during backwash!)
    body += `<g ${backwash ? 'data-pulse="1" data-cx="420" data-cy="210" data-amp="0.045"' : ''}>` +
      `<rect x="292" y="${backwash ? 142 : 168}" width="256" height="${backwash ? 142 : 124}" rx="8" fill="var(--cp-warning)" fill-opacity=".24" stroke="var(--cp-warning)" stroke-width="2"/>` +
      `<text class="svg-label svg-title" x="420" y="226" font-size="15" text-anchor="middle">${esc(T('Letto di quarzite (~50 µm)', 'Quartz sand bed (~50 µm)', '精选石英砂深床 (~50 µm)'))}</text></g>`;
    // 3) Coarse support gravel
    body += `<rect x="292" y="294" width="256" height="40" rx="6" fill="var(--cp-border-strong)" fill-opacity=".28" stroke="var(--cp-border-strong)" stroke-width="1.6"/>`;
    body += `<text class="svg-label svg-sub" x="420" y="319" font-size="12.5" text-anchor="middle">${esc(T('Ghiaia di supporto', 'Coarse support gravel', '粗砾石承托层'))}</text>`;
    // 4) Nozzle collector plate
    body += `<line x1="286" y1="344" x2="554" y2="344" stroke="var(--cp-accent)" stroke-width="4"/>`;
    for (let nx = 316; nx <= 524; nx += 34) body += `<rect class="tag-pill-bg" x="${nx - 7}" y="336" width="14" height="16" rx="3"/>`;

    if (!backwash) {
      body += waterPipe([[96, 74], [420, 74], [420, 154]], 'link', 'link');
      body += waterPipe([[420, 352], [420, 416], [736, 416]], 'link', 'link', { marker: true });
      body += `<text class="svg-label svg-title" x="174" y="56" font-size="14" text-anchor="middle">${esc(T('Acquedotto · 66 m³/h', 'City mains · 66 m³/h', '市政自来水 · 66 m³/h'))}</text>`;
      body += `<text class="svg-label svg-title" x="654" y="396" font-size="14" text-anchor="middle">${esc(T('Acqua limpida → 2×S1', 'Clarified water → 2×S1', '澄清净水 → 2×S1'))}</text>`;
    } else {
      body += waterPipe([[96, 416], [420, 416], [420, 92], [736, 92]], 'link', 'warning', { marker: true });
      body += sandTrack([[420, 250], [420, 92], [736, 92]], 54);
      body += `<text class="svg-label svg-title" x="656" y="72" font-size="14" text-anchor="middle">${esc(T('Scarico torbidità controlavaggio', 'Backwash turbidity drain', '反冲洗排走截留污物'))}</text>`;
    }
    focus += organBox(0, 354, 86, 132, 40) + organBox(1, 286, 140, 268, 156) + organBox(2, 286, 290, 268, 48) + organBox(3, 282, 332, 276, 28);
    pins += pin(0, 342, 106) + pin(1, 578, 222) + pin(2, 578, 314) + pin(3, 264, 344);
  } else if (machineId === 'dab_nkve') {
    const dualPeak = modeIdx === 1;
    // Left S1 break tanks (2x2000L) -> suction manifold -> 2 vertical multistage NKVE columns + MCE/P inverters -> discharge manifold + pressure sensor
    body += `<rect class="machine-card" x="56" y="106" width="144" height="264" rx="18"/>`;
    body += `<rect class="aquifer-fill" x="68" y="162" width="120" height="196" rx="10"/>`;
    body += `<text class="svg-label svg-title" x="128" y="136" font-size="14.5" text-anchor="middle">2 × S1</text>`;
    body += `<text class="svg-label svg-sub" x="128" y="264" font-size="13" text-anchor="middle">4.000 L</text>`;
    // Suction & discharge headers
    body += waterPipe([[200, 336], [536, 336]], 'link', 'link');
    body += waterPipe([[356, 336], [356, 114], [768, 114]], 'link', 'link', { marker: true, speed: dualPeak ? 74 : 46 });
    body += waterPipe([[516, 336], [516, 114], [768, 114]], 'link', 'link', { animated: dualPeak, speed: 74 });
    // Two vertical multistage NKVE columns
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
    // Pressure transducer + small diaphragm vessel on discharge header
    body += `<rect class="machine-card" x="640" y="148" width="54" height="86" rx="22"/>` +
      `<line x1="667" y1="114" x2="667" y2="148" stroke="var(--cp-border-strong)" stroke-width="4"/>`;
    body += `<text class="svg-label svg-temp" x="688" y="88" font-size="14" text-anchor="middle">GP1: 7,3 bar · GP2: 4,3 bar</text>`;
    focus += organBox(0, 48, 98, 160, 280) + organBox(1, 318, 132, 76, 188) + organBox(2, 310, 46, 252, 56) + organBox(3, 626, 102, 144, 140);
    pins += pin(0, 128, 86) + pin(1, 304, 224) + pin(2, 436, 74) + pin(3, 714, 188);
  } else if (machineId === 'spade_corallo') {
    const regen = modeIdx === 1;
    // Left FRP resin cylinder + Top CLK electronic turbine valve + Right white salt brine tank
    body += `<rect class="machine-card" x="284" y="42" width="112" height="54" rx="10"/>`;
    body += `<text class="svg-label svg-temp" x="340" y="74" font-size="13.5" text-anchor="middle">CLK Valve</text>`;
    body += `<rect class="machine-card" x="252" y="96" width="176" height="306" rx="44"/>`;
    // Golden cation resin bed inside vessel
    body += `<rect x="268" y="156" width="144" height="214" rx="18" fill="var(--cp-warning)" fill-opacity=".28" stroke="var(--cp-warning)" stroke-width="2"/>`;
    body += `<text class="svg-label svg-title" x="340" y="252" font-size="14.5" text-anchor="middle">${esc(T('Resine Na⁺ ↔ Ca²⁺/Mg²⁺', 'Resin Na⁺ ↔ Ca²⁺/Mg²⁺', '阳离子交换树脂床'))}</text>`;
    // Right polyethylene brine tank
    body += `<path class="machine-card" d="M516 178h168l-12 222H528Z"/>`;
    body += `<rect class="aquifer-fill" x="532" y="254" width="136" height="136" rx="8"/>`;
    body += `<text class="svg-label svg-title" x="600" y="214" font-size="14" text-anchor="middle">${esc(T('Tino salamoia (NaCl)', 'Salt brine tank (NaCl)', '饱和盐水溶盐箱'))}</text>`;
    body += `<text class="svg-label svg-temp" x="600" y="330" font-size="14" text-anchor="middle">NaCl + H₂O</text>`;

    if (!regen) {
      body += waterPipe([[74, 68], [284, 68]], 'link', 'link');
      body += waterPipe([[340, 96], [340, 378], [396, 378], [396, 68], [766, 68]], 'link', 'success', { thin: true, marker: true });
      body += `<text class="svg-label svg-title" x="158" y="50" font-size="13.5" text-anchor="middle">${esc(T('Acqua dura (Ca²⁺, Mg²⁺)', 'Hard water (Ca²⁺, Mg²⁺)', '含钙镁硬水进入'))}</text>`;
      body += `<text class="svg-label svg-title" x="648" y="50" font-size="13.5" text-anchor="middle">${esc(T('Acqua addolcita → T3/T4 → S2', 'Softened → T3/T4 → S2', '软化水 → T3/T4 → S2'))}</text>`;
    } else {
      // Brine drawn from salt tank through resin and flushed to drain!
      body += waterPipe([[564, 344], [564, 134], [340, 134], [340, 376], [136, 376]], 'warning', 'warning', { thin: true, marker: true });
      body += sandTrack([[340, 220], [340, 376], [136, 376]], 54);
      body += `<text class="svg-label svg-title" x="160" y="352" font-size="13.5" text-anchor="middle">${esc(T('Scarico durezza (Ca²⁺/Mg²⁺)', 'Hardness flush to drain', '置换钙镁排入下水道'))}</text>`;
    }
    focus += organBox(0, 276, 36, 128, 64) + organBox(1, 246, 100, 188, 306, 44) + organBox(2, 510, 172, 180, 234) + organBox(3, 560, 44, 210, 56);
    pins += pin(0, 260, 68) + pin(1, 444, 252) + pin(2, 696, 286) + pin(3, 736, 102);
  } else if (machineId === 'dab_micra') {
    const lowLevel = modeIdx === 1;
    // Underground 3.5 m3 rainwater cistern + leaf filter + slim 3" MICRA HS 130 Hz pump + inline Active Driver Plus -> garden sprinklers
    body += `<rect class="machine-card" x="78" y="138" width="356" height="268" rx="18"/>`;
    const waterTop = lowLevel ? 344 : 210;
    body += `<rect class="aquifer-fill" x="92" y="${waterTop}" width="328" height="${392 - waterTop}" rx="10"/>`;
    // Roof rainwater inlet + leaf filter basket
    body += waterPipe([[62, 92], [164, 92], [164, 168]], 'link', 'link', { thin: true, animated: !lowLevel });
    body += `<rect class="plate-pack" x="136" y="158" width="56" height="36" rx="6"/>`;
    // Slim 3" MICRA HS submersible pump
    body += `<rect class="machine-sub" x="278" y="218" width="44" height="164" rx="8"/>`;
    for (const sy of [342, 308, 274]) {
      body += `<g data-rotor="1" data-cx="300" data-cy="${sy}" data-rpm="${lowLevel ? 0 : 3.2}">` +
        `<path d="M286 ${sy + 4}L300 ${sy - 6}L314 ${sy + 4}Z" fill="var(--cp-accent)"/></g>`;
    }
    // Inline Active Driver Plus inverter above cistern -> irrigation sprinklers
    body += `<rect class="machine-card" x="506" y="148" width="128" height="84" rx="14"/>`;
    body += `<text class="svg-label svg-temp" x="570" y="185" font-size="13" text-anchor="middle">Active Driver</text>`;
    body += `<text class="svg-label svg-sub" x="570" y="208" font-size="12" text-anchor="middle">130 Hz · 4,8 bar</text>`;
    body += waterPipe([[300, 218], [300, 96], [570, 96], [570, 148]], 'link', 'link', { thin: true, animated: !lowLevel });
    body += waterPipe([[634, 190], [768, 190]], 'success', 'success', { thin: true, animated: !lowLevel, marker: !lowLevel });
    if (lowLevel) {
      body += waterPipe([[434, 290], [372, 290]], 'link', 'link', { thin: true, marker: true });
      body += `<text class="svg-label svg-title" x="580" y="294" font-size="13.5" text-anchor="middle">${esc(T('Reintegro soccorso (non potabile)', 'Backup non-potable make-up', '低液位保护与非饮用水补水'))}</text>`;
    }
    body += `<text class="svg-label svg-title" x="200" y="124" font-size="14" text-anchor="middle">${esc(T('Vasca piovana 3.500 L', '3,500 L Rainwater tank', '3,500 L 雨水蓄水池'))}</text>`;
    body += `<text class="svg-label svg-title" x="712" y="168" font-size="14" text-anchor="middle">${esc(T('Irrigazione giardino', 'Garden irrigation', '公共绿地喷灌'))}</text>`;
    focus += organBox(0, 72, 132, 368, 280) + organBox(1, 268, 210, 64, 178) + organBox(2, 498, 140, 144, 100) + organBox(3, 640, 150, 144, 72);
    pins += pin(0, 114, 184) + pin(1, 344, 304) + pin(2, 570, 254) + pin(3, 736, 224);
  } else if (machineId === 'plate_hx') {
    const isSC1 = modeIdx === 1;
    // Exploded / cross-section view of 5 alternating corrugated plates showing odd vs even counter-current channels!
    body += `<rect class="machine-card" x="186" y="48" width="468" height="354" rx="18"/>`;
    const xs = [256, 322, 388, 454, 520, 586];
    for (let i = 0; i < xs.length; i++) {
      const px = xs[i];
      body += `<path d="M${px} 82l8 18l-8 18l8 18l-8 18l8 18l-8 18l8 18l-8 18l8 18l-8 18l8 18l-8 18l8 18l-8 18" fill="none" stroke="var(--cp-border-strong)" stroke-width="3.2"/>`;
    }
    // Odd channels (0, 2, 4): Primary downward flow
    for (const cx of [289, 421, 553]) {
      body += waterPipe([[cx, 84], [cx, 364]], 'danger', isSC1 ? 'warning' : 'link', { thin: true });
    }
    // Even channels (1, 3): Secondary upward counter-current flow!
    for (const cx of [355, 487]) {
      body += waterPipe([[cx, 364], [cx, 84]], 'link', 'danger', { thin: true });
      body += heatWave(cx - 28, 224, cx - 4, 224);
    }
    // Top/bottom manifolds
    body += waterPipe([[72, 84], [553, 84]], 'danger', 'danger', { thin: true });
    body += waterPipe([[553, 364], [72, 364]], 'link', 'link', { thin: true, marker: true });
    body += waterPipe([[768, 364], [355, 364]], 'link', 'link', { thin: true });
    body += waterPipe([[355, 84], [768, 84]], 'danger', 'danger', { thin: true, marker: true });
    body += `<text class="svg-label svg-temp" x="122" y="66" font-size="13.5" text-anchor="middle">${isSC1 ? 'PC1 · 70 °C' : 'P08 · Centrale'}</text>`;
    body += `<text class="svg-label svg-temp" x="122" y="392" font-size="13.5" text-anchor="middle">${isSC1 ? 'Ritorno · 65 °C' : 'Ritorno PC2'}</text>`;
    body += `<text class="svg-label svg-temp" x="716" y="66" font-size="13.5" text-anchor="middle">${isSC1 ? 'Potabile · 60 °C (S2)' : 'P09 · Alta Press. AP'}</text>`;
    body += `<text class="svg-label svg-temp" x="716" y="392" font-size="13.5" text-anchor="middle">${isSC1 ? 'Da P01 · 55 °C' : 'Ritorno Torri AP'}</text>`;
    focus += organBox(0, 246, 76, 352, 294) + organBox(1, 274, 80, 100, 288) + organBox(2, 340, 80, 164, 288) + organBox(3, 180, 42, 480, 366);
    pins += pin(0, 256, 224) + pin(1, 289, 122) + pin(2, 487, 122) + pin(3, 634, 224);
  } else if (machineId === 'dhw_storage') {
    const isS3Mode = modeIdx === 1;
    if (!isS3Mode) {
      // S2 stratified 3,000 L cylinder (left-center) + Wax-element 48 °C thermostatic mixer cutaway (right)
      const strat = makeGrad(0, 82, 0, 378, 'danger', 'link');
      body += `<rect class="machine-card" x="176" y="56" width="212" height="338" rx="68"/>`;
      body += `<rect x="192" y="76" width="180" height="298" rx="56" fill="${strat}" fill-opacity=".28" stroke="var(--cp-border-strong)"/>`;
      // Bottom baffle plate calming 15 °C AFP make-up
      body += `<line x1="236" y1="346" x2="328" y2="346" stroke="var(--cp-border-strong)" stroke-width="4" stroke-linecap="round"/>`;
      body += waterPipe([[54, 122], [196, 122]], 'danger', 'danger', { thin: true, marker: true });
      body += waterPipe([[196, 316], [54, 316]], 'warning', 'link', { thin: true, marker: true });
      body += `<text class="svg-label svg-sub" x="108" y="104" font-size="12.5" text-anchor="middle">SC1 → 60 °C</text>`;
      body += `<text class="svg-label svg-sub" x="108" y="340" font-size="12.5" text-anchor="middle">P01 → 55 °C</text>`;
      body += `<text class="svg-label svg-temp" x="282" y="138" font-size="17" text-anchor="middle">60 °C</text>`;
      body += `<text class="svg-label svg-temp" x="282" y="328" font-size="16" text-anchor="middle">~15–25 °C</text>`;

      // Thermostatic mixing valve cutaway on right
      body += `<rect class="machine-card" x="516" y="136" width="164" height="164" rx="22"/>`;
      body += `<g data-pulse="1" data-cx="598" data-cy="218" data-amp="0.06">` +
        `<rect class="tag-pill-bg" x="572" y="182" width="52" height="72" rx="12"/>` +
        `<text class="svg-label svg-title" x="598" y="223" font-size="12.5" text-anchor="middle">Wax 48°</text></g>`;
      // 60C hot in, 15C cold bottom in, ACR recirc top in -> 48C ACP out!
      body += waterPipe([[372, 114], [462, 114], [462, 218], [516, 218]], 'danger', 'danger', { thin: true });
      body += waterPipe([[282, 424], [282, 374]], 'link', 'link', { thin: true });
      body += waterPipe([[282, 424], [598, 424], [598, 300]], 'link', 'link', { thin: true });
      body += waterPipe([[598, 66], [598, 136]], 'warning', 'warning', { thin: true });
      body += waterPipe([[680, 218], [794, 218]], 'warning', 'warning', { marker: true });
      body += `<text class="svg-label svg-temp" x="742" y="196" font-size="15" text-anchor="middle">ACP · 48 °C</text>`;
      body += `<text class="svg-label svg-sub" x="598" y="54" font-size="12.5" text-anchor="middle">ACR (~46 °C)</text>`;
      body += `<text class="svg-label svg-sub" x="454" y="412" font-size="12.5" text-anchor="middle">AFP (~15 °C)</text>`;
      focus += organBox(0, 184, 70, 196, 310, 58) + organBox(1, 48, 96, 154, 246) + organBox(2, 508, 128, 180, 180) + organBox(3, 384, 96, 132, 142);
      pins += pin(0, 282, 224) + pin(1, 144, 218) + pin(2, 654, 158) + pin(3, 462, 158);
    } else {
      // Parallel S3 supply thermal buffers + direct un-buffered return!
      body += `<rect class="machine-card" x="260" y="78" width="128" height="224" rx="44"/>`;
      body += `<rect class="machine-card" x="452" y="78" width="128" height="224" rx="44"/>`;
      body += `<text class="svg-label svg-title" x="324" y="192" font-size="15" text-anchor="middle">S3 #1 · 2.000 L</text>`;
      body += `<text class="svg-label svg-title" x="516" y="192" font-size="15" text-anchor="middle">S3 #2 · 2.000 L</text>`;
      // Supply splits in parallel into both S3 tanks and reunites!
      body += waterPipe([[74, 120], [212, 120], [212, 52], [516, 52], [516, 78]], 'danger', 'danger', { thin: true });
      body += waterPipe([[212, 120], [260, 120]], 'danger', 'danger', { thin: true });
      body += waterPipe([[324, 302], [324, 332], [636, 332], [636, 120], [768, 120]], 'danger', 'danger', { thin: true, marker: true });
      body += waterPipe([[516, 302], [516, 332]], 'danger', 'danger', { thin: true });
      // Direct return bypassing S3 tanks below!
      body += waterPipe([[768, 396], [74, 396]], 'link', 'link', { marker: true });
      body += `<text class="svg-label svg-sub" x="420" y="382" font-size="13.5" text-anchor="middle">${esc(T('Ritorno diretto alle PC2 (bypassa i serbatoi S3)', 'Direct return to PC2 (bypasses S3 buffers)', '回水干管直接返回 PC2（旁通 S3 水箱）'))}</text>`;
      focus += organBox(0, 252, 70, 144, 240, 44) + organBox(1, 444, 70, 144, 240, 44) + organBox(2, 68, 372, 706, 46) + organBox(3, 196, 40, 456, 304);
      pins += pin(0, 324, 128) + pin(1, 516, 128) + pin(2, 160, 396) + pin(3, 636, 224);
    }
  } else if (machineId === 'radiant_module') {
    const summer = modeIdx === 1;
    // Left apartment satellite box (M-bus meter + 2-way valve + local mixer + pump) -> Right room floor screed serpentine + ceiling/wall dehumidifier
    body += `<rect class="machine-card" x="52" y="64" width="268" height="332" rx="18"/>`;
    body += `<text class="svg-label svg-title" x="186" y="92" font-size="15" text-anchor="middle">${esc(T('Modulo d’utenza alloggio', 'Apartment Satellite Box', '住户分户水力计量箱'))}</text>`;
    // M-bus meter badge
    body += `<rect class="machine-sub" x="82" y="122" width="92" height="46" rx="8"/>` +
      `<text class="svg-label svg-temp" x="128" y="150" font-size="13" text-anchor="middle">M-bus kWh</text>`;
    // Local 3-way mixing valve + apartment circulator
    body += `<circle class="machine-card" cx="236" cy="218" r="20"/><text class="svg-label svg-title" x="236" y="223" font-size="13" text-anchor="middle">M</text>`;
    body += impellerWheel(236, 294, 20, 1.5);

    // Apartment room on right: Dehumidifier top + Floor screed serpentine bottom
    body += `<rect class="machine-card" x="368" y="64" width="420" height="332" rx="18"/>`;
    // Isothermal dehumidifier unit (active in summer!)
    body += `<rect class="machine-sub" x="412" y="90" width="332" height="74" rx="12"/>`;
    body += `<text class="svg-label svg-title" x="578" y="120" font-size="14" text-anchor="middle">${esc(T('Deumidificatore d’alloggio', 'Apartment Dehumidifier', '户内等温除湿机'))}</text>`;
    body += `<text class="svg-label svg-sub" x="578" y="144" font-size="12.5" text-anchor="middle">${esc(summer ? T('Attivo a 13 °C · Asciuga l’aria (niente condensa)', 'Active at 13 °C · Dries indoor air below dew point', '13 °C 冷水运行 · 抽湿防结露') : T('Spento in inverno', 'Idle in winter heating', '冬季供暖期停机'))}</text>`;
    if (summer) {
      body += waterPipe([[190, 145], [190, 114], [412, 114]], 'link', 'link', { thin: true });
    }
    // Screed serpentine coil at bottom of room
    body += `<rect class="plate-pack" x="394" y="266" width="368" height="108" rx="10"/>`;
    const inT = summer ? 'link' : 'danger', outT = summer ? 'danger' : 'link';
    body += waterPipe([[16, 145], [82, 145]], inT, inT, { thin: true });
    body += waterPipe([[174, 145], [236, 145], [236, 198]], inT, inT, { thin: true });
    const coilPts = [[256, 294], [418, 294], [736, 294], [736, 324], [418, 324], [418, 354], [736, 354], [736, 382], [186, 382], [186, 354], [16, 354]];
    body += waterPipe(coilPts, inT, outT, { thin: true });
    for (const hx of [468, 578, 688]) {
      body += summer ? heatWave(hx, 206, hx, 258) : heatWave(hx, 258, hx, 200);
    }
    body += `<text class="svg-label svg-temp" x="578" y="238" font-size="17" text-anchor="middle">${summer ? '18 → 23 °C' : '38 → 33 °C'}</text>`;
    focus += organBox(0, 74, 114, 108, 62) + organBox(1, 204, 188, 64, 134) + organBox(2, 388, 260, 380, 120) + organBox(3, 404, 84, 348, 86);
    pins += pin(0, 128, 188) + pin(1, 188, 256) + pin(2, 424, 252) + pin(3, 434, 126);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" class="vector-map machine-cutaway" data-machine="${esc(machineId)}" viewBox="0 0 840 450" role="group">` +
    `<defs>${defs.join('')}</defs>` +
    `<g class="cutaway-focus">${focus}</g>` +
    `<g class="cutaway-body">${body}</g>` +
    `<g class="flow-layer" aria-hidden="true"></g>` +
    `<g class="cutaway-pins">${pins}</g>` +
    `</svg>`;
}
