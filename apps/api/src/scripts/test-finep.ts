import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

const apiCalls: string[] = [];
page.on('request', (req) => {
  const url = req.url();
  if (
    url.includes('api') ||
    url.includes('json') ||
    url.includes('chamada') ||
    url.includes('liferay') ||
    url.includes('o/')
  ) {
    apiCalls.push(`${req.method()} ${url}`);
  }
});

await page.goto('https://www.finep.gov.br/chamadas-publicas/chamadaspublicas?situacao=aberta', {
  waitUntil: 'networkidle2',
  timeout: 45_000,
});
await new Promise((r) => setTimeout(r, 4000));

console.log('=== API/XHR CALLS ===');
for (const call of apiCalls.slice(0, 40)) console.log(call);

// Extrai elementos com texto relevante
const items = await page.$$eval('*', (els) =>
  els
    .filter((el) => {
      const t = el.textContent?.toLowerCase() ?? '';
      return (
        (t.includes('chamada') || t.includes('edital') || t.includes('prazo')) &&
        el.children.length < 4 &&
        t.length < 400 &&
        t.length > 20
      );
    })
    .slice(0, 15)
    .map((el) => ({
      tag: el.tagName,
      cls: el.className?.slice(0, 60),
      text: el.textContent?.trim().slice(0, 200),
    })),
);
console.log('\n=== ELEMENTOS COM "chamada/edital/prazo" ===');
for (const i of items) console.log(JSON.stringify(i));
