import {Runtime} from './runtime.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
process.env.JIZURA_OFFLINE='1';
const runtime=new Runtime(),out=await mkdtemp(path.join(os.tmpdir(),'jizura-layer-ui-'));
try{
 await runtime.start();const {session}=await runtime.create(),page=runtime.get(session).page,errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const file=path.join(out,'cues.srt');await writeFile(file,'1\n00:00:00,100 --> 00:00:03,000\n動く歌詞を試す\n');await runtime.input(session,{path:file,kind:'srt'});
 await page.locator('#agentUniformFont').selectOption('mincho_bold');
 assert.equal(await page.evaluate(()=>J.ui.project.agentUniformFont),'mincho_bold');
 await page.locator('#btnAgentFavorites').click();await page.locator('#agentFavoriteName').fill('文字の動き');
 await page.getByRole('button',{name:'現在のカットを保存',exact:true}).click();
 await page.getByText('サンプル歌詞での試写。適用するまで現在の字幕は変わりません。',{exact:true}).waitFor({state:'visible'});
 assert.equal(await page.locator('#agentFavoritesList option').count(),1);
 await page.getByRole('button',{name:'現在のカットへ適用',exact:true}).click();
 assert.ok(await page.evaluate(()=>Object.keys(J.ui.project.agentEffects).length));
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'JSONを保存',exact:true}).click();const download=await downloadPromise;
 await download.saveAs(path.join(out,'favorites.json'));assert.equal(JSON.parse(await readFile(path.join(out,'favorites.json'),'utf8')).favorites.length,1);
 await page.screenshot({path:path.join(out,'favorites-ui.png'),fullPage:true});
 await page.getByRole('button',{name:'閉じる',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('PASS: native editor SRT, common-font selector, favorite capture/preview/apply and JSON download.\nArtifacts: '+out);
}finally{await runtime.close();}
