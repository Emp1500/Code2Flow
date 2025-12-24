// ============================================================================
// CODE2FLOW - Comprehensive Code to Flowchart Visualization Tool
// ============================================================================
// Supports: JavaScript (via Acorn.js AST) and Python (custom tokenizer)
// Features: Accurate Yes/No labels, nested structures, all control flows
// ============================================================================

// ============================================================================
// 1. CONFIGURATION & DEFAULT CODE SAMPLES
// ============================================================================

const DEFAULT_CODE = {
  javascript: `function calculateGrade(score) {
  if (score >= 90) {
    return 'A';
  } else if (score >= 80) {
    return 'B';
  } else if (score >= 70) {
    return 'C';
  } else {
    return 'F';
  }
}

for (let i = 0; i < 5; i++) {
  if (i % 2 === 0) {
    console.log('even');
  } else {
    console.log('odd');
  }
}`,

  python: `def calculate_grade(score):
    if score >= 90:
        return 'A'
    elif score >= 80:
        return 'B'
    elif score >= 70:
        return 'C'
    else:
        return 'F'

def process_data(data):
    try:
        result = parse(data)
        validate(result)
    except ValueError as e:
        log_error(e)
        return None
    except TypeError:
        return default_value()
    finally:
        cleanup()
    return result

for i in range(5):
    if i % 2 == 0:
        print('even')
    else:
        print('odd')`
};

// ============================================================================
// 2. DATA STRUCTURES
// ============================================================================

class FlowchartNode {
  constructor(id, type, label, shape = 'rectangle') {
    this.id = id;
    this.type = type;      // 'start', 'end', 'process', 'decision', 'io', 'subroutine'
    this.label = label;
    this.shape = shape;    // 'circle', 'diamond', 'rectangle', 'rounded', 'parallelogram'
  }
}

class FlowchartEdge {
  constructor(from, to, label = '') {
    this.from = from;
    this.to = to;
    this.label = label;    // 'Yes', 'No', 'case X', 'default', etc.
  }
}

class FlowchartGraph {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this.nodeCounter = 0;
  }

  createNode(type, label, shape = 'rectangle') {
    const id = `N${this.nodeCounter++}`;
    const node = new FlowchartNode(id, type, label, shape);
    this.nodes.push(node);
    return node;
  }

  connect(from, to, label = '') {
    if (from && to) {
      this.edges.push(new FlowchartEdge(from.id, to.id, label));
    }
  }
}

class TraversalContext {
  constructor(graph) {
    this.graph = graph;
    this.currentNode = null;
    this.breakTarget = null;      // Where 'break' should go
    this.continueTarget = null;   // Where 'continue' should go
    this.returnTarget = null;     // Function end node
  }

  clone() {
    const ctx = new TraversalContext(this.graph);
    ctx.currentNode = this.currentNode;
    ctx.breakTarget = this.breakTarget;
    ctx.continueTarget = this.continueTarget;
    ctx.returnTarget = this.returnTarget;
    return ctx;
  }
}

// ============================================================================
// 3. LANGUAGE DETECTION
// ============================================================================

function detectLanguage(code) {
  // Python indicators
  const pythonPatterns = [
    /^\s*def\s+\w+\s*\(/m,           // def function():
    /^\s*class\s+\w+.*:/m,           // class Foo:
    /^\s*import\s+\w+/m,             // import module
    /^\s*from\s+\w+\s+import/m,      // from x import y
    /^\s*if\s+.*:\s*$/m,             // if condition:
    /^\s*elif\s+.*:\s*$/m,           // elif condition:
    /^\s*else\s*:\s*$/m,             // else:
    /^\s*for\s+\w+\s+in\s+/m,        // for x in y:
    /^\s*while\s+.*:\s*$/m,          // while condition:
    /^\s*try\s*:\s*$/m,              // try:
    /^\s*except.*:\s*$/m,            // except:
    /^\s*print\s*\(/m,               // print()
    /^\s*#.*$/m,                     // # comment
  ];

  // JavaScript indicators
  const jsPatterns = [
    /\bfunction\s+\w+\s*\(/,         // function foo()
    /\bconst\s+\w+\s*=/,             // const x =
    /\blet\s+\w+\s*=/,               // let x =
    /\bvar\s+\w+\s*=/,               // var x =
    /=>\s*[{(]/,                     // arrow functions
    /\bconsole\.(log|error|warn)/,   // console.log
    /\{\s*$/m,                       // opening brace at end
    /^\s*\}/m,                       // closing brace
    /;\s*$/m,                        // semicolon at end
    /===|!==|&&|\|\|/,               // strict equality, logical ops
    /^\s*\/\/.*/m,                   // // comment
  ];

  let pythonScore = 0;
  let jsScore = 0;

  for (const pattern of pythonPatterns) {
    if (pattern.test(code)) pythonScore++;
  }

  for (const pattern of jsPatterns) {
    if (pattern.test(code)) jsScore++;
  }

  return pythonScore > jsScore ? 'python' : 'javascript';
}

// ============================================================================
// 4. EXPRESSION FORMATTER
// ============================================================================

function formatExpression(node, maxLength = 60) {
  if (!node) return '';

  let text = '';

  switch (node.type) {
    case 'Identifier':
      text = node.name;
      break;

    case 'Literal':
      text = node.raw || String(node.value);
      break;

    case 'BinaryExpression':
    case 'LogicalExpression':
      text = `${formatExpression(node.left)} ${node.operator} ${formatExpression(node.right)}`;
      break;

    case 'UnaryExpression':
      text = node.prefix
        ? `${node.operator}${formatExpression(node.argument)}`
        : `${formatExpression(node.argument)}${node.operator}`;
      break;

    case 'UpdateExpression':
      text = node.prefix
        ? `${node.operator}${formatExpression(node.argument)}`
        : `${formatExpression(node.argument)}${node.operator}`;
      break;

    case 'AssignmentExpression':
      text = `${formatExpression(node.left)} ${node.operator} ${formatExpression(node.right)}`;
      break;

    case 'MemberExpression':
      if (node.computed) {
        text = `${formatExpression(node.object)}[${formatExpression(node.property)}]`;
      } else {
        text = `${formatExpression(node.object)}.${formatExpression(node.property)}`;
      }
      break;

    case 'CallExpression':
      const callee = formatExpression(node.callee);
      const args = node.arguments.map(a => formatExpression(a)).join(', ');
      text = `${callee}(${args})`;
      break;

    case 'ConditionalExpression':
      text = `${formatExpression(node.test)} ? ${formatExpression(node.consequent)} : ${formatExpression(node.alternate)}`;
      break;

    case 'ArrayExpression':
      const elements = node.elements.map(e => formatExpression(e)).join(', ');
      text = `[${elements}]`;
      break;

    case 'ObjectExpression':
      text = '{...}';
      break;

    case 'NewExpression':
      const newArgs = node.arguments.map(a => formatExpression(a)).join(', ');
      text = `new ${formatExpression(node.callee)}(${newArgs})`;
      break;

    case 'SequenceExpression':
      text = node.expressions.map(e => formatExpression(e)).join(', ');
      break;

    case 'ThisExpression':
      text = 'this';
      break;

    case 'TemplateLiteral':
      text = '`...`';
      break;

    case 'ArrowFunctionExpression':
      text = '() => {...}';
      break;

    case 'FunctionExpression':
      text = 'function() {...}';
      break;

    default:
      text = node.type || '[expr]';
  }

  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + '...';
  }

  return text;
}

// ============================================================================
// 5. JAVASCRIPT PARSER (Acorn-based)
// ============================================================================

function parseJavaScript(code) {
  try {
    return acorn.parse(code, {
      ecmaVersion: 2020,
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true
    });
  } catch (error) {
    throw new Error(`JavaScript Parse Error at line ${error.loc?.line || '?'}: ${error.message}`);
  }
}

// ============================================================================
// 6. JAVASCRIPT STATEMENT HANDLERS
// ============================================================================

function processJSStatement(node, ctx) {
  if (!node) return { entry: null, exit: null };

  switch (node.type) {
    case 'FunctionDeclaration':
      return processJSFunction(node, ctx);

    case 'IfStatement':
      return processJSIf(node, ctx);

    case 'ForStatement':
      return processJSFor(node, ctx);

    case 'WhileStatement':
      return processJSWhile(node, ctx);

    case 'DoWhileStatement':
      return processJSDoWhile(node, ctx);

    case 'ForInStatement':
    case 'ForOfStatement':
      return processJSForIn(node, ctx);

    case 'SwitchStatement':
      return processJSSwitch(node, ctx);

    case 'TryStatement':
      return processJSTry(node, ctx);

    case 'ReturnStatement':
      return processJSReturn(node, ctx);

    case 'BreakStatement':
      return processJSBreak(node, ctx);

    case 'ContinueStatement':
      return processJSContinue(node, ctx);

    case 'ThrowStatement':
      return processJSThrow(node, ctx);

    case 'BlockStatement':
      return processJSBlock(node.body, ctx);

    case 'VariableDeclaration':
      return processJSVariable(node, ctx);

    case 'ExpressionStatement':
      return processJSExpression(node, ctx);

    case 'EmptyStatement':
      return { entry: null, exit: ctx.currentNode };

    default:
      // Generic statement
      const label = node.type.replace('Statement', '');
      const genericNode = ctx.graph.createNode('process', label, 'rectangle');
      return { entry: genericNode, exit: genericNode };
  }
}

function processJSFunction(node, ctx) {
  const name = node.id ? node.id.name : 'anonymous';
  const params = node.params.map(p => formatExpression(p)).join(', ');
  const funcLabel = `function ${name}(${params})`;

  const funcNode = ctx.graph.createNode('subroutine', funcLabel, 'rounded');
  const funcEnd = ctx.graph.createNode('process', `end ${name}`, 'rounded');

  // Create context for function body
  const funcCtx = ctx.clone();
  funcCtx.currentNode = funcNode;
  funcCtx.returnTarget = funcEnd;

  // Process function body
  const bodyResult = processJSBlock(node.body.body, funcCtx);

  if (bodyResult.entry) {
    ctx.graph.connect(funcNode, bodyResult.entry);
  }
  if (bodyResult.exit) {
    ctx.graph.connect(bodyResult.exit, funcEnd);
  }

  return { entry: funcNode, exit: funcEnd };
}

function processJSIf(node, ctx) {
  const condition = formatExpression(node.test);
  const conditionNode = ctx.graph.createNode('decision', condition + '?', 'diamond');

  // Merge node for after if/else
  const mergeNode = ctx.graph.createNode('process', '', 'circle');
  mergeNode.label = '';
  mergeNode.type = 'merge';

  // Process TRUE branch (consequent) - ALWAYS "Yes"
  const trueCtx = ctx.clone();
  trueCtx.currentNode = conditionNode;

  let trueBody = node.consequent;
  if (trueBody.type === 'BlockStatement') {
    trueBody = trueBody.body;
  } else {
    trueBody = [trueBody];
  }

  const trueResult = processJSBlock(trueBody, trueCtx);

  if (trueResult.entry) {
    ctx.graph.connect(conditionNode, trueResult.entry, 'Yes');
    if (trueResult.exit) {
      ctx.graph.connect(trueResult.exit, mergeNode);
    }
  } else {
    ctx.graph.connect(conditionNode, mergeNode, 'Yes');
  }

  // Process FALSE branch (alternate) - ALWAYS "No"
  if (node.alternate) {
    const falseCtx = ctx.clone();
    falseCtx.currentNode = conditionNode;

    if (node.alternate.type === 'IfStatement') {
      // else if - recursive call
      const elseIfResult = processJSIf(node.alternate, falseCtx);
      ctx.graph.connect(conditionNode, elseIfResult.entry, 'No');
      if (elseIfResult.exit) {
        ctx.graph.connect(elseIfResult.exit, mergeNode);
      }
    } else {
      // else block
      let falseBody = node.alternate;
      if (falseBody.type === 'BlockStatement') {
        falseBody = falseBody.body;
      } else {
        falseBody = [falseBody];
      }

      const falseResult = processJSBlock(falseBody, falseCtx);

      if (falseResult.entry) {
        ctx.graph.connect(conditionNode, falseResult.entry, 'No');
        if (falseResult.exit) {
          ctx.graph.connect(falseResult.exit, mergeNode);
        }
      } else {
        ctx.graph.connect(conditionNode, mergeNode, 'No');
      }
    }
  } else {
    // No else - "No" goes directly to merge
    ctx.graph.connect(conditionNode, mergeNode, 'No');
  }

  return { entry: conditionNode, exit: mergeNode };
}

function processJSFor(node, ctx) {
  let initNode = null;

  // Process initialization
  if (node.init) {
    const initLabel = node.init.type === 'VariableDeclaration'
      ? node.init.declarations.map(d => `${node.init.kind} ${formatExpression(d.id)} = ${formatExpression(d.init)}`).join(', ')
      : formatExpression(node.init);
    initNode = ctx.graph.createNode('process', initLabel, 'rectangle');
  }

  // Condition node
  const condition = node.test ? formatExpression(node.test) : 'true';
  const conditionNode = ctx.graph.createNode('decision', condition + '?', 'diamond');

  // After loop node (merge point)
  const afterLoop = ctx.graph.createNode('process', '', 'circle');
  afterLoop.type = 'merge';

  // Update node
  let updateNode = null;
  if (node.update) {
    const updateLabel = formatExpression(node.update);
    updateNode = ctx.graph.createNode('process', updateLabel, 'rectangle');
  }

  // Connect init to condition
  if (initNode) {
    ctx.graph.connect(initNode, conditionNode);
  }

  // Create context for loop body
  const loopCtx = ctx.clone();
  loopCtx.currentNode = conditionNode;
  loopCtx.breakTarget = afterLoop;
  loopCtx.continueTarget = updateNode || conditionNode;

  // Process loop body
  let loopBody = node.body;
  if (loopBody.type === 'BlockStatement') {
    loopBody = loopBody.body;
  } else {
    loopBody = [loopBody];
  }

  const bodyResult = processJSBlock(loopBody, loopCtx);

  // Connect: condition --Yes--> body
  if (bodyResult.entry) {
    ctx.graph.connect(conditionNode, bodyResult.entry, 'Yes');

    // Connect: body --> update (or condition if no update)
    if (bodyResult.exit) {
      if (updateNode) {
        ctx.graph.connect(bodyResult.exit, updateNode);
        ctx.graph.connect(updateNode, conditionNode);
      } else {
        ctx.graph.connect(bodyResult.exit, conditionNode);
      }
    }
  } else {
    // Empty body
    if (updateNode) {
      ctx.graph.connect(conditionNode, updateNode, 'Yes');
      ctx.graph.connect(updateNode, conditionNode);
    } else {
      ctx.graph.connect(conditionNode, conditionNode, 'Yes');
    }
  }

  // Connect: condition --No--> after
  ctx.graph.connect(conditionNode, afterLoop, 'No');

  return { entry: initNode || conditionNode, exit: afterLoop };
}

function processJSWhile(node, ctx) {
  const condition = formatExpression(node.test);
  const conditionNode = ctx.graph.createNode('decision', condition + '?', 'diamond');

  // After loop node
  const afterLoop = ctx.graph.createNode('process', '', 'circle');
  afterLoop.type = 'merge';

  // Create context for loop body
  const loopCtx = ctx.clone();
  loopCtx.currentNode = conditionNode;
  loopCtx.breakTarget = afterLoop;
  loopCtx.continueTarget = conditionNode;

  // Process loop body
  let loopBody = node.body;
  if (loopBody.type === 'BlockStatement') {
    loopBody = loopBody.body;
  } else {
    loopBody = [loopBody];
  }

  const bodyResult = processJSBlock(loopBody, loopCtx);

  // Connect: condition --Yes--> body --> condition
  if (bodyResult.entry) {
    ctx.graph.connect(conditionNode, bodyResult.entry, 'Yes');
    if (bodyResult.exit) {
      ctx.graph.connect(bodyResult.exit, conditionNode);
    }
  } else {
    ctx.graph.connect(conditionNode, conditionNode, 'Yes');
  }

  // Connect: condition --No--> after
  ctx.graph.connect(conditionNode, afterLoop, 'No');

  return { entry: conditionNode, exit: afterLoop };
}

function processJSDoWhile(node, ctx) {
  // Body node (executed first)
  const bodyStart = ctx.graph.createNode('process', 'do', 'rounded');

  // Condition node
  const condition = formatExpression(node.test);
  const conditionNode = ctx.graph.createNode('decision', condition + '?', 'diamond');

  // After loop node
  const afterLoop = ctx.graph.createNode('process', '', 'circle');
  afterLoop.type = 'merge';

  // Create context for loop body
  const loopCtx = ctx.clone();
  loopCtx.currentNode = bodyStart;
  loopCtx.breakTarget = afterLoop;
  loopCtx.continueTarget = conditionNode;

  // Process loop body
  let loopBody = node.body;
  if (loopBody.type === 'BlockStatement') {
    loopBody = loopBody.body;
  } else {
    loopBody = [loopBody];
  }

  const bodyResult = processJSBlock(loopBody, loopCtx);

  // Connect: bodyStart --> body --> condition
  if (bodyResult.entry) {
    ctx.graph.connect(bodyStart, bodyResult.entry);
    if (bodyResult.exit) {
      ctx.graph.connect(bodyResult.exit, conditionNode);
    }
  } else {
    ctx.graph.connect(bodyStart, conditionNode);
  }

  // Connect: condition --Yes--> bodyStart (loop back)
  ctx.graph.connect(conditionNode, bodyStart, 'Yes');

  // Connect: condition --No--> after
  ctx.graph.connect(conditionNode, afterLoop, 'No');

  return { entry: bodyStart, exit: afterLoop };
}

function processJSForIn(node, ctx) {
  const left = node.left.type === 'VariableDeclaration'
    ? `${node.left.kind} ${formatExpression(node.left.declarations[0].id)}`
    : formatExpression(node.left);
  const right = formatExpression(node.right);
  const keyword = node.type === 'ForOfStatement' ? 'of' : 'in';

  const conditionLabel = `${left} ${keyword} ${right}`;
  const conditionNode = ctx.graph.createNode('decision', conditionLabel + '?', 'diamond');

  // After loop node
  const afterLoop = ctx.graph.createNode('process', '', 'circle');
  afterLoop.type = 'merge';

  // Create context for loop body
  const loopCtx = ctx.clone();
  loopCtx.currentNode = conditionNode;
  loopCtx.breakTarget = afterLoop;
  loopCtx.continueTarget = conditionNode;

  // Process loop body
  let loopBody = node.body;
  if (loopBody.type === 'BlockStatement') {
    loopBody = loopBody.body;
  } else {
    loopBody = [loopBody];
  }

  const bodyResult = processJSBlock(loopBody, loopCtx);

  // Connect: condition --Yes--> body --> condition
  if (bodyResult.entry) {
    ctx.graph.connect(conditionNode, bodyResult.entry, 'Yes');
    if (bodyResult.exit) {
      ctx.graph.connect(bodyResult.exit, conditionNode);
    }
  } else {
    ctx.graph.connect(conditionNode, conditionNode, 'Yes');
  }

  // Connect: condition --No--> after
  ctx.graph.connect(conditionNode, afterLoop, 'No');

  return { entry: conditionNode, exit: afterLoop };
}

function processJSSwitch(node, ctx) {
  const discriminant = formatExpression(node.discriminant);
  const switchNode = ctx.graph.createNode('decision', `switch (${discriminant})`, 'diamond');

  // After switch node (break target)
  const afterSwitch = ctx.graph.createNode('process', '', 'circle');
  afterSwitch.type = 'merge';

  let previousFallthrough = null;

  for (const caseClause of node.cases) {
    const caseLabel = caseClause.test ? `case ${formatExpression(caseClause.test)}` : 'default';
    const caseNode = ctx.graph.createNode('process', caseLabel, 'rectangle');

    // Connect switch to case
    ctx.graph.connect(switchNode, caseNode, caseClause.test ? formatExpression(caseClause.test) : 'default');

    // Connect fallthrough from previous case if any
    if (previousFallthrough) {
      ctx.graph.connect(previousFallthrough, caseNode);
      previousFallthrough = null;
    }

    // Create context for case body
    const caseCtx = ctx.clone();
    caseCtx.currentNode = caseNode;
    caseCtx.breakTarget = afterSwitch;

    // Process case body
    const bodyResult = processJSBlock(caseClause.consequent, caseCtx);

    if (bodyResult.entry) {
      ctx.graph.connect(caseNode, bodyResult.entry);
      if (bodyResult.exit) {
        // Check if last statement was break
        const lastStmt = caseClause.consequent[caseClause.consequent.length - 1];
        if (lastStmt && lastStmt.type === 'BreakStatement') {
          // Already connected to afterSwitch by break handler
        } else {
          // Fallthrough to next case
          previousFallthrough = bodyResult.exit;
        }
      }
    } else {
      previousFallthrough = caseNode;
    }
  }

  // Connect any remaining fallthrough to after
  if (previousFallthrough) {
    ctx.graph.connect(previousFallthrough, afterSwitch);
  }

  return { entry: switchNode, exit: afterSwitch };
}

function processJSTry(node, ctx) {
  const tryNode = ctx.graph.createNode('process', 'try', 'rounded');

  // After try/catch/finally node
  const afterTry = ctx.graph.createNode('process', '', 'circle');
  afterTry.type = 'merge';

  // Process try block
  const tryCtx = ctx.clone();
  tryCtx.currentNode = tryNode;

  const tryResult = processJSBlock(node.block.body, tryCtx);

  if (tryResult.entry) {
    ctx.graph.connect(tryNode, tryResult.entry);
  }

  let tryExit = tryResult.exit;

  // Process catch block if exists
  if (node.handler) {
    const param = node.handler.param ? formatExpression(node.handler.param) : 'error';
    const catchNode = ctx.graph.createNode('process', `catch (${param})`, 'rounded');

    // Connect try to catch (error path)
    ctx.graph.connect(tryNode, catchNode, 'error');

    const catchCtx = ctx.clone();
    catchCtx.currentNode = catchNode;

    const catchResult = processJSBlock(node.handler.body.body, catchCtx);

    if (catchResult.entry) {
      ctx.graph.connect(catchNode, catchResult.entry);
    }

    // Both try and catch lead to finally or after
    if (node.finalizer) {
      // Will be connected to finally below
    } else {
      if (tryExit) {
        ctx.graph.connect(tryExit, afterTry);
      }
      if (catchResult.exit) {
        ctx.graph.connect(catchResult.exit, afterTry);
      }
    }
  }

  // Process finally block if exists
  if (node.finalizer) {
    const finallyNode = ctx.graph.createNode('process', 'finally', 'rounded');

    if (tryExit) {
      ctx.graph.connect(tryExit, finallyNode);
    }

    if (node.handler) {
      // Connect catch exit to finally
      const catchCtx = ctx.clone();
      const catchResult = processJSBlock(node.handler.body.body, catchCtx);
      if (catchResult.exit) {
        ctx.graph.connect(catchResult.exit, finallyNode);
      }
    }

    const finallyCtx = ctx.clone();
    finallyCtx.currentNode = finallyNode;

    const finallyResult = processJSBlock(node.finalizer.body, finallyCtx);

    if (finallyResult.entry) {
      ctx.graph.connect(finallyNode, finallyResult.entry);
    }
    if (finallyResult.exit) {
      ctx.graph.connect(finallyResult.exit, afterTry);
    } else {
      ctx.graph.connect(finallyNode, afterTry);
    }
  } else if (!node.handler && tryExit) {
    ctx.graph.connect(tryExit, afterTry);
  }

  return { entry: tryNode, exit: afterTry };
}

function processJSReturn(node, ctx) {
  const value = node.argument ? formatExpression(node.argument) : '';
  const label = value ? `return ${value}` : 'return';
  const returnNode = ctx.graph.createNode('process', label, 'rectangle');

  // Connect to function end if inside a function
  if (ctx.returnTarget) {
    ctx.graph.connect(returnNode, ctx.returnTarget);
  }

  return { entry: returnNode, exit: null }; // No exit - flow terminates
}

function processJSBreak(node, ctx) {
  const label = node.label ? `break ${node.label.name}` : 'break';
  const breakNode = ctx.graph.createNode('process', label, 'rectangle');

  // Connect to break target
  if (ctx.breakTarget) {
    ctx.graph.connect(breakNode, ctx.breakTarget);
  }

  return { entry: breakNode, exit: null }; // No exit - flow terminates
}

function processJSContinue(node, ctx) {
  const label = node.label ? `continue ${node.label.name}` : 'continue';
  const continueNode = ctx.graph.createNode('process', label, 'rectangle');

  // Connect to continue target (loop condition)
  if (ctx.continueTarget) {
    ctx.graph.connect(continueNode, ctx.continueTarget);
  }

  return { entry: continueNode, exit: null }; // No exit - flow terminates
}

function processJSThrow(node, ctx) {
  const arg = formatExpression(node.argument);
  const throwNode = ctx.graph.createNode('process', `throw ${arg}`, 'rectangle');

  return { entry: throwNode, exit: null }; // No exit - flow terminates
}

function processJSVariable(node, ctx) {
  const declarations = node.declarations.map(d => {
    const name = formatExpression(d.id);
    const value = d.init ? formatExpression(d.init) : undefined;
    return value !== undefined ? `${name} = ${value}` : name;
  }).join(', ');

  const label = `${node.kind} ${declarations}`;
  const varNode = ctx.graph.createNode('process', label, 'rectangle');

  return { entry: varNode, exit: varNode };
}

function processJSExpression(node, ctx) {
  const label = formatExpression(node.expression);
  const exprNode = ctx.graph.createNode('process', label, 'rectangle');

  return { entry: exprNode, exit: exprNode };
}

function processJSBlock(statements, ctx) {
  if (!statements || statements.length === 0) {
    return { entry: null, exit: ctx.currentNode };
  }

  let firstNode = null;
  let currentNode = ctx.currentNode;

  for (const stmt of statements) {
    const stmtCtx = ctx.clone();
    stmtCtx.currentNode = currentNode;

    const result = processJSStatement(stmt, stmtCtx);

    if (result.entry) {
      if (!firstNode) {
        firstNode = result.entry;
      }
      if (currentNode && currentNode !== ctx.currentNode) {
        ctx.graph.connect(currentNode, result.entry);
      }
      currentNode = result.exit;
    }

    // If exit is null, flow terminated (return, break, continue, throw)
    if (result.exit === null) {
      return { entry: firstNode, exit: null };
    }
  }

  return { entry: firstNode, exit: currentNode };
}

// ============================================================================
// 7. PYTHON PARSER (Custom Tokenizer)
// ============================================================================

function parsePython(code) {
  const lines = code.split('\n');
  const ast = { type: 'Program', body: [] };
  const stack = [{ indent: -1, node: ast, type: 'program' }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = getIndentLevel(line);

    // Pop stack until we find a parent with smaller indent
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    const node = parsePythonLine(trimmed, i + 1);

    if (node) {
      // Handle except/finally - attach to the most recent Try at same indent
      if (node.type === 'ExceptHandler' || node.type === 'Finally') {
        const tryNode = findParentTry(stack, indent);
        if (tryNode) {
          if (node.type === 'ExceptHandler') {
            tryNode.handlers = tryNode.handlers || [];
            tryNode.handlers.push(node);
          } else {
            tryNode.finalbody = node;
          }
          // Push to stack so except/finally body gets populated
          if (trimmed.endsWith(':')) {
            node.body = [];
            stack.push({ indent: indent, node: node, type: node.type });
          }
          continue;
        }
      }

      // Handle case - attach to the most recent Match at same indent
      if (node.type === 'Case') {
        const matchNode = findParentMatch(stack, indent);
        if (matchNode) {
          matchNode.cases = matchNode.cases || [];
          matchNode.cases.push(node);
          if (trimmed.endsWith(':')) {
            node.body = [];
            stack.push({ indent: indent, node: node, type: node.type });
          }
          continue;
        }
      }

      // Handle elif/else - attach to the most recent If or Loop at same indent
      if (node.type === 'Elif' || node.type === 'Else') {
        // For Else, first check if it belongs to a loop (for...else, while...else)
        if (node.type === 'Else') {
          const loopNode = findParentLoop(stack, parent, indent);
          if (loopNode) {
            // Attach else to the loop
            node.body = [];
            loopNode.orelse = node;
            if (trimmed.endsWith(':')) {
              stack.push({ indent: indent, node: node, type: 'Else' });
            }
            continue;
          }
        }

        // Otherwise, attach to If statement
        const ifNode = findParentIf(stack, parent, indent);
        if (ifNode) {
          if (node.type === 'Elif') {
            // Convert elif to nested if in orelse
            const nestedIf = {
              type: 'If',
              test: node.test,
              body: [],
              orelse: [],
              line: node.line
            };
            attachToOrelse(ifNode, nestedIf);
            if (trimmed.endsWith(':')) {
              stack.push({ indent: indent, node: nestedIf, type: 'If' });
            }
          } else {
            // Else body goes into orelse of the if chain
            node.body = [];
            attachElseToIf(ifNode, node);
            if (trimmed.endsWith(':')) {
              stack.push({ indent: indent, node: node, type: 'Else' });
            }
          }
          continue;
        }
      }

      parent.node.body.push(node);

      // If this starts a block (ends with :), push to stack
      if (trimmed.endsWith(':')) {
        node.body = [];
        stack.push({ indent: indent, node: node, type: node.type });
      }
    }
  }

  return ast;
}

// Find the most recent Try node at the same indentation level
function findParentTry(stack, indent) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].type === 'Try' && stack[i].indent === indent) {
      return stack[i].node;
    }
  }
  // Also check if parent's last child is a Try
  for (let i = stack.length - 1; i >= 0; i--) {
    const parentBody = stack[i].node.body;
    if (parentBody && parentBody.length > 0) {
      const lastChild = parentBody[parentBody.length - 1];
      if (lastChild.type === 'Try') {
        return lastChild;
      }
    }
  }
  return null;
}

// Find the most recent If node for elif/else attachment
function findParentIf(stack, parent, indent) {
  // Look for If in parent's body at same indent
  if (parent.node.body && parent.node.body.length > 0) {
    // Find the last If statement that could accept elif/else
    for (let i = parent.node.body.length - 1; i >= 0; i--) {
      const sibling = parent.node.body[i];
      if (sibling.type === 'If') {
        return getLastIfInChain(sibling);
      }
    }
  }
  return null;
}

// Find the most recent For or While loop for else attachment
function findParentLoop(stack, parent, indent) {
  if (parent.node.body && parent.node.body.length > 0) {
    for (let i = parent.node.body.length - 1; i >= 0; i--) {
      const sibling = parent.node.body[i];
      if (sibling.type === 'For' || sibling.type === 'While') {
        return sibling;
      }
    }
  }
  return null;
}

// Find the most recent Match node for case attachment
function findParentMatch(stack, indent) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].type === 'Match' && stack[i].indent === indent) {
      return stack[i].node;
    }
  }
  // Also check if parent's last child is a Match
  for (let i = stack.length - 1; i >= 0; i--) {
    const parentBody = stack[i].node.body;
    if (parentBody && parentBody.length > 0) {
      const lastChild = parentBody[parentBody.length - 1];
      if (lastChild.type === 'Match') {
        return lastChild;
      }
    }
  }
  return null;
}

// Get the last If in an if-elif chain (the one whose orelse is empty)
function getLastIfInChain(ifNode) {
  if (ifNode.orelse && ifNode.orelse.length > 0) {
    const last = ifNode.orelse[ifNode.orelse.length - 1];
    if (last.type === 'If') {
      return getLastIfInChain(last);
    }
  }
  return ifNode;
}

// Attach an elif (as nested If) to the orelse of the if chain
function attachToOrelse(ifNode, nestedIf) {
  const lastIf = getLastIfInChain(ifNode);
  lastIf.orelse = lastIf.orelse || [];
  lastIf.orelse.push(nestedIf);
}

// Attach else body to the if chain
function attachElseToIf(ifNode, elseNode) {
  const lastIf = getLastIfInChain(ifNode);
  lastIf.orelse = lastIf.orelse || [];
  // Mark that this will receive else body
  lastIf._elseNode = elseNode;
}

function getIndentLevel(line) {
  let indent = 0;
  for (const char of line) {
    if (char === ' ') indent++;
    else if (char === '\t') indent += 4;
    else break;
  }
  return indent;
}

function parsePythonLine(line, lineNum) {
  // Function definition
  let match = line.match(/^def\s+(\w+)\s*\((.*?)\)\s*:/);
  if (match) {
    return {
      type: 'FunctionDef',
      name: match[1],
      params: match[2],
      body: [],
      line: lineNum
    };
  }

  // Class definition
  match = line.match(/^class\s+(\w+)(?:\s*\((.*?)\))?\s*:/);
  if (match) {
    return {
      type: 'ClassDef',
      name: match[1],
      bases: match[2] || '',
      body: [],
      line: lineNum
    };
  }

  // If statement
  match = line.match(/^if\s+(.+)\s*:/);
  if (match) {
    return {
      type: 'If',
      test: match[1],
      body: [],
      orelse: [],
      line: lineNum
    };
  }

  // Elif statement
  match = line.match(/^elif\s+(.+)\s*:/);
  if (match) {
    return {
      type: 'Elif',
      test: match[1],
      body: [],
      line: lineNum
    };
  }

  // Else statement
  if (line === 'else:') {
    return {
      type: 'Else',
      body: [],
      line: lineNum
    };
  }

  // For loop
  match = line.match(/^for\s+(.+)\s+in\s+(.+)\s*:/);
  if (match) {
    return {
      type: 'For',
      target: match[1],
      iter: match[2],
      body: [],
      line: lineNum
    };
  }

  // While loop
  match = line.match(/^while\s+(.+)\s*:/);
  if (match) {
    return {
      type: 'While',
      test: match[1],
      body: [],
      line: lineNum
    };
  }

  // Try statement
  if (line === 'try:') {
    return {
      type: 'Try',
      body: [],
      handlers: [],
      orelse: [],
      finalbody: [],
      line: lineNum
    };
  }

  // Except handler
  match = line.match(/^except(?:\s+(\w+)(?:\s+as\s+(\w+))?)?\s*:/);
  if (match) {
    return {
      type: 'ExceptHandler',
      exceptionType: match[1] || '',
      name: match[2] || '',
      body: [],
      line: lineNum
    };
  }

  // Finally
  if (line === 'finally:') {
    return {
      type: 'Finally',
      body: [],
      line: lineNum
    };
  }

  // With statement
  match = line.match(/^with\s+(.+)\s*:/);
  if (match) {
    return {
      type: 'With',
      items: match[1],
      body: [],
      line: lineNum
    };
  }

  // Return statement
  match = line.match(/^return(?:\s+(.+))?$/);
  if (match) {
    return {
      type: 'Return',
      value: match[1] || '',
      line: lineNum
    };
  }

  // Break statement
  if (line === 'break') {
    return {
      type: 'Break',
      line: lineNum
    };
  }

  // Continue statement
  if (line === 'continue') {
    return {
      type: 'Continue',
      line: lineNum
    };
  }

  // Pass statement
  if (line === 'pass') {
    return {
      type: 'Pass',
      line: lineNum
    };
  }

  // Raise statement
  match = line.match(/^raise(?:\s+(.+))?$/);
  if (match) {
    return {
      type: 'Raise',
      exception: match[1] || '',
      line: lineNum
    };
  }

  // Assert statement
  match = line.match(/^assert\s+(.+)$/);
  if (match) {
    return {
      type: 'Assert',
      test: match[1],
      line: lineNum
    };
  }

  // Match statement (Python 3.10+)
  match = line.match(/^match\s+(.+)\s*:$/);
  if (match) {
    return {
      type: 'Match',
      subject: match[1],
      cases: [],
      body: [],
      line: lineNum
    };
  }

  // Case statement (for match)
  match = line.match(/^case\s+(.+)\s*:$/);
  if (match) {
    return {
      type: 'Case',
      pattern: match[1],
      body: [],
      line: lineNum
    };
  }

  // Import statement
  match = line.match(/^(?:from\s+\S+\s+)?import\s+.+$/);
  if (match) {
    return {
      type: 'Import',
      statement: line,
      line: lineNum
    };
  }

  // Generic expression/statement
  return {
    type: 'Expr',
    value: line,
    line: lineNum
  };
}

// ============================================================================
// 8. PYTHON STATEMENT HANDLERS
// ============================================================================

function processPyStatement(node, ctx) {
  if (!node) return { entry: null, exit: null };

  switch (node.type) {
    case 'FunctionDef':
      return processPyFunction(node, ctx);

    case 'ClassDef':
      return processPyClass(node, ctx);

    case 'If':
      return processPyIf(node, ctx);

    case 'For':
      return processPyFor(node, ctx);

    case 'While':
      return processPyWhile(node, ctx);

    case 'Try':
      return processPyTry(node, ctx);

    case 'With':
      return processPyWith(node, ctx);

    case 'Match':
      return processPyMatch(node, ctx);

    case 'Return':
      return processPyReturn(node, ctx);

    case 'Break':
      return processPyBreak(node, ctx);

    case 'Continue':
      return processPyContinue(node, ctx);

    case 'Raise':
      return processPyRaise(node, ctx);

    case 'Pass':
      // Pass is a no-op, skip it
      return { entry: null, exit: ctx.currentNode };

    case 'Assert':
    case 'Import':
    case 'Expr':
    default:
      return processPyGeneric(node, ctx);
  }
}

function processPyFunction(node, ctx) {
  const funcLabel = `def ${node.name}(${node.params})`;
  const funcNode = ctx.graph.createNode('subroutine', funcLabel, 'rounded');
  const funcEnd = ctx.graph.createNode('process', `end ${node.name}`, 'rounded');

  // Create context for function body
  const funcCtx = ctx.clone();
  funcCtx.currentNode = funcNode;
  funcCtx.returnTarget = funcEnd;

  // Process function body
  const bodyResult = processPyBlock(node.body, funcCtx);

  if (bodyResult.entry) {
    ctx.graph.connect(funcNode, bodyResult.entry);
  }
  if (bodyResult.exit) {
    ctx.graph.connect(bodyResult.exit, funcEnd);
  }

  return { entry: funcNode, exit: funcEnd };
}

function processPyClass(node, ctx) {
  const classLabel = node.bases ? `class ${node.name}(${node.bases})` : `class ${node.name}`;
  const classNode = ctx.graph.createNode('subroutine', classLabel, 'rounded');

  // Create context for class body
  const classCtx = ctx.clone();
  classCtx.currentNode = classNode;

  // Process class body (methods)
  const bodyResult = processPyBlock(node.body, classCtx);

  if (bodyResult.entry) {
    ctx.graph.connect(classNode, bodyResult.entry);
  }

  return { entry: classNode, exit: bodyResult.exit || classNode };
}

function processPyIf(node, ctx) {
  const conditionNode = ctx.graph.createNode('decision', node.test + '?', 'diamond');

  // Merge node for after if/else
  const mergeNode = ctx.graph.createNode('process', '', 'circle');
  mergeNode.type = 'merge';

  // Process TRUE branch - ALWAYS "Yes"
  const trueCtx = ctx.clone();
  trueCtx.currentNode = conditionNode;

  const trueResult = processPyBlock(node.body, trueCtx);

  if (trueResult.entry) {
    ctx.graph.connect(conditionNode, trueResult.entry, 'Yes');
    if (trueResult.exit) {
      ctx.graph.connect(trueResult.exit, mergeNode);
    }
  } else {
    ctx.graph.connect(conditionNode, mergeNode, 'Yes');
  }

  // Process FALSE branch (orelse) - handles elif chains and else
  if (node.orelse && node.orelse.length > 0) {
    const firstOrelse = node.orelse[0];

    if (firstOrelse.type === 'If') {
      // This is an elif - recursively process with shared merge node
      const elifResult = processPyIfWithMerge(firstOrelse, ctx, mergeNode);
      ctx.graph.connect(conditionNode, elifResult.entry, 'No');
    } else if (node._elseNode && node._elseNode.body) {
      // This is an else block (attached via _elseNode)
      const elseCtx = ctx.clone();
      elseCtx.currentNode = conditionNode;

      const elseResult = processPyBlock(node._elseNode.body, elseCtx);

      if (elseResult.entry) {
        ctx.graph.connect(conditionNode, elseResult.entry, 'No');
        if (elseResult.exit) {
          ctx.graph.connect(elseResult.exit, mergeNode);
        }
      } else {
        ctx.graph.connect(conditionNode, mergeNode, 'No');
      }
    } else {
      // Regular else body in orelse
      const elseCtx = ctx.clone();
      elseCtx.currentNode = conditionNode;

      const elseResult = processPyBlock(node.orelse, elseCtx);

      if (elseResult.entry) {
        ctx.graph.connect(conditionNode, elseResult.entry, 'No');
        if (elseResult.exit) {
          ctx.graph.connect(elseResult.exit, mergeNode);
        }
      } else {
        ctx.graph.connect(conditionNode, mergeNode, 'No');
      }
    }
  } else if (node._elseNode && node._elseNode.body) {
    // Else block attached via _elseNode (no orelse array)
    const elseCtx = ctx.clone();
    elseCtx.currentNode = conditionNode;

    const elseResult = processPyBlock(node._elseNode.body, elseCtx);

    if (elseResult.entry) {
      ctx.graph.connect(conditionNode, elseResult.entry, 'No');
      if (elseResult.exit) {
        ctx.graph.connect(elseResult.exit, mergeNode);
      }
    } else {
      ctx.graph.connect(conditionNode, mergeNode, 'No');
    }
  } else {
    // No else - "No" goes directly to merge
    ctx.graph.connect(conditionNode, mergeNode, 'No');
  }

  return { entry: conditionNode, exit: mergeNode };
}

// Helper function to process elif chains with a shared merge node
function processPyIfWithMerge(node, ctx, mergeNode) {
  const conditionNode = ctx.graph.createNode('decision', node.test + '?', 'diamond');

  // Process TRUE branch
  const trueCtx = ctx.clone();
  trueCtx.currentNode = conditionNode;

  const trueResult = processPyBlock(node.body, trueCtx);

  if (trueResult.entry) {
    ctx.graph.connect(conditionNode, trueResult.entry, 'Yes');
    if (trueResult.exit) {
      ctx.graph.connect(trueResult.exit, mergeNode);
    }
  } else {
    ctx.graph.connect(conditionNode, mergeNode, 'Yes');
  }

  // Process FALSE branch
  if (node.orelse && node.orelse.length > 0) {
    const firstOrelse = node.orelse[0];

    if (firstOrelse.type === 'If') {
      // Another elif
      const elifResult = processPyIfWithMerge(firstOrelse, ctx, mergeNode);
      ctx.graph.connect(conditionNode, elifResult.entry, 'No');
    } else {
      // Else body
      const elseCtx = ctx.clone();
      elseCtx.currentNode = conditionNode;

      const elseResult = processPyBlock(node.orelse, elseCtx);

      if (elseResult.entry) {
        ctx.graph.connect(conditionNode, elseResult.entry, 'No');
        if (elseResult.exit) {
          ctx.graph.connect(elseResult.exit, mergeNode);
        }
      } else {
        ctx.graph.connect(conditionNode, mergeNode, 'No');
      }
    }
  } else if (node._elseNode && node._elseNode.body) {
    const elseCtx = ctx.clone();
    elseCtx.currentNode = conditionNode;

    const elseResult = processPyBlock(node._elseNode.body, elseCtx);

    if (elseResult.entry) {
      ctx.graph.connect(conditionNode, elseResult.entry, 'No');
      if (elseResult.exit) {
        ctx.graph.connect(elseResult.exit, mergeNode);
      }
    } else {
      ctx.graph.connect(conditionNode, mergeNode, 'No');
    }
  } else {
    ctx.graph.connect(conditionNode, mergeNode, 'No');
  }

  return { entry: conditionNode, exit: mergeNode };
}

function processPyFor(node, ctx) {
  const conditionLabel = `${node.target} in ${node.iter}`;
  const conditionNode = ctx.graph.createNode('decision', conditionLabel + '?', 'diamond');

  // After loop node
  const afterLoop = ctx.graph.createNode('process', '', 'circle');
  afterLoop.type = 'merge';

  // Create context for loop body
  const loopCtx = ctx.clone();
  loopCtx.currentNode = conditionNode;
  loopCtx.breakTarget = afterLoop;
  loopCtx.continueTarget = conditionNode;

  // Process loop body
  const bodyResult = processPyBlock(node.body, loopCtx);

  // Connect: condition --Yes--> body --> condition
  if (bodyResult.entry) {
    ctx.graph.connect(conditionNode, bodyResult.entry, 'Yes');
    if (bodyResult.exit) {
      ctx.graph.connect(bodyResult.exit, conditionNode);
    }
  } else {
    ctx.graph.connect(conditionNode, conditionNode, 'Yes');
  }

  // Handle for...else (else runs when loop completes normally, not on break)
  if (node.orelse && node.orelse.body && node.orelse.body.length > 0) {
    const elseCtx = ctx.clone();
    elseCtx.currentNode = conditionNode;

    const elseResult = processPyBlock(node.orelse.body, elseCtx);

    if (elseResult.entry) {
      ctx.graph.connect(conditionNode, elseResult.entry, 'No');
      if (elseResult.exit) {
        ctx.graph.connect(elseResult.exit, afterLoop);
      }
    } else {
      ctx.graph.connect(conditionNode, afterLoop, 'No');
    }
  } else {
    // Connect: condition --No--> after
    ctx.graph.connect(conditionNode, afterLoop, 'No');
  }

  return { entry: conditionNode, exit: afterLoop };
}

function processPyWhile(node, ctx) {
  const conditionNode = ctx.graph.createNode('decision', node.test + '?', 'diamond');

  // After loop node
  const afterLoop = ctx.graph.createNode('process', '', 'circle');
  afterLoop.type = 'merge';

  // Create context for loop body
  const loopCtx = ctx.clone();
  loopCtx.currentNode = conditionNode;
  loopCtx.breakTarget = afterLoop;
  loopCtx.continueTarget = conditionNode;

  // Process loop body
  const bodyResult = processPyBlock(node.body, loopCtx);

  // Connect: condition --Yes--> body --> condition
  if (bodyResult.entry) {
    ctx.graph.connect(conditionNode, bodyResult.entry, 'Yes');
    if (bodyResult.exit) {
      ctx.graph.connect(bodyResult.exit, conditionNode);
    }
  } else {
    ctx.graph.connect(conditionNode, conditionNode, 'Yes');
  }

  // Handle while...else (else runs when loop completes normally, not on break)
  if (node.orelse && node.orelse.body && node.orelse.body.length > 0) {
    const elseCtx = ctx.clone();
    elseCtx.currentNode = conditionNode;

    const elseResult = processPyBlock(node.orelse.body, elseCtx);

    if (elseResult.entry) {
      ctx.graph.connect(conditionNode, elseResult.entry, 'No');
      if (elseResult.exit) {
        ctx.graph.connect(elseResult.exit, afterLoop);
      }
    } else {
      ctx.graph.connect(conditionNode, afterLoop, 'No');
    }
  } else {
    // Connect: condition --No--> after
    ctx.graph.connect(conditionNode, afterLoop, 'No');
  }

  return { entry: conditionNode, exit: afterLoop };
}

function processPyTry(node, ctx) {
  const tryNode = ctx.graph.createNode('process', 'try', 'rounded');

  // After try/catch/finally node
  const afterTry = ctx.graph.createNode('process', '', 'circle');
  afterTry.type = 'merge';

  // Process try body
  const tryCtx = ctx.clone();
  tryCtx.currentNode = tryNode;

  const tryResult = processPyBlock(node.body, tryCtx);

  if (tryResult.entry) {
    ctx.graph.connect(tryNode, tryResult.entry);
  }

  let tryExit = tryResult.exit;
  let finallyNode = null;
  let finallyExit = null;

  // Process finally block if exists (before except so we know where to connect)
  if (node.finalbody && node.finalbody.body) {
    finallyNode = ctx.graph.createNode('process', 'finally', 'rounded');

    const finallyCtx = ctx.clone();
    finallyCtx.currentNode = finallyNode;

    const finallyResult = processPyBlock(node.finalbody.body, finallyCtx);

    if (finallyResult.entry) {
      ctx.graph.connect(finallyNode, finallyResult.entry);
      finallyExit = finallyResult.exit;
    } else {
      finallyExit = finallyNode;
    }

    // Finally always leads to afterTry
    if (finallyExit) {
      ctx.graph.connect(finallyExit, afterTry);
    }
  }

  // The target for normal completion (either finally or afterTry)
  const normalTarget = finallyNode || afterTry;

  // Connect try exit to normal target
  if (tryExit) {
    ctx.graph.connect(tryExit, normalTarget);
  }

  // Process except handlers
  if (node.handlers && node.handlers.length > 0) {
    for (const handler of node.handlers) {
      let exceptLabel = 'except';
      if (handler.exceptionType) {
        exceptLabel = handler.name
          ? `except ${handler.exceptionType} as ${handler.name}`
          : `except ${handler.exceptionType}`;
      }

      const exceptNode = ctx.graph.createNode('process', exceptLabel, 'rounded');

      // Connect try to except (error path)
      ctx.graph.connect(tryNode, exceptNode, 'error');

      const exceptCtx = ctx.clone();
      exceptCtx.currentNode = exceptNode;

      const exceptResult = processPyBlock(handler.body, exceptCtx);

      if (exceptResult.entry) {
        ctx.graph.connect(exceptNode, exceptResult.entry);
        if (exceptResult.exit) {
          ctx.graph.connect(exceptResult.exit, normalTarget);
        }
      } else {
        ctx.graph.connect(exceptNode, normalTarget);
      }
    }
  }

  return { entry: tryNode, exit: afterTry };
}

function processPyWith(node, ctx) {
  const withNode = ctx.graph.createNode('process', `with ${node.items}`, 'rounded');

  // Create context for with body
  const withCtx = ctx.clone();
  withCtx.currentNode = withNode;

  // Process with body
  const bodyResult = processPyBlock(node.body, withCtx);

  if (bodyResult.entry) {
    ctx.graph.connect(withNode, bodyResult.entry);
  }

  return { entry: withNode, exit: bodyResult.exit || withNode };
}

function processPyMatch(node, ctx) {
  const matchNode = ctx.graph.createNode('decision', `match ${node.subject}`, 'diamond');

  // After match node (where all cases merge)
  const afterMatch = ctx.graph.createNode('process', '', 'circle');
  afterMatch.type = 'merge';

  // Process each case
  if (node.cases && node.cases.length > 0) {
    for (const caseNode of node.cases) {
      const pattern = caseNode.pattern;
      const caseLabel = pattern === '_' ? 'default' : `case ${pattern}`;
      const caseProcessNode = ctx.graph.createNode('process', caseLabel, 'rectangle');

      // Connect match to case
      ctx.graph.connect(matchNode, caseProcessNode, pattern === '_' ? 'default' : pattern);

      // Create context for case body
      const caseCtx = ctx.clone();
      caseCtx.currentNode = caseProcessNode;

      // Process case body
      const bodyResult = processPyBlock(caseNode.body, caseCtx);

      if (bodyResult.entry) {
        ctx.graph.connect(caseProcessNode, bodyResult.entry);
        if (bodyResult.exit) {
          ctx.graph.connect(bodyResult.exit, afterMatch);
        }
      } else {
        ctx.graph.connect(caseProcessNode, afterMatch);
      }
    }
  } else {
    // No cases - connect directly to after
    ctx.graph.connect(matchNode, afterMatch);
  }

  return { entry: matchNode, exit: afterMatch };
}

function processPyReturn(node, ctx) {
  const label = node.value ? `return ${node.value}` : 'return';
  const returnNode = ctx.graph.createNode('process', label, 'rectangle');

  // Connect to function end if inside a function
  if (ctx.returnTarget) {
    ctx.graph.connect(returnNode, ctx.returnTarget);
  }

  return { entry: returnNode, exit: null }; // No exit - flow terminates
}

function processPyBreak(node, ctx) {
  const breakNode = ctx.graph.createNode('process', 'break', 'rectangle');

  // Connect to break target
  if (ctx.breakTarget) {
    ctx.graph.connect(breakNode, ctx.breakTarget);
  }

  return { entry: breakNode, exit: null }; // No exit - flow terminates
}

function processPyContinue(node, ctx) {
  const continueNode = ctx.graph.createNode('process', 'continue', 'rectangle');

  // Connect to continue target (loop condition)
  if (ctx.continueTarget) {
    ctx.graph.connect(continueNode, ctx.continueTarget);
  }

  return { entry: continueNode, exit: null }; // No exit - flow terminates
}

function processPyRaise(node, ctx) {
  const label = node.exception ? `raise ${node.exception}` : 'raise';
  const raiseNode = ctx.graph.createNode('process', label, 'rectangle');

  return { entry: raiseNode, exit: null }; // No exit - flow terminates
}

function processPyGeneric(node, ctx) {
  let label = '';

  if (node.type === 'Assert') {
    label = `assert ${node.test}`;
  } else if (node.type === 'Import') {
    label = node.statement;
  } else if (node.type === 'Expr') {
    label = node.value;
  } else {
    label = node.type;
  }

  // Truncate long labels
  if (label.length > 60) {
    label = label.substring(0, 57) + '...';
  }

  const genericNode = ctx.graph.createNode('process', label, 'rectangle');

  return { entry: genericNode, exit: genericNode };
}

function processPyBlock(statements, ctx) {
  if (!statements || statements.length === 0) {
    return { entry: null, exit: ctx.currentNode };
  }

  let firstNode = null;
  let currentNode = ctx.currentNode;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];

    // Skip Elif and Else - they're now handled by the If processor via orelse
    if (stmt.type === 'Elif' || stmt.type === 'Else') {
      continue;
    }

    // Skip ExceptHandler and Finally - they're now attached to Try nodes
    if (stmt.type === 'ExceptHandler' || stmt.type === 'Finally') {
      continue;
    }

    // Skip Case - they're now attached to Match nodes
    if (stmt.type === 'Case') {
      continue;
    }

    const stmtCtx = ctx.clone();
    stmtCtx.currentNode = currentNode;

    const result = processPyStatement(stmt, stmtCtx);

    if (result.entry) {
      if (!firstNode) {
        firstNode = result.entry;
      }
      if (currentNode && currentNode !== ctx.currentNode) {
        ctx.graph.connect(currentNode, result.entry);
      }
      currentNode = result.exit;
    }

    // If exit is null, flow terminated (return, break, continue, raise)
    if (result.exit === null) {
      return { entry: firstNode, exit: null };
    }
  }

  return { entry: firstNode, exit: currentNode };
}

// ============================================================================
// 9. FLOWCHART CONVERTER
// ============================================================================

function convertToFlowchart(code, language) {
  const graph = new FlowchartGraph();

  // Create start node
  const startNode = graph.createNode('start', 'Start', 'circle');

  // Create end node
  const endNode = graph.createNode('end', 'End', 'circle');

  // Create traversal context
  const ctx = new TraversalContext(graph);
  ctx.currentNode = startNode;

  let ast;
  let blockResult;

  try {
    if (language === 'javascript') {
      ast = parseJavaScript(code);
      blockResult = processJSBlock(ast.body, ctx);
    } else {
      ast = parsePython(code);
      blockResult = processPyBlock(ast.body, ctx);
    }
  } catch (error) {
    throw error;
  }

  // Connect start to first node
  if (blockResult.entry) {
    graph.connect(startNode, blockResult.entry);
  } else {
    graph.connect(startNode, endNode);
  }

  // Connect last node to end
  if (blockResult.exit) {
    graph.connect(blockResult.exit, endNode);
  }

  return graph;
}

// ============================================================================
// 10. MERMAID GENERATOR
// ============================================================================

function graphToMermaid(graph) {
  let mermaid = 'flowchart TD\n';

  // Generate node declarations
  for (const node of graph.nodes) {
    const label = escapeLabel(node.label);

    // Skip empty merge nodes in declaration (they still exist for connections)
    if (node.type === 'merge' && !node.label) {
      mermaid += `    ${node.id}(( ))\n`;
      continue;
    }

    switch (node.shape) {
      case 'circle':
        mermaid += `    ${node.id}(("${label}"))\n`;
        break;
      case 'diamond':
        mermaid += `    ${node.id}{"${label}"}\n`;
        break;
      case 'rounded':
        mermaid += `    ${node.id}(["${label}"])\n`;
        break;
      case 'parallelogram':
        mermaid += `    ${node.id}[/"${label}"/]\n`;
        break;
      default:
        mermaid += `    ${node.id}["${label}"]\n`;
    }
  }

  // Generate edges
  for (const edge of graph.edges) {
    if (edge.label) {
      mermaid += `    ${edge.from} -->|${edge.label}| ${edge.to}\n`;
    } else {
      mermaid += `    ${edge.from} --> ${edge.to}\n`;
    }
  }

  return mermaid;
}

function escapeLabel(text) {
  if (!text) return '';

  return text
    .replace(/"/g, "'")
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&(?!lt;|gt;|amp;|quot;)/g, '&amp;')
    .replace(/\n/g, ' ')
    .substring(0, 80);
}

// ============================================================================
// 11. UI & MONACO EDITOR
// ============================================================================

let editor;
let currentLanguage = 'javascript';
let debounceTimer = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeLanguageSelector();
});

function initializeLanguageSelector() {
  const selector = document.getElementById('language-select');

  if (selector) {
    selector.addEventListener('change', (e) => {
      currentLanguage = e.target.value;

      // Update editor language and content
      if (editor) {
        monaco.editor.setModelLanguage(editor.getModel(), currentLanguage === 'javascript' ? 'javascript' : 'python');
        editor.setValue(DEFAULT_CODE[currentLanguage]);
      }

      // Regenerate flowchart
      generateFlowchart(DEFAULT_CODE[currentLanguage]);
    });
  }
}

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
  editor = monaco.editor.create(document.getElementById('code-editor'), {
    value: DEFAULT_CODE[currentLanguage],
    language: 'javascript',
    theme: 'vs-dark',
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'on',
    tabSize: 2
  });

  // Listen to code changes with debouncing
  editor.onDidChangeModelContent(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const code = editor.getValue();
      generateFlowchart(code);
    }, 250);
  });

  // Generate initial flowchart
  generateFlowchart(DEFAULT_CODE[currentLanguage]);
});

// Generate flowchart from code
function generateFlowchart(code) {
  const statusEl = document.getElementById('flowchart-status');

  try {
    // Convert code to flowchart graph
    const graph = convertToFlowchart(code, currentLanguage);

    // Generate Mermaid code
    const mermaidCode = graphToMermaid(graph);

    // Log for debugging
    console.log('Generated Mermaid Code:\n', mermaidCode);

    // Update status
    if (statusEl) {
      statusEl.textContent = `${graph.nodes.length} nodes, ${graph.edges.length} edges`;
      statusEl.className = 'status success';
    }

    // Render flowchart
    renderFlowchart(mermaidCode);

  } catch (error) {
    console.error('Flowchart generation error:', error);

    // Update status
    if (statusEl) {
      statusEl.textContent = error.message;
      statusEl.className = 'status error';
    }

    // Show error in flowchart panel
    const flowchartDiv = document.getElementById('flowchart');
    if (flowchartDiv) {
      flowchartDiv.innerHTML = `<div class="error-display">${escapeHtml(error.message)}</div>`;
    }
  }
}

// Render Mermaid flowchart
async function renderFlowchart(mermaidCode) {
  const flowchartDiv = document.getElementById('flowchart');

  if (!flowchartDiv) return;

  try {
    // Clear previous flowchart
    flowchartDiv.innerHTML = '';

    // Wait for mermaid to be available
    if (!window.mermaid) {
      setTimeout(() => renderFlowchart(mermaidCode), 100);
      return;
    }

    // Generate unique ID
    const id = `mermaid-${Date.now()}`;

    // Render with Mermaid
    const { svg } = await window.mermaid.render(id, mermaidCode);
    flowchartDiv.innerHTML = svg;

  } catch (error) {
    console.error('Mermaid rendering error:', error);
    console.error('Mermaid code that failed:\n', mermaidCode);
    flowchartDiv.innerHTML = `<div class="error-display">Rendering Error: ${escapeHtml(error.message)}\n\nGenerated Mermaid code:\n${escapeHtml(mermaidCode)}</div>`;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
