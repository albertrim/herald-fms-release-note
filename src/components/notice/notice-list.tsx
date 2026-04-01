"use client";

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
} from "@dnd-kit/sortable";
import { NoticeItemCard } from "./notice-item-card";
import type { NoticeItem, CategoryItem } from "@/types";

interface NoticeListProps {
  items: NoticeItem[];
  categories: CategoryItem[];
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
}

export function NoticeList({
  items,
  categories,
  selectedIds,
  onSelect,
  onDelete,
  onEdit,
  onReorder,
}: NoticeListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(active.id as string, over.id as string);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {items.map((item) => (
            <NoticeItemCard
              key={item.id}
              item={item}
              categories={categories}
              selected={selectedIds.has(item.id)}
              onSelect={onSelect}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
