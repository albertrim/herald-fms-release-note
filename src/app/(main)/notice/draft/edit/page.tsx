"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { arrayMove } from "@dnd-kit/sortable";
import { v4 as uuidv4 } from "uuid";
import {
  GripVertical,
  Edit2,
  Trash2,
  Image as ImageIcon,
  ChevronDown,
  AlertCircle,
  Check,
  Merge,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { stripHtml, renderBoldMarkdown } from "@/lib/utils";
import { MergeDialog } from "@/components/notice/merge-dialog";
import { ScreenshotUploader } from "@/components/notice/screenshot-uploader";
import { getCategoryStyle } from "@/lib/category-styles";
import type { NoticeItem, CategoryItem, DraftNotice } from "@/types";

interface DraftCardProps {
  item: NoticeItem;
  categories: CategoryItem[];
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onUpdate: (id: string, updates: Partial<NoticeItem>) => void;
  editingId: string | null;
  onScreenshotClick: (id: string) => void;
}

function AutoResizeTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // 내용 높이 + 공백 2줄(line-height ~20px * 2 = 40px)
    el.style.height = `${el.scrollHeight + 40}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className="w-full resize-none overflow-hidden rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    />
  );
}

function DraftCard({
  item,
  categories,
  selected,
  onSelect,
  onDelete,
  onEdit,
  onUpdate,
  editingId,
  onScreenshotClick,
}: DraftCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const category = categories.find((c) => c.id === item.categoryId);
  const isEditing = editingId === item.id;
  const catColor = category ? getCategoryStyle(category.name) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border-2 p-5 transition-colors ${
        selected ? "border-blue-500 bg-blue-50/30" : catColor ? `${catColor.border} ${catColor.bg}/30` : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(item.id, e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab text-gray-400 hover:text-gray-600"
          title="드래그하여 순서 변경"
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          {item.isOriginalText && (
            <div className="mb-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                <AlertCircle className="h-3.5 w-3.5" />
                수동 편집 필요
              </span>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={item.title}
                onChange={(e) => onUpdate(item.id, { title: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <AutoResizeTextarea
                value={stripHtml(item.description)}
                onChange={(e) => onUpdate(item.id, { description: e.target.value })}
              />
            </div>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
              <p
                className="mt-1 text-sm leading-relaxed text-gray-600"
                dangerouslySetInnerHTML={{ __html: renderBoldMarkdown(item.description) }}
              />
            </>
          )}

          {item.isOriginalText && !isEditing && (
            <div className="mt-3 rounded-lg bg-gray-100 p-3">
              <p className="font-mono text-xs text-gray-500">{item.jiraTicketId}: {stripHtml(item.description)}</p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative flex items-center gap-1.5">
              {/* bullet 제거됨 */}
              <select
                value={item.categoryId || ""}
                onChange={(e) =>
                  onUpdate(item.id, {
                    categoryId: e.target.value || null,
                  })
                }
                className={`appearance-none rounded-lg border py-1.5 pl-3 pr-8 text-xs font-medium outline-none focus:border-blue-500 ${
                  catColor ? `${catColor.bg} ${catColor.border} ${catColor.text}` : "border-gray-300 bg-white text-gray-700"
                }`}
              >
                <option value="">카테고리 선택</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            </div>

            {item.slackLink && (
              <a
                href={item.slackLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100"
              >
                <MessageSquare className="h-3 w-3" />
                {item.slackAuthor ? `Slack (${item.slackAuthor})` : "Slack"}
              </a>
            )}

            {item.jiraTicketUrl && item.jiraTicketUrl.includes(" | ")
              ? item.jiraTicketUrl.split(" | ").map((url, i) => {
                  const ticketIds = item.jiraTicketId.split(", ");
                  const ticketId = ticketIds[i] || `티켓 ${i + 1}`;
                  return (
                    <a
                      key={i}
                      href={url.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {ticketId}
                    </a>
                  );
                })
              : item.jiraTicketUrl && (
                <a
                  href={item.jiraTicketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <ExternalLink className="h-3 w-3" />
                  {item.jiraTicketId}
                </a>
              )}
          </div>

          {item.screenshots.length > 0 && (
            <div className="mt-3 flex gap-2">
              {item.screenshots.map((url, i) => (
                <Image
                  key={i}
                  src={url}
                  alt={`스크린샷 ${i + 1}`}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onScreenshotClick(item.id)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
            title="스크린샷 첨부"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(item.id)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
            title="편집"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            title="삭제"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DraftEditPage() {
  const router = useRouter();
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [screenshotItemId, setScreenshotItemId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const stored = sessionStorage.getItem("draftNotice");
    if (!stored) {
      router.push("/notice/new");
      return;
    }
    const draft: DraftNotice = JSON.parse(stored);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(draft.items);
    setSourceUrls(draft.sourceUrls);
  }, [router]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        const cats: CategoryItem[] = d.categories || [];
        setCategories(cats);
        // 카테고리 순서대로 항목 재정렬
        if (cats.length > 0) {
          setItems((prev) => {
            const catOrder = new Map(cats.map((c) => [c.id, c.sortOrder]));
            return [...prev].sort((a, b) => {
              const orderA = a.categoryId ? (catOrder.get(a.categoryId) ?? 999) : 999;
              const orderB = b.categoryId ? (catOrder.get(b.categoryId) ?? 999) : 999;
              return orderA - orderB;
            }).map((item, i) => ({ ...item, sortOrder: i }));
          });
        }
      });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id);
        const newIndex = prev.findIndex((i) => i.id === over.id);
        return arrayMove(prev, oldIndex, newIndex).map((item, i) => ({
          ...item,
          sortOrder: i,
        }));
      });
    }
  }

  function handleMerge(merged: { title: string; description: string }) {
    const selected = items.filter((i) => selectedIds.has(i.id));
    const remaining = items.filter((i) => !selectedIds.has(i.id));

    const mergedItem: NoticeItem = {
      id: uuidv4(),
      title: merged.title,
      description: merged.description,
      categoryId: selected[0]?.categoryId || null,
      sortOrder: selected[0]?.sortOrder || 0,
      jiraTicketId: selected.map((s) => s.jiraTicketId).join(", "),
      jiraTicketUrl: selected[0]?.jiraTicketUrl || "",
      slackLink: selected.find((s) => s.slackLink)?.slackLink || null,
      slackAuthor: selected.find((s) => s.slackAuthor)?.slackAuthor || null,
      screenshots: selected.flatMap((s) => s.screenshots).slice(0, 5),
      isOriginalText: false,
    };

    const insertIndex = Math.min(
      ...selected.map((s) => items.indexOf(s))
    );
    remaining.splice(insertIndex, 0, mergedItem);

    setItems(remaining.map((item, i) => ({ ...item, sortOrder: i })));
    setSelectedIds(new Set());
    setMergeOpen(false);
  }

  const updateItem = useCallback((id: string, updates: Partial<NoticeItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  function handleToggleEdit(id: string) {
    setEditingId((prev) => (prev === id ? null : id));
  }

  function handleScreenshotClick(id: string) {
    setScreenshotItemId((prev) => (prev === id ? null : id));
  }

  function handleProceedToSend() {
    sessionStorage.setItem(
      "draftNotice",
      JSON.stringify({ sourceUrls, items, createdAt: new Date().toISOString() })
    );
    router.push("/notice/draft/send");
  }

  return (
    <div className="mx-auto max-w-4xl py-8">
      <button
        type="button"
        onClick={() => router.push("/notice/new")}
        className="mb-6 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        &larr; URL 입력으로 돌아가기
      </button>

      <h1 className="text-2xl font-bold text-gray-900">공지 초안 편집</h1>
      <p className="mt-2 text-gray-500">
        {items.length}개 항목 - 드래그하여 순서를 변경하고, 항목을 선택하여 병합할 수 있습니다.
      </p>

      {selectedIds.size >= 2 && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
            <Check className="h-4 w-4" />
            {selectedIds.size}개 항목 선택됨
          </div>
          <button
            type="button"
            onClick={() => setMergeOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:from-blue-700 hover:to-purple-700"
          >
            <Merge className="h-4 w-4" />
            선택 항목 병합
          </button>
        </div>
      )}

      {items.length === 0 && (
        <p className="py-12 text-center text-gray-400">
          발송할 항목이 없습니다.
        </p>
      )}

      <div className="mt-6 space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item) => (
              <div key={item.id}>
                <DraftCard
                  item={item}
                  categories={categories}
                  selected={selectedIds.has(item.id)}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                  onEdit={handleToggleEdit}
                  onUpdate={updateItem}
                  editingId={editingId}
                  onScreenshotClick={handleScreenshotClick}
                />
                {screenshotItemId === item.id && (
                  <div className="mt-2 rounded-xl border border-gray-200 bg-white p-4">
                    <ScreenshotUploader
                      screenshots={item.screenshots}
                      onAdd={(url) =>
                        updateItem(item.id, {
                          screenshots: [...item.screenshots, url],
                        })
                      }
                      onRemove={(index) =>
                        updateItem(item.id, {
                          screenshots: item.screenshots.filter((_, i) => i !== index),
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/notice/new")}
          className="flex-1 rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          URL 재입력
        </button>
        <button
          type="button"
          onClick={handleProceedToSend}
          disabled={items.length === 0}
          className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
        >
          이메일 발송 준비
        </button>
      </div>

      {mergeOpen && (
        <MergeDialog
          open={mergeOpen}
          items={items.filter((i) => selectedIds.has(i.id))}
          onMerge={handleMerge}
          onClose={() => setMergeOpen(false)}
        />
      )}
    </div>
  );
}
