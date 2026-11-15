import assert from 'node:assert/strict';

export const hydraulicStyle = `
.vector-map{display:block;width:100%;height:100%;overflow:visible;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
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
.ref-casing{fill:none;stroke:var(--cp-accent);stroke-width:9.2;stroke-linecap:round;stroke-linejoin:round;opacity:.34}
.ref-casing.thin{stroke-width:7.4}
.ref-channel{fill:none;stroke:var(--cp-surface);stroke-width:5.8;stroke-linecap:round;stroke-linejoin:round}
.ref-channel.thin{stroke-width:4.6}
.ref-core{fill:none;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
.ref-core.vapour{stroke-dasharray:9 6}
.ref-core.mixture{stroke-dasharray:2.6 5.4}
.ref-core.loop{stroke-dasharray:7 4 2.4 4}
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
        { x: 340, y: 454, w: 1280, h: 330, labelKey: 'zoneDhwStage', captionOffset: 280 }
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
            io: port(75, 335, 'intermediate', ['PC2.a/i.out']),
            ii: port(195, 335, 'intermediate', ['PC2.a/i.in'])
          }, ['PC2.a'], { tagPill: 'PC2', tags: ['PC2'] }),
        node('s3c', 'bufferSingle', 615, 65, 160, 172, 'step2S3C', 's3',
          { in: port(0, 70, 'climate', ['S3.c.a/in']), out: port(160, 70, 'climate', ['S3.c.a/out']) }, ['S3.c.a'], { tagPill: 'S3', tags: ['S3'] }),
        node('load', 'buildingClimate', 910, 62, 345, 318, 'step2Floors', 'floor',
          { in: port(0, 73, 'climate', ['C.supply/p']), out: port(0, 248, 'climate', ['C.return/p']) }, ['P07', 'BP'], { tagPill: 'Pannelli', tags: ['P07', 'BP'] }),
        node('riser', 'sanitaryRiserHome', 1290, 62, 310, 326, 'step2Riser', 'dhw',
          {
            acrOut: port(50, 326, 'potable.mp', ['DHW.mp/out']),
            acpIn: port(104, 326, 'potable.mp', ['DHW.mp/in'])
          }, ['DHW.mp', 'TAP.mp', 'P02', 'D.return.mp'], { tagPill: 'ACP · ACR', tags: ['ACP', 'ACR', 'P02'] }),
        node('s3i', 'bufferSingle', 405, 505, 150, 162, 'step2S3I', 'intermediate',
          { in: port(0, 115, 'intermediate', ['S3.i.a/in']), out: port(150, 115, 'intermediate', ['S3.i.a/out']) }, ['S3.i.a'], { tagPill: 'S3', tags: ['S3'] }),
        node('pc1', 'highTempPump', 655, 482, 210, 210, 'step2PC1', 'pc1',
          {
            so: port(0, 58, 'intermediate', ['PC1/s.out']),
            si: port(0, 138, 'intermediate', ['PC1/s.in']),
            ho: port(210, 68, 'hot', ['PC1/h.out']),
            hi: port(210, 168, 'hot', ['PC1/h.in'])
          }, ['PC1'], { tagPill: 'PC1', tags: ['PC1'] }),
        node('sc1', 'plateExchanger', 960, 490, 82, 195, 'step2SC1', 'sc1',
          {
            pi: port(0, 60, 'hot', ['SC1.mp/p.in']),
            po: port(0, 160, 'hot', ['SC1.mp/p.out']),
            so: port(82, 60, 'potable.mp', ['SC1.mp/s.out']),
            si: port(82, 160, 'potable.mp', ['SC1.mp/s.in'])
          }, ['SC1.mp'], { tagPill: 'SC1', tags: ['SC1'] }),
        node('s2', 'dhwCylinder', 1135, 472, 148, 222, 'step2S2', 's2',
          {
            chargeIn: port(0, 78, 'potable.mp', ['S2.mp/charge.in']),
            chargeOut: port(0, 178, 'potable.mp', ['S2.mp/charge.out']),
            recircIn: port(148, 36, 'potable.mp', ['S2.mp/cold']),
            hotOut: port(148, 88, 'potable.mp', ['S2.mp/hot']),
            coldIn: port(74, 222, 'potable.mp', ['S2.mp/cold'])
          }, ['S2.mp'], { tagPill: 'S2 · 60 °C', tags: ['S2'] }),
        node('mixer', 'thermoMixer', 1354, 520, 80, 80, 'step2Mix', 'dhw',
          {
            hotIn: port(0, 40, 'potable.mp', ['MIX.mp/hot']),
            recircIn: port(16, 0, 'potable.mp', ['MIX.mp/cold']),
            mixedOut: port(40, 0, 'potable.mp', ['MIX.mp/out']),
            coldIn: port(40, 80, 'potable.mp', ['MIX.mp/cold'])
          }, ['MIX.mp'], { tagPill: 'Misc. 48 °C', tags: ['ACP'] }),
        node('mains', 'mainsIntake', 910, 720, 225, 52, 'step2Mains', 'water',
          { out: port(225, 26, 'potable.mp', ['COLD.mp/p']) }, ['AQ', 'T1', 'S1.a', 'GP1', 'T2.mp', 'COLD.mp'], { tagPill: 'AFP · Rete', tags: ['AFP', 'T1', 'GP1', 'T2'] })
      ],
      edges: [
        { id: 's2-gw-sup', from: 'well.out', to: 'pc2.gi', bends: [] },
        { id: 's2-gw-ret', from: 'pc2.go', to: 'returnWell.in', bends: [] },
        { id: 's2-cl-feed', from: 'pc2.co', to: 's3c.in', bends: [] },
        { id: 's2-cl-sup', from: 's3c.out', to: 'load.in', bends: [], pump: 'P07', pumpTopic: 'tag-P07' },
        { id: 's2-cl-ret', from: 'load.out', to: 'pc2.ci', bends: [] },
        { id: 's2-in-feed', from: 'pc2.io', to: 's3i.in', bends: [[360, 620]] },
        { id: 's2-in-sup', from: 's3i.out', to: 'pc1.si', bends: [], pump: 'P05', pumpTopic: 'tag-P05' },
        { id: 's2-in-ret', from: 'pc1.so', to: 'pc2.ii', bends: [[595, 540], [595, 430], [480, 430]] },
        { id: 's2-ht-sup', from: 'pc1.ho', to: 'sc1.pi', bends: [], pump: 'P04', pumpTopic: 'tag-P04' },
        { id: 's2-ht-ret', from: 'sc1.po', to: 'pc1.hi', bends: [] },
        { id: 's2-ch-sup', from: 'sc1.so', to: 's2.chargeIn', bends: [] },
        { id: 's2-ch-ret', from: 's2.chargeOut', to: 'sc1.si', bends: [], pump: 'P01', pumpTopic: 'tag-P01' },
        { id: 's2-hot-out', from: 's2.hotOut', to: 'mixer.hotIn', bends: [] },
        { id: 's2-acp-sup', from: 'mixer.mixedOut', to: 'riser.acpIn', bends: [] },
        { id: 's2-acr-mix', from: 'riser.acrOut', to: 'mixer.recircIn', bends: [[1340, 490], [1370, 490]], pump: 'P02', pumpTopic: 'tag-P02', pumpAt: [1340, 442], pumpAngle: 90, pumpSide: -1, role: 'recirc', thin: true },
        { id: 's2-acr-s2', from: 'riser.acrOut', to: 's2.recircIn', bends: [[1340, 490], [1310, 490], [1310, 508]], role: 'recirc', thin: true },
        { id: 's2-afp-s2', from: 'mains.out', to: 's2.coldIn', bends: [[1209, 746]], role: 'coldFeed' },
        { id: 's2-afp-mix', from: 'mains.out', to: 'mixer.coldIn', bends: [[1394, 746]], role: 'coldFeed' }
      ]
    };
    diagrams[d.id] = d;
  }

  // STEP 3 — Complete Real Condominium Plant Mes 600 S (100% planar: 0 crossings, multi-unit groups, pressure zones)
  {
    const d = {
      id: 'step3', step: 3, width: 1780, height: 880,
      zones: [
        { x: 18, y: 20, w: 382, h: 530, labelKey: 'zoneWellsMulti' },
        { x: 416, y: 20, w: 525, h: 422, labelKey: 'zoneGenMulti' },
        { x: 960, y: 20, w: 802, h: 422, labelKey: 'zoneClimateZones' },
        { x: 416, y: 462, w: 1346, h: 400, labelKey: 'zoneDhwMulti', captionOffset: 274 }
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
            io: port(64, 346, 'intermediate', ['PC2.a/i.out', 'PC2.b/i.out']),
            ii: port(194, 346, 'intermediate', ['PC2.a/i.in', 'PC2.b/i.in'])
          }, ['PC2.a', 'PC2.b'], { tagPill: '2 × PC2', tags: ['PC2'] }),
        node('s3c', 'multiBuffer', 746, 66, 176, 174, 'step3S3C', 's3',
          { in: port(0, 84, 'climate', ['S3.c.a/in', 'S3.c.b/in']), out: port(176, 84, 'climate', ['S3.c.a/out', 'S3.c.b/out']) },
          ['S3.c.a', 'S3.c.b'], { tagPill: '2 × S3', tags: ['S3'] }),
        node('branchCommon', 'climateBranch', 1046, 52, 654, 84, 'step3Common', 'dist-zones',
          { in: port(0, 22, 'climate', ['P06/in']), out: port(654, 58, 'climate', ['COMMON/out']) },
          ['P06', 'COMMON'], { tagPill: 'P06', pumpCode: 'P06', passThrough: true, tags: ['P06'] }),
        node('branchBP', 'climateBranch', 1046, 150, 654, 100, 'step3BP', 'dist-zones',
          { in: port(0, 22, 'climate', ['M07/hot']), out: port(654, 68, 'climate', ['BP/out']) },
          ['M07', 'P07', 'BP'], { tagPill: 'P07', pumpCode: 'P07', passThrough: true, showTemp: true, tags: ['P07', 'BP'] }),
        node('sc2', 'plateExchanger', 1046, 266, 128, 132, 'step3SC2', 'sc2',
          {
            pi: port(0, 44, 'climate', ['P08/in']),
            po: port(42, 132, 'climate', ['SC2/p.out']),
            so: port(128, 22, 'high', ['SC2/s.out']),
            si: port(128, 108, 'high', ['SC2/s.in'])
          }, ['P08', 'SC2'], { tagPill: 'P08 + SC2', isSC2: true, tags: ['P08', 'SC2'] }),
        node('branchAP', 'climateBranch', 1234, 266, 466, 132, 'step3AP', 'dist-zones',
          { in: port(0, 22, 'high', ['P09/in']), out: port(0, 108, 'high', ['AP/out']) },
          ['P09', 'AP'], { tagPill: 'P09', pumpCode: 'P09', showTemp: true, tags: ['P09', 'AP'] }),
        node('s3i', 'multiBuffer', 456, 506, 174, 168, 'step3S3I', 'intermediate',
          { in: port(0, 114, 'intermediate', ['S3.i.a/in', 'S3.i.b/in']), out: port(174, 114, 'intermediate', ['S3.i.a/out', 'S3.i.b/out']) },
          ['S3.i.a', 'S3.i.b'], { tagPill: '2 × S3', tags: ['S3'] }),
        node('pc1', 'highTempPump', 712, 495, 196, 200, 'step3PC1', 'pc1',
          {
            so: port(0, 50, 'intermediate', ['PC1/s.out']),
            si: port(0, 125, 'intermediate', ['PC1/s.in']),
            ho: port(196, 80, 'hot', ['PC1/h.out']),
            hi: port(196, 165, 'hot', ['PC1/h.in'])
          }, ['PC1'], { tagPill: 'PC1', tags: ['PC1'] }),
        node('sc1', 'multiExchanger', 988, 495, 118, 200, 'step3SC1', 'sc1',
          {
            pi: port(0, 80, 'hot', ['SC1.mp/p.in', 'SC1.bp/p.in']),
            po: port(0, 165, 'hot', ['SC1.mp/p.out', 'SC1.bp/p.out']),
            so: port(118, 80, 'potable.mp', ['SC1.mp/s.out']),
            si: port(118, 165, 'potable.mp', ['SC1.mp/s.in'])
          }, ['SC1.mp', 'SC1.bp'], { tagPill: '2 × SC1', tags: ['SC1'] }),
        node('s2', 'multiDhwCylinders', 1192, 485, 180, 215, 'step3S2', 's2',
          {
            chargeIn: port(0, 90, 'potable.mp', ['S2.mp/charge.in']),
            chargeOut: port(0, 175, 'potable.mp', ['S2.mp/charge.out']),
            recircIn: port(180, 30, 'potable.mp', ['S2.mp/cold']),
            hotOut: port(180, 95, 'potable.mp', ['S2.mp/hot']),
            coldIn: port(90, 215, 'potable.mp', ['S2.mp/cold'])
          }, ['P01.mp', 'P01.bp', 'S2.mp', 'S2.bp'], { tagPill: '2 × S2', tags: ['S2', 'P01'] }),
        node('mixer', 'thermoMixer', 1422, 545, 80, 80, 'step3Mix', 'dhw',
          {
            hotIn: port(0, 35, 'potable.mp', ['MIX.mp/hot']),
            recircIn: port(40, 0, 'potable.mp', ['MIX.mp/cold']),
            mixedOut: port(80, 35, 'potable.mp', ['MIX.mp/out']),
            coldIn: port(40, 80, 'potable.mp', ['MIX.mp/cold'])
          }, ['MIX.mp', 'MIX.bp'], { tagPill: '2×Misc.', tags: ['ACP'] }),
        node('dhwZones', 'multiDhwRisers', 1550, 482, 194, 256, 'step3DhwZones', 'dhw',
          {
            acrOut: port(0, 33, 'potable.mp', ['DHW.mp/out']),
            acpIn: port(0, 128, 'potable.mp', ['DHW.mp/in'])
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
        { id: 's3-gw-ret', from: 'pc2.go', to: 'returnWells.in', bends: [[388, 350], [388, 444]] },
        { id: 's3-cl-feed', from: 'pc2.co', to: 's3c.in', bends: [] },
        { id: 's3-cl-b1', from: 's3c.out', to: 'branchCommon.in', bends: [[988, 150], [988, 74]] },
        { id: 's3-cl-b2', from: 's3c.out', to: 'branchBP.in', bends: [[988, 150], [988, 172]] },
        { id: 's3-cl-b3', from: 's3c.out', to: 'sc2.pi', bends: [[988, 150], [988, 310]] },
        { id: 's3-cl-r1', from: 'branchCommon.out', to: 'pc2.ci', bends: [[1736, 110], [1736, 424], [720, 424], [720, 320]] },
        { id: 's3-cl-r2', from: 'branchBP.out', to: 'pc2.ci', bends: [[1736, 218], [1736, 424], [720, 424], [720, 320]] },
        { id: 's3-cl-r3', from: 'sc2.po', to: 'pc2.ci', bends: [[1088, 424], [720, 424], [720, 320]] },
        { id: 's3-ap-sup', from: 'sc2.so', to: 'branchAP.in', bends: [] },
        { id: 's3-ap-ret', from: 'branchAP.out', to: 'sc2.si', bends: [] },
        { id: 's3-in-feed', from: 'pc2.io', to: 's3i.in', bends: [[500, 442], [432, 442], [432, 620]] },
        { id: 's3-in-sup', from: 's3i.out', to: 'pc1.si', bends: [], pump: 'P05', pumpTopic: 'tag-P05' },
        { id: 's3-in-ret', from: 'pc1.so', to: 'pc2.ii', bends: [[664, 545], [664, 442], [630, 442]] },
        { id: 's3-ht-sup', from: 'pc1.ho', to: 'sc1.pi', bends: [], pump: 'P04', pumpTopic: 'tag-P04' },
        { id: 's3-ht-ret', from: 'sc1.po', to: 'pc1.hi', bends: [] },
        { id: 's3-ch-sup', from: 'sc1.so', to: 's2.chargeIn', bends: [] },
        { id: 's3-ch-ret', from: 's2.chargeOut', to: 'sc1.si', bends: [], pump: '2×P01', pumpTopic: 'tag-P01' },
        { id: 's3-hot-out', from: 's2.hotOut', to: 'mixer.hotIn', bends: [] },
        { id: 's3-acp-sup', from: 'mixer.mixedOut', to: 'dhwZones.acpIn', bends: [[1526, 580], [1526, 610]] },
        { id: 's3-acr-s2', from: 'dhwZones.acrOut', to: 's2.recircIn', bends: [], pump: 'P02·P03', pumpTopic: 'tag-P02', pumpAt: [1508, 515], pumpAngle: 180, role: 'recirc', thin: true },
        { id: 's3-acr-mix', from: 'dhwZones.acrOut', to: 'mixer.recircIn', bends: [[1462, 515]], role: 'recirc', thin: true },
        { id: 's3-afp-s2', from: 'potable.out', to: 's2.coldIn', bends: [[1282, 802]], role: 'coldFeed' },
        { id: 's3-afp-mix', from: 'potable.out', to: 'mixer.coldIn', bends: [[1462, 802]], role: 'coldFeed' }
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
        { ...node('stage0', 'cycleStage', 35, 165, 305, 210, 'stage0', 'evaporator', { in: port(62, 210, 'ref'), out: port(62, 0, 'ref') }), stage: 0 },
        { ...node('stage1', 'cycleStage', 430, 28, 300, 168, 'stage1', 'compressor', { in: port(0, 84, 'ref'), out: port(300, 84, 'ref') }), stage: 1 },
        { ...node('stage2', 'cycleStage', 820, 165, 305, 210, 'stage2', 'condenser', { in: port(243, 0, 'ref'), out: port(243, 210, 'ref') }), stage: 2 },
        { ...node('stage3', 'cycleStage', 430, 344, 300, 168, 'stage3', 'expansion', { in: port(300, 84, 'ref'), out: port(0, 84, 'ref') }), stage: 3 }
      ],
      edges: [
        { id: 'phase0', from: 'stage0.out', to: 'stage1.in', fluid: 'ref', refPhase: 'vapour', points: [[97, 165], [97, 112], [430, 112]] },
        { id: 'phase1', from: 'stage1.out', to: 'stage2.in', fluid: 'ref', refPhase: 'vapour', points: [[730, 112], [1063, 112], [1063, 165]] },
        { id: 'phase2', from: 'stage2.out', to: 'stage3.in', fluid: 'ref', refPhase: 'liquid', points: [[1063, 375], [1063, 428], [730, 428]] },
        { id: 'phase3', from: 'stage3.out', to: 'stage0.in', fluid: 'ref', refPhase: 'mixture', points: [[430, 428], [97, 428], [97, 375]] }
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
    if (n.shape === 'dhwCylinder' || n.shape === 'multiDhwCylinders') {
      if (name === 'recircIn') return 'warning';
      return (name === 'chargeIn' || name === 'hotOut') ? 'danger' : 'link';
    }
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
    ...['danger', 'link', 'warning', 'accent', 'success'].map(tone =>
      `<marker id="${prefix}-arr-${tone}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.8" markerHeight="3.8" orient="auto"><path d="M0 1L9 5L0 9Z" fill="var(--cp-${tone})"/></marker>`
    )
  ];

  const drawPipe = (points, fromTone, toTone = fromTone, opts = {}) => {
    const { attrs = '', bridges = [], thin = false, gradEnds = null, plateau = false, marker = true, animated = true, fluidKind = 'water', refPhase = 'loop' } = opts;
    const dStr = buildRoundedPath(points, bridges);
    let stroke = `var(--cp-${fromTone})`;
    if (fromTone !== toTone || gradEnds) {
      const g = makeGrad(gradEnds ? gradEnds[0] : points[0], gradEnds ? gradEnds[1] : points.at(-1), fromTone, toTone, plateau);
      defs.push(g.def);
      stroke = g.stroke;
    }
    const cls = thin ? ' thin' : '';
    const mEnd = marker ? ` marker-end="url(#${prefix}-arr-${toTone})"` : '';
    if (fluidKind === 'ref') {
      const flowAttrs = animated ? ` data-flow-path="1" data-fluid-kind="ref" data-ref-phase="${refPhase}" data-temp-start="${fromTone}" data-temp-end="${toTone}"` : '';
      return `<path d="${dStr}" class="ref-casing${cls}" aria-hidden="true"/>` +
        `<path d="${dStr}" class="ref-channel${cls}" aria-hidden="true"/>` +
        `<path d="${dStr}" class="ref-core ${refPhase}" style="stroke:${stroke}" data-temperature-from="${fromTone}" data-temperature-to="${toTone}"${flowAttrs}${mEnd} ${attrs}/>`;
    }
    const flowAttrs = animated ? ` data-flow-path="1" data-fluid-kind="water" data-temp-start="${fromTone}" data-temp-end="${toTone}"` : '';
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

  const pumpBadge = (cx, cy, code, topic, dirAngle = 0, side = 1) => {
    const isVert = Math.abs(Math.abs(dirAngle) - 90) < 15;
    const pillW = Math.max(44, code.length * 8.6 + 10);
    const px = isVert ? cx + side * (18 + pillW / 2) : cx;
    const py = isVert ? cy : cy - 26;
    return `<g class="inline-pump" data-topic="${topic || 'pumps'}" data-tags="${esc(code.replace(/[^A-Z0-9]/g, ' ').trim())}" role="button" tabindex="0" aria-label="${esc(code)}">` +
      `<circle cx="${cx}" cy="${cy}" r="22" fill="var(--cp-surface)" opacity="0" pointer-events="all"/>` +
      `<circle class="machine-card" cx="${cx}" cy="${cy}" r="14"/>` +
      `<g transform="translate(${cx} ${cy}) rotate(${dirAngle})"><path d="M-5 -6L7 0L-5 6Z" fill="var(--cp-accent)"/></g>` +
      `<rect class="tag-pill-bg" x="${px - pillW / 2}" y="${py - 9}" width="${pillW}" height="18" rx="9"/>` +
      `<text class="tag-pill-text" x="${px}" y="${py + 4}" font-size="12" text-anchor="middle">${esc(code)}</text></g>`;
  };

  // Deduplicate shared manifold prefix/suffix trunks so every segment is drawn & animated once
  const ptOnSeg = (p, a, b) => {
    if (a[0] === b[0] && p[0] === a[0]) return p[1] >= Math.min(a[1], b[1]) - 0.5 && p[1] <= Math.max(a[1], b[1]) + 0.5;
    if (a[1] === b[1] && p[1] === a[1]) return p[0] >= Math.min(a[0], b[0]) - 0.5 && p[0] <= Math.max(a[0], b[0]) + 0.5;
    return false;
  };
  const ptOnPoly = (p, pts) => {
    for (let i = 1; i < pts.length; i++) if (ptOnSeg(p, pts[i - 1], pts[i])) return true;
    return false;
  };
  const splitColinear = (pts, coords) => {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (a[0] === b[0]) {
        const dir = Math.sign(b[1] - a[1]);
        const mids = coords.filter(([cx, cy]) => cx === a[0] && (cy - a[1]) * dir > 0.5 && (b[1] - cy) * dir > 0.5)
          .map(([, cy]) => cy).sort((u, v) => (u - v) * dir);
        for (const my of [...new Set(mids)]) out.push([a[0], my]);
      } else {
        const dir = Math.sign(b[0] - a[0]);
        const mids = coords.filter(([cx, cy]) => cy === a[1] && (cx - a[0]) * dir > 0.5 && (b[0] - cx) * dir > 0.5)
          .map(([cx]) => cx).sort((u, v) => (u - v) * dir);
        for (const mx of [...new Set(mids)]) out.push([mx, a[1]]);
      }
      out.push(b);
    }
    return out;
  };

  let zonesSvg = '';
  for (const z of (d.zones || [])) {
    zonesSvg += `<g class="zone-group"><rect class="zone-box" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="16"/>` +
      `<text class="zone-caption" x="${z.x + (z.captionOffset || 18)}" y="${z.y + 24}">${esc(textLabel(z.labelKey))}</text></g>`;
  }

  const allEdgeVertices = d.edges.flatMap(e => e.points);
  const drawnPolys = [];
  const junctionDots = new Map();
  let pipesSvg = '', inlinePumpsSvg = '';

  for (const e of d.edges) {
    const fromT = d.teaching ? portTone(d.nodes.find(n => n.id === e.from.split('.')[0]), e.from.split('.')[1]) : resolveTone(e.from, e);
    const toT = d.teaching ? portTone(d.nodes.find(n => n.id === e.to.split('.')[0]), e.to.split('.')[1]) : resolveTone(e.to, e);
    const canonPath = buildRoundedPath(e.points);
    pipesSvg += `<path d="${canonPath}" fill="none" stroke="none" data-edge="${e.id}" data-from="${e.from}" data-to="${e.to}" data-fluid="${e.fluid}" data-temperature-from="${fromT}" data-temperature-to="${toT}"/>`;

    const refined = splitColinear(e.points, allEdgeVertices);
    const segCovered = (a, b) => {
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return drawnPolys.some(prev => (prev.from === e.from || prev.to === e.to) && prev.tone === fromT && ptOnPoly(mid, prev.points));
    };
    let startIdx = 0;
    while (startIdx < refined.length - 1 && segCovered(refined[startIdx], refined[startIdx + 1])) startIdx++;
    let endIdx = refined.length - 1;
    while (endIdx > startIdx && segCovered(refined[endIdx - 1], refined[endIdx])) endIdx--;

    const visPts = refined.slice(startIdx, endIdx + 1);
    if (visPts.length >= 2) {
      const isRef = e.fluid === 'ref';
      pipesSvg += drawPipe(visPts, fromT, toT, {
        thin: !!e.thin,
        marker: endIdx === refined.length - 1,
        fluidKind: isRef ? 'ref' : 'water',
        refPhase: e.refPhase || 'vapour'
      });
      if (startIdx > 0) {
        const jp = visPts[0];
        junctionDots.set(`${jp[0]},${jp[1]}`, `<circle data-junction="${jp[0]},${jp[1]}" cx="${jp[0]}" cy="${jp[1]}" r="4.8" fill="var(--cp-${fromT})" stroke="var(--cp-surface)" stroke-width="1.5"/>`);
      }
      if (endIdx < refined.length - 1) {
        const jp = visPts.at(-1);
        junctionDots.set(`${jp[0]},${jp[1]}`, `<circle data-junction="${jp[0]},${jp[1]}" cx="${jp[0]}" cy="${jp[1]}" r="4.8" fill="var(--cp-${toT})" stroke="var(--cp-surface)" stroke-width="1.5"/>`);
      }
    }
    drawnPolys.push({ from: e.from, to: e.to, tone: fromT, points: e.points });

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
      inlinePumpsSvg += pumpBadge(px, py, e.pump, e.pumpTopic, angle, e.pumpSide ?? 1);
    }
  }
  pipesSvg += [...junctionDots.values()].join('');

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
        fluidKind: 'ref', refPhase: 'loop',
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
        body += drawPipe([pin, [x + 24, pin[1]], [x + 24, y + 82], [x + w - 24, y + 82], [x + w - 24, pout[1]], pout], tone, tone, { thin: true, marker: false });
        body += drawPipe([[x + 24, pin[1]], [x + 24, y + 128], [x + w - 24, y + 128], [x + w - 24, pout[1]]], tone, tone, { thin: true, marker: false });
        body += `<circle cx="${x + 24}" cy="${pin[1]}" r="4" fill="var(--cp-${tone})"/><circle cx="${x + w - 24}" cy="${pout[1]}" r="4" fill="var(--cp-${tone})"/>`;
        body += `<text class="svg-label svg-sub pc-detail" x="${x + w / 2}" y="${y + h - 8}" font-size="13" text-anchor="middle">2 × 2.000 L</text>`;
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
      body += `<rect class="machine-sub" x="${x + 14}" y="${y + 44}" width="116" height="${h - 60}" rx="8"/>`;
      body += `<rect class="machine-sub" x="${x + 138}" y="${y + 44}" width="${w - 152}" height="${h - 60}" rx="8"/>`;
      body += `<text class="svg-label svg-sub" x="${x + 72}" y="${y + 64}" font-size="12.5" text-anchor="middle">${esc(textLabel('stairwellLabel'))}</text>`;
      body += `<text class="svg-label svg-sub" x="${x + 216}" y="${y + 64}" font-size="12.5" text-anchor="middle">${esc(textLabel('tapRoomLabel'))}</text>`;
      // ACP rises in stairwell column; at top of stairwell turns into thin ACR return staying ONLY in stairwell!
      // A straight dead-end horizontal branch enters the apartment tap directly without any loop.
      const topY = y + 98, branchY = y + 142, tapX = x + 224;
      body += drawPipe([acp, [acp[0], topY], [acr[0], topY], acr], 'warning', 'warning',
        { thin: true, marker: false, attrs: 'data-channel="riser.recirc"' });
      body += drawPipe([[acp[0], branchY], [tapX, branchY], [tapX, branchY + 14]], 'warning', 'warning',
        { thin: true, marker: false, attrs: 'data-draw-off="true"' });
      body += `<circle cx="${acp[0]}" cy="${branchY}" r="4.2" fill="var(--cp-warning)"/>`;
      body += `<path d="M${tapX - 16} ${branchY + 14}h24v12" fill="none" stroke="var(--cp-border-strong)" stroke-width="4" stroke-linecap="round"/>`;
      body += `<circle cx="${tapX + 8}" cy="${branchY + 36}" r="3.2" fill="var(--cp-warning)"/>` +
        `<circle cx="${tapX + 8}" cy="${branchY + 49}" r="3.2" fill="var(--cp-warning)"/>` +
        `<path d="M${tapX - 22} ${branchY + 62}h52l-8 15h-36Z" class="machine-card"/>`;
      body += `<text class="svg-label svg-temp" x="${x + 72}" y="${y + 218}" font-size="14.5" text-anchor="middle">48 °C</text>`;
      body += `<text class="svg-label svg-sub" x="${x + 216}" y="${y + 248}" font-size="12.5" text-anchor="middle">${esc(textLabel('openTapNote'))}</text>`;
      body += `<text class="svg-label svg-sub pc-detail" x="${x + 216}" y="${y + 268}" font-size="11.5" text-anchor="middle">${esc(textLabel('noColdReturnNote'))}</text>`;
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
      const primPts = p.po.y === h ? [pi, [po[0], pi[1]], po] : [pi, [x + 18, pi[1]], [x + 18, po[1]], po];
      body += drawPipe(primPts, portTone(n, 'pi'), portTone(n, 'po'),
        { thin: true, marker: false, gradEnds: [pi, po] });
      body += drawPipe([si, [x + w - 18, si[1]], [x + w - 18, so[1]], so], portTone(n, 'si'), portTone(n, 'so'),
        { thin: true, marker: false, gradEnds: [si, so] });
      body += drawHeat(x + 22, y + h / 2 + 12, x + w - 22, y + h / 2 + 12, isSC2 && rev);
      if (n.tagPill) body += tagPill(x + w / 2, y + 24, n.tagPill, 12);
    } else if (n.shape === 'dhwCylinder' || n.shape === 'multiDhwCylinders') {
      const isMulti = n.shape === 'multiDhwCylinders';
      const cin = portPt(n, p.chargeIn), cout = portPt(n, p.chargeOut), hout = portPt(n, p.hotOut), cold = portPt(n, p.coldIn);
      const rIn = p.recircIn ? portPt(n, p.recircIn) : null;
      const strat = makeGrad([x, y + 54], [x, y + h - 14], 'danger', 'link');
      defs.push(strat.def);
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 24}" font-size="16" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.tagPill) body += tagPill(x + w / 2, y + 44, n.tagPill, 12);
      if (isMulti) {
        for (const tx of [x + 26, x + w - 88]) {
          body += `<rect x="${tx}" y="${y + 60}" width="58" height="${h - 76}" rx="24" style="fill:${strat.stroke};fill-opacity:.22;stroke:var(--cp-border-strong);stroke-width:1.8"/>`;
        }
        body += `<text class="svg-label svg-sub pc-detail" x="${x + 55}" y="${y + 132}" font-size="12" text-anchor="middle">MP</text>`;
        body += `<text class="svg-label svg-sub pc-detail" x="${x + w - 59}" y="${y + 132}" font-size="12" text-anchor="middle">BP</text>`;
      } else {
        body += `<rect x="${x + 26}" y="${y + 58}" width="${w - 56}" height="${h - 74}" rx="34" style="fill:${strat.stroke};fill-opacity:.24;stroke:var(--cp-border-strong);stroke-width:1.8"/>`;
      }
      body += drawPipe([cin, [x + 26, cin[1]]], 'danger', 'danger', { thin: true, marker: false });
      body += drawPipe([[x + 26, cout[1]], cout], 'link', 'link', { thin: true, marker: false });
      body += drawPipe([[x + w - 30, hout[1]], hout], 'danger', 'danger', { thin: true, marker: false });
      body += drawPipe([cold, [cold[0], y + h - 18]], 'link', 'link', { thin: true, marker: false });
      if (rIn) {
        body += drawPipe([rIn, [x + w - 30, rIn[1]]], 'warning', 'warning', { thin: true, marker: false });
      }
      body += `<text class="svg-label svg-temp pc-detail" x="${isMulti ? x + 55 : x + w / 2 - 2}" y="${y + 84}" font-size="13.5" text-anchor="middle">60 °C</text>`;
    } else if (n.shape === 'thermoMixer') {
      const hin = portPt(n, p.hotIn), cin = portPt(n, p.coldIn), mout = portPt(n, p.mixedOut);
      const rin = p.recircIn ? portPt(n, p.recircIn) : null;
      const cx = x + p.coldIn.x, cy = hin[1];
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>`;
      body += drawPipe([hin, [cx, cy]], 'danger', 'warning', { thin: true, marker: false });
      body += drawPipe([cin, [cx, cy]], 'link', 'warning', { thin: true, marker: false });
      if (rin) {
        const rPts = rin[0] === cx ? [rin, [cx, cy]] : [rin, [rin[0], cy - 18], [cx, cy - 18]];
        body += drawPipe(rPts, 'warning', 'warning', { thin: true, marker: false });
      }
      body += drawPipe([[cx, cy], mout], 'warning', 'warning', { thin: true, marker: false });
      body += `<circle class="machine-card" cx="${cx}" cy="${cy}" r="14"/>` +
        `<text class="svg-label svg-title" x="${cx}" y="${cy + 5}" font-size="13" text-anchor="middle">M</text>`;
      const tempX = p.mixedOut.y === 0 ? x + w + 28 : x + w + 26;
      const tempY = p.mixedOut.y === 0 ? y + 24 : y + 14;
      body += `<text class="svg-label svg-temp" x="${tempX}" y="${tempY}" font-size="13" text-anchor="middle">48 °C</text>`;
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
      // Single horizontal manifold + non-overlapping vertical pump risers
      body += drawPipe([[x + 44, y + 206], [x + 44, pout[1]], pout], tone, tone, { thin: true, marker: false });
      for (const px of [x + 92, x + 159]) {
        body += drawPipe([[px, y + 206], [px, pout[1]]], tone, tone, { thin: true, marker: false });
        body += `<circle cx="${px}" cy="${pout[1]}" r="3.8" fill="var(--cp-${tone})"/>`;
      }
      for (const px of [x + 44, x + 92, x + 159]) {
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
      }
      // Single non-overlapping header feeding both R1 boreholes
      body += drawPipe([pin, [x + 76, pin[1]], [x + 76, y + h - 24]], tone, tone, { thin: true, marker: false });
      body += drawPipe([[x + 176, pin[1]], [x + 176, y + h - 24]], tone, tone, { thin: true, marker: false });
      body += `<circle cx="${x + 176}" cy="${pin[1]}" r="3.8" fill="var(--cp-${tone})"/>`;
    } else if (n.shape === 'climateBranch') {
      const pin = portPt(n, p.in), pout = portPt(n, p.out);
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>`;
      const px = x + 38, py = pin[1];
      if (n.passThrough) {
        const coilL = x + w - 96, coilR = x + w - 20;
        const coilPts = [pin, [coilR, py], [coilR, y + 40], [coilL, y + 40], [coilL, pout[1]], pout];
        body += drawPipe(coilPts, portTone(n, 'in'), portTone(n, 'out'),
          { thin: true, marker: false, gradEnds: [[coilL, py], pout], attrs: n.id === 'branchBP' ? 'data-channel="load.in-out"' : '' });
      } else {
        const sr = x + w - 18, coilL = x + w - 80;
        body += drawPipe([pin, [sr, pin[1]], [sr, y + 54], [coilL, y + 54], [coilL, y + 82], [sr, y + 82], [sr, pout[1]], pout],
          portTone(n, 'in'), portTone(n, 'out'), { thin: true, marker: false, gradEnds: [[coilL, pin[1]], [coilL, pout[1]]] });
      }
      body += `<circle class="machine-card" cx="${px}" cy="${py}" r="12"/><path d="M${px - 5} ${py - 5}L${px + 6} ${py}L${px - 5} ${py + 5}Z" fill="var(--cp-accent)"/>`;
      const contentY = n.passThrough ? y + 56 : y + 66;
      if (n.tagPill) body += tagPill(x + 62, contentY, n.pumpCode, 12);
      const textCx = x + 98 + (w - 190) / 2;
      const titleY = n.showTemp ? contentY - 4 : contentY + 5;
      body += `<text class="svg-label svg-title" x="${textCx}" y="${titleY}" font-size="14" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.showTemp) {
        body += `<text class="svg-label svg-temp pc-detail" x="${textCx}" y="${contentY + 16}" font-size="13" text-anchor="middle">${rev ? '18 → 23 °C' : '38 → 33 °C'}</text>`;
      }
    } else if (n.shape === 'multiDhwRisers') {
      const acp = portPt(n, p.acpIn), acr = portPt(n, p.acrOut);
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
      body += `<text class="svg-label svg-title" x="${x + w / 2}" y="${y + 25}" font-size="16" text-anchor="middle">${esc(textLabel(n.label))}</text>`;
      if (n.tagPill) body += tagPill(x + w / 2, y + 46, 'MP (P02) · BP (P03)', 11);
      // Left stairwell shaft vs Right MP/BP apartment tap rooms (dead-end taps, stairwell-only recirculation)
      body += `<rect class="machine-sub" x="${x + 12}" y="${y + 64}" width="46" height="${h - 78}" rx="7"/>`;
      body += `<rect class="machine-sub" x="${x + 64}" y="${y + 64}" width="${w - 76}" height="82" rx="8"/>`;
      body += `<rect class="machine-sub" x="${x + 64}" y="${y + 156}" width="${w - 76}" height="82" rx="8"/>`;
      body += `<text class="svg-label svg-sub" x="${x + 124}" y="${y + 83}" font-size="12" text-anchor="middle">${esc(textLabel('riserMP'))}</text>`;
      body += `<text class="svg-label svg-sub" x="${x + 124}" y="${y + 175}" font-size="12" text-anchor="middle">${esc(textLabel('riserBP'))}</text>`;
      // ACP rises in stairwell shaft (x+38); thin ACR returns from top of stairwell shaft to acrOut (0 crossings!)
      const mpY = y + 104, bpY = y + 196, shaftX = x + 38;
      body += drawPipe([acp, [shaftX, acp[1]], [shaftX, y + 74], [x + 22, y + 74], [x + 22, acr[1]], acr], 'warning', 'warning', { thin: true, marker: false });
      body += drawPipe([[shaftX, acp[1]], [shaftX, bpY], [x + 152, bpY]], 'warning', 'warning', { thin: true, marker: false });
      body += drawPipe([[shaftX, mpY], [x + 152, mpY]], 'warning', 'warning', { thin: true, marker: false, attrs: 'data-draw-off="true"' });
      body += `<circle cx="${shaftX}" cy="${acp[1]}" r="3.8" fill="var(--cp-warning)"/><circle cx="${shaftX}" cy="${mpY}" r="3.8" fill="var(--cp-warning)"/>`;
      for (const ty of [mpY, bpY]) {
        body += `<path d="M${x + 152} ${ty}h14v9" fill="none" stroke="var(--cp-border-strong)" stroke-width="3.2" stroke-linecap="round"/>` +
          `<circle cx="${x + 166}" cy="${ty + 17}" r="2.7" fill="var(--cp-warning)"/>` +
          `<circle cx="${x + 166}" cy="${ty + 27}" r="2.7" fill="var(--cp-warning)"/>`;
      }
    } else if (n.shape === 'cycleStage') {
      const pin = portPt(n, p.in), pout = portPt(n, p.out);
      const isSideVert = n.stage === 0 || n.stage === 2;
      const symX = isSideVert ? pin[0] : x + w / 2;
      const symY = y + h / 2;
      const labelX = n.stage === 0 ? x + 212 : n.stage === 2 ? x + 93 : x + w / 2;
      const stageInPhase = ['mixture', 'vapour', 'vapour', 'liquid'][n.stage];
      const stageOutPhase = ['vapour', 'vapour', 'liquid', 'mixture'][n.stage];
      body += `<rect class="machine-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
      body += `<text class="svg-label svg-title" x="${labelX}" y="${isSideVert ? symY - 16 : y + 28}" font-size="16.5" text-anchor="middle">${esc(copy.stages[n.stage])}</text>`;
      body += drawPipe([pin, [symX, symY]], portTone(n, 'in'), portTone(n, 'in'), { thin: true, marker: false, fluidKind: 'ref', refPhase: stageInPhase });
      body += drawPipe([[symX, symY], pout], portTone(n, 'out'), portTone(n, 'out'), { thin: true, marker: false, fluidKind: 'ref', refPhase: stageOutPhase });
      if (n.stage === 1) {
        body += `<circle class="machine-card" cx="${symX}" cy="${symY}" r="28"/>` +
          `<g data-rotor="1" data-cx="${symX}" data-cy="${symY}"><path d="M${symX - 11} ${symY - 13}L${symX + 17} ${symY}L${symX - 11} ${symY + 13}Z" fill="var(--cp-accent)"/></g>`;
        body += `<path class="power-track" d="M${symX} ${y + h - 28}V${symY + 32}" marker-end="url(#${prefix}-arr-accent)"/>`;
      } else if (n.stage === 3) {
        body += `<path class="machine-card" d="M${symX - 26} ${symY - 18}L${symX + 26} ${symY + 18}V${symY - 18}L${symX - 26} ${symY + 18}Z"/>`;
      } else {
        body += `<rect class="plate-pack" x="${symX - 24}" y="${symY - 28}" width="48" height="56" rx="8"/>` +
          `<path d="M${symX - 14} ${symY - 12}h28m-28 12h28m-28 12h28" stroke="var(--cp-border-strong)" stroke-width="2"/>`;
        if (n.stage === 0) body += drawHeat(x + 12, symY, symX - 28, symY, false);
        if (n.stage === 2) body += drawHeat(symX + 28, symY, x + w - 12, symY, false);
      }
      if (isSideVert && copy.states[n.stage].includes('·')) {
        const [stA, stB] = copy.states[n.stage].split('·').map(s => s.trim());
        body += `<text class="svg-label svg-sub" x="${labelX}" y="${symY + 12}" font-size="12.5" text-anchor="middle">${esc(stA)}</text>` +
          `<text class="svg-label svg-sub" x="${labelX}" y="${symY + 30}" font-size="12" text-anchor="middle">${esc(stB)}</text>`;
      } else {
        body += `<text class="svg-label svg-sub" x="${labelX}" y="${isSideVert ? symY + 16 : y + h - 14}" font-size="13" text-anchor="middle">${esc(copy.states[n.stage])}</text>`;
      }
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
    extraSvg += `<g class="cycle-center-note"><rect class="machine-sub" x="365" y="232" width="430" height="76" rx="14"/>` +
      `<text class="svg-label svg-title" x="580" y="264" font-size="16" text-anchor="middle">${esc(textLabel(season === 'winter' ? 'copBadgeWinter' : 'copBadgeSummer'))}</text>` +
      `<text class="svg-label svg-sub" x="580" y="290" font-size="13.5" text-anchor="middle">${esc(textLabel('cycleCenterSub'))}</text></g>`;
  }
  if (d.id === 'step2' || d.id === 'step3') {
    const ix = d.id === 'step2' ? 480 : 543;
    const iy = d.id === 'step2' ? 688 : 696;
    extraSvg += `<text class="svg-label svg-temp pc-detail" x="${ix}" y="${iy}" font-size="14" text-anchor="middle">40 / 35 °C</text>`;
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
  let tracks = [], rotors = [], orbits = [], pulses = [], recips = [];
  const NS = 'http://www.w3.org/2000/svg';
  const toneVar = tone => `var(--cp-${tone || 'link'})`;

  function makeRefGlyph() {
    const g = document.createElementNS(NS, 'g');
    // Vapour sub-glyph: hollow expanding bubble + trailing micro-ring
    const vap = document.createElementNS(NS, 'g');
    const c1 = document.createElementNS(NS, 'circle');
    c1.setAttribute('cx', '2'); c1.setAttribute('cy', '0'); c1.setAttribute('r', '4.3');
    c1.style.fill = 'var(--cp-surface)'; c1.style.fillOpacity = '0.35'; c1.style.strokeWidth = '1.8';
    const c2 = document.createElementNS(NS, 'circle');
    c2.setAttribute('cx', '-5.2'); c2.setAttribute('cy', '-1.4'); c2.setAttribute('r', '2.2');
    c2.style.fill = 'none'; c2.style.strokeWidth = '1.4';
    vap.append(c1, c2);

    // Subcooled liquid sub-glyph: solid faceted diamond droplet
    const liq = document.createElementNS(NS, 'polygon');
    liq.setAttribute('points', '5.5,0 0,-3.8 -5.2,0 0,3.8');
    liq.style.stroke = 'var(--cp-surface)'; liq.style.strokeWidth = '1.2';

    // Boiling two-phase mixture sub-glyph: 3 effervescent micro-bubbles
    const mix = document.createElementNS(NS, 'g');
    for (const [bx, by, br] of [[-4.2, -1.8, 2.1], [0.6, 2.0, 2.4], [4.5, -1.2, 1.8]]) {
      const mb = document.createElementNS(NS, 'circle');
      mb.setAttribute('cx', String(bx)); mb.setAttribute('cy', String(by)); mb.setAttribute('r', String(br));
      mb.style.fill = 'var(--cp-surface)'; mb.style.strokeWidth = '1.5';
      mix.appendChild(mb);
    }
    g.append(vap, liq, mix);
    return { g, vap, c1, c2, liq, mix };
  }

  function buildTracks(root) {
    tracks = [];
    rotors = [];
    orbits = [];
    pulses = [];
    recips = [];
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
        const fluidKind = path.getAttribute('data-fluid-kind') || 'water';
        const refPhase = path.getAttribute('data-ref-phase') || 'loop';
        const customSpeed = Number(path.getAttribute('data-speed') || 0);
        const spacing = fluidKind === 'ref' ? 38 : (fluidKind === 'sand' ? 28 : 46);
        const nParticles = Math.max(1, Math.floor(len / spacing));
        const fromT = path.getAttribute('data-temp-start') || 'link';
        const toT = path.getAttribute('data-temp-end') || fromT;
        const items = [];
        for (let i = 0; i < nParticles; i++) {
          if (fluidKind === 'ref') {
            const rg = makeRefGlyph();
            layer.appendChild(rg.g);
            items.push({ ...rg, phase: (i / nParticles) * len, idxSeed: i });
          } else if (fluidKind === 'sand') {
            const g = document.createElementNS(NS, 'g');
            const dot = document.createElementNS(NS, 'circle');
            dot.setAttribute('r', '2.8');
            dot.style.fill = 'var(--cp-warning)';
            dot.style.stroke = 'var(--cp-text)';
            dot.style.strokeWidth = '0.9';
            g.appendChild(dot);
            layer.appendChild(g);
            items.push({ g, dot, phase: (i / nParticles) * len });
          } else {
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
        }
        const defaultSpd = fluidKind === 'ref' ? 68 : (fluidKind === 'sand' ? 44 : 56);
        tracks.push({ kind: fluidKind, refPhase, len, lut, count, items, speed: customSpeed || defaultSpd, fromT, toT });
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
        rotors.push({ el: r, cx: Number(r.dataset.cx), cy: Number(r.dataset.cy), rpm: Number(r.dataset.rpm || 1) });
      }
      for (const o of svg.querySelectorAll('[data-orbit="1"]')) {
        orbits.push({ el: o, rad: Number(o.dataset.orbitR || 4.2), rpm: Number(o.dataset.rpm || 1.6) });
      }
      for (const p of svg.querySelectorAll('[data-pulse="1"]')) {
        pulses.push({ el: p, cx: Number(p.dataset.cx), cy: Number(p.dataset.cy), amp: Number(p.dataset.amp || 0.08) });
      }
      for (const rc of svg.querySelectorAll('[data-recip="1"]')) {
        recips.push({ el: rc, dx: Number(rc.dataset.dx || 0), dy: Number(rc.dataset.dy || 0) });
      }
    }

    renderFrame(reduced ? 18 : offset, reduced);
    if (reduced) stop();
    else start();
  }

  function renderFrame(dist, isStatic = false) {
    for (const tr of tracks) {
      if (tr.kind === 'water' || tr.kind === 'sand') {
        for (const it of tr.items) {
          const s = (it.phase + dist * (tr.speed / 56)) % tr.len;
          const idx = Math.min(tr.count, Math.max(0, Math.round((s / tr.len) * tr.count)));
          const pt = tr.lut[idx];
          const fade = isStatic ? 0.92 : Math.min(1, s / 10, (tr.len - s) / 10);
          if (tr.kind === 'water') {
            const ratio = s / tr.len;
            const tone = tr.fromT === tr.toT ? tr.fromT : (ratio < 0.5 ? tr.fromT : tr.toT);
            it.pill.style.stroke = toneVar(tone);
          }
          it.g.setAttribute('opacity', fade.toFixed(2));
          it.g.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${pt.a.toFixed(1)})`);
        }
      } else if (tr.kind === 'ref') {
        for (const it of tr.items) {
          const s = (it.phase + dist * (tr.speed / 56)) % tr.len;
          const idx = Math.min(tr.count, Math.max(0, Math.round((s / tr.len) * tr.count)));
          const pt = tr.lut[idx];
          const ratio = s / tr.len;
          const fade = isStatic ? 0.94 : Math.min(1, s / 9, (tr.len - s) / 9);
          let ph = tr.refPhase;
          let tone = tr.fromT;
          if (ph === 'loop') {
            // Closed loop [evap bottom -> evap top -> condenser top -> condenser bottom -> expansion -> evap bottom]
            if (ratio < 0.14 || ratio >= 0.84) {
              ph = 'mixture';
              tone = 'link';
            } else if (ratio < 0.62) {
              ph = 'vapour';
              tone = ratio < 0.36 ? 'link' : 'danger';
            } else {
              ph = 'liquid';
              tone = 'danger';
            }
          } else if (tr.fromT !== tr.toT) {
            tone = ratio < 0.5 ? tr.fromT : tr.toT;
          }
          const col = toneVar(tone);
          it.vap.setAttribute('display', ph === 'vapour' ? 'inline' : 'none');
          it.liq.setAttribute('display', ph === 'liquid' ? 'inline' : 'none');
          it.mix.setAttribute('display', ph === 'mixture' ? 'inline' : 'none');
          if (ph === 'vapour') {
            it.c1.style.stroke = col;
            it.c2.style.stroke = col;
            const pulseR = isStatic ? 4.2 : 3.9 + 0.7 * Math.sin(dist * 0.12 + it.idxSeed);
            it.c1.setAttribute('r', pulseR.toFixed(1));
          } else if (ph === 'liquid') {
            it.liq.style.fill = col;
          } else {
            for (const mb of it.mix.children) mb.style.stroke = col;
          }
          const jitterY = (!isStatic && ph === 'mixture') ? (Math.sin(dist * 0.22 + it.idxSeed * 2.1) * 1.3) : 0;
          it.g.setAttribute('opacity', fade.toFixed(2));
          it.g.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${(pt.y + jitterY).toFixed(1)}) rotate(${pt.a.toFixed(1)})`);
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
      for (const r of rotors) {
        if (r.rpm === 0) continue;
        const deg = (dist * 2.4 * r.rpm) % 360;
        r.el.setAttribute('transform', `rotate(${deg.toFixed(1)} ${r.cx} ${r.cy})`);
      }
      for (const o of orbits) {
        const ang = (dist * 0.085 * o.rpm);
        const ox = Math.cos(ang) * o.rad, oy = Math.sin(ang) * o.rad;
        o.el.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`);
      }
      for (const p of pulses) {
        const sc = 1 + Math.sin(dist * 0.06) * p.amp;
        p.el.setAttribute('transform', `translate(${p.cx} ${p.cy}) scale(${sc.toFixed(3)}) translate(${-p.cx} ${-p.cy})`);
      }
      for (const rc of recips) {
        const w = Math.sin(dist * 0.055);
        rc.el.setAttribute('transform', `translate(${(rc.dx * w).toFixed(1)} ${(rc.dy * w).toFixed(1)})`);
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
