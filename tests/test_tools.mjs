import esbuild from '../app/Source/node_modules/esbuild/lib/main.js';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { JSDOM, CookieJar } from 'jsdom';
import path from 'node:path';
const src = fileURLToPath(new URL('../app/Source/', import.meta.url));
const bundle = esbuild.buildSync({
  stdin: {
    contents: 'import React from \'react\';import {createRoot} from \'react-dom/client\';import ToolsNav,{groups} from \'./ToolsNav.jsx\';createRoot(document.getElementById(\'root\')).render(<ToolsNav api={window.api} ready items={groups.flatMap(g=>g[2]).map(k=>[k,()=>null,k])} order={[]} active="summary" onSelect={k=>window.selected=k}/>);',
    resolveDir: src,
    loader: 'jsx'
  },
  bundle: true,
  minify: true,
  format: 'iife',
  write: false
}).outputFiles[0].text;
const stored = {},
  jar = new CookieJar(),
  tick = () => new Promise(r => setTimeout(r, 40));
function open(port) {
  const w = new JSDOM('<div id="root"></div>', {
    url: 'http://127.0.0.1:' + port,
    runScripts: 'outside-only',
    cookieJar: jar
  }).window;
  w.api = async (route, body) => {
    const id = body?.client || route.split('=')[1];
    if (body) {
      assert.deepEqual(body.previous, stored[id] || {});
      stored[id] = JSON.parse(JSON.stringify(body.layout));
    }
    return {
      layout: stored[id] || {}
    };
  };
  w.eval(bundle);
  return w;
}
let w = open(12345);
await tick();
await tick();
const click = async text => {
  const b = [...w.document.querySelectorAll('button')].find(b => b.textContent === text || b.getAttribute('aria-label') === text);
  assert.ok(b, text);
  assert.ok(!b.disabled, text);
  b.click();
  await tick();
};
assert.equal(w.document.querySelectorAll('.tool-link').length, 0);
await click('Customize');
await click('Pin summary');
await click('Pin compare');
await click('Move compare up');
await click('Done');
assert.equal(w.document.querySelector('.tool-quick-access .tool-link').textContent, 'compare');
w.close();
w = open(23456);
await tick();
await tick();
assert.equal(w.document.querySelectorAll('.tool-link').length, 2);
assert.equal(w.document.querySelector('.tool-link').textContent, 'compare');
await click('Customize');
await click('Unpin summary');
assert.ok(w.document.querySelector('#tools-reports').textContent.includes('summary'));
assert.equal(w.document.querySelectorAll('.tool-quick-access .tool-link').length, 1);
w.close();
console.log('PASS grouped Tools, pin/unpin/reorder, same browser cookie across different launcher ports and saved layout reload.');
