import esbuild from '../app/Source/node_modules/esbuild/lib/main.js';import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../app/Source/',import.meta.url));
esbuild.buildSync({absWorkingDir:source,entryPoints:['main.jsx'],bundle:true,minify:true,format:'iife',target:'es2020',outfile:'../web/app.js'});
console.log('Frontend built.');
