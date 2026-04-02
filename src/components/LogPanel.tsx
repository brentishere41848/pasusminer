import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

interface LogPanelProps {
  title: string;
  lines: string[];
  emptyMessage: string;
}

function classifyLine(line: string): string {
  const normalized = line.toLowerCase();
  if (normalized.includes("[backend:error]") || normalized.includes(" failed")) {
    return "error";
  }
  if (normalized.includes("[backend:warn]")) {
    return "warn";
  }
  if (normalized.includes("hashrate")) {
    return "metric";
  }
  if (normalized.includes("[backend:info]")) {
    return "info";
  }
  return "default";
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
      <div className="panel-header terminal-header">
        <div className="terminal-heading">
          <p className="section-kicker">Output Feed</p>
          <h3>{title}</h3>
        </div>
        <div className="terminal-meta">
          <span className={`terminal-pill ${stickToBottom ? "live" : ""}`}>
            {stickToBottom ? "Auto-follow" : "Manual scroll"}
          </span>
          <span className="terminal-pill">{lines.length} lines</span>
        </div>
      </div>

      <div className="terminal-shell">
        <div className="terminal-topbar">
          <div className="terminal-lights" aria-hidden="true">
            <span className="terminal-light red" />
            <span className="terminal-light amber" />
            <span className="terminal-light green" />
          </div>
          <div className="terminal-title">
            <Icon name="terminal" className="terminal-title-icon" />
            <span>{title.toLowerCase().replace(/\s+/g, "_")}.session</span>
          </div>
        </div>

        <div
          ref={logRef}
          className="log-output"
          role="log"
          aria-live="polite"
          onScroll={handleScroll}
        >
          <div className="terminal-overlay" aria-hidden="true" />
          {lines.length === 0 ? (
            <div className="log-empty-state">
              <Icon name="terminal" className="empty-terminal-icon" />
              <p className="log-empty">{emptyMessage}</p>
            </div>
          ) : (
            lines.map((line, index) => {
              const lineType = classifyLine(line);

              return (
                <div key={`${title}-${index}`} className={`terminal-row terminal-${lineType}`}>
                  <span className="terminal-index">{String(index + 1).padStart(3, "0")}</span>
                  <span className="terminal-prompt">&gt;</span>
                  <pre className="log-line">{line}</pre>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
