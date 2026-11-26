import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '4mb' }));

  const VALID_APPS_SCRIPT_URL = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;

  // API Route to securely proxy write requests to the configured Google Apps Script Web App
  app.post('/api/sheet-write', async (req, res) => {
    try {
      const webhookUrl = String(
        req.body?.webhookUrl || process.env.APPS_SCRIPT_WEBAPP_URL || ''
      ).trim();
      const payload = req.body?.payload;

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
      console.error('Error in /api/sheet-write proxy:', err);
      return res.status(500).json({
        ok: false,
        error: err?.message || 'ไม่สามารถเชื่อมต่อ Google Apps Script Web App ได้',
      });
    }
  });

  // Helper: resolve exact worksheet gid by sheet tab name so /export?format=csv returns ALL rows (unfiltered)
  const resolveSheetGid = async (
    spreadsheetId: string,
    sheetName: string,
    cacheBuster: number
  ): Promise<string | null> => {
    try {
      const htmlUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview?_t=${cacheBuster}`;
      const htmlRes = await fetch(htmlUrl, {
        redirect: 'follow',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (!htmlRes.ok) return null;
      const html = await htmlRes.text();
      const target = sheetName.trim().toLowerCase();
      const tabRegex = /items\.push\(\{name:\s*"([^"]+)"[^}]*?gid:\s*"(\d+)"/g;
      let match: RegExpExecArray | null;
      while ((match = tabRegex.exec(html)) !== null) {
        if (match[1].trim().toLowerCase() === target) {
          return match[2];
        }
      }
    } catch (e) {
      console.warn('resolveSheetGid non-fatal:', e);
    }
    return null;
  };

  // API Route to fetch public Google Spreadsheet CSV without browser CORS restrictions
  app.get('/api/sheet-data', async (req, res) => {
    try {
      const id = req.query.id as string;
      const sheet = (req.query.sheet as string) || 'Books';

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing spreadsheet id' });
      }

      const cacheBuster = Date.now();
      const fetchHeaders = {
        'Cache-Control': 'no-cache',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };

      let text = '';
      let fetchedOk = false;

      // 1. Prefer export?format=csv&gid=... which ALWAYS returns ALL rows (never truncated by active Sheet Filters!)
      const resolvedGid = await resolveSheetGid(id, sheet, cacheBuster);
      if (resolvedGid) {
        const exportGidUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${encodeURIComponent(
          resolvedGid
        )}&_t=${cacheBuster}`;
        const exportRes = await fetch(exportGidUrl, {
          redirect: 'follow',
          cache: 'no-store',
          headers: fetchHeaders,
        });
        if (exportRes.ok) {
          const exportText = await exportRes.text();
          if (!exportText.startsWith('<!DOCTYPE') && !exportText.includes('<html')) {
            text = exportText;
            fetchedOk = true;
          }
        }
      }

      // 2. Fallback to gviz/tq CSV export if gid export did not succeed
      if (!fetchedOk) {
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
          sheet
        )}&_t=${cacheBuster}`;
        const response = await fetch(gvizUrl, {
          redirect: 'follow',
          cache: 'no-store',
          headers: fetchHeaders,
        });
        text = await response.text();
        if (response.ok && !text.startsWith('<!DOCTYPE') && !text.includes('<html')) {
          fetchedOk = true;
        }
      }

      // 3. Final fallback to export?format=csv&sheet=...
      if (!fetchedOk) {
        const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&sheet=${encodeURIComponent(
          sheet
        )}&_t=${cacheBuster}`;
        const exportRes = await fetch(exportUrl, {
          redirect: 'follow',
          cache: 'no-store',
          headers: fetchHeaders,
        });
        if (exportRes.ok) {
          const exportText = await exportRes.text();
          if (!exportText.startsWith('<!DOCTYPE') && !exportText.includes('<html')) {
            text = exportText;
            fetchedOk = true;
          }
        }
      }

      if (!fetchedOk || text.startsWith('<!DOCTYPE') || text.includes('<html')) {
        return res.status(403).json({
          error:
            'Google Sheet ไม่ได้เปิดสิทธิ์แชร์สาธารณะ (โปรดตั้งค่าการแชร์ใน Google Sheet เป็น "Anyone with the link can edit/view")',
        });
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(text);
    } catch (err: any) {
      console.error('Error in /api/sheet-data proxy:', err);
      return res.status(500).json({
        error: err.message || 'Failed to fetch spreadsheet from Google Sheets',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BookSwap] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
