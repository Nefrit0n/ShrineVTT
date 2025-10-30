import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  IconCircleDot,
  IconHexagon,
  IconOctahedron,
  IconPentagon,
  IconX,
} from "@tabler/icons-react";

import type { AddChatMessage } from "@/features/chat/types";
import { rollDice, type RollTerm } from "@/shared/utils/dice";

import "./DiceRoller.css";

const DICE_OPTIONS = [
  { id: "d4", label: "к4", icon: IconPentagon, hint: "Кость к4" },
  { id: "d6", label: "к6", icon: IconHexagon, hint: "Кость к6" },
  { id: "d8", label: "к8", icon: IconOctahedron, hint: "Кость к8" },
  { id: "d10", label: "к10", icon: IconDecagon, hint: "Кость к10" },
  { id: "d12", label: "к12", icon: IconDodecagon, hint: "Кость к12" },
  { id: "d20", label: "к20", icon: IconCircleDot, hint: "Кость к20" },
  { id: "d100", label: "к100", icon: IconHexagon, hint: "Кость к100" },
] as const;

function IconDecagon(props: ComponentProps<typeof IconCircleDot>) {
  return <IconCircleDot {...props} />;
}

function IconDodecagon(props: ComponentProps<typeof IconHexagon>) {
  return <IconHexagon {...props} />;
}

type DiceSelection = Record<string, number>;

type DiceRollerProps = {
  onRollComplete: AddChatMessage;
};

type RollToast = {
  title: string;
  breakdown: string;
  detail: string;
  total: number;
};

export default function DiceRoller({ onRollComplete }: DiceRollerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selection, setSelection] = useState<DiceSelection>({});
  const [toast, setToast] = useState<RollToast | null>(null);
  const hideToastTimeout = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideToastTimeout.current !== null) {
        window.clearTimeout(hideToastTimeout.current);
      }
    };
  }, []);

  const totalDice = useMemo(
    () => Object.values(selection).reduce((sum, count) => sum + count, 0),
    [selection]
  );

  const incrementDie = (id: string) => {
    setSelection((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  const resetSelection = () => {
    setSelection({});
  };

  const handleRoll = () => {
    if (!totalDice) {
      return;
    }

    const notation = buildNotation(selection);
    const result = rollDice(notation);
    const breakdown = formatTerms(result.terms);
    const detailFragments = formatRollDetail(result.terms);
    const detail = detailFragments
      ? `${toRussianNotation(result.notation)} → ${detailFragments}`
      : toRussianNotation(result.notation);

    const timestamp = new Date();
    const messageId = `${timestamp.getTime()}-${Math.random().toString(16).slice(2)}`;

    onRollComplete({
      id: messageId,
      author: "Система",
      timestamp: timestamp.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      type: "roll",
      roll: {
        title: "Бросок",
        notation: toRussianNotation(result.notation),
        total: result.total,
        breakdown,
        detail,
      },
    });

    setToast({
      title: "Бросок",
      breakdown,
      detail,
      total: result.total,
    });

    if (hideToastTimeout.current !== null) {
      window.clearTimeout(hideToastTimeout.current);
    }

    hideToastTimeout.current = window.setTimeout(() => {
      setToast(null);
      hideToastTimeout.current = null;
    }, 6000);

    resetSelection();
    setIsOpen(false);
  };

  const selectionSummary = useMemo(() => {
    const parts = DICE_OPTIONS.filter((option) => (selection[option.id] ?? 0) > 0).map((option) => {
      const count = selection[option.id] ?? 0;
      return `${count}${option.label}`;
    });

    return parts.join(" + ");
  }, [selection]);

  return (
    <div className="dice-roller" aria-live="polite">
      {toast && (
        <div className="dice-roller__toast" role="status">
          <header className="dice-roller__toast-header">{toast.title}</header>
          <div className="dice-roller__toast-body">
            <div className="dice-roller__toast-expression">{toast.breakdown}</div>
            <div className="dice-roller__toast-total">{toast.total}</div>
          </div>
          <footer className="dice-roller__toast-detail">{toast.detail}</footer>
        </div>
      )}

      <div className="dice-roller__dock">
        <button
          type="button"
          className="dice-roller__toggle"
          aria-label={isOpen ? "Закрыть меню бросков" : "Открыть меню бросков"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <IconCircleDot aria-hidden="true" stroke={1.8} />
        </button>

        <div className={isOpen ? "dice-roller__panel dice-roller__panel--open" : "dice-roller__panel"}>
          <header className="dice-roller__panel-header">
            <span className="dice-roller__panel-title">Броски</span>
            <button
              type="button"
              className="dice-roller__reset"
              onClick={resetSelection}
              disabled={!totalDice}
              aria-label="Очистить выбранные кости"
            >
              <IconX aria-hidden="true" stroke={1.6} />
            </button>
          </header>

          <div className="dice-roller__grid">
            {DICE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const count = selection[option.id] ?? 0;

              return (
                <button
                  key={option.id}
                  type="button"
                  className={
                    count > 0
                      ? "dice-roller__option dice-roller__option--active"
                      : "dice-roller__option"
                  }
                  title={option.hint}
                  onClick={() => incrementDie(option.id)}
                >
                  <span className="dice-roller__option-icon" aria-hidden="true">
                    <Icon stroke={1.5} />
                  </span>
                  <span className="dice-roller__option-label">{option.label}</span>
                  {count > 0 && <span className="dice-roller__counter">×{count}</span>}
                </button>
              );
            })}
          </div>

          <div className="dice-roller__summary" role="status">
            {selectionSummary ? selectionSummary : "Выберите кости"}
          </div>

          <button
            type="button"
            className="dice-roller__roll"
            onClick={handleRoll}
            disabled={!totalDice}
          >
            Бросить
          </button>
        </div>
      </div>
    </div>
  );
}

function buildNotation(selection: DiceSelection): string {
  return DICE_OPTIONS.filter((option) => (selection[option.id] ?? 0) > 0)
    .map((option) => `${selection[option.id] ?? 0}${option.id}`)
    .join(" + ");
}

function toRussianNotation(notation: string): string {
  return notation.replaceAll(/d/gi, "к");
}

function formatTerms(terms: RollTerm[]): string {
  return terms
    .map((term) => {
      switch (term.type) {
        case "dice":
          return `(${term.kept.join(" + ") || term.rolls.join(" + ")})`;
        case "number":
          return term.value.toString();
        case "operator":
        case "unary":
          return term.operator;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join(" ");
}

function formatRollDetail(terms: RollTerm[]): string {
  return terms
    .map((term) => {
      if (term.type !== "dice") return null;
      const kept = term.kept.map((value) => value.toString());
      const dropped = term.dropped.map((value) => value.toString());
      const fragments = [`${term.count}к${term.sides === "F" ? "F" : term.sides}`];
      if (kept.length) {
        fragments.push(`: ${kept.join(", ")}`);
      }
      if (dropped.length) {
        fragments.push(` (отброшено: ${dropped.join(", ")})`);
      }
      return fragments.join("");
    })
    .filter(Boolean)
    .join("; ");
}
