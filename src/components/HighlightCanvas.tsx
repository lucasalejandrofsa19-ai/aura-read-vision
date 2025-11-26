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

    console.log("[HighlightCanvas] Initializing canvas with dimensions:", { canvasWidth, canvasHeight });

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

    console.log("[HighlightCanvas] Rendering highlights:", {
      count: highlights.length,
      pageNumber,
      highlights: highlights.map(h => ({ id: h.id, x: h.x, y: h.y, width: h.width, height: h.height, color: h.color })),
      canvasWidth,
      canvasHeight
    });

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
      
      console.log("[HighlightCanvas] Adding rect:", { left: highlight.x, top: highlight.y, width: highlight.width, height: highlight.height });
      
      // Add click event (only when not in drawing mode)
      if (!isDrawingMode) {
        rect.on('mousedown', () => {
          onHighlightClicked?.(highlight.id, highlight.color);
        });
      }
      
      fabricCanvas.add(rect);
    });

    fabricCanvas.renderAll();
    console.log("[HighlightCanvas] Render complete");
  }, [highlights, fabricCanvas, pageNumber, isDrawingMode, onHighlightClicked, canvasWidth, canvasHeight]);

  // Handle drawing mode - Memoize handlers to prevent recreation
  const handleMouseDown = useCallback((e: any) => {
    if (!fabricCanvas) return;

    console.log("[HighlightCanvas] Mouse down event triggered");

    const pointer = fabricCanvas.getPointer(e.e);
    console.log("[HighlightCanvas] Pointer position:", pointer);
    
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

    console.log("[HighlightCanvas] Mouse up - drawing complete:", { width, height, startPoint, pointer });

    if (width > 10 && height > 10) {
      const highlight = {
        x: Math.min(startPoint.x, pointer.x),
        y: Math.min(startPoint.y, pointer.y),
        width,
        height,
      };

      console.log("[HighlightCanvas] Calling onHighlightAdded with:", highlight);
      onHighlightAdded?.(highlight);
    } else {
      console.log("[HighlightCanvas] Highlight too small, removing");
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
    
    console.log("[HighlightCanvas] Touch start event triggered");
    
    const touch = e.touches[0];
    const rect = fabricCanvas.getElement().getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    console.log("[HighlightCanvas] Touch position:", { x, y });
    
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

    console.log("[HighlightCanvas] Touch end event triggered");

    const touch = e.changedTouches[0];
    const rect = fabricCanvas.getElement().getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const width = Math.abs(x - startPoint.x);
    const height = Math.abs(y - startPoint.y);

    console.log("[HighlightCanvas] Touch drawing complete:", { width, height, startPoint, x, y });

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

  // Handle drawing mode - Simplified event handling
  useEffect(() => {
    if (!fabricCanvas || !canvasRef.current) return;

    console.log("[HighlightCanvas] Drawing mode changed:", { 
      isDrawingMode, 
      hasCanvas: !!fabricCanvas,
      isTouchDevice,
      canvasWidth,
      canvasHeight
    });

    const cleanup = () => {
      fabricCanvas.off("mouse:down");
      fabricCanvas.off("mouse:move");
      fabricCanvas.off("mouse:up");
      
      const canvasElement = canvasRef.current;
      if (canvasElement) {
        canvasElement.removeEventListener('touchstart', handleTouchStart as any);
        canvasElement.removeEventListener('touchmove', handleTouchMove as any);
        canvasElement.removeEventListener('touchend', handleTouchEnd as any);
        canvasElement.removeEventListener('mousedown', handleMouseDown as any);
        canvasElement.removeEventListener('mousemove', handleMouseMove as any);
        canvasElement.removeEventListener('mouseup', handleMouseUp as any);
      }
    };

    cleanup();

    if (isDrawingMode) {
      console.log("[HighlightCanvas] Activating drawing mode - attaching event listeners");
      
      // Use both Fabric.js events AND native events for redundancy
      fabricCanvas.on("mouse:down", handleMouseDown);
      fabricCanvas.on("mouse:move", handleMouseMove);
      fabricCanvas.on("mouse:up", handleMouseUp);
      
      const canvasElement = canvasRef.current;
      if (canvasElement) {
        // Add native mouse events directly to canvas element
        canvasElement.addEventListener('mousedown', (e) => {
          console.log("[HighlightCanvas] Native mousedown event:", e);
          handleMouseDown({ e });
        });
        
        canvasElement.addEventListener('mousemove', (e) => {
          handleMouseMove({ e });
        });
        
        canvasElement.addEventListener('mouseup', (e) => {
          console.log("[HighlightCanvas] Native mouseup event:", e);
          handleMouseUp({ e });
        });
        
        // Touch events
        canvasElement.addEventListener('touchstart', handleTouchStart as any, { passive: false });
        canvasElement.addEventListener('touchmove', handleTouchMove as any, { passive: false });
        canvasElement.addEventListener('touchend', handleTouchEnd as any, { passive: false });
        
        console.log("[HighlightCanvas] Event listeners attached to canvas element");
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
      className="absolute top-0 left-0 z-10"
      style={{
        cursor: isDrawingMode ? "crosshair" : "default",
        touchAction: "none",
        pointerEvents: "auto",
        border: isDrawingMode ? "2px dashed rgba(34, 197, 94, 0.5)" : "none",
      }}
    />
  );
};
