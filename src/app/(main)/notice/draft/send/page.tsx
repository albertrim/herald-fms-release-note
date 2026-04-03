"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, X, Loader2, CheckCircle } from "lucide-react";
import { toast } from "@/lib/toast";
import { isValidEmail, renderBoldMarkdown, formatKoreanDate } from "@/lib/utils";
import { getCategoryStyle, EMAIL_GREETING, EMAIL_GREETING_SUB } from "@/lib/category-styles";
import type {
  DraftNotice,
  CategoryItem,
  SendEmailRequest,
  RecipientSuggestion,
} from "@/types";

export default function SendPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftNotice | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const defaultTitle = `[공지] ${formatKoreanDate()}, FMS 업데이트 안내`;
  const [title, setTitle] = useState(defaultTitle);
  const senderName = "IT개발본부";
  const [recipients, setRecipients] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendSlackNotice, setSendSlackNotice] = useState(true);

  const [recipientQuery, setRecipientQuery] = useState("");
  const [suggestions, setSuggestions] = useState<RecipientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const stored = sessionStorage.getItem("draftNotice");
    if (!stored) { router.push("/notice/new"); return; }
    setDraft(JSON.parse(stored));
  }, [router]);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories || []));
    fetch("/api/history").then((r) => r.json()).then((d) => {
      if (d.lastRecipients?.length > 0) setRecipients(d.lastRecipients);
    });
  }, []);

  useEffect(() => {
    if (recipientQuery.length < 1) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/recipients/autocomplete?q=${encodeURIComponent(recipientQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.recipients.filter((s: RecipientSuggestion) => !recipients.includes(s.email)));
        setShowSuggestions(true);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [recipientQuery, recipients]);

  function getCategoryName(categoryId: string | null) {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId)?.name || null;
  }

  function addRecipients(input: string) {
    const emails = input.split(/[,;]\s*/).map((e) => e.trim()).filter((e) => e.length > 0);
    const newRecipients = [...recipients];
    for (const email of emails) {
      if (isValidEmail(email) && !newRecipients.includes(email)) newRecipients.push(email);
    }
    setRecipients(newRecipients);
    setRecipientQuery("");
    setShowSuggestions(false);
  }

  function removeRecipient(email: string) {
    setRecipients(recipients.filter((r) => r !== email));
  }

  function handleRecipientKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && recipientQuery.trim()) {
      e.preventDefault();
      addRecipients(recipientQuery.trim());
    }
  }

  function flushRecipientInput(): string[] {
    const current = [...recipients];
    if (recipientQuery.trim()) {
      const emails = recipientQuery.split(/[,;]\s*/).map((e) => e.trim()).filter((e) => e.length > 0 && isValidEmail(e) && !current.includes(e));
      current.push(...emails);
      setRecipients(current);
      setRecipientQuery("");
    }
    return current;
  }

  async function handleSend() {
    if (!draft) return;
    if (!title.trim()) { toast.error("이메일 제목을 입력해주세요."); return; }
    const finalRecipients = flushRecipientInput();
    if (finalRecipients.length === 0) { toast.error("수신자를 1명 이상 추가해주세요."); return; }

    setLoading(true);
    const body: SendEmailRequest = {
      title, senderName, recipients: finalRecipients,
      items: draft.items.map((item) => ({ title: item.title, description: item.description, categoryName: getCategoryName(item.categoryId), screenshots: item.screenshots, slackLink: item.slackLink, slackAuthor: item.slackAuthor })),
      sourceUrls: draft.sourceUrls,
      skipSlack: !sendSlackNotice,
    };
    try {
      const res = await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.status === "SUCCESS") { toast.success("이메일이 성공적으로 발송되었습니다."); sessionStorage.removeItem("draftNotice"); router.push("/dashboard"); }
      else { toast.error(data.message || "이메일 발송에 실패했습니다."); }
    } catch { toast.error("서버와 연결할 수 없습니다."); }
    finally { setLoading(false); }
  }

  const grouped = useMemo(() => {
    if (!draft) return new Map<string, { title: string; description: string; categoryName: string | null; screenshots: string[]; slackLink: string | null; slackAuthor: string | null }[]>();
    const map = new Map<string, { title: string; description: string; categoryName: string | null; screenshots: string[]; slackLink: string | null; slackAuthor: string | null }[]>();
    for (const item of draft.items) {
      const catName = getCategoryName(item.categoryId);
      const key = catName || "기타";
      const list = map.get(key) || [];
      list.push({
        title: item.title,
        description: item.description,
        categoryName: catName,
        screenshots: item.screenshots,
        slackLink: item.slackLink,
        slackAuthor: item.slackAuthor,
      });
      map.set(key, list);
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, categories]);

  if (!draft) return null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push("/notice/draft/edit")}
        className="mb-4 text-sm text-gray-600 transition-colors hover:text-gray-900"
      >
        ← 초안 편집으로 돌아가기
      </button>

      {/* Title area */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-600/20">
          <Send className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-gray-900">이메일 발송 준비</h2>
          <p className="mt-1 text-gray-600">최종 내용을 확인하고 발송하세요</p>
        </div>
      </div>

      {/* Grid: Settings + Preview */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Left column: Settings */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-sm">
            <div className="mb-6 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-900">발송 설정</h3>
            </div>

            <div className="space-y-5">
              {/* Email subject */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">이메일 제목</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Recipients */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">수신자 이메일</label>
                <div className="relative">
                  <input
                    type="text"
                    value={recipientQuery}
                    onChange={(e) => { setRecipientQuery(e.target.value); setShowSuggestions(e.target.value.length > 0); }}
                    onKeyDown={handleRecipientKeyDown}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="이메일 입력 후 Enter (여러 명: 콤마로 구분)"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
                      {suggestions.map((s) => (
                        <button
                          key={s.email}
                          type="button"
                          className="w-full px-4 py-3 text-left text-sm text-gray-700 transition-all hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50"
                          onMouseDown={() => addRecipients(s.email)}
                        >
                          {s.email}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {recipients.map((email) => (
                    <div
                      key={email}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/25"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeRecipient(email)}
                        className="rounded-full p-0.5 transition-all hover:bg-white/20"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  여러 명에게 보내려면 콤마(,)로 구분하세요.
                </p>
              </div>
            </div>
          </div>

          {/* Slack notice option */}
          <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-purple-600" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.52 2.521h-2.522V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.52v-2.522h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.52 2.522h-6.313z"/></svg>
              <h3 className="text-xl font-semibold text-gray-900">Slack 연동</h3>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3.5 transition-colors hover:bg-gray-100/80">
              <input
                type="checkbox"
                checked={sendSlackNotice}
                onChange={(e) => setSendSlackNotice(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Slack 스레드에 배포 알림 댓글 발송</span>
                <p className="mt-0.5 text-xs text-gray-400">각 JIRA 티켓의 Slack 글에 배포 완료 댓글을 남깁니다</p>
              </div>
            </label>
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || recipients.length === 0}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 py-4 text-lg font-semibold text-white shadow-2xl shadow-blue-600/30 transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-blue-700/40 hover:scale-[1.02] active:scale-[0.98] disabled:from-gray-400 disabled:to-gray-500"
          >
            {loading ? (
              <><Loader2 className="h-6 w-6 animate-spin" />발송 중...</>
            ) : (
              <><Send className="h-6 w-6" />이메일 발송하기</>
            )}
          </button>
        </div>

        {/* Right column: Inline Preview (Figma 1:1) */}
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-xl backdrop-blur-sm">
            {/* Preview header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
              <h3 className="flex items-center gap-2 text-xl font-semibold text-white">
                <CheckCircle className="h-6 w-6" />
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
        </div>
      </div>
    </div>
  );
}
