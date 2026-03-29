import { useEffect, useRef, useState } from "react";

interface LogPanelProps {
  title: string;
  lines: string[];
  emptyMessage: string;
}

export function LogPanel({ title, lines, emptyMessage }: LogPanelProps) {
  const logRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  useEffect(() => {
    const element = logRef.current;
    if (!element || !stickToBottom) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [lines, stickToBottom]);

  function handleScroll() {
    const element = logRef.current;
    if (!element) {
      return;
    }

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    setStickToBottom(distanceFromBottom < 24);
  }

  return (
    <section className="panel log-panel">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      <div
        ref={logRef}
        className="log-output"
        role="log"
        aria-live="polite"
        onScroll={handleScroll}
      >
        {lines.length === 0 ? (
          <p className="log-empty">{emptyMessage}</p>
        ) : (
          lines.map((line, index) => (
            <pre key={`${title}-${index}`} className="log-line">
              {line}
            </pre>
          ))
        )}
      </div>
    </section>
  );
}
