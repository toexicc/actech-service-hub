import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { searchDeviceCatalog, type DeviceValueKind } from "@/lib/deviceCatalog";
import { normalizeDeviceValue } from "@/lib/deviceNameCase";

interface Props {
  kind: DeviceValueKind;
  value: string;
  onChange: (value: string) => void;
  /** For models: the brand already chosen, so its models rank first. */
  brand?: string;
  placeholder?: string;
  id?: string;
  onBlur?: () => void;
  name?: string;
}

/**
 * A normal text box that suggests values already used on past tickets while
 * staff type. Anything can still be typed in freely — the list only helps.
 */
export const DeviceFieldSuggest = ({
  kind,
  value,
  onChange,
  brand,
  placeholder,
  id,
  onBlur,
  name,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const debounced = useDebounce(value ?? "", 250);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) return;
    let cancelled = false;
    (async () => {
      const rows = await searchDeviceCatalog(kind, debounced, brand);
      if (cancelled) return;
      const typed = (debounced ?? "").trim().toLowerCase();
      const filtered = rows.filter((r) => r.toLowerCase() !== typed);
      setOptions(filtered);
      setOpen(filtered.length > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, kind, brand, focused]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <Input
        id={id}
        name={name}
        autoComplete="off"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => {
          const tidy = normalizeDeviceValue(value ?? "", kind);
          if (tidy && tidy !== value) onChange(tidy);
          onBlur?.();
        }}
      />
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border/60 bg-popover shadow-lg">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeviceFieldSuggest;
