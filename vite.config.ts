import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

async function resolveSheetGid(
  spreadsheetId: string,
  sheetName: string,
  cacheBuster: number,
  fetchHeaders: Record<string, string>
): Promise<string | null> {
  try {
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview?_t=${cacheBuster}`;
    const htmlRes = await fetch(htmlUrl, {
      redirect: 'follow',
      cache: 'no-store',
      headers: fetchHeaders,
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
}

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

          const cacheBuster = Date.now();
          const fetchHeaders = {
            'Cache-Control': 'no-cache',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          };

          let text = '';
          let fetchedOk = false;

          // 1. Prefer export?format=csv&gid=... which ALWAYS returns ALL rows (never truncated by active Sheet Filters)
          const resolvedGid = await resolveSheetGid(id, sheet, cacheBuster, fetchHeaders);
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

          // 2. Fallback to gviz/tq CSV export
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
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
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
