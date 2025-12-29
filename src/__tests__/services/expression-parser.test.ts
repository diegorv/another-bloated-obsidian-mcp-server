/**
 * Tests for Expression Parser
 *
 * Covers Phases 1-11 of the improvement plan:
 * - Phase 1: Tokenizer, Parser, Evaluator (Foundation)
 * - Phase 2: Complete operators (comparison, boolean, arithmetic)
 * - Phase 5: Global functions (now, today, if, min, max, etc.)
 * - Phase 6: Date arithmetic (duration parsing, date +/- operations)
 * - Phase 7: Date functions (year, month, format, relative, etc.)
 * - Phase 8: String functions (contains, startsWith, lower, split, etc.)
 * - Phase 9: Number functions (abs, ceil, floor, round, toFixed)
 * - Phase 10: List functions (contains, join, sort, unique, etc.)
 * - Phase 11: Any type functions (toString, isTruthy, isType)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Tokenizer,
  Parser,
  Evaluator,
  evaluateExpression,
  parseExpression,
  EvaluationContext,
} from '../../services/expression-parser.js';

describe('Expression Parser', () => {
  // ============================================================================
  // Phase 1: Tokenizer Tests
  // ============================================================================
  describe('Tokenizer', () => {
    it('should tokenize numbers', () => {
      const tokenizer = new Tokenizer('42 3.14 0.5');
      const tokens = tokenizer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'NUMBER', value: 42 });
      expect(tokens[1]).toMatchObject({ type: 'NUMBER', value: 3.14 });
      expect(tokens[2]).toMatchObject({ type: 'NUMBER', value: 0.5 });
    });

    it('should tokenize strings with double quotes', () => {
      const tokenizer = new Tokenizer('"hello world"');
      const tokens = tokenizer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'STRING', value: 'hello world' });
    });

    it('should tokenize strings with single quotes', () => {
      const tokenizer = new Tokenizer("'hello world'");
      const tokens = tokenizer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'STRING', value: 'hello world' });
    });

    it('should tokenize escape sequences in strings', () => {
      const tokenizer = new Tokenizer('"hello\\nworld"');
      const tokens = tokenizer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'STRING', value: 'hello\nworld' });
    });

    it('should tokenize boolean literals', () => {
      const tokenizer = new Tokenizer('true false');
      const tokens = tokenizer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'BOOLEAN', value: true });
      expect(tokens[1]).toMatchObject({ type: 'BOOLEAN', value: false });
    });

    it('should tokenize null', () => {
      const tokenizer = new Tokenizer('null');
      const tokens = tokenizer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'NULL', value: null });
    });

    it('should tokenize identifiers', () => {
      const tokenizer = new Tokenizer('file name status123');
      const tokens = tokenizer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'file' });
      expect(tokens[1]).toMatchObject({ type: 'IDENTIFIER', value: 'name' });
      expect(tokens[2]).toMatchObject({ type: 'IDENTIFIER', value: 'status123' });
    });

    it('should tokenize comparison operators', () => {
      const tokenizer = new Tokenizer('== != > >= < <=');
      const tokens = tokenizer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'EQ' });
      expect(tokens[1]).toMatchObject({ type: 'NEQ' });
      expect(tokens[2]).toMatchObject({ type: 'GT' });
      expect(tokens[3]).toMatchObject({ type: 'GTE' });
      expect(tokens[4]).toMatchObject({ type: 'LT' });
      expect(tokens[5]).toMatchObject({ type: 'LTE' });
    });

    it('should tokenize single = as equality', () => {
      const tokenizer = new Tokenizer('a = b');
      const tokens = tokenizer.tokenize();

      expect(tokens[1]).toMatchObject({ type: 'EQ' });
    });

    it('should tokenize boolean operators', () => {
      const tokenizer = new Tokenizer('&& || !');
      const tokens = tokenizer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'AND' });
      expect(tokens[1]).toMatchObject({ type: 'OR' });
      expect(tokens[2]).toMatchObject({ type: 'NOT' });
    });

    it('should tokenize keyword boolean operators', () => {
      const tokenizer = new Tokenizer('and or not');
      const tokens = tokenizer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'AND' });
      expect(tokens[1]).toMatchObject({ type: 'OR' });
      expect(tokens[2]).toMatchObject({ type: 'NOT' });
    });

    it('should tokenize arithmetic operators', () => {
      const tokenizer = new Tokenizer('+ - * / %');
      const tokens = tokenizer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'PLUS' });
      expect(tokens[1]).toMatchObject({ type: 'MINUS' });
      expect(tokens[2]).toMatchObject({ type: 'STAR' });
      expect(tokens[3]).toMatchObject({ type: 'SLASH' });
      expect(tokens[4]).toMatchObject({ type: 'PERCENT' });
    });

    it('should tokenize punctuation', () => {
      const tokenizer = new Tokenizer('. ( ) [ ] ,');
      const tokens = tokenizer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'DOT' });
      expect(tokens[1]).toMatchObject({ type: 'LPAREN' });
      expect(tokens[2]).toMatchObject({ type: 'RPAREN' });
      expect(tokens[3]).toMatchObject({ type: 'LBRACKET' });
      expect(tokens[4]).toMatchObject({ type: 'RBRACKET' });
      expect(tokens[5]).toMatchObject({ type: 'COMMA' });
    });

    it('should throw on unterminated string', () => {
      const tokenizer = new Tokenizer('"unterminated');
      expect(() => tokenizer.tokenize()).toThrow('Unterminated string');
    });

    it('should throw on unexpected character', () => {
      const tokenizer = new Tokenizer('@');
      expect(() => tokenizer.tokenize()).toThrow('Unexpected character');
    });
  });

  // ============================================================================
  // Phase 1: Parser Tests
  // ============================================================================
  describe('Parser', () => {
    it('should parse number literal', () => {
      const ast = parseExpression('42');
      expect(ast).toEqual({ type: 'Literal', value: 42 });
    });

    it('should parse string literal', () => {
      const ast = parseExpression('"hello"');
      expect(ast).toEqual({ type: 'Literal', value: 'hello' });
    });

    it('should parse boolean literal', () => {
      const ast = parseExpression('true');
      expect(ast).toEqual({ type: 'Literal', value: true });
    });

    it('should parse identifier', () => {
      const ast = parseExpression('name');
      expect(ast).toEqual({ type: 'Identifier', name: 'name' });
    });

    it('should parse member access', () => {
      const ast = parseExpression('file.name');
      expect(ast).toEqual({
        type: 'MemberAccess',
        object: { type: 'Identifier', name: 'file' },
        property: 'name',
      });
    });

    it('should parse chained member access', () => {
      const ast = parseExpression('file.name.length');
      expect(ast).toEqual({
        type: 'MemberAccess',
        object: {
          type: 'MemberAccess',
          object: { type: 'Identifier', name: 'file' },
          property: 'name',
        },
        property: 'length',
      });
    });

    it('should parse function call without arguments', () => {
      const ast = parseExpression('now()');
      expect(ast).toEqual({
        type: 'Call',
        callee: { type: 'Identifier', name: 'now' },
        arguments: [],
      });
    });

    it('should parse function call with arguments', () => {
      const ast = parseExpression('min(1, 2, 3)');
      expect(ast).toEqual({
        type: 'Call',
        callee: { type: 'Identifier', name: 'min' },
        arguments: [
          { type: 'Literal', value: 1 },
          { type: 'Literal', value: 2 },
          { type: 'Literal', value: 3 },
        ],
      });
    });

    it('should parse method call', () => {
      const ast = parseExpression('name.contains("test")');
      expect(ast).toEqual({
        type: 'Call',
        callee: {
          type: 'MemberAccess',
          object: { type: 'Identifier', name: 'name' },
          property: 'contains',
        },
        arguments: [{ type: 'Literal', value: 'test' }],
      });
    });

    it('should parse index access', () => {
      const ast = parseExpression('items[0]');
      expect(ast).toEqual({
        type: 'IndexAccess',
        object: { type: 'Identifier', name: 'items' },
        index: { type: 'Literal', value: 0 },
      });
    });

    it('should parse binary operators', () => {
      const ast = parseExpression('a + b');
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: '+',
        left: { type: 'Identifier', name: 'a' },
        right: { type: 'Identifier', name: 'b' },
      });
    });

    it('should parse unary operators', () => {
      const ast = parseExpression('!active');
      expect(ast).toEqual({
        type: 'UnaryOp',
        operator: '!',
        operand: { type: 'Identifier', name: 'active' },
      });
    });

    it('should parse parenthesized expressions', () => {
      const ast = parseExpression('(a + b) * c');
      expect(ast.type).toBe('BinaryOp');
      expect((ast as any).operator).toBe('*');
      expect((ast as any).left.type).toBe('BinaryOp');
      expect((ast as any).left.operator).toBe('+');
    });

    it('should respect operator precedence', () => {
      // * has higher precedence than +
      const ast = parseExpression('a + b * c');
      expect(ast.type).toBe('BinaryOp');
      expect((ast as any).operator).toBe('+');
      expect((ast as any).right.type).toBe('BinaryOp');
      expect((ast as any).right.operator).toBe('*');
    });

    it('should parse complex expressions', () => {
      const ast = parseExpression('file.name.contains("test") && status == "active"');
      expect(ast.type).toBe('BinaryOp');
      expect((ast as any).operator).toBe('&&');
    });
  });

  // ============================================================================
  // Phase 2: Operator Evaluation Tests
  // ============================================================================
  describe('Operators', () => {
    describe('Comparison operators', () => {
      it('should evaluate equality', () => {
        expect(evaluateExpression('5 == 5', {})).toBe(true);
        expect(evaluateExpression('5 == 6', {})).toBe(false);
        expect(evaluateExpression('"a" == "a"', {})).toBe(true);
        expect(evaluateExpression('"a" == "b"', {})).toBe(false);
      });

      it('should evaluate inequality', () => {
        expect(evaluateExpression('5 != 6', {})).toBe(true);
        expect(evaluateExpression('5 != 5', {})).toBe(false);
      });

      it('should evaluate greater than', () => {
        expect(evaluateExpression('5 > 3', {})).toBe(true);
        expect(evaluateExpression('3 > 5', {})).toBe(false);
        expect(evaluateExpression('5 > 5', {})).toBe(false);
      });

      it('should evaluate greater than or equal', () => {
        expect(evaluateExpression('5 >= 5', {})).toBe(true);
        expect(evaluateExpression('5 >= 3', {})).toBe(true);
        expect(evaluateExpression('3 >= 5', {})).toBe(false);
      });

      it('should evaluate less than', () => {
        expect(evaluateExpression('3 < 5', {})).toBe(true);
        expect(evaluateExpression('5 < 3', {})).toBe(false);
        expect(evaluateExpression('5 < 5', {})).toBe(false);
      });

      it('should evaluate less than or equal', () => {
        expect(evaluateExpression('5 <= 5', {})).toBe(true);
        expect(evaluateExpression('3 <= 5', {})).toBe(true);
        expect(evaluateExpression('5 <= 3', {})).toBe(false);
      });

      it('should compare strings', () => {
        expect(evaluateExpression('"a" < "b"', {})).toBe(true);
        expect(evaluateExpression('"b" < "a"', {})).toBe(false);
      });
    });

    describe('Boolean operators', () => {
      it('should evaluate AND', () => {
        expect(evaluateExpression('true && true', {})).toBe(true);
        expect(evaluateExpression('true && false', {})).toBe(false);
        expect(evaluateExpression('false && true', {})).toBe(false);
        expect(evaluateExpression('false && false', {})).toBe(false);
      });

      it('should evaluate OR', () => {
        expect(evaluateExpression('true || true', {})).toBe(true);
        expect(evaluateExpression('true || false', {})).toBe(true);
        expect(evaluateExpression('false || true', {})).toBe(true);
        expect(evaluateExpression('false || false', {})).toBe(false);
      });

      it('should evaluate NOT', () => {
        expect(evaluateExpression('!true', {})).toBe(false);
        expect(evaluateExpression('!false', {})).toBe(true);
      });

      it('should evaluate keyword operators', () => {
        expect(evaluateExpression('true and true', {})).toBe(true);
        expect(evaluateExpression('true or false', {})).toBe(true);
        expect(evaluateExpression('not true', {})).toBe(false);
      });
    });

    describe('Arithmetic operators', () => {
      it('should evaluate addition', () => {
        expect(evaluateExpression('2 + 3', {})).toBe(5);
        expect(evaluateExpression('2.5 + 3.5', {})).toBe(6);
      });

      it('should evaluate subtraction', () => {
        expect(evaluateExpression('5 - 3', {})).toBe(2);
        expect(evaluateExpression('3 - 5', {})).toBe(-2);
      });

      it('should evaluate multiplication', () => {
        expect(evaluateExpression('3 * 4', {})).toBe(12);
        expect(evaluateExpression('2.5 * 4', {})).toBe(10);
      });

      it('should evaluate division', () => {
        expect(evaluateExpression('10 / 2', {})).toBe(5);
        expect(evaluateExpression('7 / 2', {})).toBe(3.5);
      });

      it('should evaluate modulo', () => {
        expect(evaluateExpression('10 % 3', {})).toBe(1);
        expect(evaluateExpression('9 % 3', {})).toBe(0);
      });

      it('should evaluate unary minus', () => {
        expect(evaluateExpression('-5', {})).toBe(-5);
        expect(evaluateExpression('--5', {})).toBe(5);
      });

      it('should concatenate strings with +', () => {
        expect(evaluateExpression('"hello" + " " + "world"', {})).toBe('hello world');
      });
    });
  });

  // ============================================================================
  // Phase 5: Global Functions Tests
  // ============================================================================
  describe('Global Functions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T12:30:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should evaluate now()', () => {
      const result = evaluateExpression('now()', {}) as Date;
      expect(result instanceof Date).toBe(true);
      expect(result.toISOString()).toBe('2024-06-15T12:30:00.000Z');
    });

    it('should evaluate today()', () => {
      const result = evaluateExpression('today()', {}) as Date;
      expect(result instanceof Date).toBe(true);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it('should evaluate date()', () => {
      const result = evaluateExpression('date("2024-01-15T12:00:00")', {}) as Date;
      expect(result instanceof Date).toBe(true);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
    });

    it('should evaluate if()', () => {
      expect(evaluateExpression('if(true, "yes", "no")', {})).toBe('yes');
      expect(evaluateExpression('if(false, "yes", "no")', {})).toBe('no');
      expect(evaluateExpression('if(false, "yes")', {})).toBe(null);
    });

    it('should evaluate min()', () => {
      expect(evaluateExpression('min(5, 3, 8, 1)', {})).toBe(1);
      expect(evaluateExpression('min(5)', {})).toBe(5);
    });

    it('should evaluate max()', () => {
      expect(evaluateExpression('max(5, 3, 8, 1)', {})).toBe(8);
      expect(evaluateExpression('max(5)', {})).toBe(5);
    });

    it('should evaluate number()', () => {
      expect(evaluateExpression('number("42")', {})).toBe(42);
      expect(evaluateExpression('number("3.14")', {})).toBe(3.14);
      expect(evaluateExpression('number(true)', {})).toBe(1);
      expect(evaluateExpression('number(false)', {})).toBe(0);
    });

    it('should evaluate list()', () => {
      expect(evaluateExpression('list(1, 2, 3)', {})).toEqual([1, 2, 3]);
    });

    it('should evaluate link()', () => {
      const result = evaluateExpression('link("path/to/note")', {});
      expect(result).toEqual({ type: 'link', path: 'path/to/note', display: undefined });

      const resultWithDisplay = evaluateExpression('link("path/to/note", "My Note")', {});
      expect(resultWithDisplay).toEqual({ type: 'link', path: 'path/to/note', display: 'My Note' });
    });

    it('should evaluate duration()', () => {
      const result = evaluateExpression('duration("7d")', {});
      expect(result).toEqual({ value: 7, unit: 'd' });
    });
  });

  // ============================================================================
  // Phase 6: Date Arithmetic Tests
  // ============================================================================
  describe('Date Arithmetic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should add days to date', () => {
      // Use context date to avoid timezone issues
      const context = { baseDate: new Date(2024, 0, 1) }; // Jan 1, 2024
      const result = evaluateExpression('baseDate + "7d"', context) as Date;
      expect(result.getDate()).toBe(8);
      expect(result.getMonth()).toBe(0); // January
    });

    it('should add weeks to date', () => {
      const context = { baseDate: new Date(2024, 0, 1) }; // Jan 1, 2024
      const result = evaluateExpression('baseDate + "2w"', context) as Date;
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(0);
    });

    it('should add months to date', () => {
      const context = { baseDate: new Date(2024, 0, 15) }; // Jan 15, 2024
      const result = evaluateExpression('baseDate + "2M"', context) as Date;
      expect(result.getMonth()).toBe(2); // March
      expect(result.getDate()).toBe(15);
    });

    it('should add years to date', () => {
      const context = { baseDate: new Date(2024, 0, 15) }; // Jan 15, 2024
      const result = evaluateExpression('baseDate + "1y"', context) as Date;
      expect(result.getFullYear()).toBe(2025);
    });

    it('should subtract days from date', () => {
      const context = { baseDate: new Date(2024, 0, 15) }; // Jan 15, 2024
      const result = evaluateExpression('baseDate - "7d"', context) as Date;
      expect(result.getDate()).toBe(8);
    });

    it('should subtract dates to get difference', () => {
      const context = {
        date1: new Date(2024, 0, 15), // Jan 15, 2024
        date2: new Date(2024, 0, 1)   // Jan 1, 2024
      };
      const result = evaluateExpression('date1 - date2', context) as number;
      expect(result).toBe(14 * 24 * 60 * 60 * 1000); // 14 days in ms
    });

    it('should compare dates', () => {
      const context = {
        date1: new Date(2024, 1, 1), // Feb 1, 2024
        date2: new Date(2024, 0, 1)  // Jan 1, 2024
      };
      expect(evaluateExpression('date1 > date2', context)).toBe(true);
      expect(evaluateExpression('date2 < date1', context)).toBe(true);
    });

    it('should support various duration units', () => {
      expect(evaluateExpression('duration("1y")', {})).toEqual({ value: 1, unit: 'y' });
      expect(evaluateExpression('duration("2M")', {})).toEqual({ value: 2, unit: 'M' });
      expect(evaluateExpression('duration("3w")', {})).toEqual({ value: 3, unit: 'w' });
      expect(evaluateExpression('duration("4d")', {})).toEqual({ value: 4, unit: 'd' });
      expect(evaluateExpression('duration("5h")', {})).toEqual({ value: 5, unit: 'h' });
      expect(evaluateExpression('duration("6m")', {})).toEqual({ value: 6, unit: 'm' });
      expect(evaluateExpression('duration("7s")', {})).toEqual({ value: 7, unit: 's' });
    });

    it('should support duration with spelled out units', () => {
      expect(evaluateExpression('duration("1 year")', {})).toMatchObject({ value: 1 });
      expect(evaluateExpression('duration("2 months")', {})).toMatchObject({ value: 2 });
      expect(evaluateExpression('duration("3 weeks")', {})).toMatchObject({ value: 3 });
      expect(evaluateExpression('duration("4 days")', {})).toMatchObject({ value: 4 });
    });
  });

  // ============================================================================
  // Phase 7: Date Functions Tests
  // ============================================================================
  describe('Date Functions', () => {
    // Create date in local timezone to avoid UTC conversion issues
    const testDate = new Date(2024, 5, 15, 14, 30, 45, 123); // June 15, 2024, 14:30:45.123

    it('should get date properties', () => {
      const context = { myDate: testDate };

      expect(evaluateExpression('myDate.year', context)).toBe(2024);
      expect(evaluateExpression('myDate.month', context)).toBe(6);
      expect(evaluateExpression('myDate.day', context)).toBe(15);
      expect(evaluateExpression('myDate.hour', context)).toBe(14);
      expect(evaluateExpression('myDate.minute', context)).toBe(30);
      expect(evaluateExpression('myDate.second', context)).toBe(45);
      expect(evaluateExpression('myDate.millisecond', context)).toBe(123);
    });

    it('should format date', () => {
      const context = { myDate: testDate };

      expect(evaluateExpression('myDate.format("YYYY-MM-DD")', context)).toBe('2024-06-15');
      expect(evaluateExpression('myDate.format("DD/MM/YYYY")', context)).toBe('15/06/2024');
      expect(evaluateExpression('myDate.format("HH:mm:ss")', context)).toBe('14:30:45');
    });

    it('should get time string', () => {
      const context = { myDate: testDate };
      expect(evaluateExpression('myDate.time()', context)).toBe('14:30:45');
    });

    it('should get date part (strip time)', () => {
      const context = { myDate: testDate };
      const result = evaluateExpression('myDate.date()', context) as Date;
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it('should return relative date', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-20T12:00:00Z'));

      const context = { myDate: new Date('2024-06-15T12:00:00Z') };
      expect(evaluateExpression('myDate.relative()', context)).toBe('5 days ago');

      vi.useRealTimers();
    });

    it('should return isEmpty for dates', () => {
      const context = { myDate: testDate };
      expect(evaluateExpression('myDate.isEmpty()', context)).toBe(false);
    });
  });

  // ============================================================================
  // Phase 8: String Functions Tests
  // ============================================================================
  describe('String Functions', () => {
    it('should get string length', () => {
      expect(evaluateExpression('"hello".length', {})).toBe(5);
    });

    it('should check contains', () => {
      expect(evaluateExpression('"hello world".contains("world")', {})).toBe(true);
      expect(evaluateExpression('"hello world".contains("foo")', {})).toBe(false);
    });

    it('should check containsAll', () => {
      expect(evaluateExpression('"hello world".containsAll("hello", "world")', {})).toBe(true);
      expect(evaluateExpression('"hello world".containsAll("hello", "foo")', {})).toBe(false);
    });

    it('should check containsAny', () => {
      expect(evaluateExpression('"hello world".containsAny("foo", "world")', {})).toBe(true);
      expect(evaluateExpression('"hello world".containsAny("foo", "bar")', {})).toBe(false);
    });

    it('should check startsWith', () => {
      expect(evaluateExpression('"hello world".startsWith("hello")', {})).toBe(true);
      expect(evaluateExpression('"hello world".startsWith("world")', {})).toBe(false);
    });

    it('should check endsWith', () => {
      expect(evaluateExpression('"hello world".endsWith("world")', {})).toBe(true);
      expect(evaluateExpression('"hello world".endsWith("hello")', {})).toBe(false);
    });

    it('should convert to lower case', () => {
      expect(evaluateExpression('"HELLO".lower()', {})).toBe('hello');
    });

    it('should convert to upper case', () => {
      expect(evaluateExpression('"hello".upper()', {})).toBe('HELLO');
    });

    it('should convert to title case', () => {
      expect(evaluateExpression('"hello world".title()', {})).toBe('Hello World');
    });

    it('should trim whitespace', () => {
      expect(evaluateExpression('"  hello  ".trim()', {})).toBe('hello');
    });

    it('should replace text', () => {
      expect(evaluateExpression('"hello world".replace("world", "universe")', {})).toBe('hello universe');
    });

    it('should split string', () => {
      expect(evaluateExpression('"a,b,c".split(",")', {})).toEqual(['a', 'b', 'c']);
      expect(evaluateExpression('"a,b,c".split(",", 2)', {})).toEqual(['a', 'b']);
    });

    it('should slice string', () => {
      expect(evaluateExpression('"hello".slice(1, 3)', {})).toBe('el');
      expect(evaluateExpression('"hello".slice(1)', {})).toBe('ello');
    });

    it('should repeat string', () => {
      expect(evaluateExpression('"ab".repeat(3)', {})).toBe('ababab');
    });

    it('should reverse string', () => {
      expect(evaluateExpression('"hello".reverse()', {})).toBe('olleh');
    });

    it('should check isEmpty', () => {
      expect(evaluateExpression('"".isEmpty()', {})).toBe(true);
      expect(evaluateExpression('"hello".isEmpty()', {})).toBe(false);
    });
  });

  // ============================================================================
  // Phase 9: Number Functions Tests
  // ============================================================================
  describe('Number Functions', () => {
    it('should get absolute value', () => {
      expect(evaluateExpression('(-5).abs()', {})).toBe(5);
      const context = { num: -5 };
      expect(evaluateExpression('num.abs()', context)).toBe(5);
    });

    it('should ceil', () => {
      const context = { num: 4.2 };
      expect(evaluateExpression('num.ceil()', context)).toBe(5);
    });

    it('should floor', () => {
      const context = { num: 4.8 };
      expect(evaluateExpression('num.floor()', context)).toBe(4);
    });

    it('should round', () => {
      const context = { num: 4.567 };
      expect(evaluateExpression('num.round()', context)).toBe(5);
      expect(evaluateExpression('num.round(2)', context)).toBe(4.57);
    });

    it('should format with toFixed', () => {
      const context = { num: 4.5 };
      expect(evaluateExpression('num.toFixed(2)', context)).toBe('4.50');
    });

    it('should return isEmpty for numbers', () => {
      const context = { num: 5 };
      expect(evaluateExpression('num.isEmpty()', context)).toBe(false);
    });
  });

  // ============================================================================
  // Phase 10: List Functions Tests
  // ============================================================================
  describe('List Functions', () => {
    it('should get list length', () => {
      const context = { items: [1, 2, 3, 4, 5] };
      expect(evaluateExpression('items.length', context)).toBe(5);
    });

    it('should check contains', () => {
      const context = { items: [1, 2, 3] };
      expect(evaluateExpression('items.contains(2)', context)).toBe(true);
      expect(evaluateExpression('items.contains(5)', context)).toBe(false);
    });

    it('should check containsAll', () => {
      const context = { items: [1, 2, 3, 4] };
      expect(evaluateExpression('items.containsAll(1, 2)', context)).toBe(true);
      expect(evaluateExpression('items.containsAll(1, 5)', context)).toBe(false);
    });

    it('should check containsAny', () => {
      const context = { items: [1, 2, 3] };
      expect(evaluateExpression('items.containsAny(5, 2)', context)).toBe(true);
      expect(evaluateExpression('items.containsAny(5, 6)', context)).toBe(false);
    });

    it('should join list', () => {
      const context = { items: ['a', 'b', 'c'] };
      expect(evaluateExpression('items.join("-")', context)).toBe('a-b-c');
      expect(evaluateExpression('items.join()', context)).toBe('a,b,c');
    });

    it('should sort list', () => {
      const context = { items: [3, 1, 2] };
      expect(evaluateExpression('items.sort()', context)).toEqual([1, 2, 3]);
    });

    it('should reverse list', () => {
      const context = { items: [1, 2, 3] };
      expect(evaluateExpression('items.reverse()', context)).toEqual([3, 2, 1]);
    });

    it('should get unique values', () => {
      const context = { items: [1, 2, 2, 3, 3, 3] };
      expect(evaluateExpression('items.unique()', context)).toEqual([1, 2, 3]);
    });

    it('should flatten list', () => {
      const context = { items: [[1, 2], [3, 4], 5] };
      expect(evaluateExpression('items.flat()', context)).toEqual([1, 2, 3, 4, 5]);
    });

    it('should slice list', () => {
      const context = { items: [1, 2, 3, 4, 5] };
      expect(evaluateExpression('items.slice(1, 3)', context)).toEqual([2, 3]);
      expect(evaluateExpression('items.slice(2)', context)).toEqual([3, 4, 5]);
    });

    it('should check isEmpty', () => {
      expect(evaluateExpression('items.isEmpty()', { items: [] })).toBe(true);
      expect(evaluateExpression('items.isEmpty()', { items: [1] })).toBe(false);
    });

    it('should get first and last', () => {
      const context = { items: [1, 2, 3] };
      expect(evaluateExpression('items.first()', context)).toBe(1);
      expect(evaluateExpression('items.last()', context)).toBe(3);
    });
  });

  // ============================================================================
  // Phase 11: Any Type Functions Tests
  // ============================================================================
  describe('Any Type Functions', () => {
    it('should convert to string', () => {
      expect(evaluateExpression('(42).toString()', {})).toBe('42');
      expect(evaluateExpression('true.toString()', {})).toBe('true');
      const context = { items: [1, 2, 3] };
      expect(evaluateExpression('items.toString()', context)).toBe('1, 2, 3');
    });

    it('should check isTruthy', () => {
      expect(evaluateExpression('(1).isTruthy()', {})).toBe(true);
      expect(evaluateExpression('(0).isTruthy()', {})).toBe(false);
      expect(evaluateExpression('"hello".isTruthy()', {})).toBe(true);
      expect(evaluateExpression('"".isTruthy()', {})).toBe(false);
      expect(evaluateExpression('true.isTruthy()', {})).toBe(true);
      expect(evaluateExpression('false.isTruthy()', {})).toBe(false);
    });

    it('should check isType', () => {
      expect(evaluateExpression('(42).isType("number")', {})).toBe(true);
      expect(evaluateExpression('(42).isType("string")', {})).toBe(false);
      expect(evaluateExpression('"hello".isType("string")', {})).toBe(true);
      expect(evaluateExpression('true.isType("boolean")', {})).toBe(true);

      const context = { items: [1, 2, 3], myDate: new Date() };
      expect(evaluateExpression('items.isType("list")', context)).toBe(true);
      expect(evaluateExpression('items.isType("array")', context)).toBe(true);
      expect(evaluateExpression('myDate.isType("date")', context)).toBe(true);
    });
  });

  // ============================================================================
  // Context and Variable Resolution Tests
  // ============================================================================
  describe('Context Resolution', () => {
    it('should resolve simple variables', () => {
      const context = { name: 'John', age: 30 };
      expect(evaluateExpression('name', context)).toBe('John');
      expect(evaluateExpression('age', context)).toBe(30);
    });

    it('should resolve nested properties', () => {
      const context = {
        file: {
          name: 'test.md',
          path: 'folder/test.md',
        },
      };
      expect(evaluateExpression('file.name', context)).toBe('test.md');
      expect(evaluateExpression('file.path', context)).toBe('folder/test.md');
    });

    it('should resolve note properties', () => {
      const context = {
        note: {
          title: 'My Note',
          status: 'active',
        },
      };
      expect(evaluateExpression('title', context)).toBe('My Note');
      expect(evaluateExpression('status', context)).toBe('active');
    });

    it('should handle undefined variables', () => {
      expect(evaluateExpression('unknown', {})).toBe(undefined);
    });

    it('should handle index access on arrays', () => {
      const context = { items: ['a', 'b', 'c'] };
      expect(evaluateExpression('items[0]', context)).toBe('a');
      expect(evaluateExpression('items[1]', context)).toBe('b');
    });

    it('should handle index access on strings', () => {
      const context = { name: 'hello' };
      expect(evaluateExpression('name[0]', context)).toBe('h');
    });
  });

  // ============================================================================
  // Complex Expression Tests
  // ============================================================================
  describe('Complex Expressions', () => {
    it('should evaluate filter-like expressions', () => {
      const context = {
        file: {
          name: 'Project Task',
          tags: ['task', 'project'],
          properties: { status: 'active' },
        },
      };

      expect(evaluateExpression('file.name.contains("Task")', context)).toBe(true);
      expect(evaluateExpression('file.tags.contains("task")', context)).toBe(true);
    });

    it('should evaluate compound conditions', () => {
      const context = {
        status: 'active',
        priority: 1,
        tags: ['urgent', 'task'],
      };

      expect(
        evaluateExpression('status == "active" && priority > 0', context)
      ).toBe(true);
      expect(
        evaluateExpression('status == "done" || tags.contains("urgent")', context)
      ).toBe(true);
    });

    it('should evaluate nested function calls', () => {
      expect(evaluateExpression('min(max(1, 2), max(3, 4))', {})).toBe(2);
    });

    it('should evaluate method chaining', () => {
      expect(evaluateExpression('"HELLO WORLD".lower().contains("hello")', {})).toBe(true);
    });

    it('should handle null/undefined gracefully', () => {
      const context = { value: null };
      expect(evaluateExpression('value == null', context)).toBe(true);
      expect(evaluateExpression('value != null', context)).toBe(false);
    });
  });

  // ============================================================================
  // Phase 4: File Functions Tests
  // ============================================================================
  describe('File Functions', () => {
    it('should check hasTag', () => {
      const context = {
        file: {
          name: 'test',
          path: 'test.md',
          folder: '',
          ext: 'md',
          basename: 'test',
          size: 100,
          ctime: new Date(),
          mtime: new Date(),
          tags: ['task', 'project'],
          links: ['other.md'],
          embeds: [],
          properties: { status: 'active' },
        },
      };

      expect(evaluateExpression('file.hasTag("task")', context)).toBe(true);
      expect(evaluateExpression('file.hasTag("unknown")', context)).toBe(false);
      expect(evaluateExpression('file.hasTag("#task")', context)).toBe(true); // With # prefix
    });

    it('should check hasLink', () => {
      const context = {
        file: {
          name: 'test',
          path: 'test.md',
          folder: '',
          ext: 'md',
          basename: 'test',
          size: 100,
          ctime: new Date(),
          mtime: new Date(),
          tags: [],
          links: ['other.md', 'another.md'],
          embeds: [],
          properties: {},
        },
      };

      expect(evaluateExpression('file.hasLink("other.md")', context)).toBe(true);
      expect(evaluateExpression('file.hasLink("unknown.md")', context)).toBe(false);
    });

    it('should check hasProperty', () => {
      const context = {
        file: {
          name: 'test',
          path: 'test.md',
          folder: '',
          ext: 'md',
          basename: 'test',
          size: 100,
          ctime: new Date(),
          mtime: new Date(),
          tags: [],
          links: [],
          embeds: [],
          properties: { status: 'active', priority: 1 },
        },
      };

      expect(evaluateExpression('file.hasProperty("status")', context)).toBe(true);
      expect(evaluateExpression('file.hasProperty("unknown")', context)).toBe(false);
    });

    it('should check inFolder', () => {
      const context = {
        file: {
          name: 'test',
          path: 'Projects/Work/test.md',
          folder: 'Projects/Work',
          ext: 'md',
          basename: 'test',
          size: 100,
          ctime: new Date(),
          mtime: new Date(),
          tags: [],
          links: [],
          embeds: [],
          properties: {},
        },
      };

      expect(evaluateExpression('file.inFolder("Projects/Work")', context)).toBe(true);
      expect(evaluateExpression('file.inFolder("Projects")', context)).toBe(true);
      expect(evaluateExpression('file.inFolder("Other")', context)).toBe(false);
    });

    it('should convert to link with asLink', () => {
      const context = {
        file: {
          name: 'My Note',
          path: 'folder/note.md',
          folder: 'folder',
          ext: 'md',
          basename: 'note',
          size: 100,
          ctime: new Date(),
          mtime: new Date(),
          tags: [],
          links: [],
          embeds: [],
          properties: {},
        },
      };

      expect(evaluateExpression('file.asLink()', context)).toEqual({
        type: 'link',
        path: 'folder/note.md',
        display: 'My Note',
      });

      expect(evaluateExpression('file.asLink("Custom")', context)).toEqual({
        type: 'link',
        path: 'folder/note.md',
        display: 'Custom',
      });
    });
  });
});
