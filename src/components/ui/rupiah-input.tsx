import { useRef, type ChangeEvent, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { formatRupiahInput } from "@/lib/rupiahInput";

type RupiahInputProps = Omit<
  ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function RupiahInput({ value, onValueChange, ...props }: RupiahInputProps) {
  const pendingCaret = useRef<number | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const beforeCaret = input.value.slice(0, input.selectionStart ?? input.value.length);
    const meaningfulBeforeCaret = beforeCaret.replace(/[^\d,]/g, "").length;
    const formatted = formatRupiahInput(input.value);
    onValueChange(formatted);

    // Grouping inserts dots while typing; keep the cursor near the same digit.
    pendingCaret.current = meaningfulBeforeCaret;
    requestAnimationFrame(() => {
      if (pendingCaret.current === null || document.activeElement !== input) return;
      const count = pendingCaret.current;
      const next = input.value;
      let position = 0;
      let seen = 0;
      while (position < next.length && seen < count) {
        if (/[\d,]/.test(next[position])) seen += 1;
        position += 1;
      }
      input.setSelectionRange(position, position);
      pendingCaret.current = null;
    });
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={handleChange}
    />
  );
}
