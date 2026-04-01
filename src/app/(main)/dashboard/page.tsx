"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { SendHistoryListItem } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [history, setHistory] = useState<SendHistoryListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.items || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 py-8">
      {/* Title Section */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">대시보드</h2>
        <p className="mt-1 text-lg text-gray-600">
          업데이트 공지를 생성하고 발송 이력을 관리합니다.
        </p>
      </div>

      {/* CTA Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-purple-600 p-8 shadow-2xl shadow-blue-600/20">
        {/* Decorative blurred circles */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-purple-400/20 blur-2xl" />
        <div className="pointer-events-none absolute right-1/3 top-1/2 h-24 w-24 rounded-full bg-blue-300/10 blur-xl" />

        <div className="relative flex items-center justify-between">
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white">
              새로운 공지를 생성하세요
            </h3>
            <button
              type="button"
              onClick={() => router.push("/notice/new")}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 font-semibold text-blue-600 transition-transform hover:scale-105 active:scale-100"
            >
              <Plus className="h-5 w-5" />
              새 공지 생성
            </button>
          </div>

          {/* Large decorative icon on the right */}
          <div className="hidden lg:block">
            <FileText className="h-32 w-32 text-white/10" />
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-xl backdrop-blur-sm">
        {/* Table Header Section */}
        <div className="border-b border-gray-100 px-8 py-6">
          <h3 className="text-2xl font-bold text-gray-900">발송 이력</h3>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-500">
            불러오는 중...
          </div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            아직 발송된 공지가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
                  <th className="px-8 py-4 font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      발송일시
                    </div>
                  </th>
                  <th className="px-8 py-4 font-medium">제목</th>
                  <th className="px-8 py-4 font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      수신자
                    </div>
                  </th>
                  <th className="px-8 py-4 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50/80"
                    onClick={() => router.push(`/history/${item.id}`)}
                  >
                    <td className="px-8 py-4 text-sm text-gray-500">
                      {new Date(item.sentAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-8 py-4 font-medium text-gray-900">
                      {item.title}
                    </td>
                    <td className="px-8 py-4 text-sm text-gray-600">
                      {item.recipientCount}명
                    </td>
                    <td className="px-8 py-4">
                      {item.status === "SUCCESS" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle className="h-3.5 w-3.5" />
                          발송 성공
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                          <XCircle className="h-3.5 w-3.5" />
                          발송 실패
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
