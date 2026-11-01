import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
fs.mkdirSync(path.join(root,'public/shells'),{recursive:true});
for(const name of ['home','medical','recovery','travel','offline'])fs.copyFileSync(path.join(root,'snapshots',name+'.html'),path.join(root,'public/shells',name+'.txt'));
fs.copyFileSync(path.join(root,'public/custom/index.html'),path.join(root,'public/shells/custom.txt'));
fs.copyFileSync(path.join(root,'snapshots/home.html'),path.join(root,'public/index.html'));
console.log('Prepared public Pages assets and application shells.');
