import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
await mkdir('docs/screenshots',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:'test-results/motion-video',size:{width:1440,height:960}},reducedMotion:'no-preference'});
const page=await context.newPage();const video=page.video();
try{
  await page.goto('http://localhost:3000/');await page.locator('.landing-experience[data-intro=done]').waitFor();await page.screenshot({path:'docs/screenshots/landing-desktop.png'});
  await page.mouse.move(650,350);await page.mouse.move(800,420,{steps:35});
  for(const [amount,name,minimum] of [[700,'expansion',1],[450,'grid',1.8],[650,'depth',3]]){
    await page.mouse.wheel(0,amount);await page.waitForFunction(min=>Number(document.querySelector('.hero').dataset.progress || 0)>min,minimum);await page.waitForFunction(()=>Math.abs(Number(document.querySelector('.hero').dataset.velocity || 0))<.08);await page.screenshot({path:`docs/screenshots/motion-${name}.png`});
  }
  await page.getByRole('button',{name:'MENU',exact:true}).click();await page.locator('.landing-menu').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished)));await page.screenshot({path:'docs/screenshots/motion-menu.png'});await page.keyboard.press('Escape');
  await page.locator('#how-it-works h2').scrollIntoViewIfNeeded();await page.locator('#how-it-works h2.is-revealed').waitFor();await page.locator('#how-it-works h2').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));await page.screenshot({path:'docs/screenshots/motion-how.png'});
}finally{await context.close();if(video)await video.saveAs('docs/screenshots/landing-motion.webm');await browser.close();}
console.log('Entrance, pointer response, native scroll chapters, and menu video captured.');
