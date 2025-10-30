export type DiceRollModifier =
  | { type: "keep-high"; count: number }
  | { type: "keep-low"; count: number }
  | { type: "drop-high"; count: number }
  | { type: "drop-low"; count: number };

export type DiceRollTerm = {
  type: "dice";
  notation: string;
  sides: number | "F";
  count: number;
  rolls: number[];
  kept: number[];
  dropped: number[];
  modifier?: DiceRollModifier;
  total: number;
};

export type NumberTerm = {
  type: "number";
  value: number;
};

export type OperatorTerm = {
  type: "operator";
  operator: "+" | "-" | "*" | "/";
};

export type RollTerm = DiceRollTerm | NumberTerm | OperatorTerm;

export interface RollResult {
  /** The numeric result of the roll after applying all operations. */
  total: number;
  /** Ordered list of terms that were evaluated while resolving the expression. */
  terms: RollTerm[];
  /** The normalized notation that was parsed. */
  notation: string;
}

type EvalResult = {
  value: number;
  terms: RollTerm[];
};

type Rng = () => number;

const DEFAULT_RNG: Rng = () => Math.random();

/**
 * Roll dice based on a notation expression.
 *
 * Supported syntax examples:
 * - `d20 + 5`
 * - `2d6 + 1d8 - 3`
 * - `4d6kh3` (keep highest 3)
 * - `4d6kl2` (keep lowest 2)
 * - `4d6dh1` (drop highest 1)
 * - `4d6dl1` (drop lowest 1)
 * - Parentheses for grouping: `(2d6+3) * 2`
 */
export function rollDice(notation: string, rng: Rng = DEFAULT_RNG): RollResult {
  const parser = new DiceParser(notation, rng);
  const result = parser.parseExpression();
  parser.skipWhitespace();
  if (!parser.isAtEnd()) {
    throw new Error(`Unexpected token at position ${parser.getIndex() + 1}`);
  }

  return {
    total: result.value,
    terms: result.terms,
    notation: parser.getNormalizedNotation(),
  };
}

class DiceParser {
  private index = 0;

  constructor(private readonly source: string, private readonly rng: Rng) {}

  parseExpression(): EvalResult {
    let left = this.parseTerm();

    for (;;) {
      this.skipWhitespace();
      const operator = this.peek();
      if (operator !== "+" && operator !== "-") {
        break;
      }
      this.index += 1;
      const right = this.parseTerm();
      left = {
        value: operator === "+" ? left.value + right.value : left.value - right.value,
        terms: [...left.terms, { type: "operator", operator }, ...right.terms],
      };
    }

    return left;
  }

  parseTerm(): EvalResult {
    let left = this.parseFactor();

    for (;;) {
      this.skipWhitespace();
      const operator = this.peek();
      if (operator !== "*" && operator !== "/") {
        break;
      }
      this.index += 1;
      const right = this.parseFactor();
      const value =
        operator === "*"
          ? left.value * right.value
          : this.divideWithCheck(left.value, right.value);
      left = {
        value,
        terms: [...left.terms, { type: "operator", operator }, ...right.terms],
      };
    }

    return left;
  }

  parseFactor(): EvalResult {
    this.skipWhitespace();
    const sign = this.parseUnarySign();
    this.skipWhitespace();
    let result: EvalResult;

    const char = this.peek();
    if (char === "(") {
      this.index += 1;
      const inner = this.parseExpression();
      this.skipWhitespace();
      if (this.peek() !== ")") {
        throw new Error(`Expected closing parenthesis at position ${this.index + 1}`);
      }
      this.index += 1;
      result = inner;
    } else if (char && /[0-9]/.test(char)) {
      if (this.looksLikeDice()) {
        result = this.parseDiceTerm();
      } else {
        result = this.parseNumber();
      }
    } else if (char?.toLowerCase() === "d") {
      result = this.parseDiceTerm();
    } else {
      throw new Error(`Unexpected token at position ${this.index + 1}`);
    }

    if (sign === -1) {
      result = {
        value: -result.value,
        terms: [{ type: "number", value: -1 }, { type: "operator", operator: "*" }, ...result.terms],
      };
    }

    return result;
  }

  parseUnarySign(): 1 | -1 {
    const char = this.peek();
    if (char === "+" || char === "-") {
      this.index += 1;
      const sign = char === "+" ? 1 : -1;
      return sign;
    }
    return 1;
  }

  parseNumber(): EvalResult {
    const start = this.index;
    while (/[0-9]/.test(this.peek() ?? "")) {
      this.index += 1;
    }
    const slice = this.source.slice(start, this.index);
    const value = Number.parseInt(slice, 10);
    if (Number.isNaN(value)) {
      throw new Error(`Invalid number at position ${start + 1}`);
    }
    return { value, terms: [{ type: "number", value }] };
  }

  parseDiceTerm(): EvalResult {
    const start = this.index;
    const count = this.parseOptionalInteger();

    const diePrefix = this.peek();
    if (!diePrefix || diePrefix.toLowerCase() !== "d") {
      throw new Error(`Expected 'd' at position ${this.index + 1}`);
    }
    this.index += 1;
    const facesChar = this.peek();
    if (!facesChar) {
      throw new Error(`Expected die faces after 'd' at position ${this.index + 1}`);
    }

    let sides: number | "F";
    if (facesChar === "%") {
      this.index += 1;
      sides = 100;
    } else if (facesChar.toLowerCase() === "f") {
      this.index += 1;
      sides = "F";
    } else {
      const faces = this.parseInteger();
      if (faces <= 0) {
        throw new Error(`Die must have at least one face at position ${this.index + 1}`);
      }
      sides = faces;
    }

    const modifier = this.parseModifier();
    const notation = this.source.slice(start, this.index);

    const rollCount = count ?? 1;
    if (rollCount <= 0) {
      throw new Error("Dice count must be greater than zero");
    }

    const rolls = Array.from({ length: rollCount }, () => this.rollSingleDie(sides));
    const { kept, dropped } = this.applyModifier(rolls, modifier);
    const total = kept.reduce((acc, value) => acc + value, 0);

    const term: DiceRollTerm = {
      type: "dice",
      notation,
      sides,
      count: rollCount,
      rolls,
      kept,
      dropped,
      modifier: modifier ?? undefined,
      total,
    };

    return { value: total, terms: [term] };
  }

  parseOptionalInteger(): number | undefined {
    const start = this.index;
    while (/[0-9]/.test(this.peek() ?? "")) {
      this.index += 1;
    }
    if (start === this.index) {
      return undefined;
    }
    const slice = this.source.slice(start, this.index);
    return Number.parseInt(slice, 10);
  }

  parseInteger(): number {
    const value = this.parseOptionalInteger();
    if (value === undefined) {
      throw new Error(`Expected number at position ${this.index + 1}`);
    }
    return value;
  }

  parseModifier(): DiceRollModifier | undefined {
    const lookahead = this.source.slice(this.index, this.index + 2).toLowerCase();
    if (!lookahead.startsWith("k") && !lookahead.startsWith("d")) {
      return undefined;
    }

    const firstChar = lookahead[0];
    const secondChar = lookahead[1];
    if (secondChar !== "h" && secondChar !== "l") {
      return undefined;
    }
    this.index += 2;
    const count = this.parseInteger();

    if (count <= 0) {
      throw new Error("Modifier count must be greater than zero");
    }

    if (firstChar === "k" && secondChar === "h") {
      return { type: "keep-high", count };
    }
    if (firstChar === "k" && secondChar === "l") {
      return { type: "keep-low", count };
    }
    if (firstChar === "d" && secondChar === "h") {
      return { type: "drop-high", count };
    }
    return { type: "drop-low", count };
  }

  applyModifier(rolls: number[], modifier?: DiceRollModifier) {
    if (!modifier) {
      return { kept: rolls.slice(), dropped: [] as number[] };
    }

    const pairs = rolls.map((value, index) => ({ value, index }));
    const sorted = pairs.slice();
    if (modifier.type === "keep-high" || modifier.type === "drop-high") {
      sorted.sort((a, b) => b.value - a.value || a.index - b.index);
    } else {
      sorted.sort((a, b) => a.value - b.value || a.index - b.index);
    }

    const count = Math.min(modifier.count, rolls.length);
    const selected = new Set<number>();

    if (modifier.type === "keep-high" || modifier.type === "keep-low") {
      for (let i = 0; i < count; i += 1) {
        selected.add(sorted[i]!.index);
      }
      const kept = rolls.filter((_, index) => selected.has(index));
      const dropped = rolls.filter((_, index) => !selected.has(index));
      return { kept, dropped };
    }

    for (let i = 0; i < count; i += 1) {
      selected.add(sorted[i]!.index);
    }
    const dropped = rolls.filter((_, index) => selected.has(index));
    const kept = rolls.filter((_, index) => !selected.has(index));
    return { kept, dropped };
  }

  rollSingleDie(sides: number | "F"): number {
    const randomValue = this.rng();
    if (randomValue < 0 || randomValue >= 1) {
      throw new Error("Random number generator must return values in [0, 1)");
    }
    if (sides === "F") {
      const value = Math.floor(randomValue * 3) - 1;
      return value;
    }
    return Math.floor(randomValue * sides) + 1;
  }

  divideWithCheck(left: number, right: number): number {
    if (right === 0) {
      throw new Error("Division by zero is not allowed in roll expressions");
    }
    return left / right;
  }

  skipWhitespace() {
    while (this.peek() === " " || this.peek() === "\n" || this.peek() === "\t") {
      this.index += 1;
    }
  }

  peek(): string | undefined {
    return this.source[this.index];
  }

  isAtEnd(): boolean {
    return this.index >= this.source.length;
  }

  getIndex(): number {
    return this.index;
  }

  getNormalizedNotation(): string {
    return this.source.replace(/\s+/g, " ").trim();
  }

  private looksLikeDice(): boolean {
    const remainder = this.source.slice(this.index);
    return /^\d*d/i.test(remainder);
  }
}
