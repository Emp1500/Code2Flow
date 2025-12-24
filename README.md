# Code2Flow - Code Visualization Tool

A comprehensive code-to-flowchart visualization tool that helps you understand code flow with visual diagrams. Supports both JavaScript and Python.

## Features

- **Two-Panel Layout**: Code editor on the left, flowchart visualization on the right
- **Real-time Visualization**: Flowchart updates as you type
- **Multi-Language Support**: JavaScript (via Acorn.js AST) and Python (custom tokenizer)
- **Manual Language Selection**: Switch between languages using the dropdown selector
- **Multiple Shapes**:
  - **Circle**: Start/End nodes and merge points
  - **Rounded Rectangle**: Function/class declarations, try/except/finally blocks
  - **Diamond**: Conditions (if/elif/else, for/while loops, switch/match)
  - **Rectangle**: Regular statements, return values, break/continue

## How to Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## How It Works

The tool parses your code and generates a flowchart using:
- **Monaco Editor**: Professional code editor (same as VS Code)
- **Mermaid.js**: Flowchart rendering library
- **Acorn.js**: JavaScript AST parser
- **Custom Python Tokenizer**: Line-by-line Python parser

## Supported Code Elements

### JavaScript
- Function declarations (`function`, arrow functions)
- Variable declarations (`const`, `let`, `var`)
- Conditional statements (`if`, `else if`, `else`)
- Loops (`for`, `while`, `do-while`, `for...in`, `for...of`)
- Switch statements (`switch`, `case`, `default`)
- Try/Catch/Finally blocks
- Control flow (`return`, `break`, `continue`, `throw`)

### Python
- Function definitions (`def`)
- Class definitions (`class`)
- Conditional statements (`if`, `elif`, `else`)
- Loops with else support (`for...else`, `while...else`)
- Match/Case statements (Python 3.10+)
- Try/Except/Finally blocks with multiple handlers
- Context managers (`with`)
- Control flow (`return`, `break`, `continue`, `raise`, `pass`)
- Assertions and imports

## Example

The default code samples demonstrate:
- **JavaScript**: Grade calculator function with if/else chain and a for loop
- **Python**: Grade calculator with elif chains, try/except/finally with multiple handlers, and for loops

## File Structure

```
code2flow/
├── server.js              # Express server
├── public/
│   ├── index.html         # Main HTML file (two-panel layout)
│   └── app.js             # Client-side logic (parser + renderer)
├── package.json           # Dependencies
├── package-lock.json      # Dependency lock file
├── node_modules/          # Installed packages
└── README.md              # Documentation
```

## Technologies Used

- **Backend**: Node.js + Express
- **Editor**: Monaco Editor (CDN)
- **Visualization**: Mermaid.js (CDN)
- **JavaScript Parsing**: Acorn.js (CDN)
- **Styling**: Vanilla CSS

## Recent Updates

### Python Handler Improvements
- **Try/Except/Finally**: Full support for multiple except handlers with proper flow connections
- **Elif/Else Chaining**: Clean nested if/elif/else structures with shared merge points
- **For/While...Else**: Python's unique loop-else construct (else runs when loop completes normally)
- **Match/Case**: Python 3.10+ structural pattern matching support

### UI Improvements
- **Manual Language Selection**: Language no longer auto-switches while editing; use the dropdown to change languages manually
