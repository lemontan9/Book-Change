import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Route to fetch public Google Spreadsheet CSV without browser CORS restrictions
  app.get('/api/sheet-data', async (req, res) => {
    try {
      const id = req.query.id as string;
      const sheet = (req.query.sheet as string) || 'Books';

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing spreadsheet id' });
      }

      // Try gviz/tq CSV export
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
      let response = await fetch(gvizUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      let text = await response.text();

      // If gviz returned html (e.g. login redirect / not shared), try export?format=csv
      if (!response.ok || text.startsWith('<!DOCTYPE') || text.includes('<html')) {
        const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&sheet=${encodeURIComponent(sheet)}`;
        const exportRes = await fetch(exportUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (exportRes.ok) {
          const exportText = await exportRes.text();
          if (!exportText.startsWith('<!DOCTYPE') && !exportText.includes('<html')) {
            text = exportText;
            response = exportRes;
          }
        }
      }

      if (text.startsWith('<!DOCTYPE') || text.includes('<html')) {
        return res.status(403).json({
          error:
            'Google Sheet ไม่ได้เปิดสิทธิ์แชร์สาธารณะ (โปรดตั้งค่าการแชร์ใน Google Sheet เป็น "Anyone with the link can edit/view")',
        });
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
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
