import * as React from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";

type ToastType = "info" | "success" | "warning" | "error";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastOptions = {
  type?: ToastType;
  description?: string;
  action?: ToastAction;
  timeout?: number;
  priority?: "low" | "high";
};

type ToastApi = {
  show: (title: string, options?: ToastOptions | ToastType) => void;
  success: (title: string, options?: Omit<ToastOptions, "type">) => void;
  warning: (title: string, options?: Omit<ToastOptions, "type">) => void;
  error: (title: string, options?: Omit<ToastOptions, "type">) => void;
  info: (title: string, options?: Omit<ToastOptions, "type">) => void;
};

const ToastApiContext = React.createContext<ToastApi>({
  show: () => {},
  success: () => {},
  warning: () => {},
  error: () => {},
  info: () => {},
});

export function useToast() {
  return React.useContext(ToastApiContext);
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();
  return (
    <>
      {toasts.map((toast) => (
        <ToastPrimitive.Root
          key={toast.id}
          toast={toast}
          className="ui-toast"
          data-tone={toast.type ?? "info"}
        >
          <ToastPrimitive.Content className="ui-toast-content">
            <div className="ui-toast-copy">
              <ToastPrimitive.Title className="ui-toast-title" />
              <ToastPrimitive.Description className="ui-toast-description" />
            </div>
            <ToastPrimitive.Action className="ui-toast-action" />
            <ToastPrimitive.Close
              className="ui-toast-close"
              aria-label="Dismiss"
            >
              ×
            </ToastPrimitive.Close>
          </ToastPrimitive.Content>
        </ToastPrimitive.Root>
      ))}
    </>
  );
}

function ToastBridge({ children }: { children: React.ReactNode }) {
  const manager = ToastPrimitive.useToastManager();
  const api = React.useMemo<ToastApi>(() => {
    const add = (title: string, options?: ToastOptions | ToastType) => {
      const opts: ToastOptions =
        typeof options === "string" ? { type: options } : (options ?? {});
      manager.add({
        title,
        description: opts.description,
        type: opts.type ?? "info",
        timeout: opts.timeout ?? 2200,
        priority: opts.priority,
        actionProps: opts.action
          ? {
              children: opts.action.label,
              onClick: opts.action.onClick,
            }
          : undefined,
      });
    };
    return {
      show: add,
      success: (title, options) => add(title, { ...options, type: "success" }),
      warning: (title, options) => add(title, { ...options, type: "warning" }),
      error: (title, options) => add(title, { ...options, type: "error" }),
      info: (title, options) => add(title, { ...options, type: "info" }),
    };
  }, [manager]);
  return (
    <ToastApiContext.Provider value={api}>{children}</ToastApiContext.Provider>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastPrimitive.Provider timeout={2200} limit={4}>
      <ToastBridge>{children}</ToastBridge>
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport className="ui-toast-viewport">
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  );
}
