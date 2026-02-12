import { Page } from "puppeteer";

export async function navigateTo(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

export async function scrollPage(page: Page, direction: "up" | "down" | "bottom" | "top") {
  await page.evaluate((dir) => {
    if (dir === "down") window.scrollBy(0, window.innerHeight);
    else if (dir === "up") window.scrollBy(0, -window.innerHeight);
    else if (dir === "bottom") window.scrollTo(0, document.body.scrollHeight);
    else if (dir === "top") window.scrollTo(0, 0);
  }, direction);
}

export async function clickAt(page: Page, x: number, y: number) {
  await page.mouse.click(x, y);
}

export async function hoverElement(page: Page, id: number) {
  await page.evaluate((id) => {
    const el = (window as any).aiElementMap[id];
    if (!el) throw new Error(`Element ${id} not found`);
    el.scrollIntoView({ behavior: 'instant', block: 'center' });
  }, id);
  const rect = await page.evaluate((id) => {
    const el = (window as any).aiElementMap[id];
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
  await page.mouse.move(rect.x, rect.y);
}

export async function clickElement(page: Page, id: number) {
  // Set up navigation listener BEFORE the click so we can detect page navigation
  const navPromise = page.waitForNavigation({
    waitUntil: 'domcontentloaded',
    timeout: 5000,
  }).then(() => true).catch(() => false);

  await page.evaluate((id) => {
    const el = (window as any).aiElementMap[id];
    if (!el) throw new Error(`Element ${id} not found`);
    el.click();
  }, id);

  // Wait up to 2s to see if the click triggered a navigation
  const didNavigate = await Promise.race([
    navPromise,
    new Promise<false>(resolve => setTimeout(() => resolve(false), 2000)),
  ]);

  if (didNavigate) {
    // Full navigation occurred - wait for the new page to render
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

export async function typeElement(page: Page, id: number, text: string) {
  await page.evaluate(
    ({ id, text }) => {
      const el = (window as any).aiElementMap[id];
      if (!el) throw new Error(`Element ${id} not found`);
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { id, text },
  );
}

export async function getScreenshot(page: Page, quality: number = 80) {
  const buffer = await page.screenshot({
    type: "jpeg",
    quality: quality,
    encoding: "base64",
  });
  return buffer as string;
}

export async function typeText(page: Page, text: string) {
  await page.keyboard.type(text);
}

export async function pressKey(page: Page, key: string) {
  // Keys that can trigger form submission / navigation
  const navigationKeys = ['Enter', 'NumpadEnter'];
  const mightNavigate = navigationKeys.includes(key);

  let navPromise: Promise<boolean> | null = null;
  if (mightNavigate) {
    navPromise = page.waitForNavigation({
      waitUntil: 'domcontentloaded',
      timeout: 5000,
    }).then(() => true).catch(() => false);
  }

  await page.keyboard.press(key as any);

  if (navPromise) {
    const didNavigate = await Promise.race([
      navPromise,
      new Promise<false>(resolve => setTimeout(() => resolve(false), 2000)),
    ]);

    if (didNavigate) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
