import {test,expect} from "@playwright/test";
test("OTP-only patient forms remain usable on desktop and mobile; experts retain password access",async({page})=>{
 await page.goto('/signin');await expect(page.getByRole('button',{name:'Send verification code',exact:true})).toBeVisible();await expect(page.locator('input[type=password]')).toHaveCount(0);
 await page.goto('/register');await expect(page.getByLabel('Full name',{exact:true})).toBeVisible();await expect(page.getByLabel('Username',{exact:true})).toBeVisible();await expect(page.locator('input[type=password]')).toHaveCount(0);
 await page.route('**/api/auth/phone-number/send-otp',async route=>{expect(route.request().headers()['x-carebodha-phone-purpose']).toBe('register');await route.fulfill({json:{message:'code sent'}});});
 await page.getByLabel('Full name',{exact:true}).fill('Fictional Test Patient');await page.getByLabel('Username',{exact:true}).fill('fixture_mobile');await page.getByLabel('Phone number with country code',{exact:true}).fill('+919000000101');await page.getByRole('button',{name:'Send verification code',exact:true}).click();await expect(page.getByLabel('6-digit sign-in code',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Verify and create account',exact:true})).toBeEnabled();
 await page.screenshot({path:'.local-browser-media/otp-registration-desktop.png'});
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Verify and create account',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.local-browser-media/otp-registration-mobile.png',fullPage:true});
 await page.goto('/expert/signin');await expect(page.locator('input[type=password]')).toBeVisible();
});
