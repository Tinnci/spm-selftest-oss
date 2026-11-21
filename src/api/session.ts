import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function onCaptionMax(
  onState: (state: "hover" | "pressed" | "") => void,
) {
  return listen<string>("caption-max", ({ payload }) =>
    onState(
      payload === "down" ? "pressed" : payload === "leave" ? "" : "hover",
    ),
  );
}

export function watchWindow(
  onMaximized: (value: boolean) => void,
  onInactive: (value: boolean) => void,
) {
  const win = getCurrentWindow();
  let stop = false;
  let resized: (() => void) | undefined;
  let focused: (() => void) | undefined;
  const sync = () =>
    void win
      .isMaximized()
      .then(onMaximized)
      .catch(() => {});
  sync();
  void win.onResized(sync).then((fn) => {
    if (stop) fn();
    else resized = fn;
  });
  void win
    .onFocusChanged(({ payload }) => onInactive(!payload))
    .then((fn) => {
      if (stop) fn();
      else focused = fn;
    });
  return () => {
    stop = true;
    resized?.();
    focused?.();
  };
}

export function minimizeWindow() {
  return getCurrentWindow().minimize();
}

export function toggleMaximizeWindow() {
  return getCurrentWindow().toggleMaximize();
}

export function closeWindow() {
  return getCurrentWindow().close();
}
