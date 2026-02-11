// vite.config.ts (RACINE)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT : on donne des chemins ABSOLUS à vite-plugin-electron
const entryMain = path.resolve(__dirname, 'main.js');
const entryPreload = path.resolve(__dirname, 'preload.js');
const outDirElectron = path.resolve(__dirname, 'dist-electron');

export default defineConfig(({ command }) => ({
  // on garde ton renderer dans le dossier frontend/
  root: 'frontend',
  
  server: {
    port: 5173,
    strictPort: false,          // Vite peut basculer sur 5174/5175 si 5173 occupé
    proxy: {
      // tout ce qui commence par /api est redirigé vers le backend dev
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // si ton backend ne préfixe pas /api et attend /chat-gpt4 :
        // rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },

  plugins: [
    react(),
    electron([
      {
        // MAIN PROCESS
        entry: entryMain,
        onstart: (options) => {
          if (command === 'serve') options.startup(); // lance Electron en dev
        },
        vite: {
          build: {
            outDir: outDirElectron,
            target: 'node18',
            minify: false,
            emptyOutDir: false, // ne pas effacer preload s'il existe déjà
          },
        },
      },
      {
        // PRELOAD
        entry: entryPreload,
        onstart: (options) => {
          if (command === 'serve') options.reload(); // reload si preload change
        },
        vite: {
          build: {
            outDir: outDirElectron,
            target: 'node18',
            minify: false,
            emptyOutDir: false,
          },
        },
      },
    ]),
  ],
  build: {
    // build du renderer => ./frontend/dist
    outDir: 'dist',
    emptyOutDir: true,
  },
  base: './',
}));