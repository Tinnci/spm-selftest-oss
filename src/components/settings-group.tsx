import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cancelHover = () => clearTimeout(hoverTimer.current);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  return (
    <details className="settings-group" ref={details}>
      <summary
        onPointerEnter={(event) => {
          const group = details.current;
          if (event.pointerType !== "mouse" || !group || group.open) return;
          hoverTimer.current = setTimeout(() => {
            group.open = true;
          }, 180);
        }}
        onPointerLeave={cancelHover}
        onClick={cancelHover}
      >
        <span>{title}</span>
        <ChevronDown className="settings-group-chevron" aria-hidden="true" />
      </summary>
      <div className="settings-group-body">{children}</div>
    </details>
  );
}
