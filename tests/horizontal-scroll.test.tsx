import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useHorizontalScroll } from "../src/hooks/useHorizontalScroll";

function ScrollHarness() {
  const ref = useHorizontalScroll<HTMLDivElement>();
  return <div ref={ref} data-testid="strip" />;
}

function setScrollMetrics(
  el: HTMLElement,
  metrics: { scrollWidth: number; clientWidth: number; scrollLeft: number },
) {
  Object.defineProperty(el, "scrollWidth", {
    configurable: true,
    value: metrics.scrollWidth,
  });
  Object.defineProperty(el, "clientWidth", {
    configurable: true,
    value: metrics.clientWidth,
  });
  let currentScrollLeft = metrics.scrollLeft;
  Object.defineProperty(el, "scrollLeft", {
    configurable: true,
    get: () => currentScrollLeft,
    set: (value: number) => {
      currentScrollLeft = Math.max(
        0,
        Math.min(value, metrics.scrollWidth - metrics.clientWidth),
      );
    },
  });
}

describe("useHorizontalScroll", () => {
  afterEach(() => {
    cleanup();
  });

  it("converts vertical wheel deltas into horizontal scroll when overflowing", () => {
    render(<ScrollHarness />);
    const strip = screen.getByTestId("strip");
    setScrollMetrics(strip, {
      scrollWidth: 400,
      clientWidth: 200,
      scrollLeft: 0,
    });

    fireEvent(strip, new Event("scroll"));
    expect(strip.dataset.scrollLeft).toBe("false");
    expect(strip.dataset.scrollRight).toBe("true");

    const wheelDown = new WheelEvent("wheel", {
      deltaY: 60,
      cancelable: true,
    });
    const notCanceled = strip.dispatchEvent(wheelDown);
    expect(notCanceled).toBe(false);
    expect(strip.scrollLeft).toBe(60);
    expect(strip.dataset.scrollLeft).toBe("true");
    expect(strip.dataset.scrollRight).toBe("true");
  });

  it("does not intercept wheel events when content does not overflow", () => {
    render(<ScrollHarness />);
    const strip = screen.getByTestId("strip");
    setScrollMetrics(strip, {
      scrollWidth: 200,
      clientWidth: 200,
      scrollLeft: 0,
    });

    fireEvent(strip, new Event("scroll"));
    expect(strip.dataset.scrollLeft).toBe("false");
    expect(strip.dataset.scrollRight).toBe("false");

    const wheelDown = new WheelEvent("wheel", {
      deltaY: 40,
      cancelable: true,
    });
    const notCanceled = strip.dispatchEvent(wheelDown);
    expect(notCanceled).toBe(true);
    expect(strip.scrollLeft).toBe(0);
  });

  it("does not trap vertical wheel events at the start or end boundaries", () => {
    render(<ScrollHarness />);
    const strip = screen.getByTestId("strip");
    setScrollMetrics(strip, {
      scrollWidth: 400,
      clientWidth: 200,
      scrollLeft: 0,
    });

    const wheelAtStart = new WheelEvent("wheel", {
      deltaY: -40,
      cancelable: true,
    });
    expect(strip.dispatchEvent(wheelAtStart)).toBe(true);

    strip.scrollLeft = 200;
    fireEvent(strip, new Event("scroll"));
    expect(strip.dataset.scrollLeft).toBe("true");
    expect(strip.dataset.scrollRight).toBe("false");

    const wheelAtEnd = new WheelEvent("wheel", {
      deltaY: 40,
      cancelable: true,
    });
    expect(strip.dispatchEvent(wheelAtEnd)).toBe(true);
  });
});
