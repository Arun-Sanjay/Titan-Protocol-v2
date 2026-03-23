const { spawn } = require('child_process');
const path = require('path');
const cwd = path.join(__dirname, 'apps', 'web');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--port', '3000'], { stdio: 'inherit', cwd });
child.on('exit', (code) => process.exit(code));
