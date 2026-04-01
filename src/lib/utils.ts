import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const JIRA_URL_PATTERN =
  /^https?:\/\/.+\/projects\/[A-Za-z][A-Za-z0-9_]+\/versions\/\d+/;

export function isValidJiraReleaseUrl(url: string): boolean {
  return JIRA_URL_PATTERN.test(url.trim());
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

/** **볼드** 마크다운을 <strong> 태그로 변환 (다른 HTML은 이스케이프) */
export function renderBoldMarkdown(text: string): string {
  const escaped = stripHtml(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
