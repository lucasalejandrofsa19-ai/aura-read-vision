import { useEffect, useRef, useState } from "react";
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
  isDrawingMode,
  highlightColor,
  canvasWidth,
  canvasHeight,
}: HighlightCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const drawingRectRef = useRef<Rect | null>(null);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      selection: false,
      backgroundColor: "transparent",
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [canvasWidth, canvasHeight]);

  // Render existing highlights
  useEffect(() => {
    if (!fabricCanvas) return;

    // Clear all objects
    fabricCanvas.clear();

    // Render all highlights for this page
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
      
      // Store highlight id in the rect for deletion
      rect.set('data', { highlightId: highlight.id });
      
      // Add click event for deletion (only when not in drawing mode)
      if (!isDrawingMode) {
        rect.on('mousedown', () => {
          if (onHighlightDeleted && confirm('Deseja apagar este destaque?')) {
            onHighlightDeleted(highlight.id);
          }
        });
      }
      
      fabricCanvas.add(rect);
    });

    fabricCanvas.renderAll();
  }, [highlights, fabricCanvas, pageNumber, isDrawingMode, onHighlightDeleted]);

  // Handle drawing mode
  useEffect(() => {
    if (!fabricCanvas) return;

    if (isDrawingMode) {
      // Enable drawing
      fabricCanvas.on("mouse:down", handleMouseDown);
      fabricCanvas.on("mouse:move", handleMouseMove);
      fabricCanvas.on("mouse:up", handleMouseUp);
    } else {
      // Disable drawing
      fabricCanvas.off("mouse:down", handleMouseDown);
      fabricCanvas.off("mouse:move", handleMouseMove);
      fabricCanvas.off("mouse:up", handleMouseUp);
      setIsDrawing(false);
      setStartPoint(null);
      if (drawingRectRef.current) {
        fabricCanvas.remove(drawingRectRef.current);
        drawingRectRef.current = null;
      }
    }

    return () => {
      fabricCanvas.off("mouse:down", handleMouseDown);
      fabricCanvas.off("mouse:move", handleMouseMove);
      fabricCanvas.off("mouse:up", handleMouseUp);
    };
  }, [isDrawingMode, fabricCanvas, highlightColor]);

  const handleMouseDown = (e: any) => {
    if (!fabricCanvas) return;

    const pointer = fabricCanvas.getPointer(e.e);
    setIsDrawing(true);
    setStartPoint({ x: pointer.x, y: pointer.y });

    // Create temporary rectangle
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

    fabricCanvas.add(rect);
    drawingRectRef.current = rect;
    fabricCanvas.renderAll();
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !startPoint || !drawingRectRef.current || !fabricCanvas) return;

    const pointer = fabricCanvas.getPointer(e.e);
    const width = pointer.x - startPoint.x;
    const height = pointer.y - startPoint.y;

    drawingRectRef.current.set({
      width: Math.abs(width),
      height: Math.abs(height),
      left: width < 0 ? pointer.x : startPoint.x,
      top: height < 0 ? pointer.y : startPoint.y,
    });

    fabricCanvas.renderAll();
  };

  const handleMouseUp = (e: any) => {
    if (!isDrawing || !startPoint || !drawingRectRef.current || !fabricCanvas) return;

    const pointer = fabricCanvas.getPointer(e.e);
    const width = Math.abs(pointer.x - startPoint.x);
    const height = Math.abs(pointer.y - startPoint.y);

    // Only save if the highlight is large enough
    if (width > 10 && height > 10) {
      const highlight = {
        x: Math.min(startPoint.x, pointer.x),
        y: Math.min(startPoint.y, pointer.y),
        width,
        height,
      };

      onHighlightAdded?.(highlight);
    } else {
      // Remove the rectangle if it's too small
      fabricCanvas.remove(drawingRectRef.current);
      fabricCanvas.renderAll();
    }

    setIsDrawing(false);
    setStartPoint(null);
    drawingRectRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-auto z-10"
      style={{
        cursor: isDrawingMode ? "crosshair" : "default",
      }}
    />
  );
};
