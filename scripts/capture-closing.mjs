import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
let page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const finish=async selector=>page.locator(selector).evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished));});
const scrollTo=async(selector,offset=0)=>page.locator(selector).evaluate((el,offset)=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top+offset,behavior:'instant'}),offset);
try{
 await page.goto('http://localhost:3000/');await page.locator('.clarity-stage').waitFor();await page.waitForFunction(()=>document.querySelector('.landing-experience').dataset.intro==='done');await scrollTo('.clarity-stage',150);await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.depth-word')).opacity)>.9);await page.screenshot({path:'docs/screenshots/conversation-read-desktop.png'});
 const clarity=await page.locator('.clarity-stage').evaluate(el=>el.offsetHeight-el.firstElementChild.offsetHeight);await scrollTo('.clarity-stage',clarity*.48);await page.waitForFunction(()=>document.querySelector('.clarity-stage').dataset.word==='1' && Number(getComputedStyle(document.querySelectorAll('.depth-word')[1]).opacity)>.9);await page.screenshot({path:'docs/screenshots/conversation-explain-desktop.png'});
 await scrollTo('.closing-stage',0);await page.locator('.chapter-scene-physics.is-ready canvas').waitFor();await page.locator('#family h2.is-revealed').waitFor();await finish('#family h2');await page.screenshot({path:'docs/screenshots/support-dark-desktop.png'});
 await scrollTo('.closing-stage',200);await page.mouse.move(400,400,{steps:20});
 await scrollTo('.closing-stage',225);await page.waitForFunction(()=>document.querySelector('.closing-stage').dataset.transition==='crossfade');await page.screenshot({path:'docs/screenshots/support-outro-transition.png'});
 await scrollTo('.closing-stage',240);await page.locator('.chapter-scene-rings.is-ready canvas').waitFor();await finish('.final-cta h2');await page.screenshot({path:'docs/screenshots/support-final-desktop.png'});
 await page.close();page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:3000/');await page.waitForFunction(()=>document.querySelector('.landing-experience').dataset.intro==='done');await scrollTo('.clarity-stage',120);await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.depth-word')).opacity)>.9);await page.screenshot({path:'docs/screenshots/conversation-mobile.png'});
 await scrollTo('.closing-stage',0);await page.locator('.chapter-scene-physics.is-ready canvas').waitFor();await finish('#family h2');await page.screenshot({path:'docs/screenshots/support-dark-mobile.png'});
 console.log(JSON.stringify({errors,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://localhost:3000/#family');await page.screenshot({path:'docs/screenshots/support-static-mobile.png'});
}finally{await browser.close();}
