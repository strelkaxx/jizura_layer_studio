const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context={window:{},console,document:{documentElement:{lang:'ja'},createElement:()=>({getContext:()=>({measureText:t=>({width:String(t).length*20})})})}};
vm.createContext(context);for(const file of fs.readdirSync(path.join(__dirname,'../src')).filter(f=>f.endsWith('.js')&&f<'12').sort())vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),context,{filename:file});
const J=context.window.J,clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){const p=J.defaultProject();p.subtitleCues=[{id:'first',start:0,end:3,text:'朝の光が輝く'},{id:'filler',start:3,end:5,text:'間奏',filler:true},{id:'last',start:5,end:8,text:'夜の星が輝く'}];p.lyrics=p.subtitleCues.map(c=>c.text).join('\n\n');return p;}
const payload={format:'jizura-cut-effects',version:1,kind:'lyrics',native:{},details:{layout:'center',enter:'cut',exit:'cut',decor:[],drawing:{version:1,mode:'replace',nodes:[{type:'text',text:'$text',x:.5,y:.5,size:.2,fill:'fg'}]}}};

test('all 855 upstream extra2 parts register and obey both inclusion switches',()=>{
 const expected={layout:180,enter:126,hold:50,exit:112,decor:130,treat:60,bg:64,cam:35,fx:69,trans:29};
 for(const [g,count] of Object.entries(expected)){
  const ids=J.order(g).filter(k=>J.registry(g)[k].x2);assert.equal(ids.length,count,g);
  for(const id of ids){const d=J.registry(g)[id],p={extra:true,extra2:true,typo:true,kinetic:true,horror:true,wa:true};
   assert.ok(J.randomOk(p,g,id),g+'.'+id);assert.equal(J.randomOk({...p,extra2:false},g,id),false);
   if(d.set!=='extra2')assert.equal(J.randomOk({...p,[d.set]:false},g,id),false);
   if(d.wa)assert.equal(J.randomOk({...p,wa:false},g,id),false);
  }
 }
 const p=fixture();assert.equal(J.setOn(p,'extra2'),false);const base=J.localLookContext(p);
 p.extra2=true;assert.notEqual(J.localLookContext(p),base);assert.equal(J.cueAppearanceRule(p,J.resolveStyle(p)).extra2,true);
 assert.equal(J.themeDrawSwitches(p).extra2,true);
 p.agentCleanTypography=true;p.overrides={0:{layout:J.order('layout').find(k=>J.LAYOUTS[k].x2)}};
 assert.ok(J.plan(p).cuts.every(c=>J.agentTypographyAllowed('layout',c.layout)));
});

test('extra2 participates in auto-compose and old projects exclude it',()=>{
 const hasNew=plan=>plan.cuts.some(c=>['layout','enter','hold','exit','treat','bg','cam','trans'].some(g=>c[g]&&J.registry(g)[c[g]]?.x2)||(c.decor||[]).some(d=>J.DECOR[d.id]?.x2))||plan.events.some(e=>J.FXE[e.type]?.x2);
 let selected=false;
 for(let seed=1;seed<=8;seed++)for(const extra2 of [false,true]){
  const p=Object.assign(fixture(),{extra:true,extra2,horror:true,wa:true});Object.assign(p,J.omakase(p,J.rng(seed)));const plan=J.plan(p);
  if(extra2)selected ||= hasNew(plan);else assert.equal(hasNew(plan),false);
 }
 assert.ok(selected,'auto-compose chooses the new parts');
});
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
