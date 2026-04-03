"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

import { TOAST_EVENT, type ToastLevel, type ToastPayload } from "@/lib/toast";

type ToastItem = ToastPayload & {
  timeoutId: ReturnType<typeof setTimeout>;
};

const levelStyles: Record<ToastLevel, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

const levelIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function removeToast(id: string) {
      setItems((current) => {
        const found = current.find((item) => item.id === id);
        if (found) clearTimeout(found.timeoutId);
        return current.filter((item) => item.id !== id);
      });
    }

    function handleToast(event: Event) {
      const customEvent = event as CustomEvent<ToastPayload>;
      const payload = customEvent.detail;
      const timeoutId = setTimeout(() => removeToast(payload.id), 4000);

      setItems((current) => [...current, { ...payload, timeoutId }]);
    }

    window.addEventListener(TOAST_EVENT, handleToast as EventListener);
    return () => {
      window.removeEventListener(TOAST_EVENT, handleToast as EventListener);
      setItems((current) => {
        current.forEach((item) => clearTimeout(item.timeoutId));
        return [];
      });
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex max-w-sm flex-col gap-3">
      {items.map((item) => {
        const Icon = levelIcons[item.level];

        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg ${levelStyles[item.level]}`}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm font-medium">{item.message}</p>
            <button
              type="button"
              onClick={() => {
                clearTimeout(item.timeoutId);
                setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
              }}
              className="rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
