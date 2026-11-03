import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function sheetProxyPlugin() {
  return {
    name: 'sheet-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/sheet-data', async (req: any, res: any) => {
        try {
          const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
          const id = urlObj.searchParams.get('id');
          const sheet = urlObj.searchParams.get('sheet') || 'Books';
          if (!id) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Missing spreadsheet id' }));
            return;
          }
          const gvizUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
          let response = await fetch(gvizUrl, {
            redirect: 'follow',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          let text = await response.text();
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
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                error:
                  'Google Sheet ไม่ได้เปิดสิทธิ์แชร์สาธารณะ (โปรดตั้งค่าการแชร์ใน Google Sheet เป็น "Anyone with the link can edit/view")',
              })
            );
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(text);
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: err.message || 'Failed to fetch spreadsheet' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), sheetProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
