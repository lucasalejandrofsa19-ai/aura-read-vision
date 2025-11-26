import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Rect } from "fabric";

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
  onHighlightAdded?: (highlight: { x: number; y: number; width: number; height: number }) => void;
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
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const isMountedRef = useRef(true);
  const drawingRef = useRef<{ startX: number; startY: number; rect: Rect | null }>({
    startX: 0,
    startY: 0,
    rect: null,
  });

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      selection: false,
      backgroundColor: "transparent",
    });

    fabricCanvasRef.current = canvas;

    return () => {
      isMountedRef.current = false;
      
      // Clean up in a way that doesn't conflict with React
      const currentCanvas = fabricCanvasRef.current;
      if (currentCanvas) {
        try {
          // Remove all event listeners first
          currentCanvas.off();
          // Clear all objects
          currentCanvas.clear();
          // Dispose without letting it manipulate DOM
          currentCanvas.dispose();
        } catch (error) {
          // Silently handle cleanup errors
        } finally {
          fabricCanvasRef.current = null;
        }
      }
    };
  }, [width, height]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isMountedRef.current) return;

    try {
      canvas.clear();

      highlights.forEach((h) => {
        const rect = new Rect({
          left: h.x,
          top: h.y,
          width: h.width,
          height: h.height,
          fill: h.color,
          opacity: 0.3,
          selectable: false,
          evented: false,
        });
        canvas.add(rect);
      });

      canvas.renderAll();
    } catch (error) {
      // Silently handle render errors during unmount
    }
  }, [highlights]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isMountedRef.current) return;

    if (isDrawing) {
      canvas.defaultCursor = "crosshair";
      
      const handleMouseDown = (e: any) => {
        if (!isMountedRef.current) return;
        
        const pointer = canvas.getPointer(e.e);
        drawingRef.current.startX = pointer.x;
        drawingRef.current.startY = pointer.y;

        const rect = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: "#fef08a",
          opacity: 0.3,
          selectable: false,
          evented: false,
        });

        canvas.add(rect);
        drawingRef.current.rect = rect;
      };

      const handleMouseMove = (e: any) => {
        if (!drawingRef.current.rect || !isMountedRef.current) return;

        const pointer = canvas.getPointer(e.e);
        const width = pointer.x - drawingRef.current.startX;
        const height = pointer.y - drawingRef.current.startY;

        drawingRef.current.rect.set({
          width: Math.abs(width),
          height: Math.abs(height),
          left: width < 0 ? pointer.x : drawingRef.current.startX,
          top: height < 0 ? pointer.y : drawingRef.current.startY,
        });

        canvas.renderAll();
      };

      const handleMouseUp = () => {
        if (!drawingRef.current.rect || !isMountedRef.current) return;

        const rect = drawingRef.current.rect;
        
        if (rect.width! > 5 && rect.height! > 5) {
          onHighlightAdded?.({
            x: rect.left!,
            y: rect.top!,
            width: rect.width!,
            height: rect.height!,
          });
        }

        try {
          canvas.remove(rect);
          canvas.renderAll();
        } catch (error) {
          // Silently handle errors during unmount
        }
        drawingRef.current.rect = null;
      };

      canvas.on("mouse:down", handleMouseDown);
      canvas.on("mouse:move", handleMouseMove);
      canvas.on("mouse:up", handleMouseUp);

      return () => {
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.off("mouse:down", handleMouseDown);
          fabricCanvasRef.current.off("mouse:move", handleMouseMove);
          fabricCanvasRef.current.off("mouse:up", handleMouseUp);
        }
      };
    } else {
      canvas.defaultCursor = "default";
    }
  }, [isDrawing, onHighlightAdded]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: isDrawing ? "auto" : "none",
      }}
    />
  );
};
