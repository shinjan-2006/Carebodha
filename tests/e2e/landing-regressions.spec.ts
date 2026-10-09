import {test,expect} from "@playwright/test";

for(const width of [1440,390])test(`Clarify holds and final sections never overlap at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');
 const gallery=page.locator('.gallery-stage'),clarity=page.locator('.clarity-stage');
 await gallery.evaluate(el=>{const frame=el.firstElementChild as HTMLElement;window.scrollTo(0,scrollY+el.getBoundingClientRect().top+(el.clientHeight-frame.clientHeight)*.84);});
 await expect(gallery).toHaveAttribute('data-active','2');
 const frames=await page.evaluate(()=>({gallery:document.querySelector('.gallery-chapter')!.getBoundingClientRect().bottom,clarity:document.querySelector('.clarity-stage')!.getBoundingClientRect().top}));
 expect(frames.clarity).toBeGreaterThanOrEqual(frames.gallery-1);
 await expect(gallery.getByRole('heading',{name:'CLARIFY',exact:true})).toBeVisible();
 await page.screenshot({path:`test-results/clarify-hold-${width}.png`});
 await page.locator('.support-stage').evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top+220));
 const separation=await page.evaluate(()=>({family:document.querySelector('.family-chapter')!.getBoundingClientRect().bottom,final:document.querySelector('.final-cta')!.getBoundingClientRect().top}));
 expect(separation.final).toBeGreaterThanOrEqual(separation.family-1);
 await page.locator('.support-scroll').click();
 await expect.poll(()=>page.locator('.final-cta').evaluate(el=>Math.abs(el.getBoundingClientRect().top-90))).toBeLessThan(5);
 await page.screenshot({path:`test-results/closing-separated-${width}.png`});
});

test('All six language choices translate landing, menu and authentication without changing form values',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 for(const language of ['hi','bn','or','te','pa','ta']){
  await page.getByRole('combobox',{name:'Language / भाषा'}).selectOption(language);
  await expect(page.locator('html')).toHaveAttribute('lang',language);
  expect(await page.locator('.gallery-caption h2').innerText()).not.toBe('UNDERSTAND');
  expect(await page.locator('.demo-copy>p').innerText()).not.toContain('A small misunderstanding');
  expect(await page.locator('.final-cta>p').innerText()).not.toContain('Explaining your doctor');
  await page.locator('.landing-menu-button').click();
  expect(await page.locator('.menu-meta').innerText()).not.toContain('Doctor-approved instructions.');
  await page.keyboard.press('Escape');
  await expect(page.locator('.landing-menu')).toHaveCount(0);
 }
 await page.goto('/expert/signin');
 await expect(page.locator('html')).toHaveAttribute('lang','ta');
 await expect(page.locator('.auth-card h2')).not.toHaveText('Medical expert sign-in');
 expect(await page.locator('.expert-access-note').innerText()).not.toContain('Medical-expert accounts');
 await page.getByRole('combobox',{name:'Language / भाषा'}).selectOption('en');
 await expect(page.locator('.auth-card h2')).toHaveText('Medical expert sign-in');
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('combobox',{name:'Language / भाषा'}).selectOption('ta');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/tamil-expert-mobile.png'});
 await page.getByRole('combobox',{name:'Language / भाषा'}).selectOption('en');
 await page.goto('/');
 await page.locator('#demo-answer').selectOption('I will take one tablet once daily after food.');
 await page.getByRole('button',{name:'Check my understanding'}).click();
 await expect(page.getByText('Mismatch detected — frequency')).toBeVisible();
});
