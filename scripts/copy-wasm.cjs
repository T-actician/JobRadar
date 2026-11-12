// The database engine (sql.js) loads this file at run time, so it must sit next to the bundled server.
const fs = require('node:fs');
fs.mkdirSync('dist-server', { recursive: true });
fs.copyFileSync('node_modules/sql.js/dist/sql-wasm.wasm', 'dist-server/sql-wasm.wasm');
