import type { GatewayClient } from "@/lib/gatewayClient";
import { ListItem } from "@work4you/ui/ui/components/list-item";
import { ChevronRight } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

/** Mirrors ``SlashPopover`` for gateway ``complete.path`` (@ file refs). */
export interface PathCompletionItem {
  display: string;
  text: string;
  meta?: string;
}

export interface PathPopoverHandle {
  handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>): boolean;
}

interface Props {
  input: string;
  gw: GatewayClient | null;
  sessionId: string | null;
  onApply(nextInput: string): void;
}

interface CompletionResponse {
  items?: PathCompletionItem[];
  replace_from?: number;
}

const DEBOUNCE_MS = 60;

function atTriggerIndex(text: string): number {
  const line = text.split("\n").pop() ?? "";
  return line.lastIndexOf("@");
}

export const PathPopover = forwardRef<PathPopoverHandle, Props>(
  function PathPopover({ input, gw, sessionId, onApply }, ref) {
    const [items, setItems] = useState<PathCompletionItem[]>([]);
    const [selected, setSelected] = useState(0);
    const [replaceFrom, setReplaceFrom] = useState(0);
    const lastInputRef = useRef<string>("");

    const atIndex = atTriggerIndex(input ?? "");
    const inAtContext = atIndex >= 0;

    useEffect(() => {
      const trimmed = input ?? "";
      if (
        !gw ||
        !sessionId ||
        !inAtContext ||
        trimmed === lastInputRef.current
      ) {
        if (!inAtContext) lastInputRef.current = "";
        return;
      }
      lastInputRef.current = trimmed;

      const timer = window.setTimeout(async () => {
        if (lastInputRef.current !== trimmed) return;
        try {
          const r = await gw.request<CompletionResponse>("complete.path", {
            text: trimmed,
            session_id: sessionId,
          });
          if (lastInputRef.current !== trimmed) return;
          setItems(r?.items ?? []);
          setReplaceFrom(r?.replace_from ?? atIndex);
          setSelected(0);
        } catch {
          if (lastInputRef.current === trimmed) setItems([]);
        }
      }, DEBOUNCE_MS);

      return () => window.clearTimeout(timer);
    }, [atIndex, gw, inAtContext, input, sessionId]);

    const apply = useCallback(
      (item: PathCompletionItem) => {
        onApply(input.slice(0, replaceFrom) + item.text);
      },
      [input, onApply, replaceFrom],
    );

    const visible = items.length > 0 && inAtContext;

    useImperativeHandle(
      ref,
      () => ({
        handleKey: (e) => {
          if (!visible) return false;
          switch (e.key) {
            case "ArrowDown":
              e.preventDefault();
              setSelected((s) => (s + 1) % items.length);
              return true;
            case "ArrowUp":
              e.preventDefault();
              setSelected((s) => (s - 1 + items.length) % items.length);
              return true;
            case "Tab": {
              e.preventDefault();
              const item = items[selected];
              if (item) apply(item);
              return true;
            }
            case "Escape":
              e.preventDefault();
              setItems([]);
              return true;
            default:
              return false;
          }
        },
      }),
      [apply, items, selected, visible],
    );

    if (!visible) return null;

    return (
      <div
        className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-xl text-sm"
        role="listbox"
      >
        {items.map((it, i) => {
          const active = i === selected;
          return (
            <ListItem
              key={`${it.text}-${i}`}
              active={active}
              role="option"
              aria-selected={active}
              onMouseEnter={() => setSelected(i)}
              onClick={() => apply(it)}
              className="px-3 py-1.5"
            >
              <ChevronRight
                className={`h-3 w-3 shrink-0 ${active ? "text-primary" : "text-transparent"}`}
              />
              <span className="font-mono text-xs shrink-0 truncate">
                {it.display}
              </span>
              {it.meta && (
                <span className="text-xs text-text-tertiary truncate ml-auto">
                  {it.meta}
                </span>
              )}
            </ListItem>
          );
        })}
      </div>
    );
  },
);
