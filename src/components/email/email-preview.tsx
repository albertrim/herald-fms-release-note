"use client";

import { renderBoldMarkdown } from "@/lib/utils";
import { getCategoryStyle, EMAIL_GREETING, EMAIL_GREETING_SUB } from "@/lib/category-styles";
import type { SendEmailRequest } from "@/types";

interface EmailPreviewProps {
  title: string;
  senderName: string;
  recipients: string[];
  items: SendEmailRequest["items"];
}

export function EmailPreview({
  title,
  senderName,
  recipients,
  items,
}: EmailPreviewProps) {
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.categoryName || "기타";
    const list = grouped.get(key) || [];
    list.push(item);
    grouped.set(key, list);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-xl backdrop-blur-sm">
      {/* Preview header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-white">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          이메일 미리보기
        </h3>
        <p className="mt-1 text-sm text-blue-100">수신자에게 전달될 최종 모습입니다</p>
      </div>

      <div className="p-8">
        {/* Email header */}
        <div className="mb-8 border-b-2 border-gray-100 pb-8">
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">제목</p>
            <h2 className="text-2xl font-bold leading-tight text-gray-900">{title || "제목 없음"}</h2>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">발신:</span>
              <span className="rounded-lg bg-blue-50 px-3 py-1 font-medium text-blue-700">{senderName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">수신:</span>
              <span className="text-gray-600">{recipients.length}명</span>
            </div>
          </div>
        </div>

        {/* Greeting */}
        <div className="mb-8">
          <p className="text-lg leading-relaxed text-gray-700">
            {EMAIL_GREETING}<br />{EMAIL_GREETING_SUB}
          </p>
        </div>

        {/* Category sections */}
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([category, categoryItems]) => {
            const style = getCategoryStyle(category);
            return categoryItems.map((item, i) => (
              <div key={`${category}-${i}`} className={`group rounded-2xl border-2 border-transparent p-6 transition-all duration-300 ${style.hoverBg} ${style.hoverBorder}`}>
                <div className="mb-4">
                  <span className={`inline-flex items-center rounded-full bg-gradient-to-r ${style.badgeBg} px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg`}>
                    {category}
                  </span>
                </div>
                <h3 className={`mb-3 text-xl font-bold text-gray-900 transition-colors ${style.titleHover}`}>
                  {item.title}
                </h3>
                <p
                  className="text-base leading-relaxed text-gray-700"
                  dangerouslySetInnerHTML={{ __html: renderBoldMarkdown(item.description) }}
                />
                {item.slackLink && (
                  <p className="mt-2 text-sm text-blue-600">
                    Slack{item.slackAuthor ? ` (${item.slackAuthor})` : ""} →
                  </p>
                )}
                {item.screenshots.length > 0 && (
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {item.screenshots.map((url, j) => (
                      <div key={j} className="aspect-square overflow-hidden rounded-lg border border-gray-200">
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ));
          })}
        </div>

        {/* Footer */}
        <div className="mt-10 border-t-2 border-gray-100 pt-8">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-purple-50 p-6">
            <p className="text-xs text-gray-600">
              본 메일은 발신 전용입니다. 더 궁금하신 사항은 정경환 담당께 슬랙 DM주세요.
            </p>
          </div>
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">© 2026 FASSTO. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
