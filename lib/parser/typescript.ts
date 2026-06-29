// TypeScript uses the same parser as JavaScript (Acorn ecmaVersion 2020 covers TS-like syntax)
// For full TS AST support, swap acorn for @typescript-eslint/typescript-estree in a future iteration.
export { convertJS as convertTS } from './javascript'
