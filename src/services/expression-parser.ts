/**
 * Expression Parser for Obsidian Bases
 *
 * A complete expression parser supporting:
 * - Comparison operators: ==, !=, >, <, >=, <=
 * - Boolean operators: &&, ||, !
 * - Arithmetic operators: +, -, *, /, %
 * - Property access: file.name, note.property
 * - Method calls: string.contains("value")
 * - Function calls: now(), today(), if(cond, a, b)
 */

// ============================================================================
// Types
// ============================================================================

export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'NULL'
  | 'IDENTIFIER'
  | 'REGEX'
  | 'DOT'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COMMA'
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'PERCENT'
  | 'EQ'
  | 'NEQ'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string | number | boolean | null | { pattern: string; flags: string };
  position: number;
}

export type ASTNode =
  | LiteralNode
  | IdentifierNode
  | BinaryOpNode
  | UnaryOpNode
  | MemberAccessNode
  | CallNode
  | IndexAccessNode
  | RegexNode;

export interface LiteralNode {
  type: 'Literal';
  value: string | number | boolean | null;
}

export interface IdentifierNode {
  type: 'Identifier';
  name: string;
}

export interface BinaryOpNode {
  type: 'BinaryOp';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOpNode {
  type: 'UnaryOp';
  operator: string;
  operand: ASTNode;
}

export interface MemberAccessNode {
  type: 'MemberAccess';
  object: ASTNode;
  property: string;
}

export interface CallNode {
  type: 'Call';
  callee: ASTNode;
  arguments: ASTNode[];
}

export interface IndexAccessNode {
  type: 'IndexAccess';
  object: ASTNode;
  index: ASTNode;
}

export interface RegexNode {
  type: 'Regex';
  pattern: string;
  flags: string;
}

// Link object type (Phase 12)
export interface LinkObject {
  type: 'link';
  path: string;
  display?: string;
}

// File object interface (all properties optional for flexibility)
export interface FileObject {
  name: string;
  path?: string;
  folder?: string;
  ext?: string;
  basename?: string;
  size?: number;
  ctime?: Date;
  mtime?: Date;
  tags?: string[];
  links?: string[];
  embeds?: string[];
  properties?: Record<string, unknown>;
}

export interface EvaluationContext {
  // File properties
  file?: FileObject;
  // Note/frontmatter properties
  note?: Record<string, unknown>;
  // Phase 15: `this` context (current file when base is embedded)
  this?: {
    file?: FileObject;
  };
  // All properties flattened for direct access
  [key: string]: unknown;
}

// ============================================================================
// Tokenizer
// ============================================================================

export class Tokenizer {
  private input: string;
  private position: number = 0;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    this.tokens = [];
    this.position = 0;

    while (this.position < this.input.length) {
      this.skipWhitespace();
      if (this.position >= this.input.length) break;

      const token = this.nextToken();
      if (token) {
        this.tokens.push(token);
      }
    }

    this.tokens.push({ type: 'EOF', value: null, position: this.position });
    return this.tokens;
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++;
    }
  }

  private peek(offset: number = 0): string {
    return this.input[this.position + offset] || '';
  }

  private advance(): string {
    return this.input[this.position++];
  }

  private nextToken(): Token | null {
    const startPos = this.position;
    const char = this.peek();

    // String literals
    if (char === '"' || char === "'") {
      return this.readString(char);
    }

    // Numbers
    if (/\d/.test(char) || (char === '.' && /\d/.test(this.peek(1)))) {
      return this.readNumber();
    }

    // Regex literals (Phase 12) - /pattern/flags
    // Only parse as regex if followed by valid regex content (not a division)
    if (char === '/' && this.canBeRegex()) {
      return this.readRegex();
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(char)) {
      return this.readIdentifier();
    }

    // Two-character operators
    const twoChar = char + this.peek(1);
    if (twoChar === '==' || twoChar === '!=') {
      this.position += 2;
      return { type: twoChar === '==' ? 'EQ' : 'NEQ', value: twoChar, position: startPos };
    }
    if (twoChar === '>=' || twoChar === '<=') {
      this.position += 2;
      return { type: twoChar === '>=' ? 'GTE' : 'LTE', value: twoChar, position: startPos };
    }
    if (twoChar === '&&') {
      this.position += 2;
      return { type: 'AND', value: '&&', position: startPos };
    }
    if (twoChar === '||') {
      this.position += 2;
      return { type: 'OR', value: '||', position: startPos };
    }

    // Single-character operators and punctuation
    this.advance();
    switch (char) {
      case '.':
        return { type: 'DOT', value: '.', position: startPos };
      case '(':
        return { type: 'LPAREN', value: '(', position: startPos };
      case ')':
        return { type: 'RPAREN', value: ')', position: startPos };
      case '[':
        return { type: 'LBRACKET', value: '[', position: startPos };
      case ']':
        return { type: 'RBRACKET', value: ']', position: startPos };
      case ',':
        return { type: 'COMMA', value: ',', position: startPos };
      case '+':
        return { type: 'PLUS', value: '+', position: startPos };
      case '-':
        return { type: 'MINUS', value: '-', position: startPos };
      case '*':
        return { type: 'STAR', value: '*', position: startPos };
      case '/':
        return { type: 'SLASH', value: '/', position: startPos };
      case '%':
        return { type: 'PERCENT', value: '%', position: startPos };
      case '>':
        return { type: 'GT', value: '>', position: startPos };
      case '<':
        return { type: 'LT', value: '<', position: startPos };
      case '!':
        return { type: 'NOT', value: '!', position: startPos };
      case '=':
        // Single = is also equality in Obsidian Bases
        return { type: 'EQ', value: '=', position: startPos };
      default:
        throw new Error(`Unexpected character '${char}' at position ${startPos}`);
    }
  }

  private readString(quote: string): Token {
    const startPos = this.position;
    this.advance(); // skip opening quote
    let value = '';

    while (this.position < this.input.length) {
      const char = this.peek();
      if (char === quote) {
        this.advance(); // skip closing quote
        return { type: 'STRING', value, position: startPos };
      }
      if (char === '\\') {
        this.advance();
        const escaped = this.advance();
        switch (escaped) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '\\':
            value += '\\';
            break;
          case '"':
            value += '"';
            break;
          case "'":
            value += "'";
            break;
          default:
            value += escaped;
        }
      } else {
        value += this.advance();
      }
    }

    throw new Error(`Unterminated string starting at position ${startPos}`);
  }

  private readNumber(): Token {
    const startPos = this.position;
    let value = '';
    let hasDecimal = false;

    while (this.position < this.input.length) {
      const char = this.peek();
      if (/\d/.test(char)) {
        value += this.advance();
      } else if (char === '.' && !hasDecimal && /\d/.test(this.peek(1))) {
        hasDecimal = true;
        value += this.advance();
      } else {
        break;
      }
    }

    return { type: 'NUMBER', value: parseFloat(value), position: startPos };
  }

  private readIdentifier(): Token {
    const startPos = this.position;
    let value = '';

    while (this.position < this.input.length && /[a-zA-Z0-9_]/.test(this.peek())) {
      value += this.advance();
    }

    // Check for keywords
    if (value === 'true') {
      return { type: 'BOOLEAN', value: true, position: startPos };
    }
    if (value === 'false') {
      return { type: 'BOOLEAN', value: false, position: startPos };
    }
    if (value === 'null') {
      return { type: 'NULL', value: null, position: startPos };
    }
    if (value === 'and') {
      return { type: 'AND', value: 'and', position: startPos };
    }
    if (value === 'or') {
      return { type: 'OR', value: 'or', position: startPos };
    }
    if (value === 'not') {
      return { type: 'NOT', value: 'not', position: startPos };
    }

    return { type: 'IDENTIFIER', value, position: startPos };
  }

  // Phase 12: Check if / should be parsed as regex (not division)
  private canBeRegex(): boolean {
    // Look at what came before to determine if this is a regex
    // If the last token was a value (number, string, identifier, ), ]), it's division
    const lastToken = this.tokens[this.tokens.length - 1];
    if (!lastToken) return true;

    const nonRegexPrecedingTokens = ['NUMBER', 'STRING', 'BOOLEAN', 'IDENTIFIER', 'RPAREN', 'RBRACKET'];
    if (nonRegexPrecedingTokens.includes(lastToken.type)) {
      return false;
    }

    // Also check what follows - if it's whitespace followed by an operator or end, it's division
    // Skip the current / and check what's next
    const nextPos = this.position + 1;
    let checkPos = nextPos;

    // Skip any whitespace
    while (checkPos < this.input.length && /\s/.test(this.input[checkPos])) {
      checkPos++;
    }

    // If we hit end of input or an operator right after /, it's probably not a regex
    if (checkPos >= this.input.length) return false;
    const nextChar = this.input[checkPos];

    // If the next non-whitespace char is an operator or special char, it's division
    const divisionFollowers = ['+', '-', '*', '/', '%', ')', ']', ',', ';', '&', '|', '=', '!', '<', '>', ':'];
    if (divisionFollowers.includes(nextChar)) {
      return false;
    }

    return true;
  }

  private readRegex(): Token {
    const startPos = this.position;
    this.advance(); // skip opening /
    let pattern = '';
    let escaped = false;
    let inCharClass = false;

    while (this.position < this.input.length) {
      const char = this.peek();

      if (escaped) {
        pattern += char;
        escaped = false;
        this.advance();
        continue;
      }

      if (char === '\\') {
        escaped = true;
        pattern += char;
        this.advance();
        continue;
      }

      if (char === '[' && !inCharClass) {
        inCharClass = true;
        pattern += char;
        this.advance();
        continue;
      }

      if (char === ']' && inCharClass) {
        inCharClass = false;
        pattern += char;
        this.advance();
        continue;
      }

      if (char === '/' && !inCharClass) {
        this.advance(); // skip closing /
        break;
      }

      pattern += char;
      this.advance();
    }

    // Read flags
    let flags = '';
    while (this.position < this.input.length && /[gimsuy]/.test(this.peek())) {
      flags += this.advance();
    }

    return { type: 'REGEX', value: { pattern, flags }, position: startPos };
  }
}

// ============================================================================
// Parser
// ============================================================================

export class Parser {
  private tokens: Token[] = [];
  private position: number = 0;

  parse(input: string): ASTNode {
    const tokenizer = new Tokenizer(input);
    this.tokens = tokenizer.tokenize();
    this.position = 0;

    const ast = this.parseExpression();

    if (this.current().type !== 'EOF') {
      throw new Error(`Unexpected token '${this.current().value}' at position ${this.current().position}`);
    }

    return ast;
  }

  private current(): Token {
    return this.tokens[this.position] || { type: 'EOF', value: null, position: -1 };
  }

  private peek(offset: number = 0): Token {
    return this.tokens[this.position + offset] || { type: 'EOF', value: null, position: -1 };
  }

  private advance(): Token {
    const token = this.current();
    this.position++;
    return token;
  }

  private expect(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new Error(`Expected ${type} but got ${token.type} at position ${token.position}`);
    }
    return this.advance();
  }

  // Expression parsing with operator precedence
  // Lowest to highest precedence:
  // 1. || (or)
  // 2. && (and)
  // 3. ==, != (equality)
  // 4. <, >, <=, >= (comparison)
  // 5. +, - (additive)
  // 6. *, /, % (multiplicative)
  // 7. ! (unary)
  // 8. . [] () (postfix)
  // 9. literals, identifiers

  private parseExpression(): ASTNode {
    return this.parseOr();
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();

    while (this.current().type === 'OR') {
      this.advance();
      const right = this.parseAnd();
      left = { type: 'BinaryOp', operator: '||', left, right };
    }

    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseEquality();

    while (this.current().type === 'AND') {
      this.advance();
      const right = this.parseEquality();
      left = { type: 'BinaryOp', operator: '&&', left, right };
    }

    return left;
  }

  private parseEquality(): ASTNode {
    let left = this.parseComparison();

    while (this.current().type === 'EQ' || this.current().type === 'NEQ') {
      const operator = this.advance().type === 'EQ' ? '==' : '!=';
      const right = this.parseComparison();
      left = { type: 'BinaryOp', operator, left, right };
    }

    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseAdditive();

    while (
      this.current().type === 'GT' ||
      this.current().type === 'GTE' ||
      this.current().type === 'LT' ||
      this.current().type === 'LTE'
    ) {
      const token = this.advance();
      const operator =
        token.type === 'GT' ? '>' : token.type === 'GTE' ? '>=' : token.type === 'LT' ? '<' : '<=';
      const right = this.parseAdditive();
      left = { type: 'BinaryOp', operator, left, right };
    }

    return left;
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();

    while (this.current().type === 'PLUS' || this.current().type === 'MINUS') {
      const operator = this.advance().type === 'PLUS' ? '+' : '-';
      const right = this.parseMultiplicative();
      left = { type: 'BinaryOp', operator, left, right };
    }

    return left;
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parseUnary();

    while (
      this.current().type === 'STAR' ||
      this.current().type === 'SLASH' ||
      this.current().type === 'PERCENT'
    ) {
      const token = this.advance();
      const operator = token.type === 'STAR' ? '*' : token.type === 'SLASH' ? '/' : '%';
      const right = this.parseUnary();
      left = { type: 'BinaryOp', operator, left, right };
    }

    return left;
  }

  private parseUnary(): ASTNode {
    if (this.current().type === 'NOT') {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryOp', operator: '!', operand };
    }

    if (this.current().type === 'MINUS') {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryOp', operator: '-', operand };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): ASTNode {
    let node = this.parsePrimary();

    while (true) {
      if (this.current().type === 'DOT') {
        this.advance();
        const property = this.expect('IDENTIFIER').value as string;
        node = { type: 'MemberAccess', object: node, property };
      } else if (this.current().type === 'LBRACKET') {
        this.advance();
        const index = this.parseExpression();
        this.expect('RBRACKET');
        node = { type: 'IndexAccess', object: node, index };
      } else if (this.current().type === 'LPAREN') {
        this.advance();
        const args: ASTNode[] = [];

        if (this.current().type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.current().type === 'COMMA') {
            this.advance();
            args.push(this.parseExpression());
          }
        }

        this.expect('RPAREN');
        node = { type: 'Call', callee: node, arguments: args };
      } else {
        break;
      }
    }

    return node;
  }

  private parsePrimary(): ASTNode {
    const token = this.current();

    switch (token.type) {
      case 'NUMBER':
        this.advance();
        return { type: 'Literal', value: token.value as number };

      case 'STRING':
        this.advance();
        return { type: 'Literal', value: token.value as string };

      case 'BOOLEAN':
        this.advance();
        return { type: 'Literal', value: token.value as boolean };

      case 'NULL':
        this.advance();
        return { type: 'Literal', value: null };

      case 'IDENTIFIER':
        this.advance();
        return { type: 'Identifier', name: token.value as string };

      case 'LPAREN': {
        this.advance();
        const expr = this.parseExpression();
        this.expect('RPAREN');
        return expr;
      }

      // Phase 12: Regex literals
      case 'REGEX': {
        this.advance();
        const regexValue = token.value as { pattern: string; flags: string };
        return { type: 'Regex', pattern: regexValue.pattern, flags: regexValue.flags };
      }

      default:
        throw new Error(`Unexpected token '${token.type}' at position ${token.position}`);
    }
  }
}

// ============================================================================
// Evaluator
// ============================================================================

export class Evaluator {
  private globalFunctions: Map<string, (...args: unknown[]) => unknown> = new Map();

  constructor() {
    this.registerGlobalFunctions();
  }

  private registerGlobalFunctions(): void {
    // Phase 5: Global functions
    this.globalFunctions.set('now', () => new Date());
    this.globalFunctions.set('today', () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    });
    this.globalFunctions.set('date', (str: unknown) => {
      if (str === null || str === undefined) return null;
      const d = new Date(String(str));
      return isNaN(d.getTime()) ? null : d;
    });
    this.globalFunctions.set('if', (cond: unknown, trueVal: unknown, falseVal?: unknown) => {
      return this.isTruthy(cond) ? trueVal : (falseVal ?? null);
    });
    this.globalFunctions.set('min', (...args: unknown[]) => {
      const nums = args.flat().filter((n): n is number => typeof n === 'number');
      return nums.length > 0 ? Math.min(...nums) : null;
    });
    this.globalFunctions.set('max', (...args: unknown[]) => {
      const nums = args.flat().filter((n): n is number => typeof n === 'number');
      return nums.length > 0 ? Math.max(...nums) : null;
    });
    this.globalFunctions.set('number', (val: unknown) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const n = parseFloat(val);
        return isNaN(n) ? null : n;
      }
      if (typeof val === 'boolean') return val ? 1 : 0;
      return null;
    });
    this.globalFunctions.set('list', (...args: unknown[]) => {
      return args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
    });
    this.globalFunctions.set('link', (path: unknown, display?: unknown) => {
      return { type: 'link', path: String(path), display: display ? String(display) : undefined };
    });
    this.globalFunctions.set('duration', (str: unknown) => {
      return this.parseDuration(String(str));
    });

    // Phase 16: Advanced functions
    this.globalFunctions.set('file', (path: unknown) => {
      // Create a minimal File-like object from a path
      const pathStr = String(path);
      const parts = pathStr.split('/');
      const fullName = parts[parts.length - 1] || '';
      const extMatch = fullName.match(/\.([^.]+)$/);
      return {
        type: 'file',
        path: pathStr,
        name: fullName.replace(/\.[^.]+$/, ''),
        basename: fullName.replace(/\.[^.]+$/, ''),
        ext: extMatch ? extMatch[1] : '',
        folder: parts.slice(0, -1).join('/'),
      };
    });

    this.globalFunctions.set('image', (path: unknown) => {
      return { type: 'image', path: String(path) };
    });

    this.globalFunctions.set('icon', (name: unknown) => {
      return { type: 'icon', name: String(name) };
    });

    this.globalFunctions.set('html', (content: unknown) => {
      return { type: 'html', content: String(content) };
    });

    this.globalFunctions.set('escapeHTML', (str: unknown) => {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    });
  }

  evaluate(node: ASTNode, context: EvaluationContext): unknown {
    switch (node.type) {
      case 'Literal':
        return node.value;

      case 'Identifier':
        return this.resolveIdentifier(node.name, context);

      case 'BinaryOp':
        return this.evaluateBinaryOp(node, context);

      case 'UnaryOp':
        return this.evaluateUnaryOp(node, context);

      case 'MemberAccess':
        return this.evaluateMemberAccess(node, context);

      case 'Call':
        return this.evaluateCall(node, context);

      case 'IndexAccess':
        return this.evaluateIndexAccess(node, context);

      // Phase 12: Regex literals
      case 'Regex':
        return { type: 'regex', pattern: node.pattern, flags: node.flags };

      default:
        throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
    }
  }

  private resolveIdentifier(name: string, context: EvaluationContext): unknown {
    // Phase 15: Handle `this` keyword
    if (name === 'this') {
      return context.this || { file: context.file };
    }

    // Check direct context properties first
    if (name in context) {
      return context[name];
    }

    // Check note properties
    if (context.note && name in context.note) {
      return context.note[name];
    }

    // Return undefined for unknown identifiers
    return undefined;
  }

  private evaluateBinaryOp(node: BinaryOpNode, context: EvaluationContext): unknown {
    const left = this.evaluate(node.left, context);
    const right = this.evaluate(node.right, context);

    switch (node.operator) {
      // Boolean operators
      case '&&':
        return this.isTruthy(left) && this.isTruthy(right);
      case '||':
        return this.isTruthy(left) || this.isTruthy(right);

      // Equality operators
      case '==':
        return this.isEqual(left, right);
      case '!=':
        return !this.isEqual(left, right);

      // Comparison operators
      case '>':
        return this.compare(left, right) > 0;
      case '>=':
        return this.compare(left, right) >= 0;
      case '<':
        return this.compare(left, right) < 0;
      case '<=':
        return this.compare(left, right) <= 0;

      // Arithmetic operators
      case '+':
        return this.add(left, right);
      case '-':
        return this.subtract(left, right);
      case '*':
        return this.multiply(left, right);
      case '/':
        return this.divide(left, right);
      case '%':
        return this.modulo(left, right);

      default:
        throw new Error(`Unknown operator: ${node.operator}`);
    }
  }

  private evaluateUnaryOp(node: UnaryOpNode, context: EvaluationContext): unknown {
    const operand = this.evaluate(node.operand, context);

    switch (node.operator) {
      case '!':
        return !this.isTruthy(operand);
      case '-':
        return typeof operand === 'number' ? -operand : null;
      default:
        throw new Error(`Unknown unary operator: ${node.operator}`);
    }
  }

  private evaluateMemberAccess(node: MemberAccessNode, context: EvaluationContext): unknown {
    const object = this.evaluate(node.object, context);
    const property = node.property;

    if (object === null || object === undefined) {
      return undefined;
    }

    // Handle special types
    if (object instanceof Date) {
      return this.getDateProperty(object, property);
    }

    if (typeof object === 'string') {
      return this.getStringProperty(object, property);
    }

    if (typeof object === 'number') {
      return this.getNumberProperty(object, property);
    }

    if (Array.isArray(object)) {
      return this.getListProperty(object, property);
    }

    if (typeof object === 'object') {
      return (object as Record<string, unknown>)[property];
    }

    return undefined;
  }

  private evaluateCall(node: CallNode, context: EvaluationContext): unknown {
    const args = node.arguments.map((arg) => this.evaluate(arg, context));

    // Handle method calls (object.method())
    if (node.callee.type === 'MemberAccess') {
      const memberNode = node.callee;
      const object = this.evaluate(memberNode.object, context);
      const method = memberNode.property;
      return this.callMethod(object, method, args, context);
    }

    // Handle global function calls (func())
    if (node.callee.type === 'Identifier') {
      const funcName = node.callee.name;
      const func = this.globalFunctions.get(funcName);
      if (func) {
        return func(...args);
      }
      throw new Error(`Unknown function: ${funcName}`);
    }

    throw new Error('Invalid function call');
  }

  private evaluateIndexAccess(node: IndexAccessNode, context: EvaluationContext): unknown {
    const object = this.evaluate(node.object, context);
    const index = this.evaluate(node.index, context);

    if (Array.isArray(object) && typeof index === 'number') {
      return object[index];
    }

    if (typeof object === 'string' && typeof index === 'number') {
      return object[index];
    }

    if (typeof object === 'object' && object !== null && typeof index === 'string') {
      return (object as Record<string, unknown>)[index];
    }

    return undefined;
  }

  // ============================================================================
  // Method implementations for different types
  // ============================================================================

  private callMethod(
    object: unknown,
    method: string,
    args: unknown[],
    _context: EvaluationContext
  ): unknown {
    if (object === null || object === undefined) {
      return undefined;
    }

    // Any type methods (Phase 11)
    if (method === 'toString') {
      return this.toString(object);
    }
    if (method === 'isTruthy') {
      return this.isTruthy(object);
    }
    if (method === 'isType') {
      return this.isType(object, args[0] as string);
    }

    // Date methods (Phase 7)
    if (object instanceof Date) {
      return this.callDateMethod(object, method, args);
    }

    // String methods (Phase 8)
    if (typeof object === 'string') {
      return this.callStringMethod(object, method, args);
    }

    // Number methods (Phase 9)
    if (typeof object === 'number') {
      return this.callNumberMethod(object, method, args);
    }

    // List methods (Phase 10)
    if (Array.isArray(object)) {
      return this.callListMethod(object, method, args);
    }

    // File methods (Phase 4) - handled via context.file object
    if (typeof object === 'object' && object !== null && 'name' in object && !('type' in object)) {
      return this.callFileMethod(object as FileObject, method, args);
    }

    // Phase 12: Link methods
    if (this.isLink(object)) {
      return this.callLinkMethod(object as LinkObject, method, args);
    }

    // Phase 12: Regex methods
    if (this.isRegex(object)) {
      return this.callRegexMethod(object as { type: 'regex'; pattern: string; flags: string }, method, args);
    }

    // Phase 12: Object methods (for plain objects)
    if (typeof object === 'object' && object !== null && !Array.isArray(object)) {
      return this.callObjectMethod(object as Record<string, unknown>, method, args);
    }

    return undefined;
  }

  // Phase 12: Check if value is a Link
  private isLink(value: unknown): boolean {
    return typeof value === 'object' && value !== null && (value as any).type === 'link';
  }

  // Phase 12: Check if value is a Regex
  private isRegex(value: unknown): boolean {
    return typeof value === 'object' && value !== null && (value as any).type === 'regex';
  }

  // Phase 12: Link methods
  private callLinkMethod(link: LinkObject, method: string, args: unknown[]): unknown {
    switch (method) {
      case 'asFile': {
        // Convert link to a File-like object
        const pathStr = link.path;
        const parts = pathStr.split('/');
        const fullName = parts[parts.length - 1] || '';
        const extMatch = fullName.match(/\.([^.]+)$/);
        return {
          type: 'file',
          path: pathStr,
          name: fullName.replace(/\.[^.]+$/, ''),
          basename: fullName.replace(/\.[^.]+$/, ''),
          ext: extMatch ? extMatch[1] : '',
          folder: parts.slice(0, -1).join('/'),
        };
      }
      case 'linksTo': {
        // Check if this link points to a given file/path
        const target = args[0];
        if (typeof target === 'string') {
          return link.path === target || link.path.endsWith('/' + target);
        }
        if (typeof target === 'object' && target !== null && 'path' in target) {
          return link.path === (target as { path: string }).path;
        }
        return false;
      }
      default:
        return undefined;
    }
  }

  // Phase 12: Regex methods
  private callRegexMethod(regex: { type: 'regex'; pattern: string; flags: string }, method: string, args: unknown[]): unknown {
    switch (method) {
      case 'matches': {
        try {
          const re = new RegExp(regex.pattern, regex.flags);
          return re.test(String(args[0]));
        } catch {
          return false;
        }
      }
      case 'test': {
        // Alias for matches
        try {
          const re = new RegExp(regex.pattern, regex.flags);
          return re.test(String(args[0]));
        } catch {
          return false;
        }
      }
      case 'exec': {
        try {
          const re = new RegExp(regex.pattern, regex.flags);
          const match = re.exec(String(args[0]));
          return match ? Array.from(match) : null;
        } catch {
          return null;
        }
      }
      default:
        return undefined;
    }
  }

  // Phase 12: Object methods
  private callObjectMethod(obj: Record<string, unknown>, method: string, _args: unknown[]): unknown {
    switch (method) {
      case 'isEmpty':
        return Object.keys(obj).length === 0;
      case 'keys':
        return Object.keys(obj);
      case 'values':
        return Object.values(obj);
      case 'entries':
        return Object.entries(obj);
      case 'hasKey':
        return _args.length > 0 && String(_args[0]) in obj;
      default:
        return undefined;
    }
  }

  // Phase 7: Date methods
  private getDateProperty(date: Date, property: string): unknown {
    switch (property) {
      case 'year':
        return date.getFullYear();
      case 'month':
        return date.getMonth() + 1; // 1-indexed
      case 'day':
        return date.getDate();
      case 'hour':
        return date.getHours();
      case 'minute':
        return date.getMinutes();
      case 'second':
        return date.getSeconds();
      case 'millisecond':
        return date.getMilliseconds();
      default:
        return undefined;
    }
  }

  private callDateMethod(date: Date, method: string, args: unknown[]): unknown {
    switch (method) {
      case 'date': {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case 'time': {
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${h}:${m}:${s}`;
      }
      case 'format':
        return this.formatDate(date, args[0] as string);
      case 'relative':
        return this.relativeDate(date);
      case 'isEmpty':
        return false;
      default:
        return undefined;
    }
  }

  private formatDate(date: Date, format: string): string {
    if (!format) return date.toISOString();

    return format
      .replace(/YYYY/g, String(date.getFullYear()))
      .replace(/YY/g, String(date.getFullYear()).slice(-2))
      .replace(/MM/g, String(date.getMonth() + 1).padStart(2, '0'))
      .replace(/M/g, String(date.getMonth() + 1))
      .replace(/DD/g, String(date.getDate()).padStart(2, '0'))
      .replace(/D/g, String(date.getDate()))
      .replace(/HH/g, String(date.getHours()).padStart(2, '0'))
      .replace(/H/g, String(date.getHours()))
      .replace(/mm/g, String(date.getMinutes()).padStart(2, '0'))
      .replace(/m/g, String(date.getMinutes()))
      .replace(/ss/g, String(date.getSeconds()).padStart(2, '0'))
      .replace(/s/g, String(date.getSeconds()));
  }

  private relativeDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    const future = diffMs < 0;
    const abs = (n: number) => Math.abs(n);

    if (abs(diffYear) >= 1) {
      return future ? `in ${abs(diffYear)} year${abs(diffYear) > 1 ? 's' : ''}` : `${abs(diffYear)} year${abs(diffYear) > 1 ? 's' : ''} ago`;
    }
    if (abs(diffMonth) >= 1) {
      return future ? `in ${abs(diffMonth)} month${abs(diffMonth) > 1 ? 's' : ''}` : `${abs(diffMonth)} month${abs(diffMonth) > 1 ? 's' : ''} ago`;
    }
    if (abs(diffWeek) >= 1) {
      return future ? `in ${abs(diffWeek)} week${abs(diffWeek) > 1 ? 's' : ''}` : `${abs(diffWeek)} week${abs(diffWeek) > 1 ? 's' : ''} ago`;
    }
    if (abs(diffDay) >= 1) {
      return future ? `in ${abs(diffDay)} day${abs(diffDay) > 1 ? 's' : ''}` : `${abs(diffDay)} day${abs(diffDay) > 1 ? 's' : ''} ago`;
    }
    if (abs(diffHour) >= 1) {
      return future ? `in ${abs(diffHour)} hour${abs(diffHour) > 1 ? 's' : ''}` : `${abs(diffHour)} hour${abs(diffHour) > 1 ? 's' : ''} ago`;
    }
    if (abs(diffMin) >= 1) {
      return future ? `in ${abs(diffMin)} minute${abs(diffMin) > 1 ? 's' : ''}` : `${abs(diffMin)} minute${abs(diffMin) > 1 ? 's' : ''} ago`;
    }
    return 'just now';
  }

  // Phase 8: String methods
  private getStringProperty(str: string, property: string): unknown {
    switch (property) {
      case 'length':
        return str.length;
      default:
        return undefined;
    }
  }

  private callStringMethod(str: string, method: string, args: unknown[]): unknown {
    switch (method) {
      case 'contains':
        return str.includes(String(args[0]));
      case 'containsAll':
        return args.every((arg) => str.includes(String(arg)));
      case 'containsAny':
        return args.some((arg) => str.includes(String(arg)));
      case 'startsWith':
        return str.startsWith(String(args[0]));
      case 'endsWith':
        return str.endsWith(String(args[0]));
      case 'lower':
        return str.toLowerCase();
      case 'upper':
        return str.toUpperCase();
      case 'title':
        return str.replace(/\b\w/g, (c) => c.toUpperCase());
      case 'trim':
        return str.trim();
      case 'replace':
        return str.replace(String(args[0]), String(args[1] ?? ''));
      case 'split': {
        const parts = str.split(String(args[0]));
        const limit = typeof args[1] === 'number' ? args[1] : undefined;
        return limit !== undefined ? parts.slice(0, limit) : parts;
      }
      case 'slice': {
        const start = typeof args[0] === 'number' ? args[0] : 0;
        const end = typeof args[1] === 'number' ? args[1] : undefined;
        return str.slice(start, end);
      }
      case 'repeat':
        return typeof args[0] === 'number' ? str.repeat(args[0]) : str;
      case 'reverse':
        return str.split('').reverse().join('');
      case 'isEmpty':
        return str.length === 0;
      default:
        return undefined;
    }
  }

  // Phase 9: Number methods
  private getNumberProperty(num: number, property: string): unknown {
    // Support for duration-like properties on numbers (e.g., ms.years)
    // Useful for date arithmetic results (date subtraction returns ms)
    const MS_PER_SECOND = 1000;
    const MS_PER_MINUTE = MS_PER_SECOND * 60;
    const MS_PER_HOUR = MS_PER_MINUTE * 60;
    const MS_PER_DAY = MS_PER_HOUR * 24;
    const MS_PER_WEEK = MS_PER_DAY * 7;
    const MS_PER_YEAR = MS_PER_DAY * 365.25;
    const MS_PER_MONTH = MS_PER_YEAR / 12;

    switch (property) {
      case 'years':
        return num / MS_PER_YEAR;
      case 'months':
        return num / MS_PER_MONTH;
      case 'weeks':
        return num / MS_PER_WEEK;
      case 'days':
        return num / MS_PER_DAY;
      case 'hours':
        return num / MS_PER_HOUR;
      case 'minutes':
        return num / MS_PER_MINUTE;
      case 'seconds':
        return num / MS_PER_SECOND;
      case 'milliseconds':
        return num;
      default:
        return undefined;
    }
  }

  private callNumberMethod(num: number, method: string, args: unknown[]): unknown {
    switch (method) {
      case 'abs':
        return Math.abs(num);
      case 'ceil':
        return Math.ceil(num);
      case 'floor':
        return Math.floor(num);
      case 'round': {
        const digits = typeof args[0] === 'number' ? args[0] : 0;
        const factor = Math.pow(10, digits);
        return Math.round(num * factor) / factor;
      }
      case 'toFixed': {
        const precision = typeof args[0] === 'number' ? args[0] : 0;
        return num.toFixed(precision);
      }
      case 'isEmpty':
        return false;
      default:
        return undefined;
    }
  }

  // Phase 10: List methods
  private getListProperty(list: unknown[], property: string): unknown {
    switch (property) {
      case 'length':
        return list.length;
      default:
        return undefined;
    }
  }

  private callListMethod(list: unknown[], method: string, args: unknown[]): unknown {
    switch (method) {
      case 'contains':
        return list.some((item) => this.isEqual(item, args[0]));
      case 'containsAll':
        return args.every((arg) => list.some((item) => this.isEqual(item, arg)));
      case 'containsAny':
        return args.some((arg) => list.some((item) => this.isEqual(item, arg)));
      case 'join':
        return list.map((item) => this.toString(item)).join(String(args[0] ?? ','));
      case 'sort':
        return [...list].sort((a, b) => this.compare(a, b));
      case 'reverse':
        return [...list].reverse();
      case 'unique':
        return [...new Set(list.map((item) => JSON.stringify(item)))].map((s) => JSON.parse(s));
      case 'flat':
        return list.flat();
      case 'slice': {
        const start = typeof args[0] === 'number' ? args[0] : 0;
        const end = typeof args[1] === 'number' ? args[1] : undefined;
        return list.slice(start, end);
      }
      case 'isEmpty':
        return list.length === 0;
      case 'first':
        return list[0];
      case 'last':
        return list[list.length - 1];
      // filter, map, reduce require expression evaluation which is complex
      // For now, these are simplified versions
      case 'filter':
        return list.filter((item) => this.isTruthy(item));
      case 'map':
        return list; // Would need sub-expression evaluation
      case 'reduce':
        return list.reduce((acc, item) => {
          if (typeof acc === 'number' && typeof item === 'number') return acc + item;
          return acc;
        }, args[1] ?? 0);
      default:
        return undefined;
    }
  }

  // Phase 4: File methods
  private callFileMethod(
    file: FileObject,
    method: string,
    args: unknown[]
  ): unknown {
    if (!file) return undefined;

    switch (method) {
      case 'hasTag':
        return args.some((tag) => (file.tags || []).includes(String(tag).replace(/^#/, '')));
      case 'hasLink':
        return (file.links || []).some((link) => link === String(args[0]));
      case 'hasProperty':
        return file.properties ? String(args[0]) in file.properties : false;
      case 'inFolder': {
        const folder = file.folder || '';
        return folder === String(args[0]) || folder.startsWith(String(args[0]) + '/');
      }
      case 'asLink':
        return { type: 'link', path: file.path || '', display: args[0] ? String(args[0]) : file.name };
      default:
        return undefined;
    }
  }

  // Phase 11: Any type methods
  private toString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((v) => this.toString(v)).join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private isType(value: unknown, typeName: string): boolean {
    switch (typeName) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date;
      case 'list':
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'null':
        return value === null;
      case 'undefined':
        return value === undefined;
      case 'link':
        return this.isLink(value);
      case 'regex':
        return this.isRegex(value);
      case 'file':
        return typeof value === 'object' && value !== null && (value as any).type === 'file';
      case 'image':
        return typeof value === 'object' && value !== null && (value as any).type === 'image';
      case 'icon':
        return typeof value === 'object' && value !== null && (value as any).type === 'icon';
      case 'html':
        return typeof value === 'object' && value !== null && (value as any).type === 'html';
      default:
        return false;
    }
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private isTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (value instanceof Date) return !isNaN(value.getTime());
    return true;
  }

  private isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (a === undefined || b === undefined) return a === b;

    // Date comparison
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    if (a instanceof Date && typeof b === 'string') {
      return a.getTime() === new Date(b).getTime();
    }
    if (typeof a === 'string' && b instanceof Date) {
      return new Date(a).getTime() === b.getTime();
    }

    // Array comparison
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, i) => this.isEqual(item, b[i]));
    }

    // Object comparison
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a as object);
      const keysB = Object.keys(b as object);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) =>
        this.isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
      );
    }

    return false;
  }

  private compare(a: unknown, b: unknown): number {
    if (a === b) return 0;
    if (a === null || a === undefined) return -1;
    if (b === null || b === undefined) return 1;

    // Date comparison
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() - b.getTime();
    }
    if (a instanceof Date && typeof b === 'string') {
      return a.getTime() - new Date(b).getTime();
    }
    if (typeof a === 'string' && b instanceof Date) {
      return new Date(a).getTime() - b.getTime();
    }

    // Number comparison
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }

    // String comparison
    if (typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b);
    }

    // Convert to string for comparison
    return String(a).localeCompare(String(b));
  }

  // Phase 6: Date arithmetic
  private add(a: unknown, b: unknown): unknown {
    // Date + duration string
    if (a instanceof Date && typeof b === 'string') {
      return this.addDuration(a, b);
    }
    if (typeof a === 'string' && b instanceof Date) {
      return this.addDuration(b, a);
    }

    // Number + Number
    if (typeof a === 'number' && typeof b === 'number') {
      return a + b;
    }

    // String + String
    if (typeof a === 'string' && typeof b === 'string') {
      // Check if b looks like a duration
      if (/^\d+\s*[yMwdhms]/.test(b)) {
        const dateA = new Date(a);
        if (!isNaN(dateA.getTime())) {
          return this.addDuration(dateA, b);
        }
      }
      return a + b;
    }

    // Fallback: convert to numbers
    const numA = typeof a === 'number' ? a : parseFloat(String(a));
    const numB = typeof b === 'number' ? b : parseFloat(String(b));
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA + numB;
    }

    return String(a) + String(b);
  }

  private subtract(a: unknown, b: unknown): unknown {
    // Date - duration string
    if (a instanceof Date && typeof b === 'string') {
      return this.subtractDuration(a, b);
    }

    // Date - Date (returns milliseconds)
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() - b.getTime();
    }

    // Number - Number
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }

    // Fallback: convert to numbers
    const numA = typeof a === 'number' ? a : parseFloat(String(a));
    const numB = typeof b === 'number' ? b : parseFloat(String(b));
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }

    return null;
  }

  private multiply(a: unknown, b: unknown): unknown {
    const numA = typeof a === 'number' ? a : parseFloat(String(a));
    const numB = typeof b === 'number' ? b : parseFloat(String(b));
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA * numB;
    }
    return null;
  }

  private divide(a: unknown, b: unknown): unknown {
    const numA = typeof a === 'number' ? a : parseFloat(String(a));
    const numB = typeof b === 'number' ? b : parseFloat(String(b));
    if (!isNaN(numA) && !isNaN(numB) && numB !== 0) {
      return numA / numB;
    }
    return null;
  }

  private modulo(a: unknown, b: unknown): unknown {
    const numA = typeof a === 'number' ? a : parseFloat(String(a));
    const numB = typeof b === 'number' ? b : parseFloat(String(b));
    if (!isNaN(numA) && !isNaN(numB) && numB !== 0) {
      return numA % numB;
    }
    return null;
  }

  private parseDuration(str: string): { value: number; unit: string } | null {
    // Match number followed by optional space and unit
    const match = str.match(/^(-?\d+(?:\.\d+)?)\s*(y(?:ears?)?|months?|M|w(?:eeks?)?|d(?:ays?)?|h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)$/i);
    if (!match) return null;

    const value = parseFloat(match[1]);
    let unit = match[2];
    const unitLower = unit.toLowerCase();

    // Normalize unit to single character, preserving M for months
    if (unitLower.startsWith('y')) unit = 'y';
    else if (unitLower.startsWith('month') || unit === 'M') unit = 'M';
    else if (unitLower.startsWith('w')) unit = 'w';
    else if (unitLower.startsWith('d')) unit = 'd';
    else if (unitLower.startsWith('h')) unit = 'h';
    else if (unitLower.startsWith('min') || unit === 'm') unit = 'm';
    else if (unitLower.startsWith('s')) unit = 's';

    return { value, unit };
  }

  private addDuration(date: Date, durationStr: string): Date {
    const duration = this.parseDuration(durationStr);
    if (!duration) return date;

    const result = new Date(date);
    const { value, unit } = duration;

    switch (unit[0]) {
      case 'y':
        result.setFullYear(result.getFullYear() + value);
        break;
      case 'M':
        result.setMonth(result.getMonth() + value);
        break;
      case 'w':
        result.setDate(result.getDate() + value * 7);
        break;
      case 'd':
        result.setDate(result.getDate() + value);
        break;
      case 'h':
        result.setHours(result.getHours() + value);
        break;
      case 'm':
        result.setMinutes(result.getMinutes() + value);
        break;
      case 's':
        result.setSeconds(result.getSeconds() + value);
        break;
    }

    return result;
  }

  private subtractDuration(date: Date, durationStr: string): Date {
    const duration = this.parseDuration(durationStr);
    if (!duration) return date;

    return this.addDuration(date, `-${duration.value}${duration.unit}`);
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Parses and evaluates an expression against a context
 */
export function evaluateExpression(expression: string, context: EvaluationContext): unknown {
  const parser = new Parser();
  const ast = parser.parse(expression);
  const evaluator = new Evaluator();
  return evaluator.evaluate(ast, context);
}

/**
 * Parses an expression and returns the AST
 */
export function parseExpression(expression: string): ASTNode {
  const parser = new Parser();
  return parser.parse(expression);
}

/**
 * Evaluates an AST against a context
 */
export function evaluate(ast: ASTNode, context: EvaluationContext): unknown {
  const evaluator = new Evaluator();
  return evaluator.evaluate(ast, context);
}
