import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  steps,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  steps?: ReactNode;
}) {
  return (
    <div className="selftest-empty">
      <div className="selftest-empty-icon">
        <Icon aria-hidden="true" />
      </div>
      <strong>{title}</strong>
      <p className="quiet">{description}</p>
      {action}
      {steps}
    </div>
  );
}
