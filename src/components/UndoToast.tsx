"use client";

import { useEffect } from "react";

export const UNDO_TIMEOUT_MS = 5_000;

interface Props {
  message: string;
  onUndo(): void;
  onClose(): void;
}

export function UndoToast({ message, onUndo, onClose }: Props) {
  useEffect(() => {
    const id = setTimeout(onClose, UNDO_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded border border-line bg-panel px-3 py-2 text-sm text-body">
      <span>{message}</span>
      <button type="button" onClick={onUndo} className="font-semibold text-accent hover:underline">
        되돌리기
      </button>
    </div>
  );
}
