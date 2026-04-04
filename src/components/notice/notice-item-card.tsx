"use client";

import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { renderBoldMarkdown } from "@/lib/utils";
import type { NoticeItem, CategoryItem } from "@/types";

interface NoticeItemCardProps {
  item: NoticeItem;
  categories: CategoryItem[];
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

export function NoticeItemCard({
  item,
  categories,
  selected,
  onSelect,
  onDelete,
  onEdit,
}: NoticeItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const category = categories.find((c) => c.id === item.categoryId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-white p-4"
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(item.id, !!checked)}
          className="mt-1"
        />
        <div
          {...attributes}
          {...listeners}
          className="text-muted-foreground mt-1 cursor-grab select-none"
          title="드래그하여 순서 변경"
        >
          ⠿
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="truncate font-medium">{item.title}</h3>
            {item.isOriginalText && (
              <Badge variant="destructive" className="shrink-0 text-xs">
                수동 편집 필요
              </Badge>
            )}
            {category && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {category.name}
              </Badge>
            )}
          </div>
          <p
            className="text-muted-foreground line-clamp-2 text-sm"
            dangerouslySetInnerHTML={{ __html: renderBoldMarkdown(item.description) }}
          />
          {item.slackLink && (
            <a
              href={item.slackLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs text-blue-600 underline"
            >
              Slack 스레드 보기
            </a>
          )}
          {item.screenshots.length > 0 && (
            <div className="mt-2 flex gap-1">
              {item.screenshots.map((url, i) => (
                <Image
                  key={i}
                  src={url}
                  alt={`스크린샷 ${i + 1}`}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded border object-cover"
                />
              ))}
            </div>
          )}
          <p className="text-muted-foreground mt-1 text-xs">
            {item.jiraTicketId}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(item.id)}>
            편집
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => onDelete(item.id)}
          >
            삭제
          </Button>
        </div>
      </div>
    </div>
  );
}
