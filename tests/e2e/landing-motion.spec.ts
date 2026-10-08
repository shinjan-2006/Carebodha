import {test,expect} from "@playwright/test";

test("Matter entrance, native scroll chapters, circular menu, and live reduced-motion switching",async({page})=>{
  await page.setViewportSize({width:1440,height:960});await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/");
  await expect(page.locator(".chrome-scene.is-ready canvas")).toBeVisible();
  await expect(page.locator(".landing-experience")).toHaveAttribute("data-intro","running");
  const chars=page.locator(".hero-title .motion-char");expect(await chars.count()).toBe(19);
  expect(await chars.first().evaluate(el=>getComputedStyle(el).animationName)).toBe("matter-character");
  await expect(page.locator(".landing-experience")).toHaveAttribute("data-intro","done");
  await expect(page.getByRole("link",{name:"OPEN CAREBODHA →",exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/motion-hero.png"});
  await page.mouse.wheel(0,700);
  await expect.poll(async()=>Number(await page.locator(".hero").getAttribute("data-progress"))).toBeGreaterThan(1);
  expect(await page.locator(".hero").evaluate(el=>Math.abs(el.getBoundingClientRect().top))).toBeLessThan(2);
  await page.mouse.wheel(0,450);await expect(page.locator(".hero-stage")).toHaveAttribute("data-chapter","grid");await page.screenshot({path:"test-results/motion-grid.png"});
  await page.mouse.wheel(0,650);await expect(page.locator(".hero-stage")).toHaveAttribute("data-chapter","depth");await page.screenshot({path:"test-results/motion-depth.png"});
  await page.getByRole("button",{name:"MENU",exact:true}).click();await expect(page.getByRole("link",{name:"How it works",exact:true})).toBeFocused();
  expect(await page.locator(".landing-menu").evaluate(el=>getComputedStyle(el).animationName)).toBe("matter-menu-in");
  await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"MENU",exact:true})).toBeFocused();await expect(page.getByRole("navigation",{name:"Main navigation"})).toHaveCount(0);
  await page.emulateMedia({reducedMotion:"reduce"});await expect(page.locator(".chrome-scene canvas")).toHaveCount(0);await expect(page.locator(".static-ribbon")).toBeVisible();
  expect(await page.locator(".hero-stage").evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(1100);
  await page.getByRole("link",{name:"CareBodha home"}).first().click();await expect(page.getByRole("heading",{name:"UNDERSTAND YOUR CARE",exact:true})).toBeVisible();
  expect(await chars.first().evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
});

test("mobile motion keeps native scrolling, reveals content, and leaves every CTA usable",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/");
  await expect(page.locator(".landing-experience")).toHaveAttribute("data-intro","done");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole("button",{name:"MENU",exact:true}).click();await page.getByRole("link",{name:"Teach-back",exact:true}).click();await expect(page).toHaveURL(/#teach-back$/);
  await expect(page.getByRole("button",{name:"Check my understanding"})).toBeVisible();await page.getByRole("button",{name:"Check my understanding"}).click();await expect(page.getByText("Mismatch detected — frequency")).toBeVisible();
  expect(await page.locator("#teach-back h2").evaluate(el=>getComputedStyle(el).opacity)).toBe("1");
  await page.screenshot({path:"test-results/motion-mobile-demo.png"});
});
