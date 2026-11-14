import assert from 'node:assert/strict';

export const hydraulicStyle = `
.vector-map{display:block;width:100%;height:100%;overflow:visible;user-select:none}
.svg-label{fill:var(--cp-text);font-family:"Segoe UI",Aptos,Calibri,-apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none}
.svg-title{font-weight:700;fill:var(--cp-text)}
.svg-sub{fill:var(--cp-text-muted);font-weight:500}
.svg-temp{font-family:Consolas,"Courier New",monospace;font-weight:700;fill:var(--cp-text)}
.zone-box{fill:var(--cp-surface-soft);fill-opacity:.55;stroke:var(--cp-border);stroke-width:1.5;stroke-dasharray:5 5}
.zone-caption{fill:var(--cp-text-muted);font-size:15px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;pointer-events:none}
.machine-card{fill:var(--cp-surface);stroke:var(--cp-border-strong);stroke-width:2;transition:stroke .16s ease,stroke-width .16s ease}
.machine-sub{fill:var(--cp-bg-elevated);stroke:var(--cp-border-strong);stroke-width:1.6}
.plate-pack{fill:var(--cp-surface-soft);stroke:var(--cp-border-strong);stroke-width:2}
.aquifer-fill{fill:var(--cp-link);fill-opacity:.1;stroke:var(--cp-link);stroke-width:1.5;stroke-dasharray:6 4}
.pipe-casing{fill:none;stroke:var(--cp-border-strong);stroke-width:9.5;stroke-linecap:round;stroke-linejoin:round;opacity:.42}
.pipe-core{fill:none;stroke-width:5.5;stroke-linecap:round;stroke-linejoin:round}
.pipe-core.thin{stroke-width:4.2}
.pipe-casing.thin{stroke-width:7.4}
.pipe-sheen{fill:none;stroke:var(--cp-sheen);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.thermal-track{fill:none;stroke:var(--cp-warning);stroke-width:3;stroke-dasharray:6 5;stroke-linecap:round;opacity:.85}
.power-track{fill:none;stroke:var(--cp-accent);stroke-width:3.2;stroke-linecap:round}
.hydraulic-node{cursor:pointer;outline:none}
.hydraulic-node:hover .machine-card,.hydraulic-node:focus-visible .machine-card,.hydraulic-node.highlighted .machine-card{stroke:var(--cp-accent);stroke-width:3.4}
.hydraulic-node:hover .tag-pill-bg,.hydraulic-node:focus-visible .tag-pill-bg,.hydraulic-node.highlighted .tag-pill-bg{fill:var(--cp-accent);stroke:var(--cp-accent)}
.hydraulic-node:hover .tag-pill-text,.hydraulic-node:focus-visible .tag-pill-text,.hydraulic-node.highlighted .tag-pill-text{fill:var(--cp-accent-fg)}
.tag-pill-bg{fill:var(--cp-accent-soft);stroke:var(--cp-accent);stroke-width:1.4;transition:fill .15s ease}
.tag-pill-text{fill:var(--cp-accent);font-family:Consolas,"Courier New",monospace;font-weight:700;pointer-events:none}
.inline-pump{cursor:pointer}
.inline-pump:hover circle,.inline-pump:focus-visible circle,.inline-pump.highlighted circle{stroke:var(--cp-accent);stroke-width:3}
.port{pointer-events:none}
.flow-layer{pointer-events:none}
@media(max-width:1023px),(max-height:540px){.pc-detail{display:none}}
`;

export function readTopology(graph) {
  const ports = new Map(), edges = [], adjacency = new Map(), nodeOfPort = new Map();
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.channels) {
      for (const [channel, [fluid, ...names]] of Object.entries(node.channels)) {
        for (const name of names) {
          ports.set(`${id}/${channel}.${name}`, fluid);
          nodeOfPort.set(`${id}/${channel}.${name}`, node);
        }
      }
    } else if (node.portFluids) {
      for (const [name, fluid] of Object.entries(node.portFluids)) {
        ports.set(`${id}/${name}`, fluid);
        nodeOfPort.set(`${id}/${name}`, node);
      }
    } else {
      const names = node.ports || (['junction', 'boundary', 'vessel'].includes(node.type) ? ['p'] : ['in', 'out']);
      for (const name of names) {
        ports.set(`${id}/${name}`, node.fluid);
        nodeOfPort.set(`${id}/${name}`, node);
      }
    }
  }
  const add = (from, to, side = false) => {
    assert(ports.has(from) && ports.has(to), `Unknown graph port: ${from} -> ${to}`);
    const fFrom = ports.get(from), fTo = ports.get(to);
    const sameNodeBooster = from.split('/')[0] === to.split('/')[0] && nodeOfPort.get(from)?.type === 'booster';
    if (!sameNodeBooster) {
      assert.equal(fFrom, fTo, `Hydraulic mixing: ${from} -> ${to}`);
    }
    edges.push({ from, to, fluid: fTo, side });
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push(to);
  };
  for (const run of graph.runs) for (let i = 1; i < run.length; i++) add(run[i - 1], run[i]);
  for (const [from, to] of graph.sideBranches) { add(from, to, true); add(to, from, true); }
  const reaches = (from, to) => {
    const queue = [from], seen = new Set();
    while (queue.length) {
      const next = queue.shift();
      if (next === to) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(...(adjacency.get(next) || []));
    }
    return false;
  };
  assert.equal(Object.values(graph.nodes).filter(n => n.tag === 'S3').length, 4);
  assert(!reaches('SC2/p.in', 'SC2/s.out'), 'SC2 must preserve the hydraulic boundary');
  assert(!reaches('SC1.mp/p.in', 'S2.mp/charge.in'), 'SC1 must separate potable water');
  assert(!reaches('TAP.mp/in', 'S2.mp/cold'), 'Open tap draw-off must never return to storage');
  assert(!reaches('TAP.bp/in', 'S2.bp/cold'), 'Open tap draw-off must never return to storage');
  assert(reaches('DHW.mp/out', 'MIX.mp/cold') && reaches('DHW.mp/out', 'S2.mp/cold'), 'Warm MP recirculation must feed mixer and S2');
  for (const suffix of ['c', 'i']) {
    const feed = suffix === 'c' ? 'C.feed/p' : 'I.feed/p';
    const supply = suffix === 'c' ? 'C.supply/p' : 'I.supply/p';
    for (const tank of ['a', 'b']) {
      assert(edges.some(e => e.from === feed && e.to === `S3.${suffix}.${tank}/in`));
      assert(edges.some(e => e.from === `S3.${suffix}.${tank}/out` && e.to === supply));
    }
  }
  return { ports, edges, reaches };
}

export function createDiagrams(graph) {
  const topology = readTopology(graph);
  const node = (id, shape, x, y, w, h, label, topic, ports, members = [], opts = {}) =>
    ({ id, shape, x, y, w, h, label, topic, ports, members, ...opts });
  const port = (x, y, fluid, refs = []) => ({ x, y, fluid, refs });
  const diagrams = {};

  // STEP 1 — Theoretical principle with 1 Heat Pump, 1 Well Pump, 1 Radiant Floor Loop
  {
    const d = {
      id: 'step1', step: 1, width: 1500, height: 660,
      zones: [
        { x: 26, y: 24, w: 304, h: 612, labelKey: 'zoneAquifer' },
        { x: 430, y: 24, w: 540, h: 612, labelKey: 'zoneHeatPump1' },
        { x: 1070, y: 24, w: 404, h: 612, labelKey: 'zoneHome' }
      ],
      nodes: [
        node('well', 'aquiferSupply', 55, 82, 245, 215, 'step1Well', 'ground',
          { out: port(245, 108, 'ground', ['GW.source/p']) }, ['P1', 'P11.a'], { tags: ['P1', 'P11'] }),
        node('returnWell', 'aquiferReturn', 55, 365, 245, 215, 'step1Return', 'ground',
          { in: port(245, 115, 'ground', ['R1.a/p']) }, ['R1.a'], { tags: ['R1'] }),
        node('pc2', 'singleHeatPump', 465, 82, 470, 498, 'step1HP', 'cycle',
          {
            gi: port(0, 108, 'ground', ['PC2.a/g.in']),
            go: port(0, 398, 'ground', ['PC2.a/g.out']),
            co: port(470, 108, 'climate', ['PC2.a/c.out']),
            ci: port(470, 398, 'climate', ['PC2.a/c.in'])
          }, ['PC2.a'], { tags: ['PC2'] }),
        node('load', 'radiantHome', 1105, 82, 340, 498, 'step1Home', 'floor',
          {
            in: port(0, 108, 'climate', ['C.supply/p']),
            out: port(0, 398, 'climate', ['C.return/p'])
          }, ['P07', 'BP'], { tags: ['BP'] })
      ],
      edges: [
        { id: 's1-gw-sup', from: 'well.out', to: 'pc2.gi', bends: [] },
        { id: 's1-gw-ret', from: 'pc2.go', to: 'returnWell.in', bends: [] },
        { id: 's1-cl-sup', from: 'pc2.co', to: 'load.in', bends: [] },
        { id: 's1-cl-ret', from: 'load.out', to: 'pc2.ci', bends: [] }
      ]
    };
    diagrams[d.id] = d;
  }

  // STEP 2 — Coupling with Domestic Hot Water (2-stage lift + accurate open tap draw-off & warm riser recirculation)
  {
    const d = {
      id: 'step2', step: 2, width: 1640, height: 800,
      zones: [
        { x: 20, y: 20, w: 222, h: 405, labelKey: 'zoneAquifer' },
        { x: 262, y: 20, w: 545, h: 405, labelKey: 'zoneClimateGen' },
        { x: 885, y: 20, w: 735, h: 405, labelKey: 'zoneBuildingLoops' },
        { x: 355, y: 452, w: 1265, h: 332, labelKey: 'zoneDhwStage', captionOffset: 62 }
      ],
      nodes: [
        node('well', 'wellCompact', 36, 65, 190, 148, 'step2Well', 'ground',
          { out: port(190, 70, 'ground', ['GW.source/p']) }, ['P1', 'P11.a', 'T6', 'T7.a', 'S4.a'], { tagPill: 'P1 · T6 · T7', tags: ['P1', 'T6', 'T7', 'S4'] }),
        node('returnWell', 'wellCompact', 36, 252, 190, 148, 'step2Return', 'ground',
          { in: port(190, 70, 'ground', ['R1.a/p']) }, ['R1.a'], { tagPill: 'R1', tags: ['R1'], isReturn: true }),
        node('pc2', 'polyHeatPump', 285, 65, 250, 335, 'step2PC2', 'pc2',
          {
            gi: port(0, 70, 'ground', ['PC2.a/g.in']),
            go: port(0, 257, 'ground', ['PC2.a/g.out']),
            co: port(250, 70, 'climate', ['PC2.a/c.out']),
            ci: port(250, 245, 'climate', ['PC2.a/c.in']),
            ii: port(80, 335, 'intermediate', ['PC2.a/i.in']),
            io: port(175, 335, 'intermediate', ['PC2.a/i.out'])
          }, ['PC2.a'], { tagPill: 'PC2', tags: ['PC2'] }),
        node('s3c', 'bufferSingle', 615, 65, 160, 172, 'step2S3C', 's3',
          { in: port(0, 70, 'climate', ['S3.c.a/in']), out: port(160, 70, 'climate', ['S3.c.a/out']) }, ['S3.c.a'], { tagPill: 'S3', tags: ['S3'] }),
        node('load', 'buildingClimate', 910, 62, 345, 318, 'step2Floors', 'floor',
          { in: port(0, 73, 'climate', ['C.supply/p']), out: port(0, 248, 'climate', ['C.return/p']) }, ['P07', 'BP'], { tagPill: 'Pannelli', tags: ['P07', 'BP'] }),
        node('riser', 'sanitaryRiserHome', 1290, 62, 310, 326, 'step2Riser', 'dhw',
          {
            acpIn: port(95, 326, 'potable.mp', ['DHW.mp/in']),
            acrOut: port(230, 326, 'potable.mp', ['DHW.mp/out'])
          }, ['DHW.mp', 'TAP.mp', 'P02', 'D.return.mp'], { tagPill: 'ACP · ACR', tags: ['ACP', 'ACR', 'P02'] }),
        node('s3i', 'bufferSingle', 425, 488, 150, 162, 'step2S3I', 'intermediate',
          { in: port(0, 67, 'intermediate', ['S3.i.a/in']), out: port(150, 67, 'intermediate', ['S3.i.a/out']) }, ['S3.i.a'], { tagPill: 'S3', tags: ['S3'] }),
        node('pc1', 'highTempPump', 670, 482, 210, 210, 'step2PC1', 'pc1',
          {
            si: port(0, 73, 'intermediate', ['PC1/s.in']),
            so: port(0, 168, 'intermediate', ['PC1/s.out']),
            ho: port(210, 73, 'hot', ['PC1/h.out']),
            hi: port(210, 168, 'hot', ['PC1/h.in'])
          }, ['PC1'], { tagPill: 'PC1', tags: ['PC1'] }),
        node('sc1', 'plateExchanger', 970, 490, 82, 195, 'step2SC1', 'sc1',
          {
            pi: port(0, 65, 'hot', ['SC1.mp/p.in']),
            po: port(0, 160, 'hot', ['SC1.mp/p.out']),
            so: port(82, 65, 'potable.mp', ['SC1.mp/s.out']),
            si: port(82, 160, 'potable.mp', ['SC1.mp/s.in'])
          }, ['SC1.mp'], { tagPill: 'SC1', tags: ['SC1'] }),
        node('s2', 'dhwCylinder', 1142, 472, 148, 222, 'step2S2', 's2',
          {
            chargeIn: port(0, 83, 'potable.mp', ['S2.mp/charge.in']),
            chargeOut: port(0, 178, 'potable.mp', ['S2.mp/charge.out']),
            hotOut: port(148, 53, 'potable.mp', ['S2.mp/hot']),
            coldIn: port(74, 222, 'potable.mp', ['S2.mp/cold'])
          }, ['S2.mp'], { tagPill: 'S2 · 60 °C', tags: ['S2'] }),
        node('mixer', 'thermoMixer', 1345, 490, 80, 80, 'step2Mix', 'dhw',
          {
            hotIn: port(0, 35, 'potable.mp', ['MIX.mp/hot']),
            coldIn: port(40, 80, 'potable.mp', ['MIX.mp/cold']),
            mixedOut: port(40, 0, 'potable.mp', ['MIX.mp/out'])
          }, ['MIX.mp'], { tagPill: 'Misc. 48 °C', tags: ['ACP'] }),
        node('mains', 'mainsIntake', 945, 720, 200, 52, 'step2Mains', 'water',
          { out: port(200, 26, 'potable.mp', ['COLD.mp/p']) }, ['AQ', 'T1', 'S1.a', 'GP1', 'T2.mp', 'COLD.mp'], { tagPill: 'AFP · Rete', tags: ['AFP', 'T1', 'GP1', 'T2'] })
      ],
      edges: [
        { id: 's2-gw-sup', from: 'well.out', to: 'pc2.gi', bends: [] },
        { id: 's2-gw-ret', from: 'pc2.go', to: 'returnWell.in', bends: [] },
        { id: 's2-cl-feed', from: 'pc2.co', to: 's3c.in', bends: [] },
        { id: 's2-cl-sup', from: 's3c.out', to: 'load.in', bends: [], pump: 'P07', pumpTopic: 'tag-P07' },
        { id: 's2-cl-ret', from: 'load.out', to: 'pc2.ci', bends: [] },
        { id: 's2-in-feed', from: 'pc2.io', to: 's3i.in', bends: [[460, 434], [395, 434], [395, 555]] },
        { id: 's2-in-sup', from: 's3i.out', to: 'pc1.si', bends: [], pump: 'P05', pumpTopic: 'tag-P05' },
        { id: 's2-in-ret', from: 'pc1.so', to: 'pc2.ii', bends: [[635, 650], [635, 722], [365, 722]] },
        { id: 's2-ht-sup', from: 'pc1.ho', to: 'sc1.pi', bends: [], pump: 'P04', pumpTopic: 'tag-P04' },
        { id: 's2-ht-ret', from: 'sc1.po', to: 'pc1.hi', bends: [] },
        { id: 's2-ch-sup', from: 'sc1.so', to: 's2.chargeIn', bends: [] },
        { id: 's2-ch-ret', from: 's2.chargeOut', to: 'sc1.si', bends: [], pump: 'P01', pumpTopic: 'tag-P01' },
        { id: 's2-hot-out', from: 's2.hotOut', to: 'mixer.hotIn', bends: [] },
        { id: 's2-acp-sup', from: 'mixer.mixedOut', to: 'riser.acpIn', bends: [] },
        { id: 's2-acr-mix', from: 'riser.acrOut', to: 'mixer.coldIn', bends: [[1520, 714], [1385, 714]], pump: 'P02', pumpTopic: 'tag-P02', pumpAt: [1520, 535], pumpAngle: 90, role: 'recirc' },
        { id: 's2-acr-s2', from: 'riser.acrOut', to: 's2.coldIn', bends: [[1520, 714], [1216, 714]], role: 'recirc' },
        { id: 's2-afp-s2', from: 'mains.out', to: 's2.coldIn', bends: [[1216, 746]], role: 'coldFeed' },
        { id: 's2-afp-mix', from: 'mains.out', to: 'mixer.coldIn', bends: [[1385, 746]], role: 'coldFeed' }
      ]
    };
    diagrams[d.id] = d;
  }

  // STEP 3 — Complete Real Condominium Plant Mes 600 S (multi-unit parallel groups, pressure zones, all tags)
  {
    const d = {
      id: 'step3', step: 3, width: 1780, height: 880,
      zones: [
        { x: 18, y: 20, w: 382, h: 530, labelKey: 'zoneWellsMulti' },
        { x: 416, y: 20, w: 525, h: 418, labelKey: 'zoneGenMulti' },
        { x: 960, y: 20, w: 802, h: 418, labelKey: 'zoneClimateZones' },
        { x: 416, y: 458, w: 1346, h: 404, labelKey: 'zoneDhwMulti' }
      ],
      nodes: [
        node('wells', 'multiWells', 32, 66, 202, 248, 'step3Wells', 'wells',
          { out: port(202, 114, 'ground', ['GW.feed/p']) }, ['P1', 'P2', 'P11.a', 'P11.b', 'P10'],
          { tagPill: 'P1 (2×P11) + P2 (P10)', tags: ['P1', 'P2', 'P11', 'P10'] }),
        node('gwTreat', 'multiGwTreat', 264, 66, 124, 248, 'step3Treat', 'gw-treatment',
          { in: port(0, 114, 'ground', ['T6/in']), out: port(124, 114, 'ground', ['GW.source/p']) },
          ['T6', 'T7.a', 'T7.b', 'S4.a', 'S4.b'], { tagPill: 'T6 · 2×T7 · 2×S4', tags: ['T6', 'T7', 'S4'] }),
        node('returnWells', 'multiReturnWells', 76, 362, 260, 165, 'step3Return', 'wells',
          { in: port(260, 82, 'ground', ['R1.a/p', 'R1.b/p']) }, ['R1.a', 'R1.b'],
          { tagPill: '2 × R1', tags: ['R1'] }),
        node('pc2', 'multiPC2', 436, 66, 254, 346, 'step3PC2', 'pc2',
          {
            gi: port(0, 114, 'ground', ['PC2.a/g.in', 'PC2.b/g.in']),
            go: port(0, 284, 'ground', ['PC2.a/g.out', 'PC2.b/g.out']),
            co: port(254, 84, 'climate', ['PC2.a/c.out', 'PC2.b/c.out']),
            ci: port(254, 254, 'climate', ['PC2.a/c.in', 'PC2.b/c.in']),
            ii: port(78, 346, 'intermediate', ['PC2.a/i.in', 'PC2.b/i.in']),
            io: port(172, 346, 'intermediate', ['PC2.a/i.out', 'PC2.b/i.out'])
          }, ['PC2.a', 'PC2.b'], { tagPill: '2 × PC2', tags: ['PC2'] }),
        node('s3c', 'multiBuffer', 746, 66, 176, 174, 'step3S3C', 's3',
          { in: port(0, 84, 'climate', ['S3.c.a/in', 'S3.c.b/in']), out: port(176, 84, 'climate', ['S3.c.a/out', 'S3.c.b/out']) },
          ['S3.c.a', 'S3.c.b'], { tagPill: '2 × S3', tags: ['S3'] }),
        node('branchCommon', 'climateBranch', 1086, 54, 656, 84, 'step3Common', 'dist-zones',
          { in: port(0, 26, 'climate', ['P06/in']), out: port(0, 60, 'climate', ['COMMON/out']) },
          ['P06', 'COMMON'], { tagPill: 'P06 · Spazi comuni', pumpCode: 'P06', tags: ['P06'] }),
        node('branchBP', 'climateBranch', 1086, 158, 656, 100, 'step3BP', 'dist-zones',
          { in: port(0, 30, 'climate', ['M07/hot']), out: port(0, 72, 'climate', ['BP/out']) },
          ['M07', 'P07', 'BP'], { tagPill: 'P07 · Zona BP', pumpCode: 'P07', hasMixer: true, showTemp: true, tags: ['P07', 'BP'] }),
        node('sc2', 'plateExchanger', 1086, 280, 128, 134, 'step3SC2', 'sc2',
          {
            pi: port(0, 35, 'climate', ['P08/in']),
            po: port(0, 98, 'climate', ['SC2/p.out']),
            so: port(128, 35, 'high', ['SC2/s.out']),
            si: port(128, 98, 'high', ['SC2/s.in'])
          }, ['P08', 'SC2'], { tagPill: 'P08 + SC2', isSC2: true, tags: ['P08', 'SC2'] }),
        node('branchAP', 'climateBranch', 1272, 280, 470, 134, 'step3AP', 'dist-zones',
          { in: port(0, 35, 'high', ['P09/in']), out: port(0, 98, 'high', ['AP/out']) },
          ['P09', 'AP'], { tagPill: 'P09 · Zona AP', pumpCode: 'P09', showTemp: true, tags: ['P09', 'AP'] }),
        node('s3i', 'multiBuffer', 442, 498, 174, 168, 'step3S3I', 'intermediate',
          { in: port(0, 77, 'intermediate', ['S3.i.a/in', 'S3.i.b/in']), out: port(174, 77, 'intermediate', ['S3.i.a/out', 'S3.i.b/out']) },
          ['S3.i.a', 'S3.i.b'], { tagPill: '2 × S3', tags: ['S3'] }),
        node('pc1', 'highTempPump', 700, 495, 196, 200, 'step3PC1', 'pc1',
          {
            si: port(0, 80, 'intermediate', ['PC1/s.in']),
            so: port(0, 165, 'intermediate', ['PC1/s.out']),
            ho: port(196, 80, 'hot', ['PC1/h.out']),
            hi: port(196, 165, 'hot', ['PC1/h.in'])
          }, ['PC1'], { tagPill: 'PC1', tags: ['PC1'] }),
        node('sc1', 'multiExchanger', 980, 495, 118, 200, 'step3SC1', 'sc1',
          {
            pi: port(0, 80, 'hot', ['SC1.mp/p.in', 'SC1.bp/p.in']),
            po: port(0, 165, 'hot', ['SC1.mp/p.out', 'SC1.bp/p.out']),
            so: port(118, 80, 'potable.mp', ['SC1.mp/s.out']),
            si: port(118, 165, 'potable.mp', ['SC1.mp/s.in'])
          }, ['SC1.mp', 'SC1.bp'], { tagPill: '2 × SC1', tags: ['SC1'] }),
        node('s2', 'multiDhwCylinders', 1188, 485, 184, 215, 'step3S2', 's2',
          {
            chargeIn: port(0, 90, 'potable.mp', ['S2.mp/charge.in']),
            chargeOut: port(0, 175, 'potable.mp', ['S2.mp/charge.out']),
            hotOut: port(184, 50, 'potable.mp', ['S2.mp/hot']),
            coldIn: port(92, 215, 'potable.mp', ['S2.mp/cold'])
          }, ['P01.mp', 'P01.bp', 'S2.mp', 'S2.bp'], { tagPill: '2 × S2', tags: ['S2', 'P01'] }),
        node('mixer', 'thermoMixer', 1420, 500, 80, 80, 'step3Mix', 'dhw',
          {
            hotIn: port(0, 35, 'potable.mp', ['MIX.mp/hot']),
            coldIn: port(40, 80, 'potable.mp', ['MIX.mp/cold']),
            mixedOut: port(80, 35, 'potable.mp', ['MIX.mp/out'])
          }, ['MIX.mp', 'MIX.bp'], { tagPill: '2×Misc.', tags: ['ACP'] }),
        node('dhwZones', 'multiDhwRisers', 1545, 480, 198, 258, 'step3DhwZones', 'dhw',
          {
            acpIn: port(0, 55, 'potable.mp', ['DHW.mp/in']),
            acrOut: port(98, 258, 'potable.mp', ['DHW.mp/out'])
          }, ['DHW.mp', 'DHW.bp', 'TAP.mp', 'TAP.bp', 'P02', 'P03', 'D.return.mp', 'D.return.bp'],
          { tagPill: 'MP + BP', tags: ['ACP', 'ACR', 'P02', 'P03', 'MP', 'BP'] }),
        node('potable', 'potableStation', 520, 758, 675, 88, 'step3Potable', 'water',
          { out: port(675, 44, 'potable.mp', ['COLD.mp/p']) },
          ['AQ', 'T1', 'S1.a', 'S1.b', 'GP1', 'GP2', 'T2.mp', 'T2.bp', 'T3.mp', 'T3.bp', 'T4.mp', 'T4.bp', 'COLD.mp', 'COLD.bp'],
          { tagPill: 'T1 · 2×S1 · GP1/GP2 · 2×T2 · T3/T4', tags: ['T1', 'S1', 'GP1', 'GP2', 'T2', 'T3', 'T4', 'AFP'] })
      ],
      edges: [
        { id: 's3-gw-raw', from: 'wells.out', to: 'gwTreat.in', bends: [] },
        { id: 's3-gw-sup', from: 'gwTreat.out', to: 'pc2.gi', bends: [] },
        { id: 's3-gw-ret', from: 'pc2.go', to: 'returnWells.in', bends: [[398, 350], [398, 444]] },
        { id: 's3-cl-feed', from: 'pc2.co', to: 's3c.in', bends: [] },
        { id: 's3-cl-b1', from: 's3c.out', to: 'branchCommon.in', bends: [[992, 150], [992, 80]] },
        { id: 's3-cl-b2', from: 's3c.out', to: 'branchBP.in', bends: [[992, 150], [992, 188]] },
        { id: 's3-cl-b3', from: 's3c.out', to: 'sc2.pi', bends: [[992, 150], [992, 315]] },
        { id: 's3-cl-r1', from: 'branchCommon.out', to: 'pc2.ci', bends: [[1036, 114], [1036, 320]] },
        { id: 's3-cl-r2', from: 'branchBP.out', to: 'pc2.ci', bends: [[1036, 230], [1036, 320]] },
        { id: 's3-cl-r3', from: 'sc2.po', to: 'pc2.ci', bends: [[1036, 378], [1036, 320]] },
        { id: 's3-ap-sup', from: 'sc2.so', to: 'branchAP.in', bends: [] },
        { id: 's3-ap-ret', from: 'branchAP.out', to: 'sc2.si', bends: [] },
        { id: 's3-in-feed', from: 'pc2.io', to: 's3i.in', bends: [[608, 448], [412, 448], [412, 575]] },
        { id: 's3-in-sup', from: 's3i.out', to: 'pc1.si', bends: [], pump: 'P05', pumpTopic: 'tag-P05' },
        { id: 's3-in-ret', from: 'pc1.so', to: 'pc2.ii', bends: [[662, 660], [662, 716], [386, 716], [386, 430], [514, 430]] },
        { id: 's3-ht-sup', from: 'pc1.ho', to: 'sc1.pi', bends: [], pump: 'P04', pumpTopic: 'tag-P04' },
        { id: 's3-ht-ret', from: 'sc1.po', to: 'pc1.hi', bends: [] },
        { id: 's3-ch-sup', from: 'sc1.so', to: 's2.chargeIn', bends: [] },
        { id: 's3-ch-ret', from: 's2.chargeOut', to: 'sc1.si', bends: [], pump: '2×P01', pumpTopic: 'tag-P01' },
        { id: 's3-hot-out', from: 's2.hotOut', to: 'mixer.hotIn', bends: [] },
        { id: 's3-acp-sup', from: 'mixer.mixedOut', to: 'dhwZones.acpIn', bends: [] },
        { id: 's3-acr-mix', from: 'dhwZones.acrOut', to: 'mixer.coldIn', bends: [[1643, 766], [1460, 766]], pump: 'P02·P03', pumpTopic: 'tag-P02', pumpAt: [1552, 766], pumpAngle: 180, role: 'recirc' },
        { id: 's3-acr-s2', from: 'dhwZones.acrOut', to: 's2.coldIn', bends: [[1643, 766], [1280, 766]], role: 'recirc' },
        { id: 's3-afp-s2', from: 'potable.out', to: 's2.coldIn', bends: [[1280, 802]], role: 'coldFeed' },
        { id: 's3-afp-mix', from: 'potable.out', to: 'mixer.coldIn', bends: [[1460, 802]], role: 'coldFeed' }
      ]
    };
    diagrams[d.id] = d;
  }

  for (const d of Object.values(diagrams)) {
    const resolve = ref => {
      const [id, name] = ref.split('.');
      const n = d.nodes.find(item => item.id === id), p = n?.ports[name];
      assert(p, `Unknown drawing port: ${d.id}/${ref}`);
      return { ...p, x: n.x + p.x, y: n.y + p.y };
    };
    for (const e of d.edges) {
      const from = resolve(e.from), to = resolve(e.to);
      assert.equal(from.fluid, to.fluid, `Drawing crosses fluids: ${d.id}/${e.id}`);
      e.fluid = from.fluid;
      e.points = [[from.x, from.y], ...e.bends, [to.x, to.y]];
      for (let i = 1; i < e.points.length; i++) {
        assert(
          e.points[i][0] === e.points[i - 1][0] || e.points[i][1] === e.points[i - 1][1],
          `Non-orthogonal pipe ${d.id}/${e.id}: ${JSON.stringify(e.points[i - 1])} -> ${JSON.stringify(e.points[i])}`
        );
      }
      assert(
        from.refs.some(a => to.refs.some(b => topology.reaches(a, b))),
        `Projection has no source graph path: ${d.id}/${e.from} -> ${e.to}`
      );
    }
    for (const n of d.nodes) {
      for (const member of n.members) assert(graph.nodes[member], `Unknown grouped instance ${member}`);
    }
  }

  // Interactive Refrigeration Cycle Zoom (4 stages + 3+1=4 COP core)
  {
    const d = {
      id: 'cycle', width: 1160, height: 540, teaching: true, zones: [],
      nodes: [
        { ...node('stage0', 'cycleStage', 65, 165, 250, 210, 'stage0', 'evaporator', { in: port(125, 210, 'ref'), out: port(125, 0, 'ref') }), stage: 0 },
        { ...node('stage1', 'cycleStage', 455, 28, 250, 168, 'stage1', 'compressor', { in: port(0, 84, 'ref'), out: port(250, 84, 'ref') }), stage: 1 },
        { ...node('stage2', 'cycleStage', 845, 165, 250, 210, 'stage2', 'condenser', { in: port(125, 0, 'ref'), out: port(125, 210, 'ref') }), stage: 2 },
        { ...node('stage3', 'cycleStage', 455, 344, 250, 168, 'stage3', 'expansion', { in: port(250, 84, 'ref'), out: port(0, 84, 'ref') }), stage: 3 }
      ],
      edges: [
        { id: 'phase0', from: 'stage0.out', to: 'stage1.in', fluid: 'ref', points: [[190, 165], [190, 112], [455, 112]] },
        { id: 'phase1', from: 'stage1.out', to: 'stage2.in', fluid: 'ref', points: [[705, 112], [970, 112], [970, 165]] },
        { id: 'phase2', from: 'stage2.out', to: 'stage3.in', fluid: 'ref', points: [[970, 375], [970, 428], [705, 428]] },
        { id: 'phase3', from: 'stage3.out', to: 'stage0.in', fluid: 'ref', points: [[455, 428], [190, 428], [190, 375]] }
      ]
    };
    diagrams[d.id] = d;
  }

  return diagrams;
}

// Self-contained SVG renderer (also embedded in browser index.html)
export function renderHydraulic(d, copy, season = 'winter', prefix = 'hyd') {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ui = copy.ui || {};
  const textLabel = key => ui[key] || copy[key] || key;
  const supplyTone = season === 'winter' ? 'danger' : 'link';
  const returnTone = season === 'winter' ? 'link' : 'danger';

  const portTone = (n, name) => {
    if (n.shape === 'cycleStage') return (n.stage === 1 && name === 'out') || (n.stage === 2) || (n.stage === 3 && name === 'in') ? 'danger' : 'link';
    if (n.shape === 'thermoMixer') return name === 'hotIn' ? 'danger' : name === 'coldIn' ? 'link' : 'warning';
    if (n.shape === 'sanitaryRiserHome' || n.shape === 'multiDhwRisers') return 'warning';
    if (n.shape === 'mainsIntake' || n.shape === 'potableStation') return 'link';
    if (n.shape === 'dhwCylinder' || n.shape === 'multiDhwCylinders') return (name === 'chargeIn' || name === 'hotOut') ? 'danger' : 'link';
    const fluid = n.ports[name].fluid;
    if (fluid === 'ground') {
      return (name === 'out' || name === 'gi' || (n.shape === 'multiGwTreat')) ? supplyTone : returnTone;
    }
    if (fluid === 'climate' || fluid === 'high') {
      if (n.shape === 'bufferSingle' || n.shape === 'multiBuffer') return supplyTone;
      return (['co', 'so', 'pi', 'in'].includes(name) && n.id !== 'returnWells') ? supplyTone : returnTone;
    }
    if (fluid === 'intermediate') {
      if (n.shape === 'bufferSingle' || n.shape === 'multiBuffer') return 'danger';
      return (name === 'io' || name === 'si') ? 'danger' : 'link';
    }
    if (fluid === 'hot') {
      return (name === 'ho' || name === 'pi') ? 'danger' : 'link';
    }
    if (fluid === 'potable.mp') {
      return name === 'so' ? 'danger' : 'link';
    }
    return 'accent';
  };

  const resolveTone = (ref, edge) => {
    if (edge?.role === 'recirc') return 'warning';
    if (edge?.role === 'coldFeed') return 'link';
    const [id, name] = ref.split('.');
    return portTone(d.nodes.find(item => item.id === id), name);
  };

  const buildRoundedPath = (points, bridges = []) => {
    if (points.length < 2) return '';
    let out = `M${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1], curr = points[i], next = points[i + 1];
      const dx1 = curr[0] - prev[0], dy1 = curr[1] - prev[1];
      const len1 = Math.hypot(dx1, dy1);
      let endX = curr[0], endY = curr[1], corner = '';
      if (next) {
        const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1];
        const len2 = Math.hypot(dx2, dy2);
        const r = Math.min(9, len1 / 2.5, len2 / 2.5);
        if (r > 1.5 && (dx1 !== 0 || dy1 !== 0) && (dx2 !== 0 || dy2 !== 0)) {
          endX = curr[0] - Math.sign(dx1) * r;
          endY = curr[1] - Math.sign(dy1) * r;
          const afterX = curr[0] + Math.sign(dx2) * r;
          const afterY = curr[1] + Math.sign(dy2) * r;
          corner = `Q${curr[0]} ${curr[1]} ${afterX} ${afterY}`;
        }
      }
      if (prev[1] === curr[1] && bridges.length) {
        const dir = Math.sign(curr[0] - prev[0]);
        const minX = Math.min(prev[0], endX) + 9, maxX = Math.max(prev[0], endX) - 9;
        const segBridges = bridges.filter(bx => bx > minX && bx < maxX).sort((a, b) => (a - b) * dir);
        for (const bx of segBridges) {
          out += `L${bx - dir * 7} ${prev[1]}A7 7 0 0 ${dir > 0 ? 1 : 0} ${bx + dir * 7} ${prev[1]}`;
        }
      }
      out += `L${endX} ${endY}${corner}`;
    }
    return out;
  };

  let gradSeq = 0;
  const makeGrad = (p1, p2, fromTone, toTone, plateau = false) => {
    const id = `${prefix}-grad-${++gradSeq}`;
    const stops = plateau
      ? `<stop offset="0%" stop-color="var(--cp-${fromTone})"/><stop offset="35%" stop-color="var(--cp-${fromTone})"/><stop offset="65%" stop-color="var(--cp-${toTone})"/><stop offset="100%" stop-color="var(--cp-${toTone})"/>`
      : `<stop offset="0%" stop-color="var(--cp-${fromTone})"/><stop offset="100%" stop-color="var(--cp-${toTone})"/>`;
    return {
      id,
      stroke: `url(#${id})`,
      def: `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}">${stops}</linearGradient>`
    };
  };

  const defs = [
    ...['danger', 'link', 'warning', 'accent'].map(tone =>
      `<marker id="${prefix}-arr-${tone}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.8" markerHeight="3.8" orient="auto"><path d="M0 1L9 5L0 9Z" fill="var(--cp-${tone})"/></marker>`
    )
  ];

  const drawPipe = (points, fromTone, toTone = fromTone, opts = {}) => {
    const { attrs = '', bridges = [], thin = false, gradEnds = null, plateau = false, marker = true, animated = true } = opts;
    const dStr = buildRoundedPath(points, bridges);
    let stroke = `var(--cp-${fromTone})`;
    if (fromTone !== toTone || gradEnds) {
      const g = makeGrad(gradEnds ? gradEnds[0] : points[0], gradEnds ? gradEnds[1] : points.at(-1), fromTone, toTone, plateau);
      defs.push(g.def);
      stroke = g.stroke;
    }
    const cls = thin ? ' thin' : '';
    const flowAttrs = animated ? ` data-flow-path="1" data-temp-start="${fromTone}" data-temp-end="${toTone}"` : '';
    const mEnd = marker ? ` marker-end="url(#${prefix}-arr-${toTone})"` : '';
    return `<path d="${dStr}" class="pipe-casing${cls}" aria-hidden="true"/>` +
      `<path d="${dStr}" class="pipe-core${cls}" style="stroke:${stroke}" data-temperature-from="${fromTone}" data-temperature-to="${toTone}"${flowAttrs}${mEnd} ${attrs}/>` +
      `<path d="${dStr}" class="pipe-sheen" aria-hidden="true"/>`;
  };

  const drawHeat = (x1, y1, x2, y2, reverse = false, extraAttrs = '') => {
    const sx = reverse ? x2 : x1, sy = reverse ? y2 : y1, ex = reverse ? x1 : x2, ey = reverse ? y1 : y2;
    return `<path class="thermal-track thermal-transfer" data-thermal-path="1" data-direction="${reverse ? 'reverse' : 'forward'}" ${extraAttrs} d="M${sx} ${sy}L${ex} ${ey}" marker-end="url(#${prefix}-arr-warning)"/>`;
  };

  const tagPill = (cx, cy, label, fontSize = 14) => {
    const w = Math.max(44, label.length * (fontSize * 0.64) + 18), h = fontSize + 10;
    return `<g class="tag-pill"><rect class="tag-pill-bg" x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/>` +
      `<text class="tag-pill-text" x="${cx}" y="${cy + fontSize * 0.35}" font-size="${fontSize}" text-anchor="middle">${esc(label)}</text></g>`;
  };

  const pumpBadge = (cx, cy, code, topic, dirAngle = 0) => {
    const isVert = Math.abs(Math.abs(dirAngle) - 90) < 15;
    const pillW = Math.max(44, code.length * 8.6 + 10);
    const px = isVert ? cx + 18 + pillW / 2 : cx;
    const py = isVert ? cy : cy - 26;
    return `<g class="inline-pump" data-topic="${topic || 'pumps'}" data-tags="${esc(code.replace(/[^A-Z0-9]/g, ' ').trim())}" role="button" tabindex="0" aria-label="${esc(code)}">` +
      `<circle class="machine-card" cx="${cx}" cy="${cy}" r="14"/>` +
      `<g transform="translate(${cx} ${cy}) rotate(${dirAngle})"><path d="M-5 -6L7 0L-5 6Z" fill="var(--cp-accent)"/></g>` +
      `<rect class="tag-pill-bg" x="${px - pillW / 2}" y="${py - 9}" width="${pillW}" height="18" rx="9"/>` +
      `<text class="tag-pill-text" x="${px}" y="${py + 4}" font-size="12" text-anchor="middle">${esc(code)}</text></g>`;
  };

  let zonesSvg = '';
  for (const z of (d.zones || [])) {
    zonesSvg += `<g class="zone-group"><rect class="zone-box" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="16"/>` +
      `<text class="zone-caption" x="${z.x + (z.captionOffset || 18)}" y="${z.y + 24}">${esc(textLabel(z.labelKey))}</text></g>`;
  }

  let pipesSvg = '', inlinePumpsSvg = '';
  for (const e of d.edges) {
    const bridges = [];
    for (let i = 1; i < e.points.length; i++) {
      const a = e.points[i - 1], b = e.points[i];
      if (a[1] !== b[1]) continue;
      for (const other of d.edges) {
        if (other === e || other.from === e.from || other.to === e.to) continue;
        if ((e.role && other.role) && (e.to === other.to)) continue;
        for (let j = 1; j < other.points.length; j++) {
          const c = other.points[j - 1], q = other.points[j];
          if (c[0] === q[0] && c[0] > Math.min(a[0], b[0]) + 10 && c[0] < Math.max(a[0], b[0]) - 10 &&
            a[1] > Math.min(c[1], q[1]) + 4 && a[1] < Math.max(c[1], q[1]) - 4) {
            bridges.push(c[0]);
          }
        }
      }
    }
    const fromT = d.teaching ? portTone(d.nodes.find(n => n.id === e.from.split('.')[0]), e.from.split('.')[1]) : resolveTone(e.from, e);
    const toT = d.teaching ? portTone(d.nodes.find(n => n.id === e.to.split('.')[0]), e.to.split('.')[1]) : resolveTone(e.to, e);
    pipesSvg += drawPipe(e.points, fromT, toT, {
      bridges,
      attrs: `data-edge="${e.id}" data-from="${e.from}" data-to="${e.to}" data-fluid="${e.fluid}"`
    });
    if (e.pump) {
      let px, py, angle = 0;
      if (e.pumpAt) {
        [px, py] = e.pumpAt;
        angle = e.pumpAngle ?? 90;
      } else {
        const segs = e.points.slice(1).map((pt, idx) => [e.points[idx], pt]);
        const [sa, sb] = segs.sort((u, v) => Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1]) - Math.hypot(u[1][0] - u[0][0], u[1][1] - u[0][1]))[0];
        px = (sa[0] + sb[0]) / 2;
        py = (sa[1] + sb[1]) / 2;
        angle = Math.atan2(sb[1] - sa[1], sb[0] - sa[0]) * 180 / Math.PI;
      }
      inlinePumpsSvg += pumpBadge(px, py, e.pump, e.pumpTopic, angle);
    }
  }

  for (const e of d.edges) {
    for (const other of d.edges) {
      if (e === other || e.fluid !== other.fluid) continue;
      const sharedConnect = e.from === other.from || e.to === other.to;
      if (!sharedConnect) continue;
      for (const [x, y] of e.points) {
        for (let i = 1; i < other.points.length; i++) {
          const a = other.points[i - 1], b = other.points[i];
          if ((x === a[0] && x === b[0] && y > Math.min(a[1], b[1]) && y < Math.max(a[1], b[1])) ||
              (y === a[1] && y === b[1] && x > Math.min(a[0], b[0]) && x < Math.max(a[0], b[0]))) {
            const tone = resolveTone(e.from, e);
            pipesSvg += `<circle data-junction="${x},${y}" cx="${x}" cy="${y}" r="5" fill="var(--cp-${tone})" stroke="var(--cp-surface)" stroke-width="1.5"/>`;
          }
        }
      }
    }
  }

  const portPt = (n, p) => [n.x + p.x, n.y + p.y];
  let nodesSvg = '';

  for (const n of d.nodes) {
    const { x, y, w, h, ports: p } = n;
    let body = '';
    const rev = season === 'summer';

    if (n.shape === 'aquiferSupply' || n.shape === 'aquiferReturn') {
      const isSupply = n.shape === 'aquiferSupply';
      const portObj = isSupply ? p.out : p.in;
      const pt = portPt(n, portObj);
      const tone = portTone(n, isSupply ? 'out' : 'in');
      const wellX = x + 95;
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>`;
      body += `<rect class="aquifer-fill" x="${x + 12}" y="${y + h - 68}" width="${w - 24}" height="56" rx="10"/>`;
      body += `<path d="M${x + 24} ${y + h - 46}q22 -9 44 0t44 0t44 0t44 0" fill="none" stroke="var(--cp-link)" stroke-width="2"/>`;
      body += `<rect class="machine-sub" x="${wellX - 18}" y="${y + 52}" width="36" height="${h - 74}" rx="6"/>`;
      const pipePts = isSupply ? [[wellX, y + h - 30], [wellX, pt[1]], pt] : [pt, [wellX, pt[1]], [wellX, y + h - 30]];
      body += drawPipe(pipePts, tone, tone, { thin: true, marker: false });
      if (isSupply) {
        body += `<circle class="machine-card" cx="${wellX}" cy="${y + h - 46}" r="15"/>` +
          `<path d="M${wellX - 6} ${y + h - 41}L${wellX} ${y + h - 54}L${wellX + 6} ${y + h - 41}Z" fill="var(--cp-accent)"/>`;
      }
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 28}" font-size="20" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      const tempTxt = isSupply ? '16 °C' : (season === 'winter' ? '11 °C' : '21 °C');
      body += `<text class="svg-label svg-temp" x="${x + w - 52}" y="${y + 78}" font-size="18" text-anchor="middle">${tempTxt}</text>`;
      body += `<text class="svg-label svg-sub pc-detail" x="${x + w - 74}" y="${y + 132}" font-size="13.5" text-anchor="middle">${esc(textLabel(isSupply ? 'aquiferSourceSub' : (rev ? 'aquiferReturnSummer' : 'aquiferReturnWinter')))}</text>`;
    } else if (n.shape === 'singleHeatPump') {
      const gi = portPt(n, p.gi), go = portPt(n, p.go), co = portPt(n, p.co), ci = portPt(n, p.ci);
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="18"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 34}" font-size="22" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      body += tagPill(x + w / 2, y + 64, textLabel('zoomCyclePill'), 14);
      body += drawPipe([gi, [x + 42, gi[1]], [x + 42, go[1]], go], portTone(n, 'gi'), portTone(n, 'go'),
        { thin: true, marker: false, gradEnds: [gi, go], attrs: 'data-channel="pc2.gi-go"' });
      body += drawPipe([ci, [x + w - 42, ci[1]], [x + w - 42, co[1]], co], portTone(n, 'ci'), portTone(n, 'co'),
        { thin: true, marker: false, gradEnds: [ci, co], attrs: 'data-channel="pc2.ci-co"' });
      body += `<rect class="plate-pack" x="${x + 56}" y="${y + 102}" width="26" height="304" rx="5"/>`;
      body += `<path d="M${x + 62} ${y + 130}l14 14l-14 14l14 14l-14 14l14 14l-14 14l14 14" fill="none" stroke="var(--cp-border-strong)" stroke-width="1.5"/>`;
      body += `<rect class="plate-pack" x="${x + w - 82}" y="${y + 102}" width="26" height="304" rx="5"/>`;
      body += `<path d="M${x + w - 76} ${y + 130}l14 14l-14 14l14 14l-14 14l14 14l-14 14l14 14" fill="none" stroke="var(--cp-border-strong)" stroke-width="1.5"/>`;
      const rl = x + 118, rr = x + w - 118, rt = y + 128, rb = y + 382, rcx = x + w / 2;
      const refLoop = rev ? [[rr, rb], [rr, rt], [rl, rt], [rl, rb], [rr, rb]] : [[rl, rb], [rl, rt], [rr, rt], [rr, rb], [rl, rb]];
      const leftTone = rev ? 'danger' : 'link', rightTone = rev ? 'link' : 'danger';
      body += drawPipe(refLoop, leftTone, rightTone, {
        thin: true, marker: false, gradEnds: [[rl, rt], [rr, rt]], plateau: true,
        attrs: 'data-closed="true" data-channel="pc2.ref"'
      });
      body += `<circle class="machine-card" cx="${rcx}" cy="${rt}" r="26"/>` +
        `<g data-rotor="1" data-cx="${rcx}" data-cy="${rt}"><path d="M${rcx - 10} ${rt - 12}L${rcx + 15} ${rt}L${rcx - 10} ${rt + 12}Z" fill="var(--cp-accent)"/></g>`;
      body += `<path class="power-track" d="M${rcx} ${rt + 66}V${rt + 30}" marker-end="url(#${prefix}-arr-accent)"/>`;
      body += `<text class="svg-label svg-sub" x="${rcx}" y="${rt + 86}" font-size="15" text-anchor="middle">${esc(textLabel('electricWork'))}</text>`;
      body += `<path class="machine-card" d="M${rcx - 22} ${rb - 15}L${rcx + 22} ${rb + 15}V${rb - 15}L${rcx - 22} ${rb + 15}Z"/>`;
      body += `<text class="svg-label svg-sub" x="${rcx}" y="${rt - 34}" font-size="15" text-anchor="middle">${esc(textLabel('compressorShort'))}</text>`;
      body += `<text class="svg-label svg-sub" x="${rcx}" y="${rb + 36}" font-size="15" text-anchor="middle">${esc(textLabel('expansionShort'))}</text>`;
      body += drawHeat(x + 34, y + 250, rl - 8, y + 250, rev);
      body += drawHeat(rr + 8, y + 250, x + w - 34, y + 250, rev);
      body += `<rect class="machine-sub pc-detail" x="${x + 48}" y="${y + h - 54}" width="${w - 96}" height="36" rx="10"/>`;
      body += `<text class="svg-label svg-sub pc-detail" x="${rcx}" y="${y + h - 31}" font-size="15" text-anchor="middle">${esc(textLabel(rev ? 'copBadgeSummer' : 'copBadgeWinter'))}</text>`;
    } else if (n.shape === 'radiantHome') {
      const pin = portPt(n, p.in), pout = portPt(n, p.out);
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="18"/>`;
      body += `<path d="M${x + 36} ${y + 118}L${x + w / 2} ${y + 62}L${x + w - 36} ${y + 118}" fill="none" stroke="var(--cp-border-strong)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
      body += `<rect class="machine-sub" x="${x + 44}" y="${y + 118}" width="${w - 88}" height="295" rx="10"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 34}" font-size="21" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      const sl = x + 64, sr = x + w - 64;
      const coil = [pin, [sl, pin[1]], [sl, y + 295], [sr, y + 295], [sr, y + 332], [sl, y + 332], [sl, y + 368], [sr, y + 368], [sr, pout[1]], [sl, pout[1]], pout];
      body += drawPipe(coil, portTone(n, 'in'), portTone(n, 'out'), {
        thin: true, marker: false, gradEnds: [[sl, y + 280], [sl, pout[1]]], attrs: 'data-channel="load.in-out"'
      });
      for (const hx of [x + 115, x + w / 2, x + w - 115]) {
        body += drawHeat(hx, y + 275, hx, y + 195, rev);
      }
      const tempBadge = season === 'winter' ? '38 → 33 °C' : '18 → 23 °C';
      body += `<text class="svg-label svg-temp" x="${x + w / 2}" y="${y + 162}" font-size="22" text-anchor="middle">${tempBadge}</text>`;
      body += `<text class="svg-label svg-sub" x="${x + w / 2}" y="${y + h - 24}" font-size="15" text-anchor="middle">${esc(textLabel(rev ? 'floorModeSummer' : 'floorModeWinter'))}</text>`;
    } else if (n.shape === 'wellCompact') {
      const isRet = !!n.isReturn;
      const pt = portPt(n, isRet ? p.in : p.out);
      const tone = portTone(n, isRet ? 'in' : 'out');
      const wx = x + 68;
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>`;
      body += `<rect class="aquifer-fill" x="${x + 10}" y="${y + h - 44}" width="${w - 20}" height="34" rx="8"/>`;
      const pts = isRet ? [pt, [wx, pt[1]], [wx, y + h - 22]] : [[wx, y + h - 22], [wx, pt[1]], pt];
      body += drawPipe(pts, tone, tone, { thin: true, marker: false });
      if (!isRet) {
        body += `<circle class="machine-card" cx="${wx}" cy="${y + h - 32}" r="12"/><path d="M${wx - 5} ${y + h - 28}L${wx} ${y + h - 39}L${wx + 5} ${y + h - 28}Z" fill="var(--cp-accent)"/>`;
      }
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 26}" font-size="17" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.tagPill) body += tagPill(x + w - 58, y + 52, n.tagPill, 12);
      const tVal = isRet ? (rev ? '21 °C' : '11 °C') : '16 °C';
      body += `<text class="svg-label svg-temp pc-detail" x="${x + w - 46}" y="${y + 98}" font-size="15" text-anchor="middle">${tVal}</text>`;
    } else if (n.shape === 'polyHeatPump' || n.shape === 'multiPC2') {
      const gi = portPt(n, p.gi), go = portPt(n, p.go), co = portPt(n, p.co), ci = portPt(n, p.ci), ii = portPt(n, p.ii), io = portPt(n, p.io);
      const isMulti = n.shape === 'multiPC2';
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
      if (isMulti) {
        body += `<rect class="machine-sub" x="${x + 14}" y="${y + 56}" width="${w - 28}" height="106" rx="10"/>`;
        body += `<rect class="machine-sub" x="${x + 14}" y="${y + 170}" width="${w - 28}" height="106" rx="10"/>`;
        body += `<text class="svg-label svg-sub pc-detail" x="${x + w / 2}" y="${y + 76}" font-size="13" text-anchor="middle">PC2 #1 · MSW182ML</text>`;
        body += `<text class="svg-label svg-sub pc-detail" x="${x + w / 2}" y="${y + 190}" font-size="13" text-anchor="middle">PC2 #2 · MSW182ML</text>`;
      }
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 27}" font-size="18" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.tagPill) body += tagPill(x + w / 2, y + 48, n.tagPill, 13);
      body += drawPipe([gi, [x + 28, gi[1]], [x + 28, go[1]], go], portTone(n, 'gi'), portTone(n, 'go'),
        { thin: true, marker: false, gradEnds: [gi, go], attrs: 'data-channel="pc2.gi-go"' });
      body += drawPipe([ci, [x + w - 28, ci[1]], [x + w - 28, co[1]], co], portTone(n, 'ci'), portTone(n, 'co'),
        { thin: true, marker: false, gradEnds: [ci, co], attrs: 'data-channel="pc2.ci-co"' });
      body += drawPipe([ii, [ii[0], y + h - 26], [io[0], y + h - 26], io], 'link', 'danger',
        { thin: true, marker: false, gradEnds: [ii, io], attrs: 'data-channel="pc2.ii-io"' });
      body += `<rect class="plate-pack" x="${x + 40}" y="${y + 84}" width="14" height="160" rx="3"/>`;
      body += `<rect class="plate-pack" x="${x + w - 54}" y="${y + 84}" width="14" height="160" rx="3"/>`;
      body += `<rect class="plate-pack" x="${x + 86}" y="${y + h - 44}" width="82" height="12" rx="3"/>`;
      const cx = x + w / 2, cy = y + 152;
      body += `<circle class="machine-card" cx="${cx}" cy="${cy}" r="22"/>` +
        `<g data-rotor="1" data-cx="${cx}" data-cy="${cy}"><path d="M${cx - 8} ${cy - 10}L${cx + 12} ${cy}L${cx - 8} ${cy + 10}Z" fill="var(--cp-accent)"/></g>`;
      body += drawHeat(x + 58, cy, cx - 26, cy, rev);
      body += drawHeat(cx + 26, cy, x + w - 58, cy, rev);
      body += `<path class="thermal-track" data-thermal-path="1" data-heat-link="pc2-intermediate" d="M${cx} ${cy + 26}V${y + h - 48}" marker-end="url(#${prefix}-arr-warning)"/>`;
    } else if (n.shape === 'bufferSingle' || n.shape === 'multiBuffer') {
      const isMulti = n.shape === 'multiBuffer';
      const pin = portPt(n, p.in), pout = portPt(n, p.out), tone = portTone(n, 'in');
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 25}" font-size="16" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.tagPill) body += tagPill(x + w / 2, y + 46, n.tagPill, 12);
      if (isMulti) {
        for (const [tx, ty] of [[x + 44, y + 66], [x + w - 78, y + 66]]) {
          body += `<rect class="machine-sub" x="${tx}" y="${ty}" width="34" height="78" rx="14"/>`;
        }
        body += drawPipe([pin, [x + 24, pin[1]], [x + 24, y + 84], [x + w - 24, y + 84], [x + w - 24, pout[1]], pout], tone, tone, { thin: true, marker: false });
        body += drawPipe([[x + 24, pin[1]], [x + 24, y + 124], [x + w - 24, y + 124], [x + w - 24, pout[1]]], tone, tone, { thin: true, marker: false });
        body += `<text class="svg-label svg-sub pc-detail" x="${x + w / 2}" y="${y + h - 10}" font-size="13" text-anchor="middle">2 × 2.000 L</text>`;
      } else {
        body += `<rect class="machine-sub" x="${x + w / 2 - 26}" y="${y + 62}" width="52" height="84" rx="20"/>`;
        body += drawPipe([pin, pout], tone, tone, { thin: true, marker: false });
        body += `<text class="svg-label svg-sub pc-detail" x="${x + w / 2}" y="${y + h - 8}" font-size="13" text-anchor="middle">2.000 L</text>`;
      }
    } else if (n.shape === 'buildingClimate') {
      const pin = portPt(n, p.in), pout = portPt(n, p.out);
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 27}" font-size="18" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.tagPill) body += tagPill(x + w / 2, y + 49, n.tagPill, 12);
      body += `<rect class="machine-sub" x="${x + 28}" y="${y + 66}" width="${w - 56}" height="205" rx="10"/>`;
      const sl = x + 46, sr = x + w - 46;
      const coil = [pin, [sl, pin[1]], [sl, y + 170], [sr, y + 170], [sr, y + 206], [sl, y + 206], [sl, pout[1]], pout];
      body += drawPipe(coil, portTone(n, 'in'), portTone(n, 'out'),
        { thin: true, marker: false, gradEnds: [[sl, y + 145], [sl, pout[1]]], attrs: 'data-channel="load.in-out"' });
      for (const hx of [x + 105, x + w / 2, x + w - 105]) body += drawHeat(hx, y + 156, hx, y + 108, rev);
      body += `<text class="svg-label svg-temp" x="${x + w / 2}" y="${y + 98}" font-size="19" text-anchor="middle">${rev ? '18 → 23 °C' : '38 → 33 °C'}</text>`;
      body += `<text class="svg-label svg-sub" x="${x + w / 2}" y="${y + h - 16}" font-size="14" text-anchor="middle">${esc(textLabel('closedLoopNote'))}</text>`;
    } else if (n.shape === 'sanitaryRiserHome') {
      const acp = portPt(n, p.acpIn), acr = portPt(n, p.acrOut);
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 27}" font-size="18" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      body += `<rect class="machine-sub" x="${x + 16}" y="${y + 44}" width="108" height="${h - 62}" rx="8"/>`;
      body += `<rect class="machine-sub" x="${x + 134}" y="${y + 44}" width="${w - 150}" height="${h - 62}" rx="8"/>`;
      body += `<text class="svg-label svg-sub" x="${x + 70}" y="${y + 64}" font-size="13" text-anchor="middle">${esc(textLabel('stairwellLabel'))}</text>`;
      body += `<text class="svg-label svg-sub" x="${x + 212}" y="${y + 64}" font-size="13" text-anchor="middle">${esc(textLabel('tapRoomLabel'))}</text>`;
      const topY = y + 96, tapX = x + 215, tapY = y + 148;
      body += drawPipe([acp, [acp[0], topY], [tapX, topY], [tapX, tapY]], 'warning', 'warning',
        { thin: true, marker: false, attrs: 'data-draw-off="true"' });
      body += drawPipe([[acp[0], topY], [x + 48, topY], [x + 48, y + h - 34], [acr[0], y + h - 34], acr], 'warning', 'warning',
        { thin: true, marker: false, attrs: 'data-channel="riser.recirc"' });
      body += `<path d="M${tapX - 18} ${tapY}h26v12" fill="none" stroke="var(--cp-border-strong)" stroke-width="4" stroke-linecap="round"/>`;
      body += `<circle cx="${tapX + 8}" cy="${tapY + 24}" r="3.2" fill="var(--cp-warning)"/>` +
        `<circle cx="${tapX + 8}" cy="${tapY + 38}" r="3.2" fill="var(--cp-warning)"/>` +
        `<path d="M${tapX - 24} ${tapY + 52}h56l-8 16h-40Z" class="machine-card"/>`;
      body += `<text class="svg-label svg-temp" x="${x + 72}" y="${y + 195}" font-size="15" text-anchor="middle">48 °C</text>`;
      body += `<text class="svg-label svg-sub" x="${x + 214}" y="${y + 246}" font-size="13" text-anchor="middle">${esc(textLabel('openTapNote'))}</text>`;
      body += `<text class="svg-label svg-sub pc-detail" x="${x + 214}" y="${y + 266}" font-size="12" text-anchor="middle">${esc(textLabel('noColdReturnNote'))}</text>`;
    } else if (n.shape === 'highTempPump') {
      const si = portPt(n, p.si), so = portPt(n, p.so), ho = portPt(n, p.ho), hi = portPt(n, p.hi);
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 26}" font-size="17" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.tagPill) body += tagPill(x + w / 2, y + 48, n.tagPill, 13);
      body += drawPipe([si, [x + 26, si[1]], [x + 26, so[1]], so], 'danger', 'link',
        { thin: true, marker: false, gradEnds: [si, so], attrs: 'data-channel="pc1.si-so"' });
      body += drawPipe([hi, [x + w - 26, hi[1]], [x + w - 26, ho[1]], ho], 'link', 'danger',
        { thin: true, marker: false, gradEnds: [hi, ho], attrs: 'data-channel="pc1.hi-ho"' });
      body += `<rect class="plate-pack" x="${x + 38}" y="${y + 68}" width="12" height="108" rx="3"/>`;
      body += `<rect class="plate-pack" x="${x + w - 50}" y="${y + 68}" width="12" height="108" rx="3"/>`;
      const cx = x + w / 2, cy = y + 122;
      body += `<circle class="machine-card" cx="${cx}" cy="${cy}" r="20"/>` +
        `<g data-rotor="1" data-cx="${cx}" data-cy="${cy}"><path d="M${cx - 7} ${cy - 9}L${cx + 11} ${cy}L${cx - 7} ${cy + 9}Z" fill="var(--cp-accent)"/></g>`;
      body += drawHeat(x + 54, cy, cx - 24, cy, false);
      body += drawHeat(cx + 24, cy, x + w - 54, cy, false);
      body += `<path class="power-track" d="M${cx} ${y + h - 22}V${cy + 24}" marker-end="url(#${prefix}-arr-accent)"/>`;
      body += `<text class="svg-label svg-temp pc-detail" x="${cx}" y="${y + h - 6}" font-size="14" text-anchor="middle">70/65 °C</text>`;
    } else if (n.shape === 'plateExchanger' || n.shape === 'multiExchanger') {
      const pi = portPt(n, p.pi), po = portPt(n, p.po), so = portPt(n, p.so), si = portPt(n, p.si);
      const isSC2 = !!n.isSC2, isMulti = n.shape === 'multiExchanger';
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>`;
      if (isMulti) {
        body += `<rect class="plate-pack" x="${x + w / 2 - 18}" y="${y + 54}" width="15" height="${h - 70}" rx="3"/>`;
        body += `<rect class="plate-pack" x="${x + w / 2 + 3}" y="${y + 54}" width="15" height="${h - 70}" rx="3"/>`;
      } else {
        body += `<rect class="plate-pack" x="${x + w / 2 - 10}" y="${y + 46}" width="20" height="${h - 62}" rx="4"/>`;
      }
      body += drawPipe([pi, [x + 18, pi[1]], [x + 18, po[1]], po], portTone(n, 'pi'), portTone(n, 'po'),
        { thin: true, marker: false, gradEnds: [pi, po] });
      body += drawPipe([si, [x + w - 18, si[1]], [x + w - 18, so[1]], so], portTone(n, 'si'), portTone(n, 'so'),
        { thin: true, marker: false, gradEnds: [si, so] });
      body += drawHeat(x + 22, y + h / 2 + 12, x + w - 22, y + h / 2 + 12, isSC2 && rev);
      if (n.tagPill) body += tagPill(x + w / 2, y + 24, n.tagPill, 12);
    } else if (n.shape === 'dhwCylinder' || n.shape === 'multiDhwCylinders') {
      const isMulti = n.shape === 'multiDhwCylinders';
      const cin = portPt(n, p.chargeIn), cout = portPt(n, p.chargeOut), hout = portPt(n, p.hotOut), cold = portPt(n, p.coldIn);
      const strat = makeGrad([x, y + 54], [x, y + h - 14], 'danger', 'link');
      defs.push(strat.def);
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 24}" font-size="16" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.tagPill) body += tagPill(x + w / 2, y + 44, n.tagPill, 12);
      if (isMulti) {
        for (const tx of [x + 26, x + w - 84]) {
          body += `<rect x="${tx}" y="${y + 60}" width="58" height="${h - 76}" rx="24" style="fill:${strat.stroke};fill-opacity:.22;stroke:var(--cp-border-strong);stroke-width:1.8"/>`;
        }
        body += `<text class="svg-label svg-sub pc-detail" x="${x + 55}" y="${y + 132}" font-size="12" text-anchor="middle">MP</text>`;
        body += `<text class="svg-label svg-sub pc-detail" x="${x + w - 55}" y="${y + 132}" font-size="12" text-anchor="middle">BP</text>`;
      } else {
        body += `<rect x="${x + 26}" y="${y + 58}" width="${w - 52}" height="${h - 74}" rx="34" style="fill:${strat.stroke};fill-opacity:.24;stroke:var(--cp-border-strong);stroke-width:1.8"/>`;
      }
      body += drawPipe([cin, [x + 26, cin[1]]], 'danger', 'danger', { thin: true, marker: false });
      body += drawPipe([[x + 26, cout[1]], cout], 'link', 'link', { thin: true, marker: false });
      body += drawPipe([[x + w - 26, hout[1]], hout], 'danger', 'danger', { thin: true, marker: false });
      body += drawPipe([cold, [cold[0], y + h - 18]], 'link', 'link', { thin: true, marker: false });
      body += `<text class="svg-label svg-temp pc-detail" x="${isMulti ? x + 55 : x + w / 2}" y="${y + 84}" font-size="13.5" text-anchor="middle">60 °C</text>`;
    } else if (n.shape === 'thermoMixer') {
      const hin = portPt(n, p.hotIn), cin = portPt(n, p.coldIn), mout = portPt(n, p.mixedOut);
      const cx = x + w / 2, cy = y + 35;
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>`;
      body += drawPipe([hin, [cx, cy]], 'danger', 'warning', { thin: true, marker: false });
      body += drawPipe([cin, [cx, cy]], 'link', 'warning', { thin: true, marker: false });
      body += drawPipe([[cx, cy], mout], 'warning', 'warning', { thin: true, marker: false });
      body += `<circle class="machine-card" cx="${cx}" cy="${cy}" r="14"/>` +
        `<text class="svg-label svg-title" x="${cx}" y="${cy + 5}" font-size="13" text-anchor="middle">M</text>`;
      const tempX = p.mixedOut.y === 0 ? x + w + 28 : cx;
      const tempY = p.mixedOut.y === 0 ? y + 24 : y - 10;
      body += `<text class="svg-label svg-temp" x="${tempX}" y="${tempY}" font-size="13.5" text-anchor="middle">48 °C</text>`;
    } else if (n.shape === 'mainsIntake' || n.shape === 'potableStation') {
      const pout = portPt(n, p.out);
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>`;
      if (n.shape === 'potableStation') {
        body += `<text class="svg-label svg-title" x="${x + 170}" y="${y + 28}" font-size="16" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
        if (n.tagPill) body += tagPill(x + 465, y + 24, n.tagPill, 12);
        const stages = ['T1', '2 × S1', 'GP1 (MP) · GP2 (BP)', '2 × T2 · T3/T4'];
        stages.forEach((st, idx) => {
          const bx = x + 22 + idx * 156, bw = idx === 2 ? 152 : 136;
          body += `<rect class="machine-sub" x="${bx}" y="${y + 42}" width="${bw}" height="34" rx="8"/>` +
            `<text class="svg-label svg-sub" x="${bx + bw / 2}" y="${y + 64}" font-size="13" text-anchor="middle">${esc(st)}</text>`;
        });
        body += drawPipe([[x + 638, pout[1]], pout], 'link', 'link', { thin: true, marker: false });
      } else {
        body += `<text class="svg-label svg-title" x="${x + w / 2 - 12}" y="${y + 22}" font-size="15" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
        body += `<text class="svg-label svg-sub pc-detail" x="${x + w / 2 - 12}" y="${y + 41}" font-size="12" text-anchor="middle">AFP · ~15 °C</text>`;
        body += drawPipe([[x + w - 28, pout[1]], pout], 'link', 'link', { thin: true, marker: false });
      }
    } else if (n.shape === 'multiWells') {
      const pout = portPt(n, p.out), tone = portTone(n, 'out');
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 25}" font-size="16" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.tagPill) body += tagPill(x + w / 2, y + 46, n.tagPill, 11);
      body += `<rect class="machine-sub" x="${x + 14}" y="${y + 64}" width="108" height="168" rx="10"/>`;
      body += `<rect class="machine-sub" x="${x + 130}" y="${y + 64}" width="58" height="168" rx="10"/>`;
      body += `<text class="svg-label svg-sub" x="${x + 68}" y="${y + 82}" font-size="13" text-anchor="middle">P1 (2×P11)</text>`;
      body += `<text class="svg-label svg-sub" x="${x + 159}" y="${y + 82}" font-size="13" text-anchor="middle">P2 (P10)</text>`;
      for (const px of [x + 44, x + 92, x + 159]) {
        body += drawPipe([[px, y + 206], [px, pout[1]], pout], tone, tone, { thin: true, marker: false });
        body += `<circle class="machine-card" cx="${px}" cy="${y + 202}" r="11"/>` +
          `<path d="M${px - 4} ${y + 206}L${px} ${y + 196}L${px + 4} ${y + 206}Z" fill="var(--cp-accent)"/>`;
      }
      body += `<text class="svg-label svg-sub pc-detail" x="${x + w / 2}" y="${y + h - 4}" font-size="12" text-anchor="middle">${esc(textLabel('threePumpsSub'))}</text>`;
    } else if (n.shape === 'multiGwTreat') {
      const pin = portPt(n, p.in), pout = portPt(n, p.out), tone = portTone(n, 'in');
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 25}" font-size="15" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.tagPill) body += tagPill(x + w / 2, y + 46, 'T6·2×T7·2×S4', 11);
      body += drawPipe([pin, pout], tone, tone, { thin: true, marker: false });
      body += `<polygon class="machine-sub" points="${x + 18},${y + 96} ${x + 42},${y + 96} ${x + 30},${y + 142}"/>`;
      body += `<rect class="machine-sub" x="${x + 52}" y="${y + 76}" width="26" height="30" rx="5"/>`;
      body += `<rect class="machine-sub" x="${x + 52}" y="${y + 122}" width="26" height="30" rx="5"/>`;
      body += `<line x1="${x + 94}" y1="${pout[1]}" x2="${x + 94}" y2="${y + 184}" stroke="var(--cp-${tone})" stroke-width="3"/>`;
      body += `<rect class="machine-sub" x="${x + 62}" y="${y + 184}" width="24" height="44" rx="10"/>`;
      body += `<rect class="machine-sub" x="${x + 92}" y="${y + 184}" width="24" height="44" rx="10"/>`;
      body += `<text class="svg-label svg-sub pc-detail" x="${x + 89}" y="${y + 241}" font-size="11" text-anchor="middle">2×S4 (1000 L)</text>`;
    } else if (n.shape === 'multiReturnWells') {
      const pin = portPt(n, p.in), tone = portTone(n, 'in');
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 25}" font-size="16" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.tagPill) body += tagPill(x + w / 2, y + 46, n.tagPill, 12);
      body += `<rect class="aquifer-fill" x="${x + 14}" y="${y + h - 42}" width="${w - 28}" height="30" rx="8"/>`;
      for (const wx of [x + 76, x + 176]) {
        body += `<rect class="machine-sub" x="${wx - 18}" y="${y + 68}" width="36" height="72" rx="6"/>`;
        body += drawPipe([pin, [wx, pin[1]], [wx, y + h - 24]], tone, tone, { thin: true, marker: false });
      }
    } else if (n.shape === 'climateBranch') {
      const pin = portPt(n, p.in), pout = portPt(n, p.out);
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>`;
      const sl = x + 88, sr = x + w - 24;
      body += drawPipe([pin, [sl, pin[1]], [sr, pin[1]], [sr, pout[1]], [sl, pout[1]], pout],
        portTone(n, 'in'), portTone(n, 'out'), { thin: true, marker: false, gradEnds: [[sl, pin[1]], [sl, pout[1]]], attrs: n.id === 'branchBP' ? 'data-channel="load.in-out"' : '' });
      const px = x + 44, py = pin[1];
      body += `<circle class="machine-card" cx="${px}" cy="${py}" r="13"/><path d="M${px - 5} ${py - 5}L${px + 6} ${py}L${px - 5} ${py + 5}Z" fill="var(--cp-accent)"/>`;
      if (n.tagPill) body += tagPill(x + 126, y + h / 2, n.pumpCode, 12);
      const textCx = x + 162 + (w - 186) / 2;
      const titleY = n.showTemp ? y + h / 2 - 4 : y + h / 2 + 5;
      body += `<text class="svg-label svg-title" x="${textCx}" y="${titleY}" font-size="15" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.showTemp) {
        body += `<text class="svg-label svg-temp pc-detail" x="${textCx}" y="${y + h / 2 + 17}" font-size="13.5" text-anchor="middle">${rev ? '18 → 23 °C' : '38 → 33 °C'}</text>`;
      }
    } else if (n.shape === 'multiDhwRisers') {
      const acp = portPt(n, p.acpIn), acr = portPt(n, p.acrOut);
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 25}" font-size="16" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.tagPill) body += tagPill(x + w / 2, y + 46, 'MP (P02) · BP (P03)', 11);
      body += `<rect class="machine-sub" x="${x + 14}" y="${y + 64}" width="${w - 28}" height="82" rx="8"/>`;
      body += `<rect class="machine-sub" x="${x + 14}" y="${y + 154}" width="${w - 28}" height="82" rx="8"/>`;
      body += `<text class="svg-label svg-sub" x="${x + 122}" y="${y + 84}" font-size="12.5" text-anchor="middle">${esc(textLabel('riserMP'))}</text>`;
      body += `<text class="svg-label svg-sub" x="${x + 122}" y="${y + 174}" font-size="12.5" text-anchor="middle">${esc(textLabel('riserBP'))}</text>`;
      body += drawPipe([acp, [x + 30, acp[1]], [x + 30, y + 104], [x + 148, y + 104]], 'warning', 'warning', { thin: true, marker: false, attrs: 'data-draw-off="true"' });
      body += drawPipe([[x + 30, acp[1]], [x + 30, y + 194], [x + 148, y + 194]], 'warning', 'warning', { thin: true, marker: false });
      body += drawPipe([[x + 56, y + 104], [x + 56, y + 244], [acr[0], y + 244], acr], 'warning', 'warning', { thin: true, marker: false });
      for (const ty of [y + 104, y + 194]) {
        body += `<path d="M${x + 148} ${ty}h16v10" fill="none" stroke="var(--cp-border-strong)" stroke-width="3.2" stroke-linecap="round"/>` +
          `<circle cx="${x + 164}" cy="${ty + 19}" r="2.8" fill="var(--cp-warning)"/>` +
          `<circle cx="${x + 164}" cy="${ty + 29}" r="2.8" fill="var(--cp-warning)"/>`;
      }
    } else if (n.shape === 'cycleStage') {
      const pin = portPt(n, p.in), pout = portPt(n, p.out);
      const cx = x + w / 2, cy = y + h / 2;
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
      body += `<text class="svg-label svg-title" x="${cx}" y="${y + 28}" font-size="18" text-anchor="middle">${esc(copy.stages[n.stage])}</text>`;
      body += drawPipe([pin, [cx, cy]], portTone(n, 'in'), portTone(n, 'in'), { thin: true, marker: false });
      body += drawPipe([[cx, cy], pout], portTone(n, 'out'), portTone(n, 'out'), { thin: true, marker: false });
      if (n.stage === 1) {
        body += `<circle class="machine-card" cx="${cx}" cy="${cy}" r="30"/>` +
          `<g data-rotor="1" data-cx="${cx}" data-cy="${cy}"><path d="M${cx - 12} ${cy - 14}L${cx + 18} ${cy}L${cx - 12} ${cy + 14}Z" fill="var(--cp-accent)"/></g>`;
        body += `<path class="power-track" d="M${cx} ${y + h - 12}V${cy + 34}" marker-end="url(#${prefix}-arr-accent)"/>`;
      } else if (n.stage === 3) {
        body += `<path class="machine-card" d="M${cx - 28} ${cy - 20}L${cx + 28} ${cy + 20}V${cy - 20}L${cx - 28} ${cy + 20}Z"/>`;
      } else {
        body += `<rect class="plate-pack" x="${cx - 28}" y="${cy - 28}" width="56" height="56" rx="8"/>` +
          `<path d="M${cx - 16} ${cy - 12}h32m-32 12h32m-32 12h32" stroke="var(--cp-border-strong)" stroke-width="2"/>`;
        if (n.stage === 0) body += drawHeat(x + 16, cy, cx - 34, cy, false);
        if (n.stage === 2) body += drawHeat(cx + 34, cy, x + w - 16, cy, false);
      }
      body += `<text class="svg-label svg-sub" x="${cx}" y="${y + h - 16}" font-size="14" text-anchor="middle">${esc(copy.states[n.stage])}</text>`;
    }

    let portDots = '';
    for (const [name, pt] of Object.entries(p)) {
      portDots += `<circle class="port" data-port="${n.id}.${name}" data-fluid="${pt.fluid}" cx="${x + pt.x}" cy="${y + pt.y}" r="3.6" fill="var(--cp-${portTone(n, name)})" stroke="var(--cp-surface)" stroke-width="1.2"/>`;
    }
    const tagsAttr = (n.tags || []).join(',');
    const aria = n.shape === 'cycleStage' ? copy.stages[n.stage] : textLabel(n.label);
    nodesSvg += `<g class="hydraulic-node" data-node="${n.id}" ${n.stage !== undefined ? `data-stage="${n.stage}"` : ''} data-topic="${n.topic}" data-tags="${esc(tagsAttr)}" role="button" tabindex="0" aria-haspopup="dialog" aria-label="${esc(aria)}">${body}${portDots}</g>`;
  }

  let extraSvg = '';
  if (d.id === 'cycle') {
    extraSvg += `<g class="cycle-center-note"><rect class="machine-sub" x="405" y="232" width="350" height="76" rx="14"/>` +
      `<text class="svg-label svg-title" x="580" y="264" font-size="18" text-anchor="middle">${esc(textLabel(season === 'winter' ? 'copBadgeWinter' : 'copBadgeSummer'))}</text>` +
      `<text class="svg-label svg-sub" x="580" y="290" font-size="14" text-anchor="middle">${esc(textLabel('cycleCenterSub'))}</text></g>`;
  }
  if (d.id === 'step2' || d.id === 'step3') {
    const iy = d.id === 'step2' ? 674 : 688;
    extraSvg += `<text class="svg-label svg-temp pc-detail" x="${d.id === 'step2' ? 500 : 528}" y="${iy}" font-size="14" text-anchor="middle">40 / 35 °C</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" class="vector-map scene" data-diagram="${d.id}" viewBox="0 0 ${d.width} ${d.height}" role="group" aria-label="${esc(copy.title)}">` +
    `<defs>${defs.join('')}</defs>` +
    `<g inkscape:groupmode="layer" inkscape:label="Zones" id="${prefix}-zones">${zonesSvg}</g>` +
    `<g inkscape:groupmode="layer" inkscape:label="Pipes" id="${prefix}-pipes">${pipesSvg}${inlinePumpsSvg}</g>` +
    `<g inkscape:groupmode="layer" inkscape:label="Components" id="${prefix}-components">${nodesSvg}${extraSvg}</g>` +
    `<g inkscape:groupmode="layer" inkscape:label="FlowAnimation" class="flow-layer" id="${prefix}-flow" aria-hidden="true"></g>` +
    `</svg>`;
}

export function createFlowAnimator() {
  let rafId = 0, lastTs = 0, offset = 0;
  let tracks = [], rotors = [];
  const NS = 'http://www.w3.org/2000/svg';
  const toneVar = tone => `var(--cp-${tone || 'link'})`;

  function buildTracks(root) {
    tracks = [];
    rotors = [];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const svg of root.querySelectorAll('svg.vector-map')) {
      const layer = svg.querySelector('.flow-layer');
      if (!layer) continue;
      layer.replaceChildren();

      for (const path of svg.querySelectorAll('[data-flow-path="1"]')) {
        const len = path.getTotalLength();
        if (len < 18) continue;
        const step = 4;
        const count = Math.max(2, Math.ceil(len / step));
        const lut = new Array(count + 1);
        for (let i = 0; i <= count; i++) {
          const d = (i / count) * len;
          const p = path.getPointAtLength(d);
          const p2 = path.getPointAtLength(Math.min(len, d + 1.5));
          lut[i] = { x: p.x, y: p.y, a: Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI };
        }
        const spacing = 46;
        const nParticles = Math.max(1, Math.floor(len / spacing));
        const fromT = path.getAttribute('data-temp-start') || 'link';
        const toT = path.getAttribute('data-temp-end') || fromT;
        const items = [];
        for (let i = 0; i < nParticles; i++) {
          const g = document.createElementNS(NS, 'g');
          const pill = document.createElementNS(NS, 'rect');
          pill.setAttribute('x', '-5.5');
          pill.setAttribute('y', '-2.3');
          pill.setAttribute('width', '11');
          pill.setAttribute('height', '4.6');
          pill.setAttribute('rx', '2.3');
          pill.style.fill = 'var(--cp-surface)';
          pill.style.strokeWidth = '1.5';
          g.appendChild(pill);
          layer.appendChild(g);
          items.push({ g, pill, phase: (i / nParticles) * len });
        }
        tracks.push({ kind: 'fluid', len, lut, count, items, speed: 56, fromT, toT });
      }

      for (const path of svg.querySelectorAll('[data-thermal-path="1"]')) {
        const len = path.getTotalLength();
        if (len < 16) continue;
        const p0 = path.getPointAtLength(0), p1 = path.getPointAtLength(len);
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
        const nWaves = Math.max(1, Math.floor(len / 34));
        const items = [];
        for (let i = 0; i < nWaves; i++) {
          const chev = document.createElementNS(NS, 'path');
          chev.setAttribute('d', 'M-4 -4.5L3 0L-4 4.5');
          chev.setAttribute('fill', 'none');
          chev.style.stroke = 'var(--cp-warning)';
          chev.setAttribute('stroke-width', '2.6');
          chev.setAttribute('stroke-linecap', 'round');
          chev.setAttribute('stroke-linejoin', 'round');
          layer.appendChild(chev);
          items.push({ g: chev, phase: (i / nWaves) * len });
        }
        tracks.push({ kind: 'thermal', len, p0, p1, angle, items, speed: 34 });
      }

      for (const r of svg.querySelectorAll('[data-rotor="1"]')) {
        rotors.push({ el: r, cx: Number(r.dataset.cx), cy: Number(r.dataset.cy) });
      }
    }

    renderFrame(reduced ? 18 : offset, reduced);
    if (reduced) stop();
    else start();
  }

  function renderFrame(dist, isStatic = false) {
    for (const tr of tracks) {
      if (tr.kind === 'fluid') {
        for (const it of tr.items) {
          const s = (it.phase + dist * (tr.speed / 56)) % tr.len;
          const idx = Math.min(tr.count, Math.max(0, Math.round((s / tr.len) * tr.count)));
          const pt = tr.lut[idx];
          const fade = isStatic ? 0.92 : Math.min(1, s / 10, (tr.len - s) / 10);
          const ratio = s / tr.len;
          const tone = tr.fromT === tr.toT ? tr.fromT : (ratio < 0.5 ? tr.fromT : tr.toT);
          it.pill.style.stroke = toneVar(tone);
          it.g.setAttribute('opacity', fade.toFixed(2));
          it.g.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${pt.a.toFixed(1)})`);
        }
      } else {
        for (const it of tr.items) {
          const s = (it.phase + dist * (tr.speed / 56)) % tr.len;
          const t = s / tr.len;
          const x = tr.p0.x + (tr.p1.x - tr.p0.x) * t;
          const y = tr.p0.y + (tr.p1.y - tr.p0.y) * t;
          const fade = isStatic ? 0.9 : Math.min(1, s / 8, (tr.len - s) / 8);
          it.g.setAttribute('opacity', fade.toFixed(2));
          it.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tr.angle.toFixed(1)})`);
        }
      }
    }
    if (!isStatic) {
      const deg = (dist * 2.4) % 360;
      for (const r of rotors) {
        r.el.setAttribute('transform', `rotate(${deg.toFixed(1)} ${r.cx} ${r.cy})`);
      }
    }
  }

  function tick(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    offset += dt * 56;
    renderFrame(offset, false);
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (!rafId) {
      lastTs = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  return { refresh: buildTracks, stop };
}
