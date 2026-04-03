"use client";

export type ToastLevel = "success" | "error" | "info" | "warning";

export type ToastPayload = {
  id: string;
  message: string;
  level: ToastLevel;
};

const TOAST_EVENT = "app-toast";

function emit(level: ToastLevel, message: string) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ToastPayload>(TOAST_EVENT, {
      detail: {
        id: crypto.randomUUID(),
        message,
        level,
      },
    }),
  );
}

export const toast = {
  success(message: string) {
    emit("success", message);
  },
  error(message: string) {
    emit("error", message);
  },
  info(message: string) {
    emit("info", message);
  },
  warning(message: string) {
    emit("warning", message);
  },
};

export { TOAST_EVENT };
