const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('BROWSER ERROR:', msg.text());
  });
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err.message);
  });

  try {
    await page.goto('http://localhost:5173/record', { waitUntil: 'networkidle2' });
  } catch (err) {
    console.error('Nav error:', err);
  }
  
  await browser.close();
})();
