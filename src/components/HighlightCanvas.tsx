import { useEffect, useRef } from "react";
import { Canvas as FabricCanvas, Rect } from "fabric";

interface HighlightCanvasProps {
  pageNumber: number;
  highlights: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;
  onHighlightAdded?: (highlight: { x: number; y: number; width: number; height: number }) => void;
  onHighlightDeleted?: (highlightId: string) => void;
  onHighlightClicked?: (highlightId: string, currentColor: string) => void;
  isDrawingMode: boolean;
  highlightColor: string;
  canvasWidth: number;
  canvasHeight: number;
}

export const HighlightCanvas = ({
  pageNumber,
  highlights,
  onHighlightAdded,
  onHighlightDeleted,
  onHighlightClicked,
  isDrawingMode,
  highlightColor,
  canvasWidth,
  canvasHeight,
}: HighlightCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const drawingStateRef = useRef({
    isDrawing: false,
    startPoint: null as { x: number; y: number } | null,
    drawingRect: null as Rect | null,
  });

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      selection: false,
      backgroundColor: "transparent",
    });

    fabricCanvasRef.current = canvas;

    return () => {
      fabricCanvasRef.current = null;
      canvas.dispose();
    };
  }, [canvasWidth, canvasHeight]);

  // Render existing highlights
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.clear();

    highlights.forEach((highlight) => {
      const rect = new Rect({
        left: highlight.x,
        top: highlight.y,
        width: highlight.width,
        height: highlight.height,
        fill: highlight.color,
        opacity: 0.4,
        selectable: !isDrawingMode,
        evented: !isDrawingMode,
        hoverCursor: isDrawingMode ? 'crosshair' : 'pointer',
      });

      if (!isDrawingMode) {
        rect.on('mousedown', () => {
          onHighlightClicked?.(highlight.id, highlight.color);
        });
      }

      canvas.add(rect);
    });

    canvas.renderAll();
  }, [highlights, pageNumber, isDrawingMode, onHighlightClicked]);

  // Handle drawing mode
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: any) => {
      const pointer = canvas.getPointer(e.e);
      const state = drawingStateRef.current;
      
      state.isDrawing = true;
      state.startPoint = { x: pointer.x, y: pointer.y };

      const rect = new Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: highlightColor,
        opacity: 0.4,
        selectable: false,
        evented: false,
      });

      canvas.add(rect);
      state.drawingRect = rect;
      canvas.renderAll();
    };

    const handleMouseMove = (e: any) => {
      const state = drawingStateRef.current;
      if (!state.isDrawing || !state.startPoint || !state.drawingRect) return;

      const pointer = canvas.getPointer(e.e);
      const width = pointer.x - state.startPoint.x;
      const height = pointer.y - state.startPoint.y;

      state.drawingRect.set({
        width: Math.abs(width),
        height: Math.abs(height),
        left: width < 0 ? pointer.x : state.startPoint.x,
        top: height < 0 ? pointer.y : state.startPoint.y,
      });

      canvas.renderAll();
    };

    const handleMouseUp = (e: any) => {
      const state = drawingStateRef.current;
      if (!state.isDrawing || !state.startPoint || !state.drawingRect) return;

      const pointer = canvas.getPointer(e.e);
      const width = Math.abs(pointer.x - state.startPoint.x);
      const height = Math.abs(pointer.y - state.startPoint.y);

      if (width > 10 && height > 10) {
        const highlight = {
          x: Math.min(state.startPoint.x, pointer.x),
          y: Math.min(state.startPoint.y, pointer.y),
          width,
          height,
        };
        onHighlightAdded?.(highlight);
      } else {
        canvas.remove(state.drawingRect);
      }

      state.isDrawing = false;
      state.startPoint = null;
      state.drawingRect = null;
      canvas.renderAll();
    };

    if (isDrawingMode) {
      canvas.on("mouse:down", handleMouseDown);
      canvas.on("mouse:move", handleMouseMove);
      canvas.on("mouse:up", handleMouseUp);
    }

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);

      const state = drawingStateRef.current;
      if (state.drawingRect) {
        canvas.remove(state.drawingRect);
        state.drawingRect = null;
      }
      state.isDrawing = false;
      state.startPoint = null;
    };
  }, [isDrawingMode, highlightColor, onHighlightAdded]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0"
      style={{
        cursor: isDrawingMode ? "crosshair" : "default",
        touchAction: "none",
        pointerEvents: "auto",
        zIndex: 999,
      }}
    />
  );
};