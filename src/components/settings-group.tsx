import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function SettingsGroup({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="settings-group" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <ChevronDown className="settings-group-chevron" aria-hidden="true" />
      </summary>
      <div className="settings-group-body">{children}</div>
    </details>
  );
}
