"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Mail, Users, Send, X, Loader2 } from "lucide-react";
import { EmailPreview } from "@/components/email/email-preview";
import { isValidEmail } from "@/lib/utils";
import type { SendHistoryDetail, SendEmailRequest, RecipientSuggestion } from "@/types";

export default function HistoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [detail, setDetail] = useState<SendHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // 재발송용 수신자 편집
  const [editRecipients, setEditRecipients] = useState<string[]>([]);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [suggestions, setSuggestions] = useState<RecipientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sending, setSending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    fetch(`/api/history/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          router.push("/dashboard");
          return;
        }
        const parsed = {
          ...d,
          contentSnapshot: d.contentSnapshot as SendEmailRequest["items"],
        };
        setDetail(parsed);
        setEditRecipients(parsed.recipients);
      })
      .finally(() => setLoading(false));
  }, [params.id, router]);

  // 수신자 자동완성
  useEffect(() => {
    if (recipientQuery.length < 1) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/recipients/autocomplete?q=${encodeURIComponent(recipientQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.recipients.filter((s: RecipientSuggestion) => !editRecipients.includes(s.email)));
        setShowSuggestions(true);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [recipientQuery, editRecipients]);

  function addRecipients(input: string) {
    const emails = input.split(/[,;]\s*/).map((e) => e.trim()).filter((e) => e.length > 0);
    const next = [...editRecipients];
    for (const email of emails) {
      if (isValidEmail(email) && !next.includes(email)) next.push(email);
    }
    setEditRecipients(next);
    setRecipientQuery("");
    setShowSuggestions(false);
  }

  function removeRecipient(email: string) {
    setEditRecipients(editRecipients.filter((r) => r !== email));
  }

  async function handleResend() {
    if (!detail) return;

    // 입력 필드에 남은 텍스트 flush
    let finalRecipients = [...editRecipients];
    if (recipientQuery.trim()) {
      const emails = recipientQuery.split(/[,;]\s*/).map((e) => e.trim()).filter((e) => e.length > 0 && isValidEmail(e) && !finalRecipients.includes(e));
      finalRecipients = [...finalRecipients, ...emails];
      setEditRecipients(finalRecipients);
      setRecipientQuery("");
    }

    if (finalRecipients.length === 0) {
      toast.error("수신자를 1명 이상 추가해주세요.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: detail.title,
          senderName: detail.senderName,
          recipients: finalRecipients,
          items: detail.contentSnapshot,
          sourceUrls: detail.sourceUrls,
        }),
      });
      const data = await res.json();
      if (data.status === "SUCCESS") {
        toast.success("이메일이 성공적으로 재발송되었습니다.");
        router.push("/dashboard");
      } else {
        toast.error(data.message || "재발송에 실패했습니다.");
      }
    } catch {
      toast.error("서버와 연결할 수 없습니다.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (!detail) return null;

  const isSuccess = detail.status === "SUCCESS";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {/* Top bar: back + actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="group flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          대시보드로 돌아가기
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={sending || editRecipients.length === 0}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:from-blue-700 hover:to-purple-700 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? "발송 중..." : "재발송"}
        </button>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">
        발송 이력 상세
      </h1>

      {/* Info card */}
      <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-sm">
        <h2 className="mb-6 text-xl font-bold text-gray-900">
          {detail.title}
        </h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">발송일시</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-800">
                {new Date(detail.sentAt).toLocaleString("ko-KR")}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50">
              <Mail className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">발신자</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-800">
                {detail.senderName}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">수신자</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-800">
                {editRecipients.length}명
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isSuccess ? "bg-green-50" : "bg-red-50"}`}>
              <div className={`h-3 w-3 rounded-full ${isSuccess ? "bg-green-500" : "bg-red-500"}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">상태</p>
              <span className={`mt-0.5 inline-flex items-center rounded-xl px-3 py-1 text-xs font-semibold ${
                isSuccess
                  ? "bg-gradient-to-r from-green-100 to-emerald-100 text-green-700"
                  : "bg-gradient-to-r from-red-100 to-rose-100 text-red-700"
              }`}>
                {isSuccess ? "발송 성공" : "발송 실패"}
              </span>
            </div>
          </div>
        </div>

        {/* Editable recipients */}
        <div className="mt-6 border-t border-gray-100 pt-6">
          <p className="mb-3 text-sm font-semibold text-gray-700">수신자 목록 (편집 가능)</p>
          <div className="flex flex-wrap gap-2">
            {editRecipients.map((email) => (
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
          <div className="relative mt-3">
            <input
              type="text"
              value={recipientQuery}
              onChange={(e) => { setRecipientQuery(e.target.value); setShowSuggestions(e.target.value.length > 0); }}
              onKeyDown={(e) => { if (e.key === "Enter" && recipientQuery.trim()) { e.preventDefault(); addRecipients(recipientQuery.trim()); } }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="수신자 추가 (이메일 입력 후 Enter, 콤마로 구분)"
              className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
          <p className="mt-1.5 text-xs text-gray-400">수신자를 추가/삭제한 후 상단의 "재발송" 버튼을 누르세요.</p>
        </div>
      </div>

      {/* Content preview */}
      <EmailPreview
        title={detail.title}
        senderName={detail.senderName}
        recipients={editRecipients}
        items={detail.contentSnapshot}
      />
    </div>
  );
}
