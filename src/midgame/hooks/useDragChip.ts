import { useCallback, useRef, useState } from 'react';

export interface DragChipPosition { x: number; y: number }

export interface UseDragChipOptions {
  amount: number; // value this chip represents when dropped
  onDrop: (dropTargetId: string, amount: number) => void;
}

// Shared drag gesture for every place money physically moves: allocation buckets
// (round start), Food/Happiness spend (weekly), and micro-event accept zones.
// Drop targets register by putting `data-drop-target="<id>"` on the element;
// on release we look up the element under the pointer and match its id.
export function useDragChip({ amount, onDrop }: UseDragChipOptions) {
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState<DragChipPosition | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerIdRef.current = e.pointerId;
    setDragging(true);
    setPosition({ x: e.clientX, y: e.clientY });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    setPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    setDragging(false);
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest('[data-drop-target]');
    const dropId = target?.getAttribute('data-drop-target');
    if (dropId) onDrop(dropId, amount);
    setPosition(null);
  }, [amount, onDrop]);

  return {
    dragging,
    position,
    chipProps: { onPointerDown, onPointerMove, onPointerUp },
  };
}
