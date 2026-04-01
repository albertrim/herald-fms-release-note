"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/lib/utils";
import type { RecipientSuggestion } from "@/types";

interface RecipientInputProps {
  recipients: string[];
  onChange: (recipients: string[]) => void;
}

export function RecipientInput({ recipients, onChange }: RecipientInputProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<RecipientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(
        `/api/recipients/autocomplete?q=${encodeURIComponent(query)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(
          data.recipients.filter(
            (s: RecipientSuggestion) => !recipients.includes(s.email)
          )
        );
        setShowSuggestions(true);
      }
    }, 300);
  }, [query, recipients]);

  function addRecipient(email: string) {
    if (!recipients.includes(email) && isValidEmail(email)) {
      onChange([...recipients, email]);
    }
    setQuery("");
    setShowSuggestions(false);
  }

  function removeRecipient(email: string) {
    onChange(recipients.filter((r) => r !== email));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      addRecipient(query.trim());
    }
  }

  return (
    <div className="relative space-y-2">
      <div className="flex flex-wrap gap-1">
        {recipients.map((email) => (
          <Badge key={email} variant="secondary" className="gap-1">
            {email}
            <button
              type="button"
              onClick={() => removeRecipient(email)}
              className="ml-1 text-xs hover:text-red-500"
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <Input
        placeholder="수신자 이메일 입력 후 Enter"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full z-10 mt-1 w-full rounded-md border bg-white shadow-md">
          {suggestions.map((s) => (
            <button
              key={s.email}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
              onMouseDown={() => addRecipient(s.email)}
            >
              <span>{s.email}</span>
              <span className="text-muted-foreground text-xs">
                {s.usedCount}회 사용
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
