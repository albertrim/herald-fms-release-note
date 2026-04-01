export const CATEGORY_NAMES = ["신규 기능", "기능 개선", "UI/UX 변경", "버그 수정"] as const;

export const EMAIL_GREETING = "안녕하세요, 파피 여러분 ❤️";
export const EMAIL_GREETING_SUB = "오늘 운영 배포된 FMS의 업데이트 내용을 안내드립니다.";

export type CategoryName = (typeof CATEGORY_NAMES)[number];

interface CategoryStyle {
  dot: string;
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
  hoverBg: string;
  hoverBorder: string;
  titleHover: string;
}

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  "신규 기능": { dot: "bg-purple-500", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", badgeBg: "from-purple-500 to-purple-600", hoverBg: "hover:bg-purple-50/50", hoverBorder: "hover:border-purple-200", titleHover: "group-hover:text-purple-700" },
  "기능 개선": { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", badgeBg: "from-blue-500 to-blue-600", hoverBg: "hover:bg-blue-50/50", hoverBorder: "hover:border-blue-200", titleHover: "group-hover:text-blue-700" },
  "UI/UX 변경": { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", badgeBg: "from-emerald-500 to-emerald-600", hoverBg: "hover:bg-emerald-50/50", hoverBorder: "hover:border-emerald-200", titleHover: "group-hover:text-emerald-700" },
  "버그 수정": { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", badgeBg: "from-red-500 to-red-600", hoverBg: "hover:bg-red-50/50", hoverBorder: "hover:border-red-200", titleHover: "group-hover:text-red-700" },
};

export const DEFAULT_CATEGORY_STYLE: CategoryStyle = {
  dot: "bg-gray-400", bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", badgeBg: "from-gray-500 to-gray-600", hoverBg: "hover:bg-gray-50/50", hoverBorder: "hover:border-gray-200", titleHover: "group-hover:text-gray-700",
};

export function getCategoryStyle(name: string | null): CategoryStyle {
  if (!name) return DEFAULT_CATEGORY_STYLE;
  return CATEGORY_STYLES[name] || DEFAULT_CATEGORY_STYLE;
}
