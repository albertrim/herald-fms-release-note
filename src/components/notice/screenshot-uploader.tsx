"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface ScreenshotUploaderProps {
  screenshots: string[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
}

export function ScreenshotUploader({
  screenshots,
  onAdd,
  onRemove,
}: ScreenshotUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (screenshots.length >= 5) {
      alert("스크린샷은 항목당 최대 5개까지 첨부할 수 있습니다.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploadthing", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "업로드에 실패했습니다.");
        return;
      }

      onAdd(data.url);
    } catch {
      alert("업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {screenshots.map((url, index) => (
          <div key={index} className="group relative">
            <img
              src={url}
              alt={`스크린샷 ${index + 1}`}
              className="h-20 w-20 rounded border object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white group-hover:flex"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {screenshots.length < 5 && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "업로드 중..." : `스크린샷 첨부 (${screenshots.length}/5)`}
          </Button>
        </>
      )}
    </div>
  );
}
