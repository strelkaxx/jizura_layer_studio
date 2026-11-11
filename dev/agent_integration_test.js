const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context={window:{},console,document:{documentElement:{lang:'ja'},createElement:()=>({getContext:()=>({measureText:t=>({width:String(t).length*20})})})}};
vm.createContext(context);for(const file of fs.readdirSync(path.join(__dirname,'../src')).filter(f=>f.endsWith('.js')&&f<'12').sort())vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),context,{filename:file});
const J=context.window.J,clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){const p=J.defaultProject();p.subtitleCues=[{id:'first',start:0,end:3,text:'朝の光が輝く'},{id:'filler',start:3,end:5,text:'間奏',filler:true},{id:'last',start:5,end:8,text:'夜の星が輝く'}];p.lyrics=p.subtitleCues.map(c=>c.text).join('\n\n');return p;}
const payload={format:'jizura-cut-effects',version:1,kind:'lyrics',native:{},details:{layout:'center',enter:'cut',exit:'cut',decor:[],drawing:{version:1,mode:'replace',nodes:[{type:'text',text:'$text',x:.5,y:.5,size:.2,fill:'fg'}]}}};
test('favorite changes the intended cue through filler subplans and retains source data',()=>{
 const p=fixture(),plan=J.plan(p),index=plan.cuts.findIndex(c=>c.line===2);const before=JSON.stringify(p),next=J.applyAgentFavorite(p,plan,index,payload),out=J.plan(next);
 assert.equal(JSON.stringify(p),before);assert.ok(out.cuts.filter(c=>c.line===2).some(c=>c.drawing));assert.ok(out.cuts.filter(c=>c.line!==2).every(c=>!c.drawing));
 const group=out.layerGroups.find(g=>g.indices.includes(2)),local=group.indices.indexOf(2);assert.ok(group.plan.cuts.filter(c=>c.line===local).some(c=>c.drawing));
 assert.deepEqual(clone(J.plan(clone(next)).cuts),clone(out.cuts));
});
test('clean profile excludes stock wave/motifs even when manually locked; native mode is reversible',()=>{
 for(const key of ['wave','vinyl','bubble','ticket','stack','ring','knPathRide']){
 const p=fixture();p.extra=true;p.overrides={0:{layout:key}};p.agentCleanTypography=true;const before=JSON.stringify(p),out=J.plan(p);
 assert.ok(out.cuts.every(c=>J.agentTypographyAllowed('layout',c.layout)));assert.ok(out.cuts.every(c=>!c.decor.length));assert.equal(JSON.stringify(p),before);
 p.agentCleanTypography=false;assert.ok(J.plan(p).cuts.some(c=>c.line===0&&c.layout===key));}
});
test('custom decorations survive the clean profile and components persist with favorites',()=>{
 const p=fixture();p.agentCleanTypography=true;const component=clone(J.customEffectSpec.example);J.importCustomEffects(p,[component]);
 const custom={...clone(payload),details:{decor:[{id:component.id,radius:.1}]},components:[component]};const plan=J.plan(p),index=plan.cuts.findIndex(c=>c.line===0);const next=J.applyAgentFavorite(p,plan,index,custom),out=J.plan(next);
 assert.ok(out.cuts[index].decor.some(d=>d.id===component.id));J.agentFavorites.save(next,{name:'custom',payload:custom});const imported=J.agentFavorites.import(J.defaultProject(),J.agentFavorites.export(next),'replace');assert.equal(imported.effectFavorites.length,1);assert.equal(imported.customEffects.length,1);
});
test('failed payloads and conflicting custom definitions do not alter project data',()=>{
 const p=fixture(),before=JSON.stringify(p);const bad=clone(payload);bad.details.layout='does_not_exist';assert.throws(()=>J.agentFavorites.save(p,{name:'bad',payload:bad}));assert.equal(JSON.stringify(p),before);
 const invalid=JSON.parse('{"format":"jizura-cut-effects","version":1,"kind":"lyrics","details":{"__proto__":{}}}');assert.throws(()=>J.validateAgentFavorite(invalid),/Unsafe/);
 const a=clone(J.customEffectSpec.example);J.importCustomEffects(p,[a]);const b=clone(a);b.name='different';assert.throws(()=>J.importCustomEffects(p,[b]),/conflict/);
});
test('single font policy applies through native saved cuts and generation',()=>{
 const p=fixture();p.agentUniformFont='mincho_bold';const next=Object.assign(p,J.omakase(p,J.rng(12))),plan=J.plan(next);assert.ok(Object.values(plan.style.fonts).every(a=>a.length===1&&a[0]==='mincho_bold'));
 assert.ok(plan.cuts.every(c=>c.renderLook.style.agentUniformFont==='mincho_bold'&&!c.weightGrow));
});

test('favorite JSON transfers installed font references without storing font binaries',()=>{
 const p=fixture();p.userFonts=[{key:'local_Test',label:'Meiryo',family:'Meiryo',weight:400}];J.registerProjectFonts(p.userFonts);p.fonts={display:'local_Test',serif:'local_Test',body:'local_Test'};
 const captured=J.captureAgentFavorite(p,J.plan(p),0);J.agentFavorites.save(p,{name:'PC font',payload:captured});const exported=J.agentFavorites.export(p);
 J.registerProjectFonts([]);const next=J.agentFavorites.import(J.defaultProject(),exported,'replace');assert.equal(next.userFonts[0].family,'Meiryo');assert.equal(next.effectFavorites[0].payload.fonts.display,'local_Test');assert.ok(!J.FONTS.local_Test,'import validation restores the active font registry');
});
