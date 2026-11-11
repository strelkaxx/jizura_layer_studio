import {Runtime} from './runtime.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';
process.env.JIZURA_OFFLINE='1';
const out=await mkdtemp(path.join(os.tmpdir(),'jizura-extra2-'));
process.env.JIZURA_OUTPUT_DIR=out;
const runtime=new Runtime();
try{
 await runtime.start();const {session}=await runtime.create(),page=runtime.get(session).page,errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const result=await page.evaluate(async()=>{
  const problems=[],counts={},renderer=new J.Renderer(),cv=document.createElement('canvas'),ctx=cv.getContext('2d');
  const warn=console.warn,error=console.error;let current='',frames=0;
  console.warn=(...v)=>problems.push(current+': '+v.map(String).join(' '));console.error=console.warn;
  try{
   for(const g of J.GROUP_KEYS){const ids=J.order(g).filter(k=>J.registry(g)[k].x2);counts[g]=ids.length;
    for(const id of ids)for(const aspect of ['16:9','9:16']){
     current=g+'.'+id+' '+aspect;
     try{
      const p={...J.defaultProject(),aspect,extra2:true,extra:true,wa:true,horror:true,agentUniformFont:'gothic_bold'};
      const plan=J.previewPlan(p,g,id);cv.width=Math.round(plan.W*.12);cv.height=Math.round(plan.H*.12);
      const times=g==='fx'?[.05,.09,.13]:g==='trans'?[1.22,1.3,1.42]:[.08,1.1,2.32];
      for(const time of times){renderer.frame(ctx,plan,time,{scale:.12});frames++;}
     }catch(e){problems.push(current+': '+e.stack);}
    }
    await new Promise(r=>requestAnimationFrame(r));
   }
  }finally{console.warn=warn;console.error=error;}
  return {counts,frames,problems};
 });
 await writeFile(path.join(out,'report.json'),JSON.stringify(result,null,2));
 assert.equal(Object.values(result.counts).reduce((a,b)=>a+b,0),855);assert.deepEqual(result.problems,[]);assert.deepEqual(errors,[]);
 // Exercise the actual native switches, regeneration and persistence in the editor.
 await page.locator('#agentCleanTypography').uncheck();
 await page.locator('#modeEasy').click();
 await page.locator('.extra2-toggle').first().check();
 assert.equal(await page.evaluate(()=>J.ui.project.extra2),true);
 assert.ok((await runtime.call(session,'catalog',{})).groups.layout.some(d=>d.extra2));
 await page.evaluate(()=>{const p=structuredClone(J.ui.project);p.lyrics='新しい演出を試す';p.overrides={0:{single:true,layout:J.LAYOUT_ORDER.find(k=>J.LAYOUTS[k].x2)}};p.res=480;p.fps=15;p.simpleExport.duration=.8;J.uiApi.importAgentProject(p);});
 assert.ok(await page.evaluate(()=>J.ui.plan.cuts.some(c=>J.LAYOUTS[c.layout].x2)));
 await page.screenshot({path:path.join(out,'extra2-editor.png'),fullPage:true});
 await runtime.call(session,'preview',{time:.2,width:320});
 const state=await runtime.call(session,'state',{});
 await runtime.call(session,'approve',{revision:state.revision,note:'Real upstream extra2 raster inspected in the render smoke test.'});
 const job=await runtime.export(session,{kind:'mp4',filename:'extra2.mp4'});
 while(runtime.jobs.get(job.id).status==='running')await new Promise(r=>setTimeout(r,100));
 assert.equal(runtime.jobs.get(job.id).status,'completed',JSON.stringify(runtime.jobs.get(job.id)));
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',runtime.jobs.get(job.id).path],{encoding:'utf8'}));
 assert.ok(probe.streams.some(s=>s.codec_name==='h264'));
 await page.goto(new URL('../en/index.html',import.meta.url).href);
 await page.waitForFunction(()=>window.J?.uiApi);
 assert.equal(await page.evaluate(()=>J.LAYOUT_ORDER.filter(k=>J.LAYOUTS[k].x2).length),180);
 assert.ok(await page.evaluate(()=>J.LAYOUT_ORDER.filter(k=>J.LAYOUTS[k].x2).every(k=>J.LAYOUTS[k].name===J.LAYOUTS[k].en)));
 await page.locator('#modeEasy').click();
 assert.ok((await page.locator('.extra2-toggle').first().locator('..').innerText()).includes('Include extra parts 2'));
 await page.locator('.extra2-toggle').first().check();
 assert.equal(await page.evaluate(()=>J.ui.project.extra2),true);
 console.log('PASS: all 855 parts, '+result.frames+' real browser frames, native extra2 switch, MCP catalog and manual layout.\nArtifacts: '+out);
}finally{await runtime.close();}
