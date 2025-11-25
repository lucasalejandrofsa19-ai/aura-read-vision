import { useEffect, useRef, useState, useCallback } from "react";
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
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

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

  // Handle drawing mode - Memoize handlers to prevent recreation
  const handleMouseDown = useCallback((e: any) => {
    if (!fabricCanvas) return;

    const pointer = fabricCanvas.getPointer(e.e);
    setIsDrawing(true);
    setStartPoint({ x: pointer.x, y: pointer.y });

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
  }, [fabricCanvas, highlightColor]);

  const handleMouseMove = useCallback((e: any) => {
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
  }, [isDrawing, startPoint, fabricCanvas]);

  const handleMouseUp = useCallback((e: any) => {
    if (!isDrawing || !startPoint || !drawingRectRef.current || !fabricCanvas) return;

    const pointer = fabricCanvas.getPointer(e.e);
    const width = Math.abs(pointer.x - startPoint.x);
    const height = Math.abs(pointer.y - startPoint.y);

    if (width > 10 && height > 10) {
      const highlight = {
        x: Math.min(startPoint.x, pointer.x),
        y: Math.min(startPoint.y, pointer.y),
        width,
        height,
      };

      onHighlightAdded?.(highlight);
    } else {
      fabricCanvas.remove(drawingRectRef.current);
      fabricCanvas.renderAll();
    }

    setIsDrawing(false);
    setStartPoint(null);
    drawingRectRef.current = null;
  }, [isDrawing, startPoint, fabricCanvas, onHighlightAdded]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!fabricCanvas) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = fabricCanvas.getElement().getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPoint({ x, y });

    const tempRect = new Rect({
      left: x,
      top: y,
      width: 0,
      height: 0,
      fill: highlightColor,
      opacity: 0.4,
      selectable: false,
      evented: false,
    });

    fabricCanvas.add(tempRect);
    drawingRectRef.current = tempRect;
    fabricCanvas.renderAll();
  }, [fabricCanvas, highlightColor]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDrawing || !startPoint || !drawingRectRef.current || !fabricCanvas) return;
    e.preventDefault();

    const touch = e.touches[0];
    const rect = fabricCanvas.getElement().getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const width = x - startPoint.x;
    const height = y - startPoint.y;

    drawingRectRef.current.set({
      width: Math.abs(width),
      height: Math.abs(height),
      left: width < 0 ? x : startPoint.x,
      top: height < 0 ? y : startPoint.y,
    });

    fabricCanvas.renderAll();
  }, [isDrawing, startPoint, fabricCanvas]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isDrawing || !startPoint || !drawingRectRef.current || !fabricCanvas) return;
    e.preventDefault();

    const touch = e.changedTouches[0];
    const rect = fabricCanvas.getElement().getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const width = Math.abs(x - startPoint.x);
    const height = Math.abs(y - startPoint.y);

    if (width > 10 && height > 10) {
      const highlight = {
        x: Math.min(startPoint.x, x),
        y: Math.min(startPoint.y, y),
        width,
        height,
      };

      onHighlightAdded?.(highlight);
    } else {
      fabricCanvas.remove(drawingRectRef.current);
      fabricCanvas.renderAll();
    }

    setIsDrawing(false);
    setStartPoint(null);
    drawingRectRef.current = null;
  }, [isDrawing, startPoint, fabricCanvas, onHighlightAdded]);

  // Handle drawing mode
  useEffect(() => {
    if (!fabricCanvas) return;

    const cleanup = () => {
      fabricCanvas.off("mouse:down");
      fabricCanvas.off("mouse:move");
      fabricCanvas.off("mouse:up");
      
      if (isTouchDevice) {
        const canvas = fabricCanvas.getElement();
        if (canvas) {
          canvas.removeEventListener('touchstart', handleTouchStart);
          canvas.removeEventListener('touchmove', handleTouchMove);
          canvas.removeEventListener('touchend', handleTouchEnd);
        }
      }
    };

    cleanup();

    if (isDrawingMode) {
      fabricCanvas.on("mouse:down", handleMouseDown);
      fabricCanvas.on("mouse:move", handleMouseMove);
      fabricCanvas.on("mouse:up", handleMouseUp);
      
      if (isTouchDevice) {
        const canvas = fabricCanvas.getElement();
        if (canvas) {
          canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
          canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
          canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        }
      }
    } else {
      setIsDrawing(false);
      setStartPoint(null);
      if (drawingRectRef.current) {
        fabricCanvas.remove(drawingRectRef.current);
        drawingRectRef.current = null;
      }
    }

    return cleanup;
  }, [isDrawingMode, fabricCanvas, isTouchDevice, handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd]);


  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-auto z-10"
      style={{
        cursor: isDrawingMode ? "crosshair" : "default",
        touchAction: isDrawingMode ? "none" : "auto",
      }}
    />
  );
};
