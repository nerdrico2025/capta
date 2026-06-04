import puppeteer from 'puppeteer';

const UA = 'Mozilla/5.0 (compatible; CaptaBot/1.0; +https://capta.org.br)';

export async function fetchWithPuppeteer(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45_000 });
    await page.waitForSelector('article, [class*="card"]', { timeout: 10_000 }).catch(() => {});
    return await page.content();
  } finally {
    await browser.close();
  }
}
