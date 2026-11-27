import { useEffect, useRef } from "react";

export function useHorizontalScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const syncScrollState = () => {
      const canLeft = el.scrollLeft > 1;
      const canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      el.dataset.scrollLeft = canLeft ? "true" : "false";
      el.dataset.scrollRight = canRight ? "true" : "false";
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      if (
        event.deltaY === 0 ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX)
      ) {
        return;
      }
      if (el.scrollWidth <= el.clientWidth + 1) return;

      const delta =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * el.clientWidth
            : event.deltaY;

      const atStart = el.scrollLeft <= 0 && delta < 0;
      const atEnd =
        el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && delta > 0;
      if (atStart || atEnd) return;

      event.preventDefault();
      el.scrollLeft += delta;
      syncScrollState();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", syncScrollState, { passive: true });
    window.addEventListener("resize", syncScrollState);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncScrollState)
        : null;
    resizeObserver?.observe(el);

    const mutationObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(syncScrollState)
        : null;
    mutationObserver?.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    syncScrollState();

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", syncScrollState);
      window.removeEventListener("resize", syncScrollState);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, []);

  return ref;
}
