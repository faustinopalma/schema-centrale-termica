import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createDiagrams, readTopology, renderHydraulic, createFlowAnimator, hydraulicStyle } from './hydraulic-diagrams.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(path.join(root, 'src', 'data', 'plant-data.json'), 'utf8'));
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const palette = { bg: '#f7f4ef', surface: '#ffffff', text: '#242424', muted: '#5c5c5c', border: '#dedede', accent: '#b11f4b', link: '#0078d4', success: '#16a34a', warning: '#f59e0b' };
const node = (id, x, y, w, title, lines, kind = 'accent', h = 110) => ({ id, x, y, w, h, title, lines, kind });
const edge = (id, from, to, points, label, lx, ly, kind = 'accent', both = false, dashed = false) => ({ id, from, to, points, label, lx, ly, kind, both, dashed });

const diagrams = [
  {
    id: 'energy-overview', title: 'One plant, three separate water systems', width: 1260, height: 750,
    subtitle: 'Energy-flow overview | arrows represent heat transfer, not pipe connections',
    foot: ['PC2 and PC1 also consume electricity. Heat crosses exchanger surfaces; the water systems remain separate.',
      'S00 p.1 + S01/S02 family principles. Recovery availability and priority depend on the installed configuration.',
      'Groundwater and building arrows reverse between heating and cooling. Service devices are omitted.'],
    nodes: [
      node('wells', 40, 185, 240, 'GROUNDWATER', ['Wells P1 / P2 + T6 / T7 / S4', 'Source in winter; sink in summer'], 'link'),
      node('pc2', 400, 185, 240, '2 x PC2 | HiRef MSW', ['Water-to-water heat pumps', 'Building + intermediate circuits']),
      node('hvac', 930, 185, 270, 'BUILDING HEATING / COOLING', ['S3 buffers + distribution branches', 'Radiant panels and other loads'], 'success'),
      node('warm', 400, 430, 240, 'INTERMEDIATE WATER', ['2 x S3, each 2,000 L', '40 / 35 deg C design labels'], 'warning'),
      node('pc1', 680, 430, 220, 'PC1 | HiRef KSW', ['High-temperature heat pump', '70 / 65 deg C primary loop']),
      node('dhw', 940, 430, 260, 'DOMESTIC HOT WATER', ['2 x SC1 + 2 x S2 (3,000 L each)', '60 deg C storage; mixed outlets'], 'link')
    ],
    edges: [
      edge('ground', 'wells', 'pc2', [[280,240],[400,240]], 'Source / sink', 340, 216, 'link', true),
      edge('space', 'pc2', 'hvac', [[640,240],[930,240]], 'Heating / cooling', 785, 216, 'success', true),
      edge('recovery', 'pc2', 'warm', [[520,295],[520,430]], 'Warm-water production / recovery', 700, 368, 'warning'),
      edge('lift', 'warm', 'pc1', [[640,485],[680,485]], '', 660, 462, 'warning'),
      edge('hot', 'pc1', 'dhw', [[900,485],[940,485]], '', 920, 462)
    ]
  },
  {
    id: 'dhw-circuits', title: 'Domestic hot water: follow one pressure branch', width: 1260, height: 790,
    subtitle: 'Simplified water-flow principle | repeat for MP (P02) and BP (P03); each has its own SC1, P01 and S2',
    foot: ['Rose: closed PC1 primary water. Blue: potable water. The two fluids exchange heat across SC1.',
      'The recirculation connection is simplified; the source includes a split return/mixing arrangement.',
      'S00 p.1, two DHW branches. Temperatures are drawing annotations; hygiene and operating settings need verification.'],
    nodes: [
      node('dhw-pc1', 40, 210, 210, 'PC1 + P04', ['Closed hot-water primary', '70 supply / 65 return']),
      node('dhw-sc1', 350, 210, 210, 'SC1 | 90 kW', ['Heat-exchanger boundary', 'No mixing of the fluids']),
      node('dhw-s2', 670, 210, 210, 'S2 | 3,000 L', ['Potable hot-water storage', '60 deg C design label'], 'link'),
      node('dhw-mix', 980, 210, 220, 'MIXING VALVE', ['Hot + cold blending', '48 deg C outlet label'], 'link'),
      node('dhw-return', 350, 455, 210, 'P02 or P03', ['Dedicated recirculation pump', '3.6 m3/h design duty'], 'link'),
      node('dhw-cold', 670, 455, 210, 'TREATED COLD WATER', ['Pressure-zone supply', 'T2 + T3 + T4 upstream'], 'link'),
      node('dhw-users', 980, 455, 220, 'DHW DISTRIBUTION', ['Draw-off to taps', 'Separate recirculation return'], 'link')
    ],
    edges: [
      edge('hot-supply', 'dhw-pc1', 'dhw-sc1', [[250,240],[350,240]], '70 deg C', 300, 222),
      edge('hot-return', 'dhw-sc1', 'dhw-pc1', [[350,290],[250,290]], '65 deg C', 300, 316, 'accent', false, true),
      edge('charge', 'dhw-sc1', 'dhw-s2', [[560,240],[670,240]], '60 deg C', 615, 222, 'link'),
      edge('charge-return', 'dhw-s2', 'dhw-sc1', [[670,290],[560,290]], 'P01 / 55 deg C', 615, 337, 'link', false, true),
      edge('stored-hot', 'dhw-s2', 'dhw-mix', [[880,240],[980,240]], 'Hot water', 930, 222, 'link'),
      edge('mixed-water', 'dhw-mix', 'dhw-users', [[1090,320],[1090,455]], 'Mixed supply', 1170, 400, 'link'),
      edge('tank-fill', 'dhw-cold', 'dhw-s2', [[775,455],[775,320]], 'Cold feed', 719, 398, 'link'),
      edge('mix-cold', 'dhw-cold', 'dhw-mix', [[880,500],[930,500],[930,290],[980,290]], 'Cold blend', 1000, 365, 'link'),
      edge('recirc', 'dhw-users', 'dhw-return', [[1090,565],[1090,625],[455,625],[455,565]], 'Return from the same pressure zone', 770, 650, 'link', false, true),
      edge('recirc-join', 'dhw-return', 'dhw-s2', [[560,510],[610,510],[610,380],[690,380],[690,320]], '', 610, 390, 'link', false, true)
    ]
  },
  {
    id: 'pressure-zones', title: 'Heating and cooling: distribution by pressure zone', width: 1260, height: 1000,
    subtitle: 'Paired arrows summarise supply and return | SC2 transfers heat across a separate pressure circuit',
    foot: ['P07/P09 residential outlets: 42/38 deg C winter and 13/18 deg C summer (pipe labels).',
      'S00 p.1, right-hand distribution. SC2 schedule and terminal details contain different selection temperatures.',
      'Mixing valves, expansion vessels, make-up groups and protection devices are omitted from this functional view.'],
    nodes: [
      node('zone-source', 40, 345, 220, 'PC2 BUILDING LOOP', ['2 x S3 buffers (2,000 L each)', 'Common supply / return'], 'success'),
      node('zone-p06', 430, 150, 220, 'P06', ['Communal-space branch', '3 m3/h; 200 kPa'], 'success'),
      node('zone-common', 950, 150, 250, 'TOWER B COMMUNAL', ['Plant branch: 45/40 winter', '8/13 deg C summer labels'], 'success'),
      node('zone-p07', 430, 345, 220, 'P07 + MIXING', ['Low-pressure distribution', '66 m3/h; 220 kPa'], 'success'),
      node('zone-low', 950, 345, 250, 'TOWERS A + B | BP', ['Low-pressure residential outlets', 'Apartment modules downstream'], 'success'),
      node('zone-p08', 430, 570, 210, 'P08', ['SC2 primary circulation', '41.2 m3/h; 80 kPa'], 'success'),
      node('zone-sc2', 730, 570, 170, 'SC2', ['Hydraulic boundary', 'Heat crosses plates'], 'accent'),
      node('zone-p09', 990, 570, 210, 'P09', ['High-pressure secondary', '57 m3/h; 210 kPa'], 'success'),
      node('zone-high', 950, 765, 250, 'TOWERS A + B | AP', ['Separate high-pressure outlets', 'Apartment modules downstream'], 'success')
    ],
    edges: [
      edge('branch-common', 'zone-source', 'zone-p06', [[260,370],[330,370],[330,205],[430,205]], '', 330, 300, 'success', true),
      edge('common-load', 'zone-p06', 'zone-common', [[650,205],[950,205]], 'Supply / return', 800, 183, 'success', true),
      edge('branch-low', 'zone-source', 'zone-p07', [[260,400],[430,400]], '', 330, 380, 'success', true),
      edge('low-load', 'zone-p07', 'zone-low', [[650,400],[950,400]], 'Supply / return', 800, 378, 'success', true),
      edge('branch-primary', 'zone-source', 'zone-p08', [[260,430],[330,430],[330,625],[430,625]], '', 330, 520, 'success', true),
      edge('primary-sc2', 'zone-p08', 'zone-sc2', [[640,625],[730,625]], 'Primary', 686, 605, 'success', true),
      edge('secondary-sc2', 'zone-sc2', 'zone-p09', [[900,625],[990,625]], 'Secondary', 945, 605, 'success', true),
      edge('high-load', 'zone-p09', 'zone-high', [[1095,680],[1095,765]], '', 1095, 727, 'success', true)
    ]
  }
];

function svg(diagram) {
  const markers = ['accent', 'link', 'success', 'warning'].map(kind =>
    `<marker id="${diagram.id}-${kind}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="${palette[kind]}"/></marker>`).join('');
  const edges = diagram.edges.map(e => `<g class="diagram-edge" data-edge="${e.id}">
    <path id="${diagram.id}-${e.id}" d="${e.points.map((p,i) => `${i ? 'L' : 'M'}${p.join(',')}`).join(' ')}" fill="none" stroke="${palette[e.kind]}" stroke-width="3" stroke-linejoin="round" ${e.dashed ? 'stroke-dasharray="8 6"' : ''} marker-end="url(#${diagram.id}-${e.kind})" ${e.both ? `marker-start="url(#${diagram.id}-${e.kind})"` : ''}/>
    ${e.label ? `<text x="${e.lx}" y="${e.ly}" text-anchor="middle" font-size="15" fill="${palette.muted}">${esc(e.label)}</text>` : ''}</g>`).join('');
  const nodes = diagram.nodes.map(n => `<g id="${diagram.id}-${n.id}" class="diagram-node" data-node="${n.id}">
    <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="${palette.surface}" stroke="${palette.border}" stroke-width="2"/>
    <rect x="${n.x}" y="${n.y+14}" width="5" height="${n.h-28}" rx="2" fill="${palette[n.kind]}"/>
    <text x="${n.x+16}" y="${n.y+31}" font-size="16" font-weight="700" fill="${palette.text}">${esc(n.title)}</text>
    ${n.lines.map((line,i) => `<text x="${n.x+16}" y="${n.y+59+i*22}" font-size="14" fill="${palette.muted}">${esc(line)}</text>`).join('')}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${diagram.width}" height="${diagram.height}" viewBox="0 0 ${diagram.width} ${diagram.height}" role="img" aria-labelledby="${diagram.id}-title ${diagram.id}-desc">
  <title id="${diagram.id}-title">${esc(diagram.title)}</title><desc id="${diagram.id}-desc">${esc(diagram.subtitle)}. ${esc(diagram.foot.join(' '))}</desc>
  <defs>${markers}</defs>
  <g font-family="Segoe UI, Arial, sans-serif">
    <rect width="${diagram.width}" height="${diagram.height}" fill="${palette.bg}"/>
    <text x="40" y="57" fill="${palette.text}" font-size="30" font-weight="700">${esc(diagram.title)}</text>
    <text x="40" y="91" fill="${palette.muted}" font-size="16">${esc(diagram.subtitle)}</text>
    <g inkscape:groupmode="layer" inkscape:label="Connections" id="${diagram.id}-connections">${edges}</g>
    <g inkscape:groupmode="layer" inkscape:label="Components" id="${diagram.id}-components">${nodes}</g>
    ${diagram.foot.map((line,i) => `<text x="40" y="${diagram.height-77+i*25}" fill="${palette.muted}" font-size="15">${esc(line)}</text>`).join('')}
  </g></svg>`;
}

function drawioPage(d, index) {
  const labelCell = (id, value, x, y, w, h, fontSize, bold = false, align = 'left') =>
    `<mxCell id="${id}" value="${esc(value)}" style="text;html=0;align=${align};verticalAlign=middle;whiteSpace=wrap;rounded=0;fontFamily=Segoe UI;fontSize=${fontSize};fontStyle=${bold ? 1 : 0};fontColor=${palette.text};" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  const cells = [labelCell('heading', d.title, 40, 22, d.width-80, 45, 27, true), labelCell('subtitle', d.subtitle, 40, 73, d.width-80, 36, 15)];
  for (const n of d.nodes) {
    const label = `<b>${esc(n.title)}</b><br>${n.lines.map(esc).join('<br>')}`;
    cells.push(`<mxCell id="${n.id}" value="${esc(label)}" style="rounded=1;whiteSpace=wrap;html=1;arcSize=12;fillColor=${palette.surface};strokeColor=${palette[n.kind]};strokeWidth=2;fontColor=${palette.text};fontFamily=Segoe UI;fontSize=14;spacing=12;align=left;" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`);
  }
  for (const e of d.edges) {
    const source = d.nodes.find(n => n.id === e.from);
    const target = d.nodes.find(n => n.id === e.to);
    const start = e.points[0], end = e.points.at(-1);
    const style = `edgeStyle=none;html=0;rounded=0;strokeWidth=2;strokeColor=${palette[e.kind]};endArrow=block;endFill=1;startArrow=${e.both ? 'block' : 'none'};startFill=1;${e.dashed ? 'dashed=1;' : ''}exitX=${(start[0]-source.x)/source.w};exitY=${(start[1]-source.y)/source.h};entryX=${(end[0]-target.x)/target.w};entryY=${(end[1]-target.y)/target.h};exitPerimeter=0;entryPerimeter=0;`;
    cells.push(`<mxCell id="edge-${e.id}" style="${style}" edge="1" parent="1" source="${source.id}" target="${target.id}"><mxGeometry relative="1" as="geometry"><Array as="points">${e.points.slice(1,-1).map(p=>`<mxPoint x="${p[0]}" y="${p[1]}"/>`).join('')}</Array></mxGeometry></mxCell>`);
    if (e.label) {
      const width = Math.min(260, 2 * Math.min(e.lx - 20, d.width - e.lx - 20));
      cells.push(labelCell(`label-${e.id}`, e.label, e.lx-width/2, e.ly-19, width, 23, 14, false, 'center'));
    }
  }
  d.foot.forEach((line,i) => cells.push(labelCell(`foot-${i}`, line, 40, d.height-96+i*25, d.width-80, 25, 14)));
  return `<diagram id="page-${index}" name="${esc(d.title)}"><mxGraphModel dx="${d.width}" dy="${d.height}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${d.width}" pageHeight="${d.height}" background="${palette.bg}"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel></diagram>`;
}

mkdirSync(path.join(root, 'diagrams'), { recursive: true });
const svgFiles = diagrams.map(d => {
  const output = svg(d);
  writeFileSync(path.join(root, 'diagrams', `${d.id}.svg`), output);
  return output;
});
writeFileSync(path.join(root, 'diagrams', 'plant-flows.drawio'), `<?xml version="1.0" encoding="UTF-8"?><mxfile host="Electron" agent="Plant documentation" version="24.0.0">${diagrams.map(drawioPage).join('')}</mxfile>`);

const sources = data.sources.filter(source => source.file).map(source => {
  const bytes = readFileSync(path.join(root, source.file));
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error(`Invalid PDF: ${source.file}`);
  return { ...source, retrieved: source.id === 'S00' ? null : data.reviewed, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
writeFileSync(path.join(root, 'documents', 'sources.json'), JSON.stringify(sources, null, 2) + '\n');
const inlineSVG = svgFiles.map(text => {
  for (const [key,value] of Object.entries(palette)) text = text.replaceAll(value, `var(--cp-${key === 'muted' ? 'text-muted' : key})`);
  return text;
});
let html = readFileSync(path.join(root, 'src', 'templates', 'site.template.html'), 'utf8');
const replacements = {
  MODES: data.modes.map((m,i)=>`<button type="button" class="mode-button" data-mode="${m.id}" aria-pressed="${i===0}">${esc(m.title)}</button>`).join(''),
  OVERVIEW: inlineSVG[0], DHW: inlineSVG[1], ZONES: inlineSVG[2],
  DATA: JSON.stringify(data).replaceAll('<','\\u003c'),
  DIAGRAM_DATA: JSON.stringify(diagrams).replaceAll('<','\\u003c')
};
for (const [key,value] of Object.entries(replacements)) html = html.replaceAll(`{{${key}}}`, value);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unexpanded template token');
const lesson = JSON.parse(readFileSync(path.join(root, 'src', 'data', 'lesson-content.json'), 'utf8'));
const graph = JSON.parse(readFileSync(path.join(root, 'src', 'data', 'plant-graph.json'), 'utf8'));
const topology = readTopology(graph);
const hydraulicDiagrams = createDiagrams(graph);
function validateTranslation(reference, translation, location) {
  if (typeof reference !== typeof translation || translation === null) throw new Error(`Translation type: ${location}`);
  if (Array.isArray(reference)) {
    if (!Array.isArray(translation) || reference.length !== translation.length) throw new Error(`Translation count: ${location}`);
    reference.forEach((value, index) => validateTranslation(value, translation[index], `${location}[${index}]`));
  } else if (typeof reference === 'object') {
    if (JSON.stringify(Object.keys(reference).sort()) !== JSON.stringify(Object.keys(translation).sort())) throw new Error(`Translation keys: ${location}`);
    for (const key of Object.keys(reference)) validateTranslation(reference[key], translation[key], `${location}.${key}`);
  } else if (typeof translation === 'string' && !translation.trim()) throw new Error(`Empty translation: ${location}`);
}
for (const language of ['it', 'zh']) {
  validateTranslation(lesson.en, lesson[language], language);
}
const template = readFileSync(path.join(root, 'src', 'templates', 'lesson.template.html'), 'utf8');
const themeMatch = html.match(/:root \{[\s\S]*?\r?\n\}\r?\nhtml\[data-theme="dark"\] \{[\s\S]*?\r?\n\}/);
if (!themeMatch) throw new Error('Shared light/dark theme block is missing from the site template');
const theme = themeMatch[0];
const page = template.replace('{{THEME}}', theme).replace('{{LESSON}}', JSON.stringify(lesson).replaceAll('<', '\\u003c'))
  .replace('{{HYDRAULIC_STYLE}}', hydraulicStyle)
  .replace('{{HYDRAULIC_DIAGRAMS}}', JSON.stringify(hydraulicDiagrams).replaceAll('<', '\\u003c'))
  .replace('{{HYDRAULIC_RENDERER}}', renderHydraulic.toString())
  .replace('{{FLOW_ANIMATOR}}', createFlowAnimator.toString());
if (/\{\{[A-Z_]+\}\}/.test(page)) throw new Error('Unexpanded teaching template token');
for (const old of readdirSync(path.join(root, 'diagrams')).filter(n => n.startsWith('connected-'))) {
  rmSync(path.join(root, 'diagrams', old), { force: true });
}
const colours = Object.fromEntries([...theme.split('html[data-theme="dark"]')[0].matchAll(/--cp-([\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
for (const diagram of Object.values(hydraulicDiagrams)) {
  const svg = renderHydraulic(diagram, lesson.en, 'winter', diagram.id)
    .replace('>', `><style>${hydraulicStyle}</style>`)
    .replace(/var\(--cp-([\w-]+)\)/g, (_, key) => { if (!colours[key]) throw new Error(`Unknown SVG colour ${key}`); return colours[key]; });
  writeFileSync(path.join(root, 'diagrams', `connected-${diagram.id}.svg`), svg);
}
console.log(`Graph verified: ${Object.keys(graph.nodes).length} instances/groups, ${topology.ports.size} ports, ${topology.edges.length} hydraulic edges; ${Object.keys(hydraulicDiagrams).length} connected SVG projections.`);
// Stage only known public deliverables into dist/; never copy private sources.
const distDir = path.join(root, 'dist');
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
writeFileSync(path.join(distDir, 'index.html'), page);
writeFileSync(path.join(distDir, 'project.html'), html);
writeFileSync(path.join(distDir, '.nojekyll'), '');
copyFileSync(path.join(root, 'src', 'data', 'plant-graph.json'), path.join(distDir, 'plant-graph.json'));
const publishFiles = ['documents/sources.json',
  ...sources.map(source => source.file),
  ...readdirSync(path.join(root, 'diagrams')).filter(name => /\.(svg|png|pdf|drawio)$/.test(name)).map(name => `diagrams/${name}`)];
for (const file of publishFiles) {
  const target = path.join(distDir, file);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(path.join(root, file), target);
}
console.log(`Built trilingual animated dist/index.html, dist/project.html, ${sources.length} public references and dist (private source excluded).`);
