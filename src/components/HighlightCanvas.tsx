import { useEffect, useRef } from "react";
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
  const drawingRef = useRef<{ startX: number; startY: number; rect: Rect | null }>({
    startX: 0,
    startY: 0,
    rect: null,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      selection: false,
      backgroundColor: "transparent",
    });

    fabricCanvasRef.current = canvas;

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

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
  }, [highlights]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (isDrawing) {
      canvas.defaultCursor = "crosshair";
      
      const handleMouseDown = (e: any) => {
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
        if (!drawingRef.current.rect) return;

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
        if (!drawingRef.current.rect) return;

        const rect = drawingRef.current.rect;
        
        if (rect.width! > 5 && rect.height! > 5) {
          onHighlightAdded?.({
            x: rect.left!,
            y: rect.top!,
            width: rect.width!,
            height: rect.height!,
          });
        }

        canvas.remove(rect);
        canvas.renderAll();
        drawingRef.current.rect = null;
      };

      canvas.on("mouse:down", handleMouseDown);
      canvas.on("mouse:move", handleMouseMove);
      canvas.on("mouse:up", handleMouseUp);

      return () => {
        canvas.off("mouse:down", handleMouseDown);
        canvas.off("mouse:move", handleMouseMove);
        canvas.off("mouse:up", handleMouseUp);
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
