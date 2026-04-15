"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { NoticeItem } from "@/types";

interface MergeDialogProps {
  open: boolean;
  items: NoticeItem[];
  onMerge: (mergedItem: { title: string; description: string }) => void;
  onClose: () => void;
}

export function MergeDialog({ open, items, onMerge, onClose }: MergeDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const prevOpenRef = useRef(false);

  const fetchAiMerge = useCallback(async () => {
    setAiLoading(true);
    setAiUsed(false);
    try {
      const res = await fetch("/api/notice/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ title: i.title, description: i.description })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTitle(data.title);
        setDescription(data.description);
        setAiUsed(true);
      } else {
        // AI 실패 시 단순 합치기
        setTitle(items[0]?.title || "");
        setDescription(items.map((i) => i.description).join("\n\n"));
      }
    } catch {
      setTitle(items[0]?.title || "");
      setDescription(items.map((i) => i.description).join("\n\n"));
    } finally {
      setAiLoading(false);
    }
  }, [items]);

  // 다이얼로그가 닫힘→열림으로 전환될 때만 AI 요약 자동 실행
  useEffect(() => {
    if (open && !prevOpenRef.current && items.length >= 2) {
      fetchAiMerge();
    }
    prevOpenRef.current = open;
  }, [open, items, fetchAiMerge]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900">항목 병합</h3>
          <p className="mt-1 text-sm text-gray-500">
            {items.length}개 항목을 하나의 공지 항목으로 병합합니다.
          </p>
        </div>

        {aiLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-gray-600">
              AI가 항목을 분석하여 통합 중입니다...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {aiUsed && (
              <div className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-700">
                <Sparkles className="h-4 w-4" />
                AI가 내용을 분석하여 통합했습니다. 필요 시 수정하세요.
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                병합 제목
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                병합 내용
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-400">병합 대상</p>
              {items.map((item) => (
                <p key={item.id} className="text-xs text-gray-500">
                  • {item.jiraTicketId}: {item.title}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            취소
          </button>
          {!aiLoading && (
            <>
              <button
                type="button"
                onClick={fetchAiMerge}
                className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100"
              >
                <Sparkles className="h-4 w-4" />
                AI 재요약
              </button>
              <button
                type="button"
                onClick={() => onMerge({ title, description })}
                disabled={!title.trim()}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
              >
                병합 확인
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
