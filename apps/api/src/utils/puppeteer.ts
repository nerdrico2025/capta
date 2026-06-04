import puppeteerCore from 'puppeteer-core';

export async function fetchWithPuppeteer(url: string): Promise<string> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/chromium-browser';

  const browser = await puppeteerCore.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
    ],
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
