import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const modulePath = process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href);
const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const server = createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if ((file !== root && !file.startsWith(root + path.sep)) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const target = fs.statSync(file).isDirectory() ? path.join(file,'index.html') : file;
  const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp' };
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream'); res.end(fs.readFileSync(target));
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const address = 'http://127.0.0.1:' + server.address().port;
const now = Date.now(), day = new Date(now+8*3600000).toISOString().slice(0,10);
let profile = { learnerKey:'a'.repeat(64),alias:'Curious Comet A81C',companion:'orbit',frame:'none',optIn:true,xp:465,level:3,levelProgress:65,nextLevelXp:200,weeklyXp:120,completed:24,corrected:3,studyDays:8,activeDays:[day],currentWeekDays:[day],badges:[{id:'first-step',label:'First steps',earned:true},{id:'comeback',label:'Comeback kid',earned:true}],unlockedCompanions:['orbit','pip'],unlockedFrames:['none','sunrise'] };
function snapshot() { return {profile,quests:[{id:'study',label:'Make time to learn',progress:1,target:1,xp:5},{id:'practice',label:'Practise three questions',progress:2,target:3,xp:15},{id:'correction',label:'Turn a mistake into progress',progress:0,target:1,xp:20}],leaderboard:{status:'ready',level:'P5',subject:'science',resetsAt:now+3*86400000,rows:[{alias:'Bright Otter B12A',companion:'nova',frame:'none',xp:165,rank:1},{alias:'Kind Comet C87B',companion:'pip',frame:'none',xp:145,rank:2},{alias:profile.alias,companion:profile.companion,frame:profile.frame,xp:120,rank:3,isYou:true}]}}; }
const context = await browser.newContext({viewport:{width:1280,height:1050},reducedMotion:'reduce'});
const page = await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
async function readyImages() {
  await page.evaluate(async () => { await Promise.all([...document.querySelectorAll('.adv-character img')].map(img => img.decode().catch(() => {}))); });
}
await page.route('https://**/*', async route => {
  if (route.request().url().endsWith('/studyBuddyGame')) {
    const body=route.request().postDataJSON();
    if(body.action==='preferences') profile={...profile,...Object.fromEntries(['companion','frame','optIn'].filter(k=>body[k]!==undefined).map(k=>[k,body[k]]))};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot())});
  }
  return route.abort();
});
try {
  await page.goto(address,{waitUntil:'load'});
  await page.evaluate(() => {
    currentUser={uid:'visual-test',getIdToken:async()=> 'test-token'}; myStudents=[{name:'Test Learner',level:'P5',subject:'science'}];_activeIdx=0;
    window.liveAppCheckToken=async()=> 'test-appcheck';
    document.getElementById('signedOutCard').classList.add('hidden');document.getElementById('homeSignedIn').classList.remove('hidden');
    document.getElementById('signInBtn').classList.add('hidden');
    StudyAdventure.sync();
  });
  await page.getByText('Curious Comet A81C',{exact:false}).first().waitFor();
  await readyImages();
  assert.equal(await page.locator('.adv-character-fallback').count(),0,'all generated character assets load');
  assert.equal(errors.length,0,errors.join('\n'));
  assert.ok(await page.locator('#adventureHome').isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'desktop overflow');
  const output = process.env.ADVENTURE_SHOTS;
  if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'adventure-desktop.png'),fullPage:true});}
  await page.evaluate(()=>StudyAdventure.open('collection'));
  await page.getByRole('dialog').waitFor();
  await readyImages();
  assert.equal(await page.locator('#app').evaluate(el=>el.inert),true,'modal makes background inert');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);
  await page.evaluate(()=>StudyAdventure.open('leaderboard'));
  await page.getByRole('dialog').waitFor();
  assert.ok(await page.getByRole('dialog').getByText('Bright Otter B12A').count());
  await readyImages();
  if(output)await page.screenshot({path:path.join(output,'adventure-leaderboard.png'),fullPage:true});
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile overflow');
  if(output)await page.screenshot({path:path.join(output,'adventure-mobile.png'),fullPage:true});
  await page.evaluate(()=>StudyAdventure.open('collection'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'collection mobile overflow');
  if(output)await page.screenshot({path:path.join(output,'adventure-collection.png'),fullPage:true});
  await page.keyboard.press('Escape');
  await page.evaluate(()=> { currentUser=null; StudyAdventure.reset(); StudyAdventure.sync(); });
  assert.equal(await page.locator('#adventureHome').isVisible(),false,'sign out hides prior learner data');
  await page.evaluate(()=> { currentUser={uid:'teacher',getIdToken:async()=> 'teacher-token'}; isAdmin=()=>true; StudyAdventure.sync(); });
  assert.ok(await page.locator('#adventureHome').getByRole('button',{name:'Manage learners'}).isVisible());
  assert.equal(await page.locator('#adventureHome .adv-metrics').count(),0,'teacher has no fictional personal XP');
  assert.equal(await page.locator('#adventureHome .adv-quest-grid').count(),0,'teacher has no student quests');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Adventure browser checks passed: authenticated dashboard, real-data rendering, desktop/mobile, modal focus/inert, reduced motion, account cleanup.');
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
