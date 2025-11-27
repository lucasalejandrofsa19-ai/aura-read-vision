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
}

export const HighlightCanvas = ({
  width,
  height,
  highlights,
  onHighlightAdded,
  isDrawing,
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

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      drawingRef.current = {
        isDrawing: true,
        startX: x,
        startY: y,
      };
      currentRect = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!drawingRef.current.isDrawing) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

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

      ctx.fillStyle = "#fef08a";
      ctx.globalAlpha = 0.3;
      ctx.fillRect(rectX, rectY, Math.abs(rectWidth), Math.abs(rectHeight));
      ctx.globalAlpha = 1.0;

      currentRect = {
        x: rectX,
        y: rectY,
        width: Math.abs(rectWidth),
        height: Math.abs(rectHeight),
      };
    };

    const handleMouseUp = () => {
      if (!drawingRef.current.isDrawing) return;

      drawingRef.current.isDrawing = false;

      if (currentRect && currentRect.width > 5 && currentRect.height > 5) {
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

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [isDrawing, highlights, width, height, onHighlightAdded]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        cursor: isDrawing ? "crosshair" : "default",
        pointerEvents: isDrawing ? "auto" : "none",
        zIndex: isDrawing ? 10 : 1,
      }}
    />
  );
};
