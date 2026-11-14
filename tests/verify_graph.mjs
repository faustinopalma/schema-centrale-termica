import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiagrams, readTopology, renderHydraulic } from '../src/hydraulic-diagrams.mjs';

const graph=JSON.parse(readFileSync(new URL('../src/data/plant-graph.json',import.meta.url),'utf8'));

test('hydraulic circuits connect through components and remain isolated across exchangers',()=>{
  const model=readTopology(graph);
  assert(model.reaches('P1/p','R1.a/p'));
  assert(model.reaches('PC2.a/c.out','BP/in'));
  assert(model.reaches('BP/out','PC2.a/c.in'));
  assert(model.reaches('PC2.a/i.out','PC1/s.in'));
  assert(model.reaches('PC1/s.out','PC2.a/i.in'));
  assert(model.reaches('PC1/h.out','SC1.mp/p.in'));
  assert(model.reaches('SC1.mp/s.out','S2.mp/charge.in'));
  for(const [a,b] of [['PC2.a/g.in','PC2.a/c.out'],['SC2/p.in','SC2/s.out'],['SC1.mp/p.in','SC1.mp/s.out']])
    assert(!model.reaches(a,b),`${a} must not mix with ${b}`);
});

test('S3 pairs are parallel supply branches and do not interrupt the direct return',()=>{
  for(const circuit of ['c','i']){
    const prefix=circuit==='c'?'C':'I';
    const branches=graph.runs.filter(run=>run[0]===`${prefix}.feed/p`);
    assert.equal(branches.length,2);
    assert(branches.every(run=>run.at(-1)===`${prefix}.supply/p`));
    assert(branches.some(run=>run.includes(`S3.${circuit}.a/in`)));
    assert(branches.some(run=>run.includes(`S3.${circuit}.b/in`)));
    assert(graph.runs.some(run=>run[0]===`${prefix}.return/p`&&run[1]===`PC2.a/${circuit}.in`));
  }
});

test('a mistaken pipe between different fluids is rejected',()=>{
  const broken=structuredClone(graph);
  broken.runs.push(['SC2/p.in','SC2/s.out']);
  assert.throws(()=>readTopology(broken),/Hydraulic mixing/);
});

test('all projections have continuous orthogonal port-to-port edges',()=>{
  for(const d of Object.values(createDiagrams(graph))){
    for(const edge of d.edges){
      const get=ref=>{
        const [id,port]=ref.split('.');
        const n=d.nodes.find(node=>node.id===id);
        return [n.x+n.ports[port].x,n.y+n.ports[port].y];
      };
      assert.deepEqual(edge.points[0],get(edge.from));
      assert.deepEqual(edge.points.at(-1),get(edge.to));
      for(let i=1;i<edge.points.length;i++){
        const a=edge.points[i-1],b=edge.points[i];
        assert(a[0]===b[0]||a[1]===b[1],`${d.id}/${edge.id} must stay orthogonal`);
      }
    }
  }
});

test('pressure vessels remain side branches rather than series devices',()=>{
  assert(graph.sideBranches.some(([a,b])=>a==='GW.filtered/p'&&b==='S4.a/p'));
  assert(graph.sideBranches.some(([a,b])=>a==='GW.filtered/p'&&b==='S4.b/p'));
  assert(!graph.runs.some(run=>run.some(port=>port.startsWith('S4.'))));
});

test('domestic draw-off is open while warm stairwell recirculation is distinct from cold mains',()=>{
  const model=readTopology(graph);
  assert.equal(Object.keys(graph.nodes).filter(id=>['P11.a','P11.b','P10'].includes(id)).length,3);
  assert(model.reaches('AQ/p','COLD.mp/p')&&model.reaches('AQ/p','COLD.bp/p'));
  for(const zone of ['mp','bp']){
    assert(model.reaches(`COLD.${zone}/p`,`TAP.${zone}/in`));
    assert(model.reaches(`S2.${zone}/hot`,`TAP.${zone}/in`));
    assert(!model.reaches(`TAP.${zone}/in`,`S2.${zone}/cold`));
    assert(!model.reaches(`COLD.tap.${zone}/in`,`S2.${zone}/cold`));
    assert(model.reaches(`DHW.${zone}/out`,`S2.${zone}/cold`));
    assert(model.reaches(`DHW.${zone}/out`,`MIX.${zone}/cold`));
    assert(!model.reaches(`PC1/h.out`,`TAP.${zone}/in`));
  }
  const copy=JSON.parse(readFileSync(new URL('../src/data/lesson-content.json',import.meta.url),'utf8')).it;
  const diagrams=createDiagrams(graph);
  for(const [id,acrEdge,afpEdge] of [['step2','s2-acr-mix','s2-afp-s2'],['step3','s3-acr-mix','s3-afp-s2']]){
    const svg=renderHydraulic(diagrams[id],copy,'winter',id);
    const acr=svg.match(new RegExp(`<path[^>]+data-edge="${acrEdge}"[^>]*>`))[0];
    const afp=svg.match(new RegExp(`<path[^>]+data-edge="${afpEdge}"[^>]*>`))[0];
    assert(acr.includes('data-temperature-from="warning"'),'Riser recirculation must be warm, never cold blue');
    assert(afp.includes('data-temperature-from="link"'),'Cold mains feed must be cool blue');
  }
});

test('season changes water temperature, preserving pipe routing and intermediate heat delivery',()=>{
  const copy=JSON.parse(readFileSync(new URL('../src/data/lesson-content.json',import.meta.url),'utf8')).en;
  for(const d of Object.values(createDiagrams(graph))){
    const edges=season=>[...renderHydraulic(d,copy,season).matchAll(/<path[^>]+data-edge="[^"]+"[^>]*>/g)].map(([tag])=>{
      const get=name=>tag.match(new RegExp(`${name}="([^"]+)"`))[1];
      assert.equal(get('data-temperature-from'),get('data-temperature-to'),'Pipe temperature changes belong inside heat-exchange components');
      return [get('data-from'),get('data-to'),get('d')];
    });
    assert.deepEqual(edges('winter'),edges('summer'));
    if(d.teaching){
      for(let i=0;i<4;i++)assert(d.edges.some(e=>e.from===`stage${i}.out`&&e.to===`stage${(i+1)%4}.in`));
    }
  }
});

test('all diagrams are strictly planar with zero pipe crossings and zero unrelated colinear overlaps',()=>{
  const diagrams=createDiagrams(graph);
  for(const d of Object.values(diagrams)){
    for(let i=0;i<d.edges.length;i++){
      for(let j=i+1;j<d.edges.length;j++){
        const e1=d.edges[i],e2=d.edges[j];
        const sharedManifold=(e1.from===e2.from||e1.to===e2.to)&&(e1.role===e2.role);
        for(let s1=1;s1<e1.points.length;s1++){
          const a=e1.points[s1-1],b=e1.points[s1];
          for(let s2=1;s2<e2.points.length;s2++){
            const c=e2.points[s2-1],q=e2.points[s2];
            const h1=a[1]===b[1],h2=c[1]===q[1];
            if(h1!==h2){
              const [ha,hb]=h1?[a,b]:[c,q],[va,vb]=h1?[c,q]:[a,b];
              const ix=va[0],iy=ha[1];
              const inH=ix>Math.min(ha[0],hb[0])+0.5&&ix<Math.max(ha[0],hb[0])-0.5;
              const inV=iy>Math.min(va[1],vb[1])+0.5&&iy<Math.max(va[1],vb[1])-0.5;
              assert(!(inH&&inV),`Avoidable pipe crossing in ${d.id}: ${e1.id} x ${e2.id} at (${ix},${iy})`);
            }else if(!sharedManifold){
              if(h1&&a[1]===c[1]){
                const overlap=Math.min(Math.max(a[0],b[0]),Math.max(c[0],q[0]))-Math.max(Math.min(a[0],b[0]),Math.min(c[0],q[0]));
                assert(overlap<=0.5,`Overlapping horizontal pipes in ${d.id}: ${e1.id} & ${e2.id}`);
              }
              if(!h1&&a[0]===c[0]){
                const overlap=Math.min(Math.max(a[1],b[1]),Math.max(c[1],q[1]))-Math.max(Math.min(a[1],b[1]),Math.min(c[1],q[1]));
                assert(overlap<=0.5,`Overlapping vertical pipes in ${d.id}: ${e1.id} & ${e2.id}`);
              }
            }
          }
        }
      }
    }
  }
});
