import {Page} from "puppeteer";
import {robustEvaluate, robustScreenshot} from "./utils.js";

export async function navigateTo(page: Page, url: string) {
    await page.goto(url, {waitUntil: "domcontentloaded", timeout: 30000});
    await new Promise((resolve) => setTimeout(resolve, 2000));
}

export async function scrollPage(page: Page, direction: "up" | "down" | "bottom" | "top") {
    const scrollBefore = await robustEvaluate(page, () => ({
        x: window.scrollX,
        y: window.scrollY,
        pageH: document.body.scrollHeight
    }));
    console.log(`    \x1b[35m[scroll ${direction}]\x1b[0m Before: scrollY=${scrollBefore.y}, pageHeight=${scrollBefore.pageH}`);

    await robustEvaluate(page, (dir) => {
        if (dir === "down") window.scrollBy(0, window.innerHeight);
        else if (dir === "up") window.scrollBy(0, -window.innerHeight);
        else if (dir === "bottom") window.scrollTo(0, document.body.scrollHeight);
        else if (dir === "top") window.scrollTo(0, 0);
    }, direction);

    const scrollAfter = await robustEvaluate(page, () => window.scrollY);
    console.log(`    \x1b[35m[scroll ${direction}]\x1b[0m After: scrollY=${scrollAfter}`);
}

export async function clickAt(page: Page, x: number, y: number) {
    await page.mouse.click(x, y);
}

export async function hoverElement(page: Page, id: number) {
    await robustEvaluate(page, (id) => {
        const el = (window as any).aiElementMap[id];
        if (!el) throw new Error(`Element ${id} not found`);
        el.scrollIntoView({behavior: 'instant', block: 'center'});
    }, id);
    const rect = await robustEvaluate(page, (id) => {
        const el = (window as any).aiElementMap[id];
        const r = el.getBoundingClientRect();
        return {x: r.left + r.width / 2, y: r.top + r.height / 2};
    }, id);
    await page.mouse.move(rect.x, rect.y);
}

export async function clickElement(page: Page, id: number) {
    // Get element info for logging and coordinates
    const elInfo = await robustEvaluate(page, (id) => {
        const el = (window as any).aiElementMap[id];
        if (!el) throw new Error(`Element ${id} not found`);

        // Scroll into view first so getBoundingClientRect returns viewport-relative coords
        el.scrollIntoView({behavior: 'instant', block: 'center'});

        const rect = el.getBoundingClientRect();
        return {
            tag: el.tagName,
            text: (el.innerText || el.value || '').slice(0, 80),
            href: el.getAttribute('href') || undefined,
            className: (el.className || '').toString().slice(0, 80),
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            rect: {x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height)},
        };
    }, id);
    console.log(`    \x1b[35m[click_element #${id}]\x1b[0m tag=${elInfo.tag} text="${elInfo.text}" href=${elInfo.href || 'none'} class="${elInfo.className}" rect=${JSON.stringify(elInfo.rect)}`);

    // Set up navigation listener BEFORE the click so we can detect page navigation
    const navPromise = page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: 5000,
    }).then(() => true).catch(() => false);

    // Use real Puppeteer mouse click at element center.
    console.log(`    \x1b[35m[click_element #${id}]\x1b[0m Mouse click at (${Math.round(elInfo.centerX)}, ${Math.round(elInfo.centerY)})`);
    await page.mouse.click(elInfo.centerX, elInfo.centerY);


    try {
        await page.mouse.click(elInfo.centerX, elInfo.centerY);
    } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes("detached Frame") || msg.includes("context was destroyed")) {
            console.warn(`    \x1b[33m[click_element #${id}]\x1b[0m Mouse click failed due to detachment/navigation: ${msg}. Assuming navigation started.`);
            // In this case, navigation likely started, so we proceed to wait
        } else {
            throw e;
        }
    }

    // Wait up to 2s to see if the click triggered a navigation
    const didNavigate = await Promise.race([
        navPromise,
        new Promise<false>(resolve => setTimeout(() => resolve(false), 2000)),
    ]);

    if (didNavigate) {
        console.log(`    \x1b[35m[click_element #${id}]\x1b[0m Navigation detected, waiting for page render...`);
        // Full navigation occurred - wait for the new page to render
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Log the current URL after the click
    const currentUrl = page.url();
    console.log(`    \x1b[35m[click_element #${id}]\x1b[0m Current URL: ${currentUrl}`);
}

export async function typeElement(page: Page, id: number, text: string) {
    await robustEvaluate(
        page,
        ({id, text}) => {
            const el = (window as any).aiElementMap[id];
            if (!el) throw new Error(`Element ${id} not found`);
            el.value = text;
            el.dispatchEvent(new Event("input", {bubbles: true}));
            el.dispatchEvent(new Event("change", {bubbles: true}));
        },
        {id, text},
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
