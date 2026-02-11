import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import FormData from 'form-data';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [];
if (app.isPackaged) {
  envCandidates.push(path.join(process.resourcesPath, '.env'));
}
envCandidates.push(path.join(__dirname, '.env'));

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  process.env.DOTENV_CONFIG_PATH = envPath;
  config({ path: envPath });
} else {
  config();
}

const isDev = !app.isPackaged;
app.setName('Chatbot FidOuest');

import { MAX_FILES } from './frontend/src/config.ts';
import { getPermissionsForCurrentUser } from './backend/security/permissions.ts';

let featureFlagsCache = null;
let mainWindow = null;
const backendPort = Number(process.env.PORT ?? 3000);
const backendBaseUrl = `http://127.0.0.1:${backendPort}`;
process.env.BACKEND_URL = backendBaseUrl;

async function resolvePermissionsAtStartup() {
  try {
    featureFlagsCache = await getPermissionsForCurrentUser();
  } catch {
    featureFlagsCache = { canUseApp: false, canImportFiles: false };
  }
}

function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, 'build', 'icon.ico')
    : path.join(process.resourcesPath, 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.removeMenu();

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const indexHtml = path.join(__dirname, '../frontend/dist/index.html');
    mainWindow.loadFile(indexHtml);
  }
}

async function maybeStartBackend() {
  if (!app.isPackaged && process.env.START_BACKEND !== '1') return;
  try {
    await import('./backend/index.js');
  } catch (err) {
    console.error('[main] Failed to start backend:', err?.message ?? err);
  }
}

app.whenReady().then(resolvePermissionsAtStartup).then(maybeStartBackend).then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo
const tokenToPath = new Map();

function makeToken() {
  return 'file_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

ipcMain.handle('file:openMany', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Documents', extensions: ['pdf', 'docx'] },
    ],
  });
  if (canceled || !filePaths?.length) return null;

  const picked = filePaths.slice(0, MAX_FILES);
  const out = [];
  for (const p of picked) {
    try {
      const st = fs.statSync(p);
      if (st.size > MAX_SIZE_BYTES) continue;
      const token = makeToken();
      tokenToPath.set(token, p);
      out.push({ token, name: path.basename(p), size: st.size });
    } catch (e) {
      console.warn('[main] skip file:', p, e?.message);
    }
  }
  return out;
});

ipcMain.handle('file:uploadByTokens', async (_evt, tokens, backendUrl) => {
  if (!Array.isArray(tokens) || tokens.length === 0) return [];
  
  const defaultUploadUrl = `${backendBaseUrl}/api/files`;
  const urlObj = new URL(backendUrl ?? defaultUploadUrl);
  const form = new FormData();
  let count = 0;
  
  console.log(`[FileUpload] Starting upload for ${tokens.length} token(s)`);
  
  for (const token of tokens.slice(0, MAX_FILES)) {
    const p = tokenToPath.get(token);
    if (!p) {
      console.warn(`[FileUpload] No path for token ${token}`);
      continue;
    }
    
    try {
      const st = fs.statSync(p);
      console.log(`[FileUpload] File: ${p} (${st.size} bytes)`);
      
      if (st.size > MAX_SIZE_BYTES) {
        console.warn(`[FileUpload] File too large: ${p}`);
        continue;
      }
      
      // Ajouter le fichier directement en tant que stream
      const fileStream = fs.createReadStream(p);
      const filename = path.basename(p);
      form.append('files', fileStream, filename);
      count++;
      console.log(`[FileUpload] Added to form: ${filename}`);
    } catch (err) {
      console.error(`[FileUpload] Error processing ${p}:`, err.message);
    }
  }
  
  if (count === 0) {
    console.warn('[FileUpload] No valid files to upload');
    return [];
  }
  
  const port = parseInt(urlObj.port || '3000', 10);
  console.log(`[FileUpload] Uploading ${count} file(s) to ${urlObj.hostname}:${port}${urlObj.pathname}`);
  
  // Utiliser http.request pour envoyer les fichiers
  return new Promise((resolve, reject) => {
    const headers = form.getHeaders();
    console.log(`[FileUpload] Headers:`, headers);
    
    const options = {
      hostname: urlObj.hostname,
      port: port,
      path: urlObj.pathname,
      method: 'POST',
      headers: headers,
    };
    
    const req = http.request(options, (res) => {
      console.log(`[FileUpload] Response status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          console.log(`[FileUpload] Response body (first 500 chars):`, data.substring(0, 500));
          
          if (res.statusCode !== 200) {
            console.error('[FileUpload] Non-200 response:', res.statusCode, data);
            reject(new Error(`Upload failed: HTTP ${res.statusCode} - ${data}`));
            return;
          }
          
          const parsed = JSON.parse(data);
          const fileIds = Array.isArray(parsed?.files) ? parsed.files : [];
          const result = tokens.slice(0, MAX_FILES).map((token, i) => ({
            token,
            file_id: fileIds[i]?.file_id,
          })).filter(x => x.file_id);
          console.log(`[FileUpload] Success: ${result.length} file(s) uploaded with IDs`);
          resolve(result);
        } catch (e) {
          console.error('[FileUpload] Parse error:', e.message);
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('[FileUpload] Request error:', err.message);
      reject(err);
    });
    
    // Pipe form data to request
    console.log('[FileUpload] Piping form data to request...');
    form.pipe(req);
  });
});

ipcMain.handle('permissions:get', async () => {
  if (!featureFlagsCache) await resolvePermissionsAtStartup();
  return featureFlagsCache;
});

ipcMain.handle('shell:openExternal', async (_evt, url) => {
  if (typeof url !== 'string' || url.trim() === '') return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  await shell.openExternal(trimmed);
  return true;
});