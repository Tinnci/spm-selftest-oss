import type { ReactNode } from "react";

export function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={className ? `selftest-field ${className}` : "selftest-field"}
    >
      <span className="selftest-field-label">{label}</span>
      {children}
    </label>
  );
}
