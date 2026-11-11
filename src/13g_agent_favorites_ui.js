/* Human-facing controls for the same favorites used by the local MCP bridge. */
(() => {
'use strict';
const tr=J.layerText,el=(tag,text)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;return e;};
function boot(){
  const S=J.ui,A=J.uiApi,clone=x=>JSON.parse(JSON.stringify(x));
  const opener=el('button',tr('お気に入り演出…','Favorite effects…'));opener.id='btnAgentFavorites';opener.type='button';opener.className='small';
  (document.getElementById('btnMotionLibrary')||document.getElementById('btnOmakase')).after(opener);
  const fontBox=el('div');fontBox.className='agent-font-control';
  const clean=el('input');clean.type='checkbox';clean.id='agentCleanTypography';
  const cleanLabel=el('label',tr('文字だけ（基本の9レイアウト）','Text only (9 core layouts)'));cleanLabel.prepend(clean);
  clean.addEventListener('change',()=>{const next=clone(S.project);next.agentCleanTypography=clean.checked;update(next);});
  const label=el('label',tr('全編の書体を固定','One font for all lyrics')),fonts=el('select');fonts.id='agentUniformFont';fonts.setAttribute('aria-label',tr('全編の書体を固定','One font for all lyrics'));
  const syncFont=()=>{fonts.replaceChildren();const off=el('option',tr('スタイル・役割ごとの書体','Use style font roles'));off.value='';fonts.append(off);for(const [key,f] of Object.entries(J.FONTS)){const o=el('option',f.label);o.value=key;fonts.append(o);}fonts.value=S.project.agentUniformFont||'';clean.checked=!!S.project.agentCleanTypography;};
  const update=next=>{A.importAgentProject(next);syncFont();};
  label.htmlFor=fonts.id;fontBox.append(cleanLabel,label,fonts);document.getElementById('layerPanel')?.prepend(fontBox);syncFont();
  fonts.addEventListener('change',()=>{const next=clone(S.project);if(fonts.value)next.agentUniformFont=fonts.value;else delete next.agentUniformFont;update(next);});
  let dialog,list,name,status,canvas,target=-1,epoch=0;
  const message=(text,error=false)=>{status.textContent=text;status.classList.toggle('error',error);};
  const selected=()=>S.project.effectFavorites?.find(f=>f.id===list.value);
  function refresh(id){const value=id||list.value;list.replaceChildren();for(const f of S.project.effectFavorites||[]){const o=el('option',f.name);o.value=f.id;list.append(o);}if(value)list.value=value;if(list.selectedIndex<0&&list.options.length)list.selectedIndex=0;}
  async function preview(){const f=selected();if(!f)return;const seq=++epoch;message(tr('試写中…','Rendering preview…'));try{const result=await J.agentFavorites.preview({project:S.project,id:f.id,time:.8,width:480});const image=new Image();image.src='data:image/png;base64,'+result.data;await image.decode();if(seq!==epoch||!dialog.open)return;canvas.width=result.width;canvas.height=result.height;canvas.getContext('2d').drawImage(image,0,0);message(tr('サンプル歌詞での試写。適用するまで現在の字幕は変わりません。','Sample preview. The current subtitle changes only when Apply is pressed.'));}catch(e){if(seq===epoch)message(e.message,true);}}
  function mount(){if(dialog)return;dialog=el('dialog');dialog.id='agentFavoritesDialog';dialog.className='agent-favorites-dialog';
    const heading=el('h2',tr('お気に入り演出','Favorite effects'));heading.id='agentFavoritesHeading';dialog.setAttribute('aria-labelledby',heading.id);
    const hint=el('p',tr('現在のカットを保存し、別の歌詞に適用できます。AIが作った演出はJSONから取り込めます。字幕全体の構成には「モーションライブラリ」を使ってください。','Save the current cut or import AI-authored favorites as JSON. Use Motion library for whole-subtitle compositions.'));
    list=el('select');list.size=6;list.id='agentFavoritesList';list.setAttribute('aria-label',tr('保存済み演出','Saved favorite effects'));list.addEventListener('change',()=>{name.value=selected()?.name||'';preview();});
    name=el('input');name.id='agentFavoriteName';name.placeholder=tr('お気に入りの名前','Favorite name');name.setAttribute('aria-label',name.placeholder);name.maxLength=200;
    canvas=el('canvas');canvas.width=480;canvas.height=270;canvas.className='agent-favorite-preview';status=el('p');status.setAttribute('role','status');
    const actions=el('div');actions.className='agent-favorite-actions';
    const button=(text,handler)=>{const b=el('button',text);b.type='button';b.addEventListener('click',async()=>{try{await handler();}catch(e){message(e.message,true);}});actions.append(b);return b;};
    button(tr('現在のカットを保存','Save current cut'),()=>{if(target<0)throw Error(tr('先に字幕を読み込んでください。','Import subtitles first.'));const next=clone(S.project),f=J.agentFavorites.save(next,{name:name.value.trim()||tr('お気に入り','Favorite'),plan:S.plan,index:target});update(next);refresh(f.id);preview();});
    button(tr('現在のカットへ適用','Apply to current cut'),()=>{const f=selected();if(!f)throw Error(tr('演出を選んでください。','Select a favorite.'));update(J.agentFavorites.apply(S.project,S.plan,target,f.id));message(tr('適用しました（Ctrl+Zで戻せます）。','Applied. Ctrl+Z restores the previous state.'));});
    button(tr('選択した演出を削除','Delete selected favorite'),()=>{const f=selected();if(!f)return;const next=clone(S.project);J.agentFavorites.remove(next,f.id);update(next);refresh();message(tr('削除しました。','Deleted.'));});
    button(tr('JSONを保存','Export JSON'),()=>J.saveFile('effects.jizura-layer-favorites.json',JSON.stringify(J.agentFavorites.export(S.project),null,2)));
    const file=el('input');file.type='file';file.accept='.json';file.hidden=true;file.addEventListener('change',async()=>{try{if(!file.files[0])return;const next=J.agentFavorites.import(S.project,JSON.parse(await file.files[0].text()),'append');update(next);refresh();preview();}catch(e){message(e.message,true);}finally{file.value='';}});
    button(tr('JSONを読み込む','Import JSON'),()=>file.click());button(tr('閉じる','Close'),()=>dialog.close());
    dialog.append(heading,hint,list,name,actions,canvas,status,file);dialog.addEventListener('close',()=>{epoch++;});document.body.append(dialog);
  }
  opener.addEventListener('click',()=>{A.pause();mount();const cut=J.cutAt(S.plan,S.t);target=cut?.utext!=null?cut.index:S.plan.cuts.findIndex(c=>c.utext!=null);refresh();name.value=selected()?.name||'';dialog.showModal();message(tr('対象：現在のカット','Target: current cut'));preview();});
  const sync=J.syncLayerUI;J.syncLayerUI=()=>{sync?.();syncFont();};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
