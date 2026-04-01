"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertCircle, Loader2, Link as LinkIcon } from "lucide-react";
import { isValidJiraReleaseUrl } from "@/lib/utils";
import type { NoticeItem } from "@/types";

export default function NewNoticePage() {
  const router = useRouter();
  const [urls, setUrls] = useState(["", ""]);
  const [errors, setErrors] = useState<string[]>([]);
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);

  function addUrl() {
    setUrls([...urls, ""]);
  }

  function updateUrl(index: number, value: string) {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
    if (errors[index]) {
      const newErrors = [...errors];
      newErrors[index] = "";
      setErrors(newErrors);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError("");

    const filledUrls = urls.filter((u) => u.trim() !== "");
    if (filledUrls.length === 0) {
      setGlobalError("최소 1개의 URL을 입력해주세요.");
      return;
    }

    const newErrors = urls.map((url) => {
      if (url.trim() === "") return "";
      return isValidJiraReleaseUrl(url) ? "" : "유효한 JIRA Release Note URL 형식이 아닙니다.";
    });

    if (newErrors.some((e) => e !== "")) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);
    setLoading(true);

    try {
      const res = await fetch("/api/jira/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: filledUrls }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGlobalError(data.message || "초안 생성에 실패했습니다.");
        setLoading(false);
        return;
      }

      const items: NoticeItem[] = data.items;
      sessionStorage.setItem("draftNotice", JSON.stringify({
        sourceUrls: filledUrls,
        items,
        createdAt: new Date().toISOString(),
      }));

      router.push("/notice/draft/edit");
    } catch {
      setGlobalError("서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="mb-6 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        &larr; 대시보드로 돌아가기
      </button>

      <h1 className="text-2xl font-bold text-gray-900">JIRA 릴리즈 입력</h1>
      <p className="mt-2 text-gray-500">
        공지를 생성할 JIRA Release Note의 URL을 입력해주세요. 여러 개의 URL을 추가할 수 있습니다.
      </p>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {urls.map((url, index) => (
            <div key={index}>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <LinkIcon className="h-4 w-4" />
                {index === 0 ? "FMS Release Note URL" : index === 1 ? "OMS Release Note URL" : `Release Note URL ${index + 1}`}
              </label>
              <div className="flex items-start gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    className={`w-full rounded-lg border py-3 pl-10 pr-4 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                      errors[index]
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300 bg-white"
                    }`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => updateUrl(index, "")}
                  disabled={!url.trim()}
                  className="rounded-lg p-2 text-gray-300 transition-colors enabled:text-gray-400 enabled:hover:bg-red-50 enabled:hover:text-red-600 disabled:cursor-not-allowed"
                  title="입력 초기화"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              {errors[index] && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors[index]}
                </p>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addUrl}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" />
            URL 추가
          </button>

          {globalError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {globalError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !urls.some((u) => u.trim())}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:from-blue-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                초안 생성 중...
              </span>
            ) : (
              "초안 생성"
            )}
          </button>
        </form>
      </div>

      <div className="mt-4 rounded-lg bg-blue-50 p-4">
        <p className="text-sm text-blue-700">
          URL 형식: <span className="font-mono text-xs">https://jira.company.com/projects/PROJECT/versions/12345</span>
        </p>
      </div>
    </div>
  );
}
