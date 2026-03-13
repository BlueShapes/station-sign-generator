import { copyFileSync, existsSync } from 'fs';

const src = 'node_modules/sql.js/dist/sql-wasm.wasm';
const dest = 'public/sql-wasm.wasm';

if (existsSync(src)) {
  copyFileSync(src, dest);
  console.log('Copied sql-wasm.wasm → public/sql-wasm.wasm');
} else {
  console.warn('sql.js WASM not found at', src, '— skipping copy');
}
