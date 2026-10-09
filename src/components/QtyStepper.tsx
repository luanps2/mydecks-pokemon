/* Quantidade de cópias de uma carta no deck: − ×N + (de 1 a 999) */
export function QtyStepper({ value, onChange, label, compact = false }: {
  value: number;
  onChange: (n: number) => void;
  /** nome da carta, para os leitores de tela */
  label: string;
  compact?: boolean;
}) {
  return (
    <span className={"qty-step" + (compact ? " compact" : "")} role="group" aria-label={`Quantidade de ${label}`} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Uma cópia a menos" title="Uma cópia a menos" disabled={value <= 1} onClick={() => onChange(value - 1)}>−</button>
      <b aria-live="polite">×{value}</b>
      <button type="button" aria-label="Uma cópia a mais" title="Uma cópia a mais" disabled={value >= 999} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}
