/* Opt-in engine policy; the fork UI enables it for new projects. Source picks are retained. */
(() => {
'use strict';
const lists={layout:'center huge vcols knSlamStack knCollide knReflow tyJustify tyScaleSteps tyLineFocus',
enter:'cut pop zoom slideL slideR riseMask dropMask knWordSlam knPushIn knInertia',exit:'cut shrink slideOutL slideOutR sinkMask riseOut knPushOut',
hold:'still breathe knWordPulse knGapBreath',decor:'',bg:'none',treat:'none outline knWordScale',cam:'push',fx:'',trans:'pushSlide'};
const sets=Object.fromEntries(Object.entries(lists).map(([g,s])=>[g,new Set(s.split(/\s+/).filter(Boolean))]));
J.agentTypographyAllowed=(g,k)=>!sets[g]||sets[g].has(k)||!!J.registry(g)?.[k]?.custom;
const randomOk=J.randomOk;
J.randomOk=(p,g,k)=>!(p.agentCleanTypography&&sets[g]&&!J.agentTypographyAllowed(g,k))&&randomOk(p,g,k);
const omakase=J.omakase;
J.omakase=(p,...args)=>{const next=omakase(p,...args);if(p.agentCleanTypography)next.enabled=Object.fromEntries(J.GROUP_KEYS.map(g=>[g,Object.fromEntries(J.order(g).map(k=>[k,J.agentTypographyAllowed(g,k)&&p.enabled?.[g]?.[k]!==false]))]));return next;};
const plan=J.plan;
J.plan=(project,...args)=>{
  const out=plan(project,...args);if(!project.agentCleanTypography)return out;
  function clean(p){
    p.agentCleanTypography=true;
    Object.assign(p.fx,{decor:0,texture:0,chroma:0,glitch:0,flash:false,hud:'off'});p.hud=false;p.events=[];
    const cutClean=c=>{
      if(c.renderLook){c.renderLook=JSON.parse(JSON.stringify(c.renderLook));Object.assign(c.renderLook.fx,{decor:0,texture:0,chroma:0,glitch:0,flash:false,hud:'off'});c.renderLook.hud=false;}
      if(!J.agentTypographyAllowed('layout',c.layout)){
        c.layout='center';c.params=J.LAYOUTS.center.plan(J.rng(c.seed),{text:c.text,n:J.glyphCount(c.text),W:c.zone?.w||p.W,H:c.zone?.h||p.H,dur:c.dur},c.renderLook?.style||p.style);
      }
      for(const [g,k] of [['enter','cut'],['exit','cut'],['hold','still'],['treat','none'],['bg','none'],['cam','push']])if(!J.agentTypographyAllowed(g,c[g])){c[g]=k;if(g==='treat')c.treatP={};}
      c.decor=(c.decor||[]).filter(d=>J.DECOR[d.id]?.custom);if(!J.BG[c.bg]?.custom){c.bg='none';c.bgP={};}delete c.morph;delete c.weightGrow;
      if(c.trans&&!J.agentTypographyAllowed('trans',c.trans)){c.trans=null;c.transDur=0;c.transP={};}
      if(c.layout==='center')c.params={...c.params,sub:false,under:false,sx:1};
      if(c.layout==='huge')c.params={...c.params,label:false};
      if(c.layout==='vcols')c.params={...c.params,variant:'split'};
      if(c.companion&&typeof c.companion==='object')cutClean(c.companion);
    };
    (p.cuts||[]).forEach(cutClean);for(const g of p.layerGroups||[])clean(g.plan);
  }
  clean(out);return out;
};
// Remove optional guide/plate graphics from stock text layouts. Authored custom components keep their design.
const drawCut=J.Renderer.prototype.drawCut;
J.Renderer.prototype.drawCut=function(env){if(env.plan.agentCleanTypography&&!J.LAYOUTS[env.cut.layout]?.custom&&!env.cut.drawing&&!(env.cut.decor||[]).some(d=>J.DECOR[d.id]?.custom)){const saved={};for(const k of ['line','polyPartial','circle','arc','rrect','rect','poly','blob']){saved[k]=env[k];env[k]=()=>{};}try{return drawCut.call(this,env);}finally{Object.assign(env,saved);}}return drawCut.call(this,env);};
})();
