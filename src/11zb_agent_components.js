/* Adapted from hirazisora/JIZURA (MIT), 5874988dfcbaf93d15e355701841e954b51e9225. See THIRD_PARTY_NOTICES.md. */
/* Project-owned effect components. Portable JSON, composed through stock pipelines. */
(() => {
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),mediaGroups=[];
const groups=J.GROUP_KEYS.filter(g=>g!=='fx'),fallback={layout:'center',enter:'cut',hold:'still',exit:'cut',treat:'none',bg:'none',cam:'push',trans:'wipe'};
const registry=g=>mediaGroups.includes(g)?J.MEDIA_TECH:J.registry(g);
const motionKeys=['x','y','rotation','scale','sx','sy','opacity'];
let signature='',active=[];
J.customEffectSpec={format:'jizura-effect-components',version:1,groups,id:'custom_ followed by letters, numbers or underscores (max 80)',
  fields:['version','id','group','name','nameEn','tags','themes','base','params','labels','motion','program','layer'],
  params:'Standard JSON parameter defaults (numbers, booleans, strings, arrays, objects). program/motion may reference a numeric {param:"amount",default:1}, scaled by an optional mul ({param:"size",default:1,mul:.4}) so one parameter can resize a multi-part shape; labels maps parameter keys to {ja,en}.',
  targets:'Layer Studio lyric groups. Background media tracks belong to the host application.',
  base:'Existing stock ID in the same group. Reuse stock effects/parameters first; author only missing components. Custom IDs cannot be bases.',
  motion:{groups:['enter','hold','exit','treat','cam',...mediaGroups],fields:motionKeys,coordinates:'x/y fractions of target width/height; rotation degrees; scale/sx/sy/opacity multipliers',progress:'enter/exit: phase progress, hold: cut progress'},
  program:{groups:['layout','decor','bg','fx','trans',...mediaGroups],spec:J.drawingSpec,notes:'Layout text uses stock enter/hold/exit and treatment. Decor layer front/back. Media programs overlay the stock material. trans/fx keep stock rendering; programs add to it.'},
  workflow:['Read catalog and theme candidates','Use stock IDs for existing effects','Define only missing elements in their proper group','Validate/import components','Combine stock and custom IDs in a standard favorite payload','Preview entrance/hold/exit and refine','Save project or export favorites (definitions included)'],
  example:{version:1,id:'custom_pop_dots',group:'decor',name:'ポップのドット',nameEn:'Pop dots',tags:['pop'],layer:'front',params:{radius:.08},labels:{radius:{ja:'円の半径',en:'Circle radius'}},program:{version:1,mode:'overlay',nodes:[{type:'ellipse',x:.15,y:.2,w:{param:'radius'},h:{param:'radius'},fill:'accent',scale:{from:0,to:1,ease:'out'}}]}}};
J.validateCustomEffects=value=>{
  const fail=m=>{throw Error('Custom effects: '+m);};
  if(!Array.isArray(value)||value.length>128||JSON.stringify(value).length>2097152)fail('invalid list or size');
  const list=JSON.parse(JSON.stringify(value),(key,v)=>{if(['__proto__','prototype','constructor'].includes(key))fail('unsafe key');return v;}),ids=new Set();
  for(const d of list){
    if(!d||d.version!==1||!groups.includes(d.group)||typeof d.id!=='string'||!/^custom_[A-Za-z0-9_]{1,73}$/.test(d.id)||ids.has(d.id))fail('invalid version, group or duplicate ID');ids.add(d.id);
    if(Object.keys(d).some(k=>!J.customEffectSpec.fields.includes(k)))fail('unknown field');
    if(typeof d.name!=='string'||!d.name.trim()||d.name.length>200||d.nameEn!==undefined&&(typeof d.nameEn!=='string'||d.nameEn.length>200))fail('invalid name');
    for(const [key,table] of [['tags',J.MOODS],['themes',J.THEMES]])if(d[key]!==undefined&&(!Array.isArray(d[key])||d[key].some(k=>typeof k!=='string'||!Object.hasOwn(table,k))))fail('invalid '+key);
    if(!d.tags?.length&&!d.themes?.length)fail('tags or themes required for theme filtering');
    if(d.base!==undefined){const b=registry(d.group)[d.base];if(typeof d.base!=='string'||!Object.hasOwn(registry(d.group),d.base)||!b||b.custom||d.base.startsWith('custom_')||mediaGroups.includes(d.group)&&(d.group==='media'?!!b.stage:b.stage!==(d.group==='mediaEnter'?'enter':'exit')))fail('invalid stock base: '+d.group+'/'+d.base);}
    function parameter(v,depth=0){if(depth>4)return false;if(typeof v==='number')return Number.isFinite(v)&&Math.abs(v)<=10000;if(typeof v==='boolean')return true;if(typeof v==='string')return v.length<=2000;if(Array.isArray(v))return v.length<=64&&v.every(x=>parameter(x,depth+1));return !!v&&typeof v==='object'&&Object.keys(v).length<=40&&Object.entries(v).every(([k,x])=>/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)&&parameter(x,depth+1));}
    if(d.params!==undefined&&(!d.params||Array.isArray(d.params)||typeof d.params!=='object'||!parameter(d.params)))fail('invalid params');
    if(d.labels!==undefined&&(!d.labels||Array.isArray(d.labels)||Object.entries(d.labels).some(([k,v])=>!Object.hasOwn(d.params||{},k)||!v||Object.keys(v).some(k=>!['ja','en'].includes(k))||Object.values(v).some(s=>typeof s!=='string'||s.length>120))))fail('invalid labels');
    if(d.layer!==undefined&&(d.group!=='decor'||!['front','back'].includes(d.layer)))fail('invalid decoration layer');
    if(d.motion){if(!J.customEffectSpec.motion.groups.includes(d.group)||typeof d.motion!=='object'||Array.isArray(d.motion)||Object.keys(d.motion).some(k=>!motionKeys.includes(k)))fail('motion not supported by this group');for(const v of Object.values(d.motion))J.validateDrawing({version:1,mode:'overlay',nodes:[{type:'rect',x:v}]});}
    if(d.program){if(!J.customEffectSpec.program.groups.includes(d.group))fail('program not supported by this group');d.program=J.validateDrawing(d.program);if([...mediaGroups,'fx','trans'].includes(d.group)&&d.program.mode!=='overlay')fail('this group uses overlay programs');}
    if(d.group==='cam'&&d.motion?.opacity!==undefined)fail('camera opacity is not supported; use cut opacity');
    if(mediaGroups.includes(d.group)&&!d.base)fail('media requires a stock recipe base');
    if(['trans','fx'].includes(d.group)&&!d.base)fail('trans/fx require a stock base');
    if(!d.base&&!d.program&&!d.motion)fail('component must define base, program or motion');
  }
  return list;
};
function tracks(d,p,params,W,H){const v=(k,f)=>J.drawingValue(d.motion?.[k],p,params,f);return {x:v('x',0)*W,y:v('y',0)*H,rotation:v('rotation',0)*Math.PI/180,scale:v('scale',1),sx:v('sx',1),sy:v('sy',1),alpha:J.clamp(v('opacity',1))};}
// The lyric's text box at rest (after its entrance), measured once per cut and size by running the layout
// under an empty clip. Decorations in frame text/textX/textY follow it on both layers, so they keep their
// place when the font size, the text or the display area changes, without riding the entrance animation.
const restBoxes=new WeakMap();
J.restTextBox=env=>{
  const cut=env.cut;if(!cut||cut.effectsOnly||!cut.text)return null;
  let sizes=restBoxes.get(cut);if(!sizes)restBoxes.set(cut,sizes=new Map());
  const key=Math.round(env.W)+'x'+Math.round(env.H);if(sizes.has(key))return sizes.get(key);
  const L=J.LAYOUTS[cut.layout]||J.LAYOUTS.center,ctx=env.ctx,saved={lt:env.lt,ltb:env.ltb,pIn:env.pIn,pOut:env.pOut};
  const rest=Math.max(0,Math.min(cut.dur-(cut.outDur||0)-.01,Math.max((cut.inDur||0)+.35,cut.dur*.4)));
  let bb=null;sizes.set(key,null);   // guards re-entry from layouts that draw decor themselves
  ctx.save();
  try{ctx.beginPath();ctx.rect(0,0,0,0);ctx.clip();Object.assign(env,{lt:rest,ltb:rest,pIn:J.clamp(rest/Math.max(.01,cut.inDur)),pOut:0});bb=L.render(env);}
  catch(e){bb=null;}finally{ctx.restore();Object.assign(env,saved);}
  const box=bb&&bb.x1>bb.x0&&bb.y1>bb.y0?{x0:bb.x0,y0:bb.y0,x1:bb.x1,y1:bb.y1}:null;
  sizes.set(key,box);return box;
};
const usesText=program=>program.nodes.some(n=>n.frame&&n.frame!=='area');
function paint(d,env,params,source=null,progress=null,layout=false){
  if(!d.program)return null;
  const box=!layout&&usesText(d.program)?J.restTextBox(env):null;
  return J.drawProgram(env.ctx,d.program,{W:env.W,H:env.H,box,p:progress??J.clamp(env.lt/Math.max(.01,env.cut.dur)),text:env.cut.text||'',note:env.cut.note||'',sc:env.sc,source,params,font:params.font||env.st?.fonts?.display?.[0],uniformFont:env.st?.agentUniformFont,
    drawText:layout?it=>J.mainDraw(env,{...it,x:0,y:0,rot:0,track:0,lead:1.2}):null});
}
function install(d){
  const g=d.group,b=registry(g)[d.base??fallback[g]],defaults=d.params||{};
  if(mediaGroups.includes(g)){
    const stage=g==='mediaEnter'?'enter':g==='mediaExit'?'exit':null;
    J.MEDIA_TECH[d.id]={...b,name:J.layerText(d.name,d.nameEn||d.name),custom:true,customDefinition:d,...(stage?{group:stage,stage,motion:d.id,[stage]:d.id}:{})};return;
  }
  const def={...(b||{}),name:J.layerText(d.name,d.nameEn||d.name),custom:true,customDefinition:d,tags:d.tags||[],w:b?.w??1};
  delete def.extra;delete def.set;delete def.wa;delete def.special;
  if(['layout','bg','treat','cam','trans'].includes(g))def.plan=(...a)=>{const seed=a[0]?.state?.(),p={...(!d.program||d.program.mode==='overlay'?b?.plan?.(...a):{}),...defaults};if(g==='layout')p._motionPlan={version:1,layout:d.id,seed,fontRoles:clone(a[2].fonts)};return p;};
  if(['enter','hold','exit','treat'].includes(g))def.apply=(env,it,p,context)=>{
    const params={...defaults,...env.cut[g+'P']};
    b?.apply?.(env,it,g==='treat'?{...params,...p}:p,context);
    const progress=g==='hold'||g==='treat'?J.clamp(env.lt/Math.max(.01,env.cut.dur)):p;
    const v=tracks(d,progress,params,env.W,env.H);
    it.x+=v.x;it.y+=v.y;it.rot=(it.rot||0)+v.rotation/J.DEG;it.sx=(it.sx??1)*v.scale*v.sx;it.sy=(it.sy??1)*v.scale*v.sy;it.alpha=(it.alpha??1)*v.alpha;
  };
  if(g==='layout')def.fits=b?.fits||(()=>true);
  if(g==='layout')def.render=env=>{
    const params={...defaults,...env.cut.params};let bb;
    if(!d.program||d.program.mode==='overlay')bb=b?.render?.(env);
    const drawn=paint(d,env,params,null,null,true);
    if(!bb&&drawn)bb={...drawn,cx:(drawn.x0+drawn.x1)/2,cy:(drawn.y0+drawn.y1)/2,boxes:[]};
    return bb||{x0:0,y0:0,x1:env.W,y1:env.H,cx:env.W/2,cy:env.H/2};
  };
  if(g==='decor'){def.layer=d.layer||b?.layer||'front';def.detailFields=[...new Set([...(b&&(!d.program||d.program.mode==='overlay')?(J.decorDetailFields?.(d.base)||[]):[]),...Object.keys(defaults)])];def.draw=(env,bb,P)=>{const params={...defaults,...P};if(!d.program||d.program.mode==='overlay')b?.draw?.(env,bb,params);paint(d,env,params);};}
  if(g==='bg')def.draw=(env,P)=>{const params={...defaults,...P};if(!d.program||d.program.mode==='overlay')b?.draw?.(env,params);paint(d,env,params);};
  if(g==='cam')def.get=env=>{const params={...defaults,...env.cut.camP},v=tracks(d,J.clamp(env.lt/Math.max(.01,env.cut.dur)),params,env.W,env.H),base=b?.get?.(env,params)||{};return {...base,x:(base.x||0)+v.x,y:(base.y||0)+v.y,rot:(base.rot||0)+v.rotation/J.DEG,s:(base.s??1)*v.scale,sx:(base.sx??1)*v.sx,sy:(base.sy??1)*v.sy};};
  if(g==='trans')def.draw=(ctx,A,B,p,I)=>{b.draw(ctx,A,B,p,I);if(d.program){ctx.save();try{ctx.globalAlpha*=Math.sin(Math.PI*J.clamp(p));J.drawProgram(ctx,d.program,{W:ctx.canvas.width,H:ctx.canvas.height,p,source:B,params:{...defaults,...I.P}});}finally{ctx.restore();}}};
  if(g==='fx'){
    def.customBase=d.base;
    if(d.program)def.draw=(ctx,ev,p,I)=>{b?.draw?.(ctx,ev,p,I);ctx.save();try{J.drawProgram(ctx,d.program,{W:I.cw,H:I.ch,p,sc:I.sc,params:{...defaults,...ev.params}});}finally{ctx.restore();}};
  }
  J.register(g,d.id,def,'custom');
}
J.activateCustomEffects=project=>{
  const value=project?.customEffects||[],next=JSON.stringify(value);if(next===signature)return;
  const list=J.validateCustomEffects(value);
  for(const d of active){delete registry(d.group)[d.id];if(!mediaGroups.includes(d.group)){const order=J.order(d.group),i=order.indexOf(d.id);if(i>=0)order.splice(i,1);}}
  for(const d of list)install(d);active=list;signature=next;
};
J.withCustomEffects=(list,fn)=>{const old=clone(active);J.activateCustomEffects({customEffects:list});try{return fn();}finally{J.activateCustomEffects({customEffects:old});}};
const canonical=v=>JSON.stringify(v&&typeof v==='object'?(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))]))):v);
J.combineCustomEffects=(...lists)=>{
  const merged=[];
  for(const list of lists)for(const d of J.validateCustomEffects(list)){const same=merged.find(x=>x.id===d.id);if(same&&canonical(same)!==canonical(d))throw Error('Custom effect ID conflict: '+d.id);if(!same)merged.push(d);}
  return J.validateCustomEffects(merged);
};
J.importCustomEffects=(project,value)=>{
  const list=J.validateCustomEffects(value),merged=J.combineCustomEffects(project.customEffects||[],list);
  project.customEffects=J.validateCustomEffects(merged);J.activateCustomEffects(project);
  const themes=project.theme&&J.THEMES[project.theme]?[project.theme]:[],matches=d=>!themes.length||themes.some(key=>d.themes?.includes(key)||(d.tags||[]).some(t=>J.THEMES[key].moods.includes(t)));
  for(const d of list){if(mediaGroups.includes(d.group)){for(const layer of ['foreground','media']){const settings=project[layer].effects ||= {};settings.enabled ||= {};settings.enabled[d.id]??=matches(d);}}else{project.enabled ||= {};project.enabled[d.group] ||= {};project.enabled[d.group][d.id]??=matches(d);}}
  return clone(list);
};
J.customEffectDependencies=value=>{const ids=new Set();const visit=v=>{if(typeof v==='string')ids.add(v);else if(v&&typeof v==='object')Object.values(v).forEach(visit);};visit(value);return clone(active.filter(d=>ids.has(d.id)));};
const plan=J.plan;
J.plan=(project,...args)=>{J.activateCustomEffects(project);const out=plan(project,...args);out.customEffects=clone(active);return out;};
const omakase=J.omakase;
J.omakase=(project,...args)=>{J.activateCustomEffects(project);return omakase(project,...args);};
})();
