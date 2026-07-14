/**
 * Valida que rows com image_providers nulo/vazio NÃO renderizam badges
 * e a UI do BookVideoHistory continua íntegra (sem crash).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import BookVideoHistory from "@/components/BookVideoHistory";

vi.mock("@/integrations/supabase/client", () => {
  const rows = [
    {
      id: "null-1",
      status: "error",
      created_at: new Date().toISOString(),
      file_path: null,
      file_size: null,
      file_mime: null,
      scenes_count: 3,
      mode: "summary",
      error_message: "Falha total",
      image_providers: null,
    },
    {
      id: "empty-1",
      status: "ok",
      created_at: new Date().toISOString(),
      file_path: "path/video.mp4",
      file_size: 1024,
      file_mime: "video/mp4",
      scenes_count: 2,
      mode: "summary",
      error_message: null,
      image_providers: {},
    },
  ];
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return {
    supabase: {
      from: vi.fn(() => builder),
      storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn() })) },
    },
  };
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("BookVideoHistory — image_providers nulo/vazio", () => {
  it("não renderiza badges de providers e mantém UI estável", async () => {
    const { container } = render(<BookVideoHistory bookId="book-null" />);

    await waitFor(() => {
      expect(screen.getByText("Falha")).toBeInTheDocument();
      expect(screen.getByText("Concluído")).toBeInTheDocument();
    });

    // Nenhum badge de provider deve aparecer
    expect(screen.queryByText(/Gemini ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lovable \(fallback\) ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OpenAI ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cache ·/)).not.toBeInTheDocument();

    // UI continua funcional: mensagem de erro do row com falha permanece visível
    expect(screen.getByText("Falha total")).toBeInTheDocument();

    // Container renderizou sem crash
    expect(container.querySelector("ul")).not.toBeNull();
  });
});
