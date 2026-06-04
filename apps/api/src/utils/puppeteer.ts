import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';

export async function fetchWithPuppeteer(url: string): Promise<string> {
  const executablePath = await chromium.executablePath();

  const browser = await puppeteerCore.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 800 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (compatible; CaptaBot/1.0; +https://capta.org.br)');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45_000 });
    await page
      .waitForSelector('article, [class*="card"], [class*="chamada"]', { timeout: 15_000 })
      .catch(() => {});
    return await page.content();
  } finally {
    await browser.close();
  }
}
