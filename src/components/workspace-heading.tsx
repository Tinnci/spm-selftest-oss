import type { ReactNode } from "react";

export function WorkspaceHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="workspace-heading">
      <div className="workspace-heading-text">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? (
        <div className="workspace-heading-actions">{actions}</div>
      ) : null}
    </header>
  );
}
