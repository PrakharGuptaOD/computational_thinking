// ==========================================
// 1. LEXER
// ==========================================

const TokenType = {
    KEYWORD: 'KEYWORD',
    IDENTIFIER: 'IDENTIFIER',
    NUMBER: 'NUMBER',
    STRING: 'STRING',
    OPERATOR: 'OPERATOR',
    PUNCTUATION: 'PUNCTUATION',
    EOF: 'EOF'
};

const Keywords = new Set([
    'SET', 'TO', 'PRINT', 'IF', 'THEN', 'ELSE', 'ENDIF',
    'WHILE', 'ENDWHILE', 'FOR', 'EACH', 'IN', 'ENDFOR', 'FROM',
    'CREATE', 'LIST', 'SET_DATA', 'TUPLE', 'APPEND', 'REMOVE',
    'INPUT_TEXT', 'INPUT_NUM', 'AND', 'OR',
    'FUNCTION', 'ENDFUNCTION', 'RETURN', 'BREAK', 'CONTINUE',
    'TRUE', 'FALSE', 'NOT', 'TRACE', 'ON', 'OFF','ASSERT'
]);

const Operators = ['+', '-', '*', '/', '%', '//', '<=', '>=', '==', '!=', '<', '>'];

class Lexer {
    constructor(input) {
        this.input = input;
        this.pos = 0;
        this.line = 1;
        this.col = 1;
    }

    advance() {
        if (this.pos >= this.input.length) return null;
        const char = this.input[this.pos++];
        if (char === '\n') { this.line++; this.col = 1; } 
        else { this.col++; }
        return char;
    }

    peek(offset = 0) {
        if (this.pos + offset >= this.input.length) return null;
        return this.input[this.pos + offset];
    }

    skipWhitespace() {
        while (this.peek() && /\s/.test(this.peek())) this.advance();
    }

    tokenize() {
        const tokens = [];
        while (this.pos < this.input.length) {
            this.skipWhitespace();
            if (this.pos >= this.input.length) break;

            const char = this.peek();

            // Comments
            if (char === '#') {
                while (this.peek() && this.peek() !== '\n') this.advance();
                continue;
            }

            // Strings
            if (char === '"' || char === "'") {
                tokens.push(this.readString(this.advance()));
                continue;
            }

            // Numbers
            if (/[0-9]/.test(char)) {
                tokens.push(this.readNumber());
                continue;
            }

            // Identifiers and Keywords
            if (/[a-zA-Z_]/.test(char)) {
                tokens.push(this.readIdentifier());
                continue;
            }

            // Operators (2 chars) - specifically checking for // >= <= == !=
            const twoCharOp = char + (this.peek(1) || '');
            if (Operators.includes(twoCharOp)) {
                tokens.push({ type: TokenType.OPERATOR, value: twoCharOp, line: this.line });
                this.advance(); this.advance();
                continue;
            }

            // Operators (1 char)
            if (Operators.includes(char)) {
                tokens.push({ type: TokenType.OPERATOR, value: char, line: this.line });
                this.advance();
                continue;
            }

            // Punctuation
            if (/[(),[\]{}:]/.test(char)) {
                tokens.push({ type: TokenType.PUNCTUATION, value: char, line: this.line });
                this.advance();
                continue;
            }

            throw new Error(`Lexer Error: Unexpected character '${char}' at line ${this.line}`);
        }
        tokens.push({ type: TokenType.EOF, value: null, line: this.line });
        return tokens;
    }

    readString(quote) {
        let value = '';
        let startLine = this.line;
        while (this.peek() && this.peek() !== quote) {
            value += this.advance();
        }
        if (this.peek() !== quote) throw new Error(`Lexer Error: Unterminated string at line ${startLine}`);
        this.advance();
        return { type: TokenType.STRING, value, line: startLine };
    }

    readNumber() {
        let value = '';
        while (this.peek() && /[0-9.]/.test(this.peek())) {
            value += this.advance();
        }
        return { type: TokenType.NUMBER, value: parseFloat(value), line: this.line };
    }

    readIdentifier() {
        let value = '';
        while (this.peek() && /[a-zA-Z0-9_]/.test(this.peek())) {
            value += this.advance();
        }
        const upper = value.toUpperCase();
        if (Keywords.has(upper)) {
            return { type: TokenType.KEYWORD, value: upper, line: this.line };
        }
        return { type: TokenType.IDENTIFIER, value, line: this.line };
    }
}

// ==========================================
// 2. PARSER
// ==========================================

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    peek() { return this.tokens[this.pos]; }
    previous() { return this.tokens[this.pos - 1]; }
    isAtEnd() { return this.peek().type === TokenType.EOF; }

    advance() {
        if (!this.isAtEnd()) this.pos++;
        return this.previous();
    }

    matchType(type) {
        if (this.peek().type === type) { this.advance(); return true; }
        return false;
    }

    matchKeyword(kw) {
        if (this.peek().type === TokenType.KEYWORD && this.peek().value === kw) {
            this.advance(); return true;
        }
        return false;
    }

    matchOp(ops) {
        if (this.peek().type === TokenType.OPERATOR && ops.includes(this.peek().value)) {
            this.advance(); return true;
        }
        return false;
    }

    matchPunct(ch) {
        if (this.peek().type === TokenType.PUNCTUATION && this.peek().value === ch) {
            this.advance(); return true;
        }
        return false;
    }

    consumeType(type, errMsg) {
        if (this.matchType(type)) return this.previous();
        throw new Error(`Parse Error (Line ${this.peek().line}): ${errMsg} - found '${this.peek().value}'`);
    }

    consumeKeyword(kw, errMsg) {
        if (this.matchKeyword(kw)) return this.previous();
        throw new Error(`Parse Error (Line ${this.peek().line}): ${errMsg} - found '${this.peek().value}'`);
    }

    consumePunct(ch, errMsg) {
        if (this.matchPunct(ch)) return this.previous();
        throw new Error(`Parse Error (Line ${this.peek().line}): ${errMsg} - found '${this.peek().value}'`);
    }

    parse() {
        const statements = [];
        while (!this.isAtEnd()) statements.push(this.parseStatement());
        return { type: 'Program', body: statements };
    }

    parseStatement() {
        const line = this.peek().line;

        let stmt;
        if (this.matchKeyword('SET')) stmt = this.parseSet();
        else if (this.matchKeyword('PRINT')) stmt = this.parsePrint();
        else if (this.matchKeyword('IF')) stmt = this.parseIf();
        else if (this.matchKeyword('WHILE')) stmt = this.parseWhile();
        else if (this.matchKeyword('FOR')) stmt = this.parseFor();
        else if (this.matchKeyword('APPEND')) stmt = this.parseAppend();
        else if (this.matchKeyword('REMOVE')) stmt = this.parseRemove();
        else if (this.matchKeyword('FUNCTION')) stmt = this.parseFunction();
        else if (this.matchKeyword('RETURN')) stmt = this.parseReturn();
        else if (this.matchKeyword('BREAK')) stmt = { type: 'BreakStatement' };
        else if (this.matchKeyword('CONTINUE')) stmt = { type: 'ContinueStatement' };
        else if (this.matchKeyword('ASSERT')) {
            const expr = this.parseExpression();
            stmt = { type: 'AssertStatement', expression: expr };
        }
        else if (this.matchKeyword('TRACE')) {
            let mode = 'ON';
            if (this.matchKeyword('ON')) mode = 'ON';
            else if (this.matchKeyword('OFF')) mode = 'OFF';
            else throw new Error(`Parse Error (Line ${line}): Expected 'ON' or 'OFF' after TRACE`);
            stmt = { type: 'TraceStatement', mode };
        }
        else {
            const expr = this.parseExpression();
            stmt = { type: 'ExpressionStatement', expression: expr };
        }

        stmt.line = line;
        return stmt;
    }

    parseFunction() {
        const name = this.consumeType(TokenType.IDENTIFIER, "Expected function name").value;
        this.consumePunct('(', "Expected '(' after function name");

        const params = [];
        if (this.peek().value !== ')') {
            params.push(this.consumeType(TokenType.IDENTIFIER, "Expected parameter name").value);
            while (this.matchPunct(',')) {
                params.push(this.consumeType(TokenType.IDENTIFIER, "Expected parameter name").value);
            }
        }
        this.consumePunct(')', "Expected ')' after parameters");

        const body = [];
        while (!this.isAtEnd() && this.peek().value !== 'ENDFUNCTION') {
            body.push(this.parseStatement());
        }
        this.consumeKeyword('ENDFUNCTION', "Expected 'ENDFUNCTION'");
        return { type: 'FunctionDeclaration', name, params, body };
    }

    parseReturn() {
        const value = this.parseExpression();
        return { type: 'ReturnStatement', value };
    }

    parseSet() {
        const id = this.consumeType(TokenType.IDENTIFIER, "Expected variable name after SET").value;

        let indexExpr = null;
        if (this.peek().type === TokenType.PUNCTUATION && this.peek().value === '[') {
            this.advance(); 
            indexExpr = this.parseExpression();
            this.consumePunct(']', "Expected ']' after index");
        }

        this.consumeKeyword('TO', "Expected 'TO' after variable name in SET statement");
        const value = this.parseExpression();
        return { type: 'SetStatement', identifier: id, index: indexExpr, value };
    }

    parsePrint() {
        return { type: 'PrintStatement', expression: this.parseExpression() };
    }

    parseIf() {
        const condition = this.parseExpression();
        this.consumeKeyword('THEN', "Expected 'THEN' after IF condition");
        const consequent = [];

        while (!this.isAtEnd() && !['ELSE', 'ENDIF'].includes(this.peek().value)) {
            consequent.push(this.parseStatement());
        }

        const elseIfs = [];
        let alternate = [];

        while (this.matchKeyword('ELSE')) {
            if (this.matchKeyword('IF')) {
                const eiCondition = this.parseExpression();
                this.consumeKeyword('THEN', "Expected 'THEN' after ELSE IF condition");
                const eiConsequent = [];
                while (!this.isAtEnd() && !['ELSE', 'ENDIF'].includes(this.peek().value)) {
                    eiConsequent.push(this.parseStatement());
                }
                elseIfs.push({ condition: eiCondition, consequent: eiConsequent });
            } else {
                while (!this.isAtEnd() && this.peek().value !== 'ENDIF') {
                    alternate.push(this.parseStatement());
                }
                break;
            }
        }
        this.consumeKeyword('ENDIF', "Expected 'ENDIF' to close IF statement");
        return { type: 'IfStatement', condition, consequent, elseIfs, alternate };
    }

    parseWhile() {
        const condition = this.parseExpression();
        const body = [];
        while (!this.isAtEnd() && this.peek().value !== 'ENDWHILE') body.push(this.parseStatement());
        this.consumeKeyword('ENDWHILE', "Expected 'ENDWHILE'");
        return { type: 'WhileStatement', condition, body };
    }

    parseFor() {
        if (this.matchKeyword('EACH')) {
            const iterator = this.consumeType(TokenType.IDENTIFIER, "Expected iterator variable name").value;
            this.consumeKeyword('IN', "Expected 'IN'");
            const collection = this.parseExpression();
            const body = [];
            while (!this.isAtEnd() && this.peek().value !== 'ENDFOR') body.push(this.parseStatement());
            this.consumeKeyword('ENDFOR', "Expected 'ENDFOR'");
            return { type: 'ForStatement', iterator, collection, body };
        } else {
            const iterator = this.consumeType(TokenType.IDENTIFIER, "Expected iterator variable name").value;
            this.consumeKeyword('FROM', "Expected 'FROM'");
            const start = this.parseExpression();
            this.consumeKeyword('TO', "Expected 'TO'");
            const end = this.parseExpression();
            const body = [];
            while (!this.isAtEnd() && this.peek().value !== 'ENDFOR') body.push(this.parseStatement());
            this.consumeKeyword('ENDFOR', "Expected 'ENDFOR'");
            return { type: 'ForRangeStatement', iterator, start, end, body };
        }
    }

    parseAppend() {
        const item = this.parseExpression();
        this.consumeKeyword('TO', "Expected 'TO'");
        const collection = this.consumeType(TokenType.IDENTIFIER, "Expected collection name").value;
        return { type: 'AppendStatement', item, collection };
    }

    parseRemove() {
        const item = this.parseExpression();
        this.consumeKeyword('FROM', "Expected 'FROM'");
        const collection = this.consumeType(TokenType.IDENTIFIER, "Expected collection name").value;
        return { type: 'RemoveStatement', item, collection };
    }

    parseExpression() {
        return this.parseLogical();
    }

    parseLogical() {
        let left = this.parseEquality();
        while (this.matchKeyword('AND') || this.matchKeyword('OR')) {
            const op = this.previous().value;
            const right = this.parseEquality();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }

    parseEquality() {
        let left = this.parseComparison();
        while (this.matchOp(['==', '!='])) {
            const op = this.previous().value;
            const right = this.parseComparison();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }

    parseComparison() {
        let left = this.parseTerm();
        while (this.matchOp(['<', '<=', '>', '>='])) {
            const op = this.previous().value;
            const right = this.parseTerm();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }

    parseTerm() {
        let left = this.parseFactor();
        while (this.matchOp(['+', '-'])) {
            const op = this.previous().value;
            const right = this.parseFactor();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }

    parseFactor() {
        let left = this.parseUnary();
        while (this.matchOp(['*', '/', '%', '//'])) {
            const op = this.previous().value;
            const right = this.parseUnary();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }

    parseUnary() {
        if (this.matchKeyword('NOT') || this.matchOp(['-'])) {
            const op = this.previous().value;
            const right = this.parseUnary();
            return { type: 'UnaryExpression', operator: op, right };
        }
        return this.parsePrimary();
    }

    parsePrimary() {
        if (this.matchType(TokenType.NUMBER)) return { type: 'Literal', value: this.previous().value, dataType: 'Number' };
        if (this.matchType(TokenType.STRING)) return { type: 'Literal', value: this.previous().value, dataType: 'String' };

        if (this.matchKeyword('TRUE')) return { type: 'Literal', value: true, dataType: 'Boolean' };
        if (this.matchKeyword('FALSE')) return { type: 'Literal', value: false, dataType: 'Boolean' };

        // List Literals [1, 2, 3]
        if (this.peek().type === TokenType.PUNCTUATION && this.peek().value === '[') {
            this.advance(); // consume '['
            const elements = [];
            if (this.peek().value !== ']') {
                elements.push(this.parseExpression());
                while (this.matchPunct(',')) {
                    elements.push(this.parseExpression());
                }
            }
            this.consumePunct(']', "Expected ']' after list literal");
            return { type: 'ListLiteral', elements };
        }

        if (this.matchKeyword('CREATE')) {
            if (this.matchKeyword('LIST')) return { type: 'CreateCollection', collectionType: 'List' };
            if (this.matchKeyword('SET_DATA')) return { type: 'CreateCollection', collectionType: 'Set' };
            if (this.matchKeyword('TUPLE')) return { type: 'CreateCollection', collectionType: 'Tuple' };
            throw new Error(`Parse Error (Line ${this.peek().line}): Unknown collection type after CREATE`);
        }

        if (this.matchKeyword('INPUT_TEXT') || this.matchKeyword('INPUT_NUM')) {
            const type = this.previous().value;
            this.consumePunct('(', "Expected '(' after " + type);
            const promptStr = this.consumeType(TokenType.STRING, "Expected prompt string").value;
            this.consumePunct(')', "Expected ')' after prompt");
            return { type: 'InputExpression', inputType: type, prompt: promptStr };
        }

        if (this.matchType(TokenType.IDENTIFIER)) {
            const name = this.previous().value;
            let node;

            if (this.peek().type === TokenType.PUNCTUATION && this.peek().value === '(') {
                this.advance(); // consume '('
                const args = [];
                if (this.peek().value !== ')') {
                    args.push(this.parseExpression());
                    while (this.matchPunct(',')) {
                        args.push(this.parseExpression());
                    }
                }
                this.consumePunct(')', "Expected ')' after arguments");
                node = { type: 'FunctionCall', name, args };
            } else {
                node = { type: 'Identifier', name };
            }

            while (this.peek().type === TokenType.PUNCTUATION && this.peek().value === '[') {
                this.advance(); // consume '['

                let start = null;
                if (!(this.peek().type === TokenType.PUNCTUATION && this.peek().value === ':')) {
                    start = this.parseExpression();
                }

                if (this.peek().type === TokenType.PUNCTUATION && this.peek().value === ':') {
                    this.advance(); // consume ':'
                    let end = null;
                    if (!(this.peek().type === TokenType.PUNCTUATION && this.peek().value === ']')) {
                        end = this.parseExpression();
                    }
                    this.consumePunct(']', "Expected ']' after slice");
                    node = { type: 'SliceExpression', target: node, start, end };
                } else {
                    this.consumePunct(']', "Expected ']' after index");
                    node = { type: 'IndexExpression', target: node, index: start };
                }
            }
            return node;
        }

        if (this.peek().type === TokenType.PUNCTUATION && this.peek().value === '(') {
            this.advance(); // consume '('
            const expr = this.parseExpression();
            this.consumePunct(')', "Expected ')'");
            return expr;
        }

        throw new Error(`Parse Error (Line ${this.peek().line}): Unexpected token '${this.peek().value}'`);
    }
}

// ==========================================
// 3. INTERPRETER & ENVIRONMENT
// ==========================================

class Environment {
    constructor(parent = null) {
        this.vars = new Map();
        this.parent = parent;
        this.onChange = null;
    }

    set(name, value, type) {
        this.vars.set(name, { value, type });
        const root = this._root();
        if (root.onChange) root.onChange(root);
    }

    get(name) {
        if (this.vars.has(name)) return this.vars.get(name);
        if (this.parent) return this.parent.get(name);
        throw new Error(`Undefined variable: '${name}'`);
    }

    _root() {
        let env = this;
        while (env.parent) env = env.parent;
        return env;
    }
}

class Interpreter {
    constructor(ast, env, onOutput, onInput, updateStackUI) {
        this.ast = ast;
        this.env = env;
        this.onOutput = onOutput;
        this.onInput = onInput;
        this.updateStackUI = updateStackUI;
        this.stepCount = 0;
        this.MAX_STEPS = 20000;
        
        this.traceMode = false;
        this.callStack = ['main()'];

        this.execGen = this.executeBlock(this.ast.body);
    }

    _pushStack(name) {
        this.callStack.push(name);
        if (this.updateStackUI) this.updateStackUI(this.callStack);
    }

    _popStack() {
        this.callStack.pop();
        if (this.updateStackUI) this.updateStackUI(this.callStack);
    }

    async runAll() {
        let result = this.execGen.next();
        while (!result.done) {
            if (result.value instanceof Promise) {
                const userInput = await result.value;
                result = this.execGen.next(userInput);
            } else {
                result = this.execGen.next();
            }
        }
    }

    async step() {
        let result = this.execGen.next();

        while (!result.done) {
            if (result.value instanceof Promise) {
                const userInput = await result.value;
                result = this.execGen.next(userInput);
            } else {
                return { done: false, line: result.value.line };
            }
        }
        return { done: true };
    }

    *executeBlock(statements) {
        for (const stmt of statements) {
            yield stmt;
            const result = yield* this.executeStatement(stmt);

            if (result && (result.type === 'ReturnSignal' || result.type === 'BreakSignal' || result.type === 'ContinueSignal')) {
                return result;
            }

            this.stepCount++;
            if (this.stepCount > this.MAX_STEPS) {
                throw new Error("Possible infinite loop detected (exceeded " + this.MAX_STEPS + " steps).");
            }
        }
    }

    *executeStatement(stmt) {
        if (this.traceMode) {
            this.onOutput(`[TRACE] Executing ${stmt.type} on Line ${stmt.line}`, 'trace');
        }

        switch (stmt.type) {

            case 'TraceStatement': {
                this.traceMode = stmt.mode === 'ON';
                break;
            }
            case 'BreakStatement': {
                return { type: 'BreakSignal' };
            }
            case 'ContinueStatement': {
                return { type: 'ContinueSignal' };

            }
            case 'AssertStatement': {
                const cond = yield* this.evaluate(stmt.expression);
                if (!cond.value) {
                    throw new Error(`Assertion Failed: The condition evaluated to FALSE.`);
                }
                break;
            }
            case 'FunctionDeclaration': {
                this.env.set(stmt.name, stmt, 'Function');
                break;
            }
            case 'ReturnStatement': {
                const valObj = yield* this.evaluate(stmt.value);
                return { type: 'ReturnSignal', value: valObj };
            }
            case 'SetStatement': {
                const valObj = yield* this.evaluate(stmt.value);

                if (stmt.index) {
                    const colObj = this.env.get(stmt.identifier);
                    if (colObj.type !== 'List') throw new Error(`Cannot index-assign into type '${colObj.type}'`);

                    const idxObj = yield* this.evaluate(stmt.index);
                    let idx = idxObj.value;

                    if (idx < 0) idx = colObj.value.length + idx;
                    if (idx < 0 || idx >= colObj.value.length) throw new Error("Index out of bounds");

                    colObj.value[idx] = valObj.value;
                    this.env.set(stmt.identifier, colObj.value, colObj.type);
                } else {
                    this.env.set(stmt.identifier, valObj.value, valObj.type);
                }
                break;
            }
            case 'PrintStatement': {
                const valObj = yield* this.evaluate(stmt.expression);
                const out = this._valueToString(valObj);
                this.onOutput(out);
                break;
            }
            case 'IfStatement': {
                const cond = yield* this.evaluate(stmt.condition);
                if (cond.value) {
                    const res = yield* this.executeBlock(stmt.consequent);
                    if (res) return res;
                } else {
                    let handled = false;
                    if (stmt.elseIfs && stmt.elseIfs.length > 0) {
                        for (const ei of stmt.elseIfs) {
                            const eiCond = yield* this.evaluate(ei.condition);
                            if (eiCond.value) {
                                const res = yield* this.executeBlock(ei.consequent);
                                if (res) return res;
                                handled = true;
                                break;
                            }
                        }
                    }
                    if (!handled && stmt.alternate && stmt.alternate.length > 0) {
                        const res = yield* this.executeBlock(stmt.alternate);
                        if (res) return res;
                    }
                }
                break;
            }
            case 'WhileStatement': {
                while (true) {
                    const cond = yield* this.evaluate(stmt.condition);
                    if (!cond.value) break;
                    
                    const res = yield* this.executeBlock(stmt.body);
                    if (res && res.type === 'ReturnSignal') return res;
                    if (res && res.type === 'BreakSignal') break;
                    // ContinueSignal is ignored here because we just let the block end and loop resets naturally
                }
                break;
            }
            case 'ForStatement': {
                const colObj = yield* this.evaluate(stmt.collection);
                let items = [];
                if (colObj.type === 'List' || colObj.type === 'Tuple') items = colObj.value;
                else if (colObj.type === 'Set') items = Array.from(colObj.value);
                else throw new Error(`Cannot iterate over type '${colObj.type}'`);

                for (const item of items) {
                    const itemType = typeof item === 'number' ? 'Number' : (typeof item === 'boolean' ? 'Boolean' : 'String');
                    this.env.set(stmt.iterator, item, itemType);
                    
                    const res = yield* this.executeBlock(stmt.body);
                    if (res && res.type === 'ReturnSignal') return res;
                    if (res && res.type === 'BreakSignal') break;
                }
                break;
            }
            case 'ForRangeStatement': {
                const startObj = yield* this.evaluate(stmt.start);
                const endObj = yield* this.evaluate(stmt.end);

                for (let i = startObj.value; i <= endObj.value; i++) {
                    this.env.set(stmt.iterator, i, 'Number');
                    
                    const res = yield* this.executeBlock(stmt.body);
                    if (res && res.type === 'ReturnSignal') return res;
                    if (res && res.type === 'BreakSignal') break;
                }
                break;
            }
            case 'AppendStatement': {
                const itemObj = yield* this.evaluate(stmt.item);
                const col = this.env.get(stmt.collection);
                if (col.type === 'List') {
                    col.value.push(itemObj.value);
                } else if (col.type === 'Set') {
                    col.value.add(itemObj.value);
                } else {
                    throw new Error(`Cannot APPEND to type '${col.type}'`);
                }
                this.env.set(stmt.collection, col.value, col.type);
                break;
            }
            case 'RemoveStatement': {
                const itemObj = yield* this.evaluate(stmt.item);
                const col = this.env.get(stmt.collection);
                if (col.type === 'List') {
                    const idx = col.value.indexOf(itemObj.value);
                    if (idx > -1) col.value.splice(idx, 1);
                } else if (col.type === 'Set') {
                    col.value.delete(itemObj.value);
                } else {
                    throw new Error(`Cannot REMOVE from type '${col.type}'`);
                }
                this.env.set(stmt.collection, col.value, col.type);
                break;
            }
            case 'ExpressionStatement': {
                yield* this.evaluate(stmt.expression);
                break;
            }
        }
    }

    _valueToString(valObj) {
        if (valObj.type === 'List' || valObj.type === 'Tuple') return `[${valObj.value.join(', ')}]`;
        if (valObj.type === 'Set') return `{${Array.from(valObj.value).join(', ')}}`;
        if (valObj.type === 'Boolean') return valObj.value ? 'TRUE' : 'FALSE';
        return String(valObj.value);
    }

    *evaluate(expr) {
        switch (expr.type) {
            case 'Literal':
                return { value: expr.value, type: expr.dataType };

            case 'Identifier':
                return this.env.get(expr.name);
            
            case 'ListLiteral': {
                const listVal = [];
                for (const el of expr.elements) {
                    const ev = yield* this.evaluate(el);
                    listVal.push(ev.value);
                }
                return { value: listVal, type: 'List' };
            }

            case 'CreateCollection': {
                if (expr.collectionType === 'List')  return { value: [],         type: 'List'  };
                if (expr.collectionType === 'Set')   return { value: new Set(),  type: 'Set'   };
                if (expr.collectionType === 'Tuple') return { value: [],         type: 'Tuple' };
                throw new Error(`Unknown collection type: '${expr.collectionType}'`);
            }

            case 'InputExpression': {
                const userInput = yield this.onInput(expr.prompt);
                if (expr.inputType === 'INPUT_NUM') {
                    const num = parseFloat(userInput);
                    if (isNaN(num)) throw new Error(`Expected a number but got '${userInput}'`);
                    return { value: num, type: 'Number' };
                }
                return { value: userInput, type: 'String' };
            }

            case 'UnaryExpression': {
                const rightObj = yield* this.evaluate(expr.right);
                if (expr.operator === 'NOT') return { value: !rightObj.value,  type: 'Boolean' };
                if (expr.operator === '-')   return { value: -rightObj.value,  type: 'Number'  };
                throw new Error(`Unknown unary operator: '${expr.operator}'`);
            }

            case 'BinaryExpression': {
                const leftObj  = yield* this.evaluate(expr.left);
                const rightObj = yield* this.evaluate(expr.right);
                const l = leftObj.value, r = rightObj.value;

                switch (expr.operator) {
                    case '+': {
                        if (leftObj.type === 'Number' && rightObj.type === 'Number') {
                            return { value: l + r, type: 'Number' };
                        }
                        const lStr = this._valueToString(leftObj);
                        const rStr = this._valueToString(rightObj);
                        return { value: lStr + rStr, type: 'String' };
                    }
                    case '-':  return { value: l - r,   type: 'Number'  };
                    case '*':  return { value: l * r,   type: 'Number'  };
                    case '/':  return { value: l / r,   type: 'Number'  };
                    case '//': return { value: Math.floor(l / r), type: 'Number' };
                    case '%':  return { value: l % r,   type: 'Number'  };
                    case '==': return { value: l === r, type: 'Boolean' };
                    case '!=': return { value: l !== r, type: 'Boolean' };
                    case '<':  return { value: l < r,   type: 'Boolean' };
                    case '<=': return { value: l <= r,  type: 'Boolean' };
                    case '>':  return { value: l > r,   type: 'Boolean' };
                    case '>=': return { value: l >= r,  type: 'Boolean' };
                    case 'AND': return { value: !!(l && r), type: 'Boolean' };
                    case 'OR':  return { value: !!(l || r), type: 'Boolean' };
                    default: throw new Error(`Unknown binary operator: '${expr.operator}'`);
                }
            }

            case 'IndexExpression': {
                const targetObj = yield* this.evaluate(expr.target);
                const idxObj    = yield* this.evaluate(expr.index);

                if (targetObj.type !== 'List' && targetObj.type !== 'String' && targetObj.type !== 'Tuple') {
                    throw new Error(`Cannot index into type '${targetObj.type}'`);
                }

                let idx = idxObj.value;
                if (idx < 0) idx = targetObj.value.length + idx;
                if (idx < 0 || idx >= targetObj.value.length) throw new Error("Index out of bounds");

                const val = targetObj.value[idx];
                const type = typeof val === 'number' ? 'Number' : (typeof val === 'boolean' ? 'Boolean' : 'String');
                return { value: val, type };
            }

            case 'SliceExpression': {
                const targetObj = yield* this.evaluate(expr.target);
                if (targetObj.type !== 'List' && targetObj.type !== 'String') {
                    throw new Error(`Cannot slice type '${targetObj.type}'`);
                }

                let start = 0;
                let end   = targetObj.value.length;

                if (expr.start) {
                    const s = yield* this.evaluate(expr.start);
                    start = s.value < 0 ? targetObj.value.length + s.value : s.value;
                }
                if (expr.end) {
                    const e = yield* this.evaluate(expr.end);
                    end = e.value < 0 ? targetObj.value.length + e.value : e.value;
                }

                const sliced = targetObj.value.slice(start, end);
                return { value: sliced, type: targetObj.type };
            }

            case 'FunctionCall': {
                const func = this.env.get(expr.name);

                if (func.type === 'NativeFunction') {
                    const argVals = [];
                    for (const arg of expr.args) {
                        argVals.push(yield* this.evaluate(arg));
                    }
                    return func.value(argVals);
                }

                if (func.type !== 'Function') throw new Error(`'${expr.name}' is not a function`);
                
                this._pushStack(`${expr.name}()`);
                
                const funcNode = func.value;
                const localEnv = new Environment(this.env);

                for (let i = 0; i < funcNode.params.length; i++) {
                    const argVal = yield* this.evaluate(expr.args[i]);
                    localEnv.set(funcNode.params[i], argVal.value, argVal.type);
                }

                const previousEnv = this.env;
                this.env = localEnv;
                const result = yield* this.executeBlock(funcNode.body);
                this.env = previousEnv;

                this._popStack();

                if (result && result.type === 'ReturnSignal') return result.value;
                return { value: undefined, type: 'Undefined' };
            }

            default:
                throw new Error(`Unknown expression type: '${expr.type}'`);
        }
    }
}

// ==========================================
// 4. UI AND RUNTIME INTEGRATION
// ==========================================

let mainEditor = null;
let activeInterpreter = null;
let activeEnv = null;
let activeLineMarker = null;
let isRunning = false;

document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // MAIN EDITOR INITIALIZATION
    // ==========================================
    const mainEditorDiv = document.getElementById('editor');
    if (mainEditorDiv) {
        mainEditor = CodeMirror(mainEditorDiv, {
            value: "# Refer to https://kselis.github.io/computational_thinking/KSELIS_psuedocode_language for documentation",
            mode: "javascript",
            theme: "darcula",
            lineNumbers: true,
            indentUnit: 4,
            viewportMargin: Infinity
        });

        const terminalEl  = document.getElementById('terminal');
        const variablesEl = document.getElementById('variables');
        const callstackEl = document.getElementById('callstack-ui'); // Optional UI Element

        function printTerminal(msg, type = '') {
            const line = document.createElement('div');
            // Adding a distinct style class if it's a TRACE message
            if (type === 'trace') line.className = 'term-line term-trace';
            else line.className = `term-line ${type ? 'term-' + type : ''}`;
            
            line.textContent = msg;
            terminalEl.appendChild(line);
            terminalEl.scrollTop = terminalEl.scrollHeight;
        }

        function clearTerminal() {
            terminalEl.innerHTML = '<div class="term-system">Sandbox initialized. Ready.</div>';
        }

        function updateCallStackUI(stack) {
            if (!callstackEl) return; // Fail gracefully if UI element doesn't exist
            callstackEl.innerHTML = '';
            stack.forEach(frame => {
                const el = document.createElement('div');
                el.className = 'stack-frame';
                el.textContent = `↳ ${frame}`;
                callstackEl.appendChild(el);
            });
        }

        function updateVariablesUI(env) {
            const dataVars = Array.from(env.vars.entries()).filter(([key, v]) => 
                v.type !== 'NativeFunction' && v.type !== 'Function'
            );

            if (dataVars.length === 0) {
                variablesEl.innerHTML = '<div class="term-system">No variables defined.</div>';
                return;
            }
            
            variablesEl.innerHTML = '';
            for (const [key, v] of dataVars) {
                const row  = document.createElement('div');
                row.className = 'var-row';

                const name = document.createElement('div');
                name.className = 'var-name';
                name.textContent = key;

                const val = document.createElement('div');
                val.className = `var-value ${v.type.toLowerCase()}`;

                if (v.type === 'List' || v.type === 'Tuple') val.textContent = `[${v.value.join(', ')}]`;
                else if (v.type === 'Set')     val.textContent = `{${Array.from(v.value).join(', ')}}`;
                else if (v.type === 'String')  val.textContent = `"${v.value}"`;
                else if (v.type === 'Boolean') val.textContent = v.value ? 'TRUE' : 'FALSE';
                else val.textContent = v.value;

                row.appendChild(name);
                row.appendChild(val);
                variablesEl.appendChild(row);
            }
        }

        function highlightLine(lineNum) {
            if (activeLineMarker !== null) {
                mainEditor.removeLineClass(activeLineMarker, "background", "active-line");
            }
            if (lineNum !== null && lineNum > 0) {
                activeLineMarker = lineNum - 1;
                mainEditor.addLineClass(activeLineMarker, "background", "active-line");
            }
        }

        function requestInput(promptMsg) {
            return new Promise((resolve) => {
                const line = document.createElement('div');
                line.className = 'term-input-line';

                const promptLabel = document.createElement('span');
                promptLabel.className = 'term-prompt';
                promptLabel.textContent = promptMsg + " >";

                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.className = 'term-input';

                line.appendChild(promptLabel);
                line.appendChild(inputField);
                terminalEl.appendChild(line);
                terminalEl.scrollTop = terminalEl.scrollHeight;
                inputField.focus();

                inputField.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        const val = inputField.value;
                        inputField.disabled = true;
                        resolve(val);
                    }
                });
            });
        }

        function injectNativeLibrary(env) {
            // Arrays & Math
            env.set('LENGTH', (args) => ({ value: args[0].value.length !== undefined ? args[0].value.length : args[0].value.size, type: 'Number' }), 'NativeFunction');
            env.set('SUM', (args) => ({ value: args[0].value.reduce((acc, curr) => acc + curr, 0), type: 'Number' }), 'NativeFunction');
            env.set('MIN', (args) => ({ value: Math.min(...args[0].value), type: 'Number' }), 'NativeFunction');
            env.set('MAX', (args) => ({ value: Math.max(...args[0].value), type: 'Number' }), 'NativeFunction');
            env.set('CONTAINS', (args) => ({ value: args[0].value.includes(args[1].value), type: 'Boolean' }), 'NativeFunction');
            env.set('INDEXOF', (args) => ({ value: args[0].value.indexOf(args[1].value), type: 'Number' }), 'NativeFunction');
            env.set('RANDOM_INT', (args) => ({ value: Math.floor(Math.random() * (Math.floor(args[1].value) - Math.ceil(args[0].value) + 1)) + Math.ceil(args[0].value), type: 'Number' }), 'NativeFunction');
            
            // Casting
            env.set('TO_STRING', (args) => ({ value: String(args[0].value), type: 'String' }), 'NativeFunction');
            env.set('TO_NUM', (args) => {
                const n = parseFloat(args[0].value);
                if (isNaN(n)) throw new Error(`Cannot convert '${args[0].value}' to a number`);
                return { value: n, type: 'Number' };
            }, 'NativeFunction');

            // Course Specific Evaluators (Time/Space Complexity, Dates, Time)
            env.set('DATE', () => {
                const now = new Date();
                // DD/MM/YYYY format
                const formatted = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + now.getFullYear();
                return { value: formatted, type: 'String' };
            }, 'NativeFunction');
            
            env.set('TIME', () => {
                const now = new Date();
                // 24hr format HH:MM:SS
                const formatted = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
                return { value: formatted, type: 'String' };
            }, 'NativeFunction');

            env.set('TCOMP', (args) => ({ value: `Time Complexity: ${args[0].value}`, type: 'String' }), 'NativeFunction');
            env.set('SCOMP', (args) => ({ value: `Space Complexity: ${args[0].value}`, type: 'String' }), 'NativeFunction');
        }

        function setupExecution() {
            clearTerminal();
            activeEnv = new Environment();
            injectNativeLibrary(activeEnv);

            activeEnv.onChange = updateVariablesUI;
            updateVariablesUI(activeEnv);
            updateCallStackUI(['main()']);

            const code = mainEditor.getValue();
            try {
                const lexer  = new Lexer(code);
                const tokens = lexer.tokenize();
                const parser = new Parser(tokens);
                const ast    = parser.parse();

                activeInterpreter = new Interpreter(ast, activeEnv, printTerminal, requestInput, updateCallStackUI);
                return true;
            } catch (e) {
                printTerminal(e.message, 'error');
                activeInterpreter = null;
                return false;
            }
        }

        function setControlsDisabled(disabled) {
            document.getElementById('btn-run').disabled  = disabled;
            document.getElementById('btn-step').disabled = disabled;
        }

        document.getElementById('btn-run').addEventListener('click', async () => {
            if (isRunning) return;
            if (!activeInterpreter) {
                if (!setupExecution()) return;
            }

            isRunning = true;
            setControlsDisabled(true);
            highlightLine(null);

            try {
                await activeInterpreter.runAll();
                printTerminal("Program finished.", "success");
                activeInterpreter = null;
            } catch (e) {
                printTerminal("Runtime Error: " + e.message, "error");
                activeInterpreter = null;
            }

            isRunning = false;
            setControlsDisabled(false);
        });

        document.getElementById('btn-step').addEventListener('click', async () => {
            if (isRunning) return;

            if (!activeInterpreter) {
                if (!setupExecution()) return;
                printTerminal("Stepping started...", "system");
            }

            isRunning = true;
            setControlsDisabled(true);

            try {
                const stepResult = await activeInterpreter.step();
                if (stepResult.done) {
                    printTerminal("Program finished.", "success");
                    highlightLine(null);
                    activeInterpreter = null;
                } else {
                    highlightLine(stepResult.line);
                }
            } catch (e) {
                printTerminal("Runtime Error: " + e.message, "error");
                highlightLine(null);
                activeInterpreter = null;
            }

            isRunning = false;
            setControlsDisabled(false);
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            clearTerminal();
            activeEnv = new Environment();
            injectNativeLibrary(activeEnv);
            activeEnv.onChange = updateVariablesUI;
            updateVariablesUI(activeEnv);
            updateCallStackUI(['main()']);
            activeInterpreter = null;

            highlightLine(null);
            isRunning = false;
            setControlsDisabled(false);
        });
    }

    // ==========================================
    // EMBEDDABLE MODE INITIALIZATION
    // ==========================================
    const embeds = document.querySelectorAll('.pseudo-sandbox');
    embeds.forEach((el) => {
        const code = el.textContent.trim();

        const container = document.createElement('div');
        container.className = 'sandbox-container embedded-sandbox';

        container.innerHTML = `
            <div class="panel editor-panel">
                <div class="panel-header">
                    <span>Editor</span>
                    <div class="toolbar">
                        <button class="embed-run run-btn">▶ Run</button>
                    </div>
                </div>
                <div class="embed-editor editor-container"></div>
            </div>
            <div class="panel variables-panel hidden"></div>
            <div class="panel terminal-panel">
                <div class="panel-header"><span>>_ Terminal</span></div>
                <div class="embed-terminal terminal-content"></div>
            </div>
        `;

        el.parentNode.replaceChild(container, el);

        const edNode  = container.querySelector('.embed-editor');
        const termNode = container.querySelector('.embed-terminal');
        const runBtn  = container.querySelector('.embed-run');

        const embedEditor = CodeMirror(edNode, {
            value: code,
            mode: "javascript",
            theme: "darcula",
            lineNumbers: true
        });

        runBtn.addEventListener('click', async () => {
            termNode.innerHTML = '';
            const embedEnv = new Environment();

            // Minimal embed library matching main
            embedEnv.set('LENGTH', (args) => ({ value: args[0].value.length !== undefined ? args[0].value.length : args[0].value.size, type: 'Number' }), 'NativeFunction');
            embedEnv.set('SUM', (args) => ({ value: args[0].value.reduce((acc, curr) => acc + curr, 0), type: 'Number' }), 'NativeFunction');
            embedEnv.set('MIN', (args) => ({ value: Math.min(...args[0].value), type: 'Number' }), 'NativeFunction');
            embedEnv.set('MAX', (args) => ({ value: Math.max(...args[0].value), type: 'Number' }), 'NativeFunction');
            embedEnv.set('CONTAINS', (args) => ({ value: args[0].value.includes(args[1].value), type: 'Boolean' }), 'NativeFunction');
            embedEnv.set('INDEXOF', (args) => ({ value: args[0].value.indexOf(args[1].value), type: 'Number' }), 'NativeFunction');
            embedEnv.set('RANDOM_INT', (args) => ({ value: Math.floor(Math.random() * (Math.floor(args[1].value) - Math.ceil(args[0].value) + 1)) + Math.ceil(args[0].value), type: 'Number' }), 'NativeFunction');
            embedEnv.set('TO_STRING', (args) => ({ value: String(args[0].value), type: 'String' }), 'NativeFunction');
            embedEnv.set('TO_NUM', (args) => { const n = parseFloat(args[0].value); if (isNaN(n)) throw new Error(`Cannot convert '${args[0].value}' to a number`); return { value: n, type: 'Number' }; }, 'NativeFunction');
            embedEnv.set('DATE', () => { const now = new Date(); return { value: String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + now.getFullYear(), type: 'String' }; }, 'NativeFunction');
            embedEnv.set('TIME', () => { const now = new Date(); return { value: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0'), type: 'String' }; }, 'NativeFunction');
            embedEnv.set('TCOMP', (args) => ({ value: `Time Complexity: ${args[0].value}`, type: 'String' }), 'NativeFunction');
            embedEnv.set('SCOMP', (args) => ({ value: `Space Complexity: ${args[0].value}`, type: 'String' }), 'NativeFunction');

            const printFn = (msg, type='') => {
                const line = document.createElement('div');
                if (type === 'trace') line.className = 'term-line term-trace';
                else line.className = `term-line ${type ? 'term-' + type : ''}`;
                line.textContent = msg;
                termNode.appendChild(line);
                termNode.scrollTop = termNode.scrollHeight;
            };

            const inputFn = (promptMsg) => new Promise((resolve) => {
                const line = document.createElement('div');
                line.className = 'term-input-line';
                const promptLabel = document.createElement('span');
                promptLabel.className = 'term-prompt';
                promptLabel.textContent = promptMsg + " >";
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.className = 'term-input';
                line.appendChild(promptLabel);
                line.appendChild(inputField);
                termNode.appendChild(line);
                termNode.scrollTop = termNode.scrollHeight;
                inputField.focus();

                inputField.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        inputField.disabled = true;
                        resolve(inputField.value);
                    }
                });
            });

            try {
                const lex = new Lexer(embedEditor.getValue());
                const ast = new Parser(lex.tokenize()).parse();
                const interpreter = new Interpreter(ast, embedEnv, printFn, inputFn, null);
                await interpreter.runAll();
                const doneMsg = document.createElement('div');
                doneMsg.className = 'term-line term-success';
                doneMsg.textContent = "Finished.";
                termNode.appendChild(doneMsg);
            } catch(e) {
                const errMsg = document.createElement('div');
                errMsg.className = 'term-line term-error';
                errMsg.textContent = "Error: " + e.message;
                termNode.appendChild(errMsg);
            }
        });
    });
});
