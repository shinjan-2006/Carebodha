import 'dotenv/config';
import { chromium } from '@playwright/test';
import {mkdir} from 'node:fs/promises';
if(process.env.APP_MODE!=='demo')throw new Error('Capture only fictional demo screens.');
await mkdir('docs/screenshots',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const origin=process.env.BETTER_AUTH_URL || 'http://localhost:3000';
  await page.goto(origin);await page.getByRole('heading',{name:'UNDERSTAND YOUR CARE',exact:true}).waitFor();
  await page.locator('.chrome-scene.is-ready canvas').waitFor();await page.locator('.landing-experience[data-intro=done]').waitFor();await page.screenshot({path:'docs/screenshots/landing-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.static-ribbon').waitFor();await page.screenshot({path:'docs/screenshots/landing-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:960});
  await page.goto(`${origin}/signin?demo=patient`);await page.getByRole('button',{name:'patient',exact:true}).click();
  await page.screenshot({path:'docs/screenshots/signin-desktop.png'});
  const registration=await browser.newPage({viewport:{width:390,height:844}});await registration.goto(`${origin}/register`);await registration.getByRole('heading',{name:'Create your account',exact:true}).waitFor();if(await registration.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Registration overflows.');await registration.screenshot({path:'docs/screenshots/register-mobile.png'});await registration.close();
  const login=page.waitForResponse(r=>r.url().endsWith('/api/auth/sign-in/email') && r.request().method()==='POST');await page.getByRole('button',{name:'Sign in',exact:true}).click();let response=await login;
  if(response.status()===429){await new Promise(r=>setTimeout(r,(Number(response.headers()['x-retry-after'] || 10)+1)*1000));const retry=page.waitForResponse(r=>r.url().endsWith('/api/auth/sign-in/email'));await page.getByRole('button',{name:'Sign in',exact:true}).click();response=await retry;}
  if(response.status()!==200)throw new Error('Capture sign-in failed.');await page.getByRole('heading',{name:'Hello, Asha.'}).waitFor();await page.screenshot({path:'docs/screenshots/patient-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('link',{name:'My care plan',exact:true}).click();await page.getByRole('heading',{name:'My care plan',exact:true}).waitFor();await page.getByText('Demo Medicine A की एक गोली दिन में दो बार खाने के बाद लें।',{exact:true}).waitFor();await page.screenshot({path:'docs/screenshots/patient-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:960});
  for(const section of ['plan','teachback','family','appointments','questions','notifications','settings']){
    await page.goto(`${origin}/app/${section}`);await page.locator('.page-heading h1').waitFor();if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error(`${section} overflows.`);await page.screenshot({path:`docs/screenshots/patient-${section}-desktop.png`});
  }
  for(const role of ['clinician','family']){
    const rolePage=await browser.newPage({viewport:{width:1440,height:960}});await rolePage.goto(`${origin}/signin?demo=${role}`);await rolePage.getByRole('button',{name:role,exact:true}).click();
    const signedIn=rolePage.waitForResponse(r=>r.url().endsWith('/api/auth/sign-in/email') && r.request().method()==='POST');await rolePage.getByRole('button',{name:'Sign in',exact:true}).click();let signedResponse=await signedIn;
    if(signedResponse.status()===429){await new Promise(r=>setTimeout(r,(Number(signedResponse.headers()['x-retry-after'] || 10)+1)*1000));const retry=rolePage.waitForResponse(r=>r.url().endsWith('/api/auth/sign-in/email'));await rolePage.getByRole('button',{name:'Sign in',exact:true}).click();signedResponse=await retry;}
    if(signedResponse.status()!==200)throw new Error(`${role} capture sign-in failed.`);await rolePage.locator('.page-heading h1').waitFor();
    for(const section of role==='clinician'?['overview','upload','review']:['overview','plan']){
      await rolePage.goto(`${origin}/app/${section}`);await rolePage.locator('.page-heading h1').waitFor();if(await rolePage.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error(`${role}/${section} overflows.`);await rolePage.screenshot({path:`docs/screenshots/${role}-${section}-desktop.png`});
    }
    await rolePage.close();
  }
  console.log('Landing, authentication, patient routes, family views, and clinician upload/review captured; no horizontal overflow.');
}finally{await browser.close();}
