import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {pwaPlugin} from './scripts/build-pwa.mjs';
const release=Date.now().toString(36);
export default defineConfig({
 plugins:[react(),tailwindcss(),pwaPlugin(release)],
 define:{__PWA_RELEASE__:JSON.stringify(release)}
});
