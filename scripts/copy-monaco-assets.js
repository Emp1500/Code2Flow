// Self-hosts Monaco's editor assets under public/monaco instead of letting
// @monaco-editor/react fetch them from cdn.jsdelivr.net, which the app's CSP
// (script-src 'self') blocks.
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs')
const dest = path.join(__dirname, '..', 'public', 'monaco', 'min', 'vs')

fs.rmSync(dest, { recursive: true, force: true })
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.cpSync(src, dest, { recursive: true })

console.log(`Copied Monaco assets to ${path.relative(process.cwd(), dest)}`)
