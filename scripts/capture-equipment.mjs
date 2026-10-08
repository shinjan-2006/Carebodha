import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}});
const address=process.argv[2] || 'http://localhost:3000';
const finish=selector=>page.locator(selector).evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished));});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(address);await page.waitForSelector('.landing-experience[data-intro="done"]');
 for(let i=0;i<3;i++){
  await page.evaluate(i=>{const el=document.querySelector('.gallery-stage');const distance=el.offsetHeight-el.firstElementChild.offsetHeight;window.scrollTo({top:scrollY+el.getBoundingClientRect().top+i/2*distance,behavior:'instant'});},i);
  await page.waitForFunction(i=>document.querySelector('.gallery-stage').dataset.active===String(i),i);
  await page.waitForSelector('.chapter-scene-gallery.is-ready');
  await page.waitForFunction(i=>Math.abs(Number(document.querySelector('.gallery-stage').style.getPropertyValue('--gallery-progress'))-i)<.01,i);
  await finish('.gallery-caption');await page.screenshot({path:`docs/screenshots/medical-gallery-${i+1}-desktop.png`});
 }
 await page.locator('#teach-back').scrollIntoViewIfNeeded();await page.waitForSelector('#teach-back h2.is-revealed');await finish('#teach-back h2');await page.screenshot({path:'docs/screenshots/medical-teachback-desktop.png'});
 await page.evaluate(()=>document.querySelector('#family').scrollIntoView({behavior:'instant'}));await page.waitForSelector('.chapter-scene-physics.is-ready');await page.waitForSelector('#family h2.is-revealed');await finish('#family h2');await page.screenshot({path:'docs/screenshots/medical-family-desktop.png'});
 await page.getByRole('button',{name:'Scatter the medical equipment'}).click();
 await page.setViewportSize({width:390,height:844});await page.goto(address);
 await page.evaluate(()=>document.querySelector('.gallery-stage').scrollIntoView({behavior:'instant'}));await page.waitForSelector('.chapter-scene-gallery.is-ready');await finish('.gallery-caption');await page.screenshot({path:'docs/screenshots/medical-gallery-mobile.png'});
 await page.evaluate(()=>document.querySelector('#family').scrollIntoView({behavior:'instant'}));await page.waitForSelector('.chapter-scene-physics.is-ready');await page.waitForSelector('#family h2.is-revealed');await finish('#family h2');await page.screenshot({path:'docs/screenshots/medical-family-mobile.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(address);await page.evaluate(()=>document.querySelector('.gallery-stage').scrollIntoView({behavior:'instant'}));await page.waitForSelector('.medical-fallback');await page.screenshot({path:'docs/screenshots/medical-gallery-fallback.png'});
 console.log(JSON.stringify({pageErrors:errors,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
} finally {await browser.close();}
