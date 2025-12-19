import type { ChangeEvent, ReactNode } from "react";

type Option = { value: string; label: string };

type SelectProps = {
  value?: string;
  placeholder?: string;
  options: Option[];
  onChange?: (value: string) => void;
  className?: string;
};

export function Select({
  value,
  placeholder = "Select an option",
  options,
  onChange,
  className = "select select-bordered",
}: SelectProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange?.(event.target.value);
  };

  return (
    <select value={value} onChange={handleChange} className={className}>
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export type SelectTriggerProps = SelectProps;
export const SelectTrigger = Select;
export const SelectValue = ({ children }: { children?: ReactNode }) => (
  <>{children}</>
);
export const SelectContent = ({ children }: { children?: ReactNode }) => (
  <>{children}</>
);
export const SelectItem = ({ children }: { children: ReactNode }) => <>{children}</>;
export const SelectGroup = ({ children }: { children: ReactNode }) => <>{children}</>;
export const SelectLabel = ({ children }: { children: ReactNode }) => <>{children}</>;
export const SelectScrollDownButton = ({ children }: { children: ReactNode }) => (
  <>{children}</>
);
export const SelectScrollUpButton = ({ children }: { children: ReactNode }) => (
  <>{children}</>
);
export const SelectSeparator = () => null;
