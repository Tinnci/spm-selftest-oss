import { Fragment } from "react";

export function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: Array<{ value: string; match: boolean }> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const idx = lower.indexOf(needle, cursor);
    if (idx === -1) {
      parts.push({ value: text.slice(cursor), match: false });
      break;
    }
    if (idx > cursor) {
      parts.push({ value: text.slice(cursor, idx), match: false });
    }
    parts.push({ value: text.slice(idx, idx + needle.length), match: true });
    cursor = idx + needle.length;
  }
  if (!parts.some((p) => p.match)) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark key={index} className="ui-highlight">
            {part.value}
          </mark>
        ) : (
          <Fragment key={index}>{part.value}</Fragment>
        ),
      )}
    </>
  );
}
