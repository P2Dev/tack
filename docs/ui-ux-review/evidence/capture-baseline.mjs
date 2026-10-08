import { chromium } from '@playwright/test';
import fs from 'node:fs';
const path=process.cwd()+'/docs/ui-ux-review/evidence';
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({baseURL:'http://localhost:3105',viewport:{width:1440,height:900}});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3105/?issue=TCK-1&q=example');
 await page.waitForTimeout(220);await page.screenshot({caret:"initial",path:path+'/sign-in-desktop.png'});
 const redirected=page.url();
 await page.getByLabel('Email',{exact:true}).fill(process.env.TACK_ADMIN_EMAIL);
 await page.getByLabel('Password',{exact:true}).fill(process.env.TACK_ADMIN_PASSWORD);
 await page.getByRole('button',{name:'Open the board'}).click();
 await page.waitForURL('http://localhost:3105/');
 await page.locator('.board-grid').waitFor();
 await page.waitForTimeout(220);await page.screenshot({caret:"initial",path:path+'/board-desktop.png'});
 const snapshot=await (await page.request.get('/api/issues')).json();
 const metrics=[];
 for(const width of [1440,900,390,320]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(220);await page.screenshot({caret:"initial",path:path+`/board-${width}.png`});
  metrics.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,boardTop:document.querySelector('.board-grid').getBoundingClientRect().top,quickAddTop:document.querySelector('.board-column[data-active="true"] .quick-add')?.getBoundingClientRect().top})));
 }
 await page.setViewportSize({width:1440,height:900});
 await page.locator('.card-title').first().click();await page.waitForTimeout(220);await page.screenshot({caret:"initial",path:path+'/issue-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(220);await page.screenshot({caret:"initial",path:path+'/issue-mobile.png'});
 await page.getByRole('button',{name:'Close issue details'}).focus(); await page.keyboard.press('Shift+Tab');
 const focusEscape=await page.evaluate(()=>({label:document.activeElement.getAttribute('aria-label')||document.activeElement.textContent,inDialog:!!document.activeElement.closest('[role="dialog"]')}));
 await page.goto('http://localhost:3105/team');await page.waitForTimeout(220);await page.screenshot({caret:"initial",path:path+'/team-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(220);await page.screenshot({caret:"initial",path:path+'/team-desktop.png',fullPage:true});
 fs.writeFileSync(path+'/baseline.json',JSON.stringify({source:'Workspace Next dev, localhost:3105',redirected,afterLogin:'http://localhost:3105/',activeCards:snapshot.active?.length,archivedCards:snapshot.archived?.length,metrics,focusEscape,errors},null,2));
 console.log(JSON.stringify({activeCards:snapshot.active?.length,archivedCards:snapshot.archived?.length,redirected,metrics,focusEscape,errors},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
