import { useEffect, useRef } from "react";

interface HighlightCanvasProps {
  width: number;
  height: number;
  highlights: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;
  onHighlightAdded?: (highlight: { x: number; y: number; width: number; height: number }) => Promise<void> | void;
  isDrawing: boolean;
  minSelectionSize?: number;
  drawColor?: string;
}

export const HighlightCanvas = ({
  width,
  height,
  highlights,
  onHighlightAdded,
  isDrawing,
  minSelectionSize = 20,
  drawColor = "#fef08a",
}: HighlightCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<{
    isDrawing: boolean;
    startX: number;
    startY: number;
  }>({
    isDrawing: false,
    startX: 0,
    startY: 0,
  });

  // Render existing highlights
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw all highlights
    highlights.forEach((h) => {
      ctx.fillStyle = h.color;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(h.x, h.y, h.width, h.height);
    });

    ctx.globalAlpha = 1.0;
  }, [highlights, width, height]);

  // Handle drawing mode
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing) return;

    let currentRect: { x: number; y: number; width: number; height: number } | null = null;

    const getCoordinates = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      if ('touches' in e) {
        const touch = e.touches[0];
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      } else {
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
    };

    const handleStart = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const { x, y } = getCoordinates(e);

      drawingRef.current = {
        isDrawing: true,
        startX: x,
        startY: y,
      };
      currentRect = null;
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!drawingRef.current.isDrawing) return;
      e.preventDefault();

      const { x, y } = getCoordinates(e);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear and redraw
      ctx.clearRect(0, 0, width, height);

      // Redraw existing highlights
      highlights.forEach((h) => {
        ctx.fillStyle = h.color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(h.x, h.y, h.width, h.height);
      });

      // Draw current selection
      const rectWidth = x - drawingRef.current.startX;
      const rectHeight = y - drawingRef.current.startY;
      const rectX = rectWidth < 0 ? x : drawingRef.current.startX;
      const rectY = rectHeight < 0 ? y : drawingRef.current.startY;

      ctx.fillStyle = drawColor;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(rectX, rectY, Math.abs(rectWidth), Math.abs(rectHeight));
      ctx.globalAlpha = 1.0;

      currentRect = {
        x: rectX,
        y: rectY,
        width: Math.abs(rectWidth),
        height: Math.abs(rectHeight),
      };
    };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
      if (!drawingRef.current.isDrawing) return;
      e.preventDefault();

      drawingRef.current.isDrawing = false;

      if (currentRect && currentRect.width > minSelectionSize && currentRect.height > minSelectionSize) {
        onHighlightAdded?.(currentRect);
      }

      // Clear temporary drawing
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        highlights.forEach((h) => {
          ctx.fillStyle = h.color;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(h.x, h.y, h.width, h.height);
        });
        ctx.globalAlpha = 1.0;
      }

      currentRect = null;
    };

    // Mouse events
    canvas.addEventListener("mousedown", handleStart as EventListener);
    canvas.addEventListener("mousemove", handleMove as EventListener);
    canvas.addEventListener("mouseup", handleEnd as EventListener);
    canvas.addEventListener("mouseleave", handleEnd as EventListener);

    // Touch events
    canvas.addEventListener("touchstart", handleStart as EventListener, { passive: false });
    canvas.addEventListener("touchmove", handleMove as EventListener, { passive: false });
    canvas.addEventListener("touchend", handleEnd as EventListener, { passive: false });
    canvas.addEventListener("touchcancel", handleEnd as EventListener, { passive: false });

    return () => {
      canvas.removeEventListener("mousedown", handleStart as EventListener);
      canvas.removeEventListener("mousemove", handleMove as EventListener);
      canvas.removeEventListener("mouseup", handleEnd as EventListener);
      canvas.removeEventListener("mouseleave", handleEnd as EventListener);
      
      canvas.removeEventListener("touchstart", handleStart as EventListener);
      canvas.removeEventListener("touchmove", handleMove as EventListener);
      canvas.removeEventListener("touchend", handleEnd as EventListener);
      canvas.removeEventListener("touchcancel", handleEnd as EventListener);
    };
  }, [isDrawing, highlights, width, height, onHighlightAdded, drawColor, minSelectionSize]);

  // Custom SVG pen cursor tinted with the active highlight color
  const cursorSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M3 25 L8 20 L20 8 L24 12 L12 24 Z" fill="${drawColor}" stroke="#1a1a1a" stroke-width="1.2" stroke-linejoin="round"/><path d="M18 10 L22 14" stroke="#1a1a1a" stroke-width="1.2"/><circle cx="4" cy="24" r="1.6" fill="#1a1a1a"/></svg>`
  );
  const penCursor = `url("data:image/svg+xml;utf8,${cursorSvg}") 2 26, crosshair`;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        cursor: isDrawing ? penCursor : "default",
        pointerEvents: isDrawing ? "auto" : "none",
        zIndex: isDrawing ? 10 : 1,
      }}
    />
  );
};
