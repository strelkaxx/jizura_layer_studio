/* Layer Studio agent favorites: portable JSON and ordinary editor projects. */
(() => {
'use strict';
const clone = x => JSON.parse(JSON.stringify(x));
const own = (o,k) => !!o && Object.hasOwn(o,k);
J.agentJSON = (value, max = 2097152) => {
  const raw = JSON.stringify(value);
  if (!raw || raw.length > max) throw Error('JSON exceeds the supported size');
  const visit = (x, depth = 0) => {
    if (depth > 24) throw Error('JSON nesting is too deep');
    if (typeof x === 'number' && !Number.isFinite(x)) throw Error('Non-finite number');
    if (x && typeof x === 'object') for (const [k,v] of Object.entries(x)) {
      if (['__proto__','prototype','constructor'].includes(k)) throw Error('Unsafe JSON key');
      visit(v,depth+1);
    }
  };
  visit(value); return clone(value);
};
const detailKeys = ['layout','enter','hold','exit','treat','bg','cam','trans','params','enterP','holdP','exitP','treatP','bgP','camP','transP','decor','drawing'];
J.agentFavoriteSpec = {
  format:'jizura-cut-effects',version:1,kinds:['lyrics'],detailKeys,
  portableFormat:'jizura-layer-favorites', portableExtension:'.jizura-layer-favorites.json',
  notes:['Lyrics only: Layer Studio has a single background asset, not ONE STOP EDITION media tracks.',
    'The JSON payload supports stock lyric slots and custom components. Binary .jizuraichifav containers are not supported.',
    'Use motion_* for a whole subtitle recipe. favorite_* captures or authors the appearance of one generated cut.'],
  example:{format:'jizura-cut-effects',version:1,kind:'lyrics',native:{},details:{layout:'center',enter:'pop',hold:'still',exit:'shrink',decor:[]}},
};
J.validateAgentFavorite = payload => {
  const p = J.agentJSON(payload);
  if (p.format !== 'jizura-cut-effects' || p.version !== 1 || p.kind !== 'lyrics') throw Error('Expected lyric jizura-cut-effects version 1');
  if (p.native && Object.keys(p.native).length) throw Error('Native media fields are not supported');
  if (Object.keys(p).some(k=>!['format','version','kind','native','details','components','fonts'].includes(k))) throw Error('Unknown favorite field');
  if (!p.details || Array.isArray(p.details) || typeof p.details !== 'object') throw Error('Favorite details required');
  if (Object.keys(p.details).some(k=>!detailKeys.includes(k))) throw Error('Unsupported detail field');
  const components = J.validateCustomEffects(p.components || []);
  J.withCustomEffects(components, () => {
    for (const [g,k] of Object.entries(p.details)) {
      if (J.GROUP_KEYS.includes(g) && g !== 'decor' && !(g==='trans' && (k===null||k==='none')) && (typeof k !== 'string' || !own(J.registry(g),k))) throw Error('Unknown '+g+' ID: '+k);
      if (/P$/.test(g) || g==='params') if (!k || Array.isArray(k) || typeof k !== 'object') throw Error('Parameters must be objects');
    }
    if (p.details.decor && (!Array.isArray(p.details.decor) || p.details.decor.length>16 || p.details.decor.some(d=>!d||!own(J.DECOR,d.id)))) throw Error('Invalid decoration');
  });
  if (p.details.drawing) p.details.drawing = J.validateDrawing(p.details.drawing);
  if (p.fonts && (Array.isArray(p.fonts)||typeof p.fonts!=='object'||Object.entries(p.fonts).some(([r,k])=>!['display','serif','body','mono'].includes(r)||!own(J.FONTS,k)))) throw Error('Invalid font role');
  p.native = {}; p.components = components;
  return p;
};
const cueKey = (project,line) => project.subtitleCues?.[line]?.id || 'line-'+line;
J.agentCutTarget = (plan,index) => {
  if (!Number.isInteger(index)||index<0) throw Error('Invalid cut index');
  const cut=plan.cuts[index];
  if (!cut || cut.line<0 || cut.utext==null) throw Error('Lyric cut not found');
  return {cut,slot:plan.cuts.filter(c=>c.line===cut.line&&c.utext!=null).indexOf(cut)};
};
J.captureAgentFavorite = (project,plan,index) => {
  const {cut}=J.agentCutTarget(plan,index), details={};
  for (const k of detailKeys) if (cut[k]!==undefined) details[k]=clone(cut[k]);
  delete details.params?._motionPlan;
  const style=cut.renderLook?.style||plan.style;
  return J.validateAgentFavorite({format:'jizura-cut-effects',version:1,kind:'lyrics',native:{},details,
    components:J.customEffectDependencies(details),fonts:Object.fromEntries(Object.entries(style.fonts).map(([r,a])=>[r,a[0]]))});
};
J.applyAgentFavorite = (project,plan,index,payload) => {
  const valid=J.validateAgentFavorite(payload),{cut,slot}=J.agentCutTarget(plan,index);
  if (project.overrides?.[cut.line]?.lock) throw Error('Unlock this subtitle before applying effects');
  const next=clone(project);
  J.importCustomEffects(next,valid.components);
  next.agentEffects ||= {}; const key=cueKey(next,cut.line);
  next.agentEffects[key] ||= {}; next.agentEffects[key][slot]=valid;
  return next;
};
const resolveStyle=J.resolveStyle;
J.resolveStyle=project=>{const st=resolveStyle(project),font=project.agentUniformFont;if(font&&own(J.FONTS,font)){st.agentUniformFont=font;for(const role of Object.keys(st.fonts))st.fonts[role]=[font];}return st;};
const originalPlan=J.plan;
J.plan=(project,...args)=>{
  const result=originalPlan(project,...args), seen=new WeakSet();
  function apply(plan,lineMap=null) {
    if (!plan || seen.has(plan)) return; seen.add(plan);
    const counts=new Map();
    for (const cut of plan.cuts || []) {
      if (cut.line<0||cut.utext==null) continue;
      const slot=counts.get(cut.line)||0;counts.set(cut.line,slot+1);
      const raw=project.agentEffects?.[cueKey(project,lineMap?lineMap[cut.line]:cut.line)]?.[slot];
      if (!raw) continue;
      const {details,fonts}=J.validateAgentFavorite(raw);
      if (details.layout && details.layout!==cut.layout) {
        cut.layout=details.layout;
        cut.params=J.LAYOUTS[cut.layout].plan(J.rng(cut.seed),{text:cut.text,n:J.glyphCount(cut.text),W:cut.zone?.w||plan.W,H:cut.zone?.h||plan.H,dur:cut.dur},cut.renderLook?.style||plan.style);
      }
      for (const [k,v] of Object.entries(details)) {
        if (k==='params' && !details.layout) cut.params={...cut.params,...clone(v)};
        else cut[k]=clone(v);
      }
      if (cut.trans==='none') cut.trans=null;
      delete cut.morph;delete cut.weightGrow;
      if (fonts) {
        cut.renderLook=clone(cut.renderLook||{style:plan.style,styleKey:plan.styleKey,fx:plan.fx,hud:plan.hud});
        for (const [role,key] of Object.entries(fonts)) cut.renderLook.style.fonts[role]=[key];
      }
      if (cut.companion && typeof cut.companion==='object') {
        const other=cut.companion;
        for (const k of detailKeys.filter(k=>k!=='params')) if (cut[k]!==undefined) other[k]=clone(cut[k]);
        other.params=J.LAYOUTS[other.layout].plan(J.rng(other.seed),{text:other.text,n:J.glyphCount(other.text),W:other.zone.w,H:other.zone.h,dur:other.dur},cut.renderLook?.style||plan.style);
      }
    }
    for(const group of plan.layerGroups||[])apply(group.plan,group.indices.map(i=>lineMap?lineMap[i]:i));
  }
  apply(result);
  if (project.agentUniformFont && own(J.FONTS,project.agentUniformFont)) {
    const font=project.agentUniformFont, roles={display:font,serif:font,body:font};
    const unify=p=>{const fallback={style:clone(p.style),styleKey:p.styleKey,fx:p.fx,hud:p.hud};for(const role of Object.keys(p.style.fonts))p.style.fonts[role]=[font];
      for(const c of p.cuts||[]){J.retargetCutFonts(c,roles,fallback);c.renderLook.style.agentUniformFont=font;delete c.weightGrow;if(c.companion&&typeof c.companion==='object')J.retargetCutFonts(c.companion,roles,fallback);}
      for(const group of p.layerGroups||[])unify(group.plan);};unify(result);
  }
  return result;
};
const favorites=project=>project.effectFavorites||[];
J.agentFavorites = {
  spec:()=>({...J.agentFavoriteSpec,drawing:J.drawingSpec,components:J.customEffectSpec}),
  list:project=>clone(favorites(project)),
  save(project,{name,payload,id,plan,index}) {
    const valid=payload?J.validateAgentFavorite(payload):J.captureAgentFavorite(project,plan,index);
    if(typeof name!=='string'||!name.trim()||name.length>200)throw Error('Favorite name must contain 1–200 characters');
    const list=clone(favorites(project));if(list.length>=256&&!id)throw Error('Favorite limit reached');
    const pos=id?list.findIndex(f=>f.id===id):-1;if(id&&pos<0)throw Error('Favorite not found');
    const entry={id:id||'fav-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)),name:name.trim(),payload:valid};
    J.importCustomEffects(project,valid.components);
    if(pos<0)list.push(entry);else list[pos]=entry;project.effectFavorites=list;return clone(entry);
  },
  remove(project,id){const list=favorites(project);if(!list.some(f=>f.id===id))throw Error('Favorite not found');project.effectFavorites=list.filter(f=>f.id!==id);},
  apply(project,plan,index,id){const f=favorites(project).find(f=>f.id===id);if(!f)throw Error('Favorite not found');return J.applyAgentFavorite(project,plan,index,f.payload);},
  export(project){return {format:'jizura-layer-favorites',version:1,favorites:this.list(project),customEffects:clone(project.customEffects||[]),userFonts:clone(project.userFonts||[])};},
  import(project,data,mode='append'){
    const file=J.agentJSON(data);if(file.format!=='jizura-layer-favorites'||file.version!==1||!Array.isArray(file.favorites)||file.favorites.length>256)throw Error('Expected Layer Studio favorites JSON');
    if(!['append','replace'].includes(mode))throw Error('Invalid import mode');
    const next=clone(project), fonts=new Map((next.userFonts||[]).map(f=>[f.key,f]));
    if(file.userFonts!==undefined&&(!Array.isArray(file.userFonts)||file.userFonts.length>128))throw Error('Invalid installed font references');
    for(const raw of file.userFonts||[]){
      if(!raw||!J.SAFE_FONT_KEY.test(raw.key)||typeof raw.family!=='string'||!J.safeFamily(raw.family))throw Error('Invalid installed font reference');
      const f={key:raw.key,label:String(raw.label||raw.key).slice(0,80),family:J.safeFamily(raw.family),weight:J.clamp(parseInt(raw.weight,10)||400,100,900)};
      if(fonts.has(f.key)&&JSON.stringify(fonts.get(f.key))!==JSON.stringify(f))throw Error('Installed font ID conflict');fonts.set(f.key,f);
    }
    next.userFonts=[...fonts.values()];
    try {
      J.registerProjectFonts(next.userFonts);
      const ids=new Set();const list=file.favorites.map(f=>{if(!f||typeof f.id!=='string'||!f.id||ids.has(f.id)||typeof f.name!=='string'||!f.name.trim()||f.name.length>200)throw Error('Invalid favorite entry');ids.add(f.id);return {...f,payload:J.validateAgentFavorite(f.payload)};});
      if(mode==='replace')next.effectFavorites=[];
      J.importCustomEffects(next,J.combineCustomEffects(file.customEffects||[],...list.map(f=>f.payload.components)));
      for(const f of list){const old=favorites(next).find(x=>x.id===f.id);if(old&&JSON.stringify(old)!==JSON.stringify(f))f.id='fav-'+(globalThis.crypto?.randomUUID?.()||Date.now()+Math.random());if(!old||old.id!==f.id)(next.effectFavorites||=[]).push(f);}
      if(favorites(next).length>256)throw Error('Favorite limit reached');
    } finally { J.registerProjectFonts(project.userFonts); J.activateCustomEffects(project); }
    return next;
  },
  async preview({project,payload,id,index,time=1,width=640}) {
    if(!Number.isFinite(time)||time<0||!Number.isInteger(width)||width<160||width>1920)throw Error('Invalid preview time/width');
    const selected=payload||favorites(project).find(f=>f.id===id)?.payload;if(!selected)throw Error('Favorite not found');
    const valid=J.validateAgentFavorite(selected),p=project?clone(project):J.defaultProject();
    try {
      if(index===undefined){p.subtitleCues=[{id:'sample',start:0,end:3,text:'動く歌詞'}];p.lyrics='動く歌詞';p.overrides={0:{cuts:1}};p.localLooks=null;p.agentEffects={};index=0;}
      J.importCustomEffects(p,valid.components);let plan=J.plan(p);const original=J.agentCutTarget(plan,index).cut;
      if(time>=original.dur)throw Error('time must be less than cut duration');
      const next=J.applyAgentFavorite(p,plan,index,valid);plan=J.plan(next);const cut=plan.cuts[index];
      await J.ensureFonts(next.lyrics,J.fontsOfPlan(plan));
      const height=Math.round(width*plan.H/plan.W),renderer=new J.LayerRenderer(width,height,next.layerMode,next.layerBackgroundOpacity,next.hideDecorativeText);
      renderer.draw(plan,cut.start+time,true);
      return {data:renderer.layer.toDataURL('image/png').split(',')[1],width,height,time,duration:cut.dur};
    }finally{J.activateCustomEffects(project||J.ui?.project||{});}
  },
};
})();
