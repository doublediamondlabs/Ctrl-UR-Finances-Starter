import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from '../app/Source/node_modules/esbuild/lib/main.js';
const root = fileURLToPath(new URL('../', import.meta.url));
export function bundleHarness(name) {
  return esbuild.buildSync({
    entryPoints: [path.join(root, 'tests', name)],
    bundle: true,
    format: 'iife',
    write: false,
    nodePaths: [path.join(root, 'app/Source/node_modules')]
  }).outputFiles[0].text;
}
