// Vercel Serverless Function for /api/sheet-write
// Securely proxies write payloads to the library's Google Apps Script Web App URL
// so browser CORS and Google 302 redirects never block saving Transactions or Books.

const VALID_APPS_SCRIPT_URL = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const webhookUrl = String(
      body.webhookUrl || process.env.APPS_SCRIPT_WEBAPP_URL || ''
    ).trim();
    const payload = body.payload;

    if (!webhookUrl || !VALID_APPS_SCRIPT_URL.test(webhookUrl)) {
      return res.status(400).json({
        ok: false,
        error:
          'Google Apps Script Web App URL ไม่ถูกต้อง (ต้องขึ้นต้นด้วย https://script.google.com/macros/s/ และลงท้ายด้วย /exec)',
      });
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ ok: false, error: 'Missing write payload' });
    }

    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const rawText = await upstream.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    if (!upstream.ok || !parsed) {
      const hint =
        rawText.includes('ServiceLogin') || rawText.includes('accounts.google.com')
          ? 'Apps Script Web App ยังไม่ได้ตั้งค่าสิทธิ์ "Who has access: Anyone" กรุณา Deploy ใหม่โดยเลือก Anyone'
          : `Google Apps Script ตอบกลับผิดพลาด (HTTP ${upstream.status})`;
      return res.status(502).json({ ok: false, error: hint });
    }

    if (parsed.ok === false) {
      return res.status(400).json({
        ok: false,
        error: parsed.error || 'Apps Script ปฏิเสธการบันทึกข้อมูล',
      });
    }

    return res.status(200).json(parsed);
  } catch (err: any) {
    console.error('Error in Vercel /api/sheet-write:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'ไม่สามารถเชื่อมต่อ Google Apps Script Web App ได้',
    });
  }
}
