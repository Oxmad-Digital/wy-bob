"use client";

import { useEffect, useRef, useState } from "react";

export interface CountrySelectOption {
  code: string;
  label: string;
}

interface CountrySelectProps {
  value: string;
  onChange: (code: string) => void;
  options: CountrySelectOption[];
}

// Remplace le <select> natif : sur mobile, un <select> avec ~40 pays s'ouvre en
// plein écran (comportement OS non stylable). Ce menu maison reste ancré sous le
// champ avec une hauteur limitée et son propre scroll.
export default function CountrySelect({ value, onChange, options }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [open]);

  const selected = options.find((o) => o.code === value);

  return (
    <div className="checkout-select" ref={rootRef}>
      <button
        type="button"
        className="checkout-input checkout-select-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label ?? ""}</span>
        <svg className="checkout-select-arrow" width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1.5L6 6.5L11 1.5" stroke="#1B1843" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="checkout-select-menu" role="listbox">
          {options.map((opt) => (
            <li
              key={opt.code}
              role="option"
              aria-selected={opt.code === value}
              className={`checkout-select-option ${opt.code === value ? "active" : ""}`}
              onClick={() => {
                onChange(opt.code);
                setOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
