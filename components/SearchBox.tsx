import { useEffect, useId, useRef, useState } from "react";
import { formatMoney } from "../lib/format";
import type { SearchResult } from "../types";
import { SearchIcon } from "./Icons";

interface SearchBoxProps {
  onSelect: (symbol: string) => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
}

export function SearchBox({ onSelect, onSearch }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      const trimmed = query.trim();
      if (!trimmed) {
        setResults([]);
        setBusy(false);
        setAnnouncement("");
        return;
      }
      setBusy(true);
      void onSearch(trimmed).then((next) => {
        if (cancelled) return;
        setResults(next);
        setBusy(false);
        setActiveIndex(0);
        setOpen(true);
        setAnnouncement(
          next.length === 0
            ? `No sample companies match ${trimmed}.`
            : `${next.length} sample ${next.length === 1 ? "company" : "companies"} match ${trimmed}.`,
        );
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [onSearch, query]);

  function choose(symbol: string) {
    onSelect(symbol);
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={boxRef} className="relative w-full" onBlur={(event) => {
      if (!boxRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <label htmlFor="symbol-search" className="sr-only">
        Search the sample companies
      </label>
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
        <SearchIcon />
      </div>
      <input
        ref={inputRef}
        id="symbol-search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && (results.length > 0 || query.trim().length > 0)}
        aria-controls={listId}
        aria-activedescendant={open && results[activeIndex] ? `${listId}-${results[activeIndex].symbol}` : undefined}
        type="text"
        value={query}
        placeholder="Try Apple, Visa, or NVDA"
        autoComplete="off"
        className="min-h-12 w-full rounded-full border border-line bg-card py-3 pr-4 pl-11 text-base text-ink placeholder:text-muted/80"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && open && results[activeIndex]) {
            event.preventDefault();
            choose(results[activeIndex].symbol);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <p className="sr-only" aria-live="polite">
        {busy ? "Searching the sample list." : announcement}
      </p>
      {open && query.trim() && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-3xl border border-line bg-card shadow-[0_18px_40px_-24px_rgba(70,40,20,0.45)]">
          {results.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Sample companies" className="max-h-80 overflow-auto py-2">
              {results.map((result, index) => (
                <li key={result.symbol} role="presentation">
                  <button
                    id={`${listId}-${result.symbol}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left ${
                      index === activeIndex ? "bg-clay-soft" : "hover:bg-paper"
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(result.symbol)}
                  >
                    <span>
                      <span className="block font-bold text-ink">{result.symbol}</span>
                      <span className="block text-sm text-muted">{result.name}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold tabular-nums text-ink">{formatMoney(result.price)}</span>
                      <span className="block text-xs text-muted">Sample start · {result.sector}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !busy && (
              <p className="px-4 py-4 text-sm leading-relaxed text-muted" role="status">
                Nothing in the sample list matches that. Try Apple, Nvidia, or a sector like Healthcare.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
