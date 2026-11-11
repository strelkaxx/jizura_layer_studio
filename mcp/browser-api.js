/* Injected only into the local MCP browser, never into the public HTML. */
(() => {
'use strict';
const S=J.ui,A=J.uiApi,clone=x=>JSON.parse(JSON.stringify(x));
let revision=0,signature='',review=null,history=[],inspected=new Set(),abort=null;
const motions=[];
function current(){const now=JSON.stringify(S.project);if(now!==signature){signature=now;revision++;review=null;inspected.clear();}return revision;}
function state({offset=0,limit=50,includeProject=true}={}){
  current();return {revision,engine:'cityedge-layer-studio',...(includeProject?{project:clone(S.project)}:{}),
    duration:S.plan.duration,cutCount:S.plan.cuts.length,cueCount:S.plan.lines.length,
    cuts:S.plan.cuts.slice(offset,offset+limit).map(c=>({index:c.index,line:c.line,text:c.text,start:c.start,end:c.end,layout:c.layout,enter:c.enter,hold:c.hold,exit:c.exit,treat:c.treat,bg:c.bg,cam:c.cam,decor:c.decor,drawing:c.drawing||null})),
    audio:S.audio?{name:S.project.audioName,duration:S.audio.duration,bpm:S.audio.bpm}:null,
    background:J.layerSession.background?{name:J.layerSession.background.name,video:J.layerSession.background.video}:null};
}
function replace(project){const next=J.agentJSON(project,8388608);try{J.registerProjectFonts(next.userFonts);J.plan(next,A.audioLike());}catch(e){J.registerProjectFonts(S.project.userFonts);J.activateCustomEffects(S.project);throw e;}history.push(clone(S.project));if(history.length>30)history.shift();A.importAgentProject(next);current();return state();}
function mutate(fn){const draft=clone(S.project);fn(draft);return replace(draft);}
const getCut=index=>J.agentCutTarget(S.plan,index).cut;
function validateCues(p){if(p.subtitleCues)p.subtitleCues=J.validateCues(p.subtitleCues);}
function catalog(){J.activateCustomEffects(S.project);return {engine:'cityedge-layer-studio',defaults:J.defaultProject(),themes:clone(J.THEMES),
  groups:Object.fromEntries(J.GROUP_KEYS.map(g=>[g,J.order(g).map(id=>({id,name:J.registry(g)[id].name,custom:!!J.registry(g)[id].custom,set:J.setOf(g,id),extra2:!!J.registry(g)[id].x2}))])),
  fonts:Object.fromEntries(Object.entries(J.FONTS).map(([key,f])=>[key,{label:f.label,weight:f.weight}])),favorite:J.agentFavorites.spec(),
  limitations:['Lyric cuts use resolved zero-based cut indices; cue_edit/cue_randomize use subtitle indices.',
    'No foreground/background media timelines from ONE STOP EDITION; use the single Layer Studio background asset.',
    'Favorite JSON is Layer Studio format, not the binary .jizuraichifav container.']};}
function audit(){const errors=[],warnings=[];for(const c of S.plan.cuts){if(!(c.end>c.start))errors.push('Invalid duration at cut '+c.index);if(!J.LAYOUTS[c.layout])errors.push('Unknown layout at cut '+c.index);}
  if(!S.plan.cuts.length)errors.push('No lyric cuts');if(S.plan.cuts.some(c=>c.drawing))warnings.push('Custom drawings need visual review.');return {revision:current(),errors,warnings};}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function preview({time=0,width=640}={}){
  if(!Number.isFinite(time)||time<0||time>=S.plan.duration)throw Error('Preview time is outside the timeline');
  const r=current(),height=Math.round(width*S.plan.H/S.plan.W);await J.ensureFonts(S.project.lyrics,J.fontsOfPlan(S.plan));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  if(J.layerSession.background?.video)await J.seekLayerMedia(J.layerSession.background,time);
  J.drawLayerPreview(canvas.getContext('2d'),S.plan,time,{fast:true,simpleSettingsPreview:true});inspected.add(r);
  return {data:canvas.toDataURL('image/png').split(',')[1],width,height,time,revision:r};
}
window.JizuraMCP={
  new(){A.pause();J.resetLayerProjectSession();S.audio=null;A.importAgentProject({...J.defaultProject(),agentCleanTypography:true,agentUniformFont:'gothic_bold'});history=[];motions.length=0;signature='';return state();},
  state,catalog,audit,preview,
  edit({changes}){return mutate(p=>{for(const change of changes){const route=change.path;if(!Array.isArray(route)||!route.length||route.length>16)throw Error('Invalid JSON path');let obj=p;
    for(const part of route){if(typeof part!=='string'&&(!Number.isInteger(part)||part<0))throw Error('Invalid path segment');if(['__proto__','prototype','constructor'].includes(part))throw Error('Unsafe path');}
    for(const part of route.slice(0,-1)){if(!obj[part]||typeof obj[part]!=='object')throw Error('Path does not exist: '+part);obj=obj[part];}obj[route.at(-1)]=clone(change.value);}
    validateCues(p);});},
  theme({theme}){if(theme&&!J.normalizeTheme(theme,S.project))throw Error('Unknown theme');return mutate(p=>{p.theme=theme;});},
  generate({seed}){return mutate(p=>{Object.assign(p,J.omakase(p,J.rng(seed)));p.seed=seed;p.agentEffects={};});},
  fontSet({font}){if(!Object.hasOwn(J.FONTS,font))throw Error('Unknown font');return mutate(p=>{p.agentUniformFont=font;p.fonts={display:font,serif:font,body:font,mono:font};});},
  cueEdit({index,text,start,end}){return mutate(p=>{if(!Array.isArray(p.subtitleCues))throw Error('Import SRT or set subtitleCues first');const patch={};if(text!==undefined)patch.text=text;if(start!==undefined)patch.start=start;if(end!==undefined)patch.end=end;J.editLayerCue(p,index,patch);});},
  cueRandomize({index,mode='motion'}){const next=J.prepareCueReroll(S.project,S.plan,index,A.audioLike(),mode);if(!['color','font'].includes(mode)&&next.agentEffects)delete next.agentEffects[next.subtitleCues?.[index]?.id||'line-'+index];return replace(next);},
  cutUpdate({index,details}){const before=J.captureAgentFavorite(S.project,S.plan,index);before.details={...before.details,...details};return replace(J.applyAgentFavorite(S.project,S.plan,index,before));},
  undo(){if(!history.length)throw Error('No MCP edit to undo');A.importAgentProject(history.pop());current();return state();},
  favoriteSpec:()=>J.agentFavorites.spec(),
  favoriteList:()=>J.agentFavorites.list(S.project),
  favoriteValidate:({payload})=>J.validateAgentFavorite(payload),
  favoriteSave({name,id,payload,index}){let favorite;mutate(p=>{favorite=J.agentFavorites.save(p,{name,id,payload,plan:S.plan,index});});return {favorite,revision};},
  favoriteDelete({id}){return mutate(p=>J.agentFavorites.remove(p,id));},
  favoriteApply({id,index}){return replace(J.agentFavorites.apply(S.project,S.plan,index,id));},
  favoritePreview:args=>J.agentFavorites.preview({...args,project:S.project}),
  customEffectSpec:()=>J.customEffectSpec,
  customEffectList:()=>clone(S.project.customEffects||[]),
  customEffectValidate:({components})=>J.validateCustomEffects(components),
  customEffectImport({components}){return mutate(p=>J.importCustomEffects(p,components));},
  customEffectPreview({id,index,time,width}){const component=(S.project.customEffects||[]).find(x=>x.id===id);if(!component)throw Error('Custom effect not found');
    const g=component.group;if(g==='fx')throw Error('FX components are previewed in a generated cut');
    const details=g==='decor'?{decor:[{id,...component.params}]}:{[g]:id};
    return J.agentFavorites.preview({project:S.project,index,time,width,payload:{format:'jizura-cut-effects',version:1,kind:'lyrics',native:{},details,components:[component]}});},
  motionList:()=>clone(motions),
  motionSave({index,name}){if(typeof name!=='string'||!name.trim())throw Error('Name required');const recipe=J.captureMotionRecipe(S.project,S.plan,index),entry={id:crypto.randomUUID(),name:name.trim(),recipe};motions.push(entry);return clone(entry);},
  motionApply({id,index}){const m=motions.find(x=>x.id===id);if(!m)throw Error('Motion not found');return replace(J.prepareMotionApply(S.project,S.plan,index,m.recipe,A.audioLike()));},
  async import({url,name,kind,mode='append'}){
    const response=await fetch(url);if(!response.ok)throw Error('Could not read the local input');const data=await response.blob();
    if(kind==='audio'){const file=new File([data],name,{type:data.type||'audio/wav'});if(!await A.loadAudioFile(file))throw Error('Audio decode failed');current();return state();}
    if(kind==='background'){const media=await J.loadLayerMedia(new File([data],name,{type:data.type}));J.layerSession.background?.dispose();J.layerSession.background=media;J.syncLayerUI();current();revision++;review=null;inspected.clear();return state();}
    const raw=JSON.parse(await data.text());
    if(kind==='project'||kind==='settings'){const draft=Object.assign(J.defaultProject(),J.agentJSON(raw,8388608));if(raw.motionRecipeVersion!==1)draft.motionRecipeVersion=0;validateCues(draft);return replace(draft);}
    if(kind==='srt')throw Error('SRT is text, not JSON');
    if(kind==='favorites')return replace(J.agentFavorites.import(S.project,raw,mode));
    if(kind==='motions'){const items=J.parseMotionLibrary(raw);if(mode==='replace')motions.length=0;for(const item of items){if(motions.some(x=>x.id===item.id&&JSON.stringify(x)!==JSON.stringify(item)))item.id=crypto.randomUUID();if(!motions.some(x=>x.id===item.id))motions.push(item);}return clone(motions);}
    throw Error('Unsupported asset kind');
  },
  importSrt({text}){const cues=J.parseSRT(text);return mutate(p=>{p.subtitleCues=cues;p.lyrics=cues.map(c=>c.text).join('\n\n');p.overrides={};p.localLooks=null;p.agentEffects={};p.timing.lineTimes={};});},
  async audioPreview({start=0,duration=5}){if(!S.audio?.buffer)throw Error('No audio imported');if(start>=S.audio.duration)throw Error('Audio start is outside the track');duration=Math.min(duration,S.audio.duration-start);const blob=J.audioWav(S.audio.buffer,duration,start);const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return {data:btoa(binary),start,duration};},
  audioAnalysis({start=0,duration=30}){if(!S.audio)throw Error('No audio imported');const end=start+duration;return {start,end,beats:S.audio.beats.filter(t=>t>=start&&t<end),bpm:S.audio.bpm};},
  approve({revision:expected,note}){const r=current(),a=audit();if(expected!==r||!inspected.has(r))throw Error('Inspect current preview frames before recording review');if(a.errors.length)throw Error(a.errors.join('; '));review={revision:r,note};return clone(review);},
  async output({kind}){
    current();if(['project','settings','favorites','motions'].includes(kind)){
      const data=kind==='favorites'?J.agentFavorites.export(S.project):kind==='motions'?{format:'jizura-motion-library',version:1,items:clone(motions)}:clone(S.project);
      download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'output.json');return {format:kind};
    }
    if(!review||review.revision!==revision)throw Error('Inspect and quality_approve the current revision before video export');
    abort=new AbortController();const p=clone(S.project);p.simpleExport=J.normalizeSimpleExport({...p.simpleExport,duration:p.simpleExport?.duration||Math.max(S.plan.duration,S.audio?.duration||0)});
    const onProgress=(value,message)=>window.mcpProgress?.({value,message});let output;
    try{
      const missing=J.missingUserFonts(J.fontsOfPlan(S.plan));if(missing.length)throw Error('Install a PC font instead of legacy uploaded fonts: '+missing.join(', '));
      await J.ensureFonts(p.lyrics,J.fontsOfPlan(S.plan));
      if(kind==='front')output=await J.exportLayerFront({plan:S.plan,project:p,signal:abort.signal,onProgress});
      else if(kind==='mp4')output=await J.exportSimpleVideo({plan:S.plan,project:p,background:J.layerSession.background,audio:S.audio,signal:abort.signal,onProgress});
      else throw Error('Unsupported export kind');
      download(output.files[0].blob,'output.mp4');return {audio:!!output.audio,duration:output.duration||output.manifest?.duration,width:J.outputSize(p)[0],height:J.outputSize(p)[1]};
    }finally{abort=null;}
  },
  cancel(){abort?.abort();return {cancelled:true};},
};
// SRT import must preserve the subtitle text exactly and uses a strict UTF-8 decoder.
const importFile=window.JizuraMCP.import;
window.JizuraMCP.import=async args=>{
  if(args.kind!=='srt')return importFile(args);
  const response=await fetch(args.url);if(!response.ok)throw Error('Could not read SRT');
  return window.JizuraMCP.importSrt({text:new TextDecoder('utf-8',{fatal:true}).decode(await response.arrayBuffer())});
};
})();
