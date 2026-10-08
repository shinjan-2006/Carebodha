import {test,expect} from "@playwright/test";

test("Matter finale assembles, shatters, becomes particles and yields to a keyboard-accessible outro",async({page})=>{
 const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));await page.setViewportSize({width:1440,height:960});await page.goto("/");
 const support=page.locator("#family"),scene=page.locator(".chapter-scene-physics");
 const scroll=async(progress:number)=>page.locator(".closing-stage").evaluate((el,p)=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top+((el as HTMLElement).offsetHeight-(el.querySelector(".closing-frame") as HTMLElement).offsetHeight)*p/3.3,behavior:"instant"}),progress);
 await scroll(0);await expect(scene.locator("canvas")).toBeVisible();await expect(scene).toHaveAttribute("data-phase","assembled");await expect(page.getByRole("heading",{name:"Care is better. Together."})).toBeVisible();
 await expect(page.locator(".landing-experience")).toHaveClass(/support-dark/);await page.locator("#family h2").evaluate(async el=>await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished)));await page.screenshot({path:"docs/screenshots/matter-finale-assembled.png"});
 await scroll(1.65);await expect(scene).toHaveAttribute("data-phase","shattering");await expect.poll(()=>support.evaluate(el=>Number(el.style.getPropertyValue("--support-break")))).toBeGreaterThan(.4);await page.screenshot({path:"docs/screenshots/matter-finale-shattering.png"});
 await page.mouse.move(700,500);await expect(page.locator(".matter-cursor-ring")).toHaveClass(/is-finale/);await expect(page.locator(".matter-cursor-ring span")).toHaveText("");await expect.poll(()=>page.locator(".matter-cursor-ring").evaluate(el=>getComputedStyle(el).width)).toBe("44px");
 await scroll(2.4);await expect(scene).toHaveAttribute("data-phase","particles");await expect.poll(()=>support.evaluate(el=>Number(el.style.getPropertyValue("--support-break")))).toBeGreaterThan(.7);await expect(page.locator(".closing-stage")).toHaveAttribute("data-transition","support");await page.screenshot({path:"docs/screenshots/matter-finale-particles.png"});
 expect(await page.locator(".final-cta").evaluate(el=>Number(getComputedStyle(el).opacity))).toBe(0);
 await scroll(3.05);await expect(scene).toHaveAttribute("data-phase","cleared");await expect(page.locator(".closing-stage")).toHaveAttribute("data-transition","crossfade");await expect.poll(()=>page.locator(".support-title").evaluate(el=>Number(getComputedStyle(el).opacity))).toBe(0);await expect(page.locator(".matter-cursor-ring")).not.toHaveClass(/is-finale/);await page.screenshot({path:"docs/screenshots/closing-no-overlap.png"});
 await page.locator(".final-cta .button").focus();await expect(page.locator(".closing-stage")).toHaveAttribute("data-transition","outro");await expect(scene).toHaveAttribute("data-phase","cleared");await expect(page.locator(".final-cta .button")).toBeFocused();await expect(page.locator(".final-cta .button")).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test("second-to-third and gallery-to-conversation handoffs preserve native scroll and care-step controls",async({page})=>{
 await page.setViewportSize({width:1440,height:960});await page.goto("/");await expect(page.locator(".landing-experience")).toHaveAttribute("data-intro","done");
 await page.locator(".hero-stage").evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top+(el as HTMLElement).offsetHeight-innerHeight-15,behavior:"instant"}));
 await expect.poll(()=>page.locator(".hero").evaluate(el=>Number((el as HTMLElement).style.getPropertyValue("--handoff-white")))).toBeGreaterThan(.8);
 await page.locator(".gallery-stage").evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top,behavior:"instant"}));await expect.poll(()=>page.locator(".gallery-stage").evaluate(el=>Number((el as HTMLElement).style.getPropertyValue("--gallery-in")))).toBeGreaterThan(.99);
 await page.getByRole("button",{name:/03.*CLARIFY/}).click();await expect(page.locator(".equipment-label")).toHaveText("IV stand");await expect(page.getByRole("heading",{name:"CLARIFY",exact:true})).toBeVisible();
 await page.locator(".clarity-stage").evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top-innerHeight*.4,behavior:"instant"}));
 const values=await page.locator(".gallery-stage").evaluate(el=>({enter:Number((el as HTMLElement).style.getPropertyValue("--gallery-in")),exit:Number((el as HTMLElement).style.getPropertyValue("--gallery-out"))}));expect(values.enter).toBeGreaterThan(.99);
 await expect.poll(()=>page.locator(".gallery-stage").evaluate(el=>Number((el as HTMLElement).style.getPropertyValue("--gallery-out")))).toBeGreaterThan(.05);
 await expect.poll(()=>page.locator(".clarity-stage").evaluate(el=>Number((el as HTMLElement).style.getPropertyValue("--clarity-in")))).toBeGreaterThan(.5);
 await page.screenshot({path:"docs/screenshots/gallery-conversation-handoff.png"});
 await page.locator(".clarity-stage").evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top+120,behavior:"instant"}));await expect(page.locator(".clarity-stage")).toHaveAttribute("data-word","0");await expect.poll(()=>page.locator(".depth-word").first().evaluate(el=>Number(getComputedStyle(el).opacity))).toBeGreaterThan(.9);
 await page.emulateMedia({reducedMotion:"reduce"});await expect(sceneCanvas(page)).toHaveCount(0);await expect(page.getByRole("heading",{name:"Read your care. Explain in your own words. Find clarity."})).toBeAttached();
});

function sceneCanvas(page:import("@playwright/test").Page){return page.locator(".chapter-scene canvas");}

test("gap-free handoffs and two native wheel steps reach the brighter outro on desktop and mobile",async({page})=>{
 for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.goto("/");await expect(page.locator(".landing-experience")).toHaveAttribute("data-intro","done");
  const spacing=await page.evaluate(()=>{const box=(s:string)=>document.querySelector(s)!.getBoundingClientRect();return {heroGap:box(".gallery-stage").top-box(".hero-stage").bottom,galleryGap:box(".clarity-stage").top-box(".gallery-stage").bottom,conversationGap:box(".editorial-teachback").top-box(".clarity-stage").bottom};});
  expect(spacing.heroGap).toBeLessThan(-viewport.height*.95);expect(spacing.galleryGap).toBeLessThan(0);expect(spacing.conversationGap).toBeLessThan(0);
  await page.locator(".closing-stage").evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top,behavior:"instant"}));
  await expect.poll(()=>page.locator(".closing-stage").evaluate(el=>Number((el as HTMLElement).style.getPropertyValue("--support-enter")))).toBeGreaterThan(.99);
  await expect(page.getByRole("link",{name:"SCROLL DOWN"})).toBeVisible();await expect(page.locator(".chapter-scene-physics")).toHaveAttribute("data-phase","assembled");
  const before=await page.evaluate(()=>scrollY);await page.mouse.move(viewport.width*.5,viewport.height*.5);
  await page.mouse.wheel(0,120);await expect(page.locator(".chapter-scene-physics")).toHaveAttribute("data-phase","shattering");
  const burstStarted=Date.now();await page.mouse.wheel(0,120);await expect(page.locator(".closing-stage")).toHaveAttribute("data-transition","outro");expect(Date.now()-burstStarted).toBeGreaterThan(1300);
  expect(await page.evaluate(()=>scrollY)-before).toBeCloseTo(240,0);await expect(page.locator(".chapter-scene-physics")).toHaveAttribute("data-phase","cleared");
  expect(await page.locator(".support-title").evaluate(el=>Number(getComputedStyle(el).opacity))).toBe(0);
  expect(await page.locator(".final-cta").evaluate(el=>getComputedStyle(el).backgroundColor)).toBe("rgb(16, 20, 39)");
  await page.locator(".final-cta h2").evaluate(async el=>await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished)));
  await expect(page.locator(".final-cta .button")).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`docs/screenshots/two-scroll-outro-${viewport.width}.png`});
 }
});

test("teach-back fades into the pearl scene without a hard edge on desktop and mobile",async({page})=>{
 for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.goto("/");
  const closing=page.locator(".closing-stage");
  await closing.evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top-innerHeight*.45,behavior:"instant"}));
  await expect.poll(()=>closing.evaluate(el=>Number((el as HTMLElement).style.getPropertyValue("--support-enter")))).toBeGreaterThan(.6);
  expect(await closing.evaluate(el=>Number((el as HTMLElement).style.getPropertyValue("--support-enter")))).toBeLessThan(.85);
  expect(await page.locator(".editorial-teachback").evaluate(el=>Number((el as HTMLElement).style.getPropertyValue("--teachback-out")))).toBeGreaterThan(.6);
  await page.screenshot({path:`docs/screenshots/teachback-pearl-handoff-${viewport.width}.png`});
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect.poll(()=>page.locator("#family").evaluate(el=>getComputedStyle(el).opacity)).toBe("1");
  expect(await closing.evaluate(el=>el.querySelector(".closing-frame")!.getBoundingClientRect().height)).toBeGreaterThan(viewport.height);
  await page.emulateMedia({reducedMotion:"no-preference"});
 }
});

test("mobile finale keeps centered copy and family access readable, with a static reduced-motion fallback",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/");
 await page.locator(".closing-stage").evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top,behavior:"instant"}));
 await expect(page.locator(".chapter-scene-physics.is-ready canvas")).toBeVisible();await expect(page.locator(".chapter-scene-physics")).toHaveAttribute("data-phase","assembled");
 await page.locator("#family h2").evaluate(async el=>await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished)));
 const heading=await page.locator("#family h2").boundingBox();expect(heading!.x).toBeGreaterThanOrEqual(0);expect(heading!.x+heading!.width).toBeLessThanOrEqual(390);
 await expect(page.getByRole("link",{name:"Explore family assistance",exact:true})).toBeVisible();await page.screenshot({path:"docs/screenshots/matter-finale-mobile.png"});
 await page.emulateMedia({reducedMotion:"reduce"});await expect(page.locator(".chapter-scene-physics canvas")).toHaveCount(0);
 await page.locator("#family").evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top,behavior:"instant"}));await expect(page.locator(".finale-static")).toBeVisible();await page.screenshot({path:"docs/screenshots/matter-finale-static-mobile.png"});
 await page.locator(".final-cta").scrollIntoViewIfNeeded();await expect(page.locator(".final-cta .button")).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
