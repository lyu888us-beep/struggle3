import {defineConfig} from 'vite';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
 root:path.join(root,'client'),
 base:'/custom/',
 build:{outDir:path.join(root,'public/custom'),emptyOutDir:true,sourcemap:false},
});
