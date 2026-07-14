/**
 * Valida que rows de story_videos com status "error" exibem badges de providers
 * quando image_providers está preenchido (cobertura pós regenerate-story-video-scene).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import BookVideoHistory from "@/components/BookVideoHistory";

vi.mock("@/integrations/supabase/client", () => {
  const errorRows = [
    {
      id: "err-1",
      status: "error",
      created_at: new Date().toISOString(),
      file_path: null,
      file_size: null,
      file_mime: null,
      scenes_count: 3,
      mode: "summary",
      error_message: "Falha ao regenerar áudio",
      image_providers: { gemini: 2, lovable: 1, cached: 1 },
    },
    {
      id: "err-2",
      status: "error",
      created_at: new Date().toISOString(),
      file_path: null,
      file_size: null,
      file_mime: null,
      scenes_count: 2,
      mode: "highlights",
      error_message: "Timeout",
      image_providers: { openai: 2 },
    },
  ];
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: errorRows, error: null }),
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

describe("BookVideoHistory — badges em rows com status error", () => {
  it("renderiza badges de providers para vídeos com falha e image_providers preenchido", async () => {
    render(<BookVideoHistory bookId="book-1" />);

    // Ambos os rows aparecem como "Falha"
    await waitFor(() => {
      expect(screen.getAllByText("Falha")).toHaveLength(2);
    });

    // Badges de providers presentes mesmo em status=error
    expect(screen.getByText(/Gemini · 2/)).toBeInTheDocument();
    expect(screen.getByText(/Lovable \(fallback\) · 1/)).toBeInTheDocument();
    expect(screen.getByText(/Cache · 1/)).toBeInTheDocument();
    expect(screen.getByText(/OpenAI · 2/)).toBeInTheDocument();

    // Mensagem de erro visível
    expect(screen.getByText("Falha ao regenerar áudio")).toBeInTheDocument();
    expect(screen.getByText("Timeout")).toBeInTheDocument();
  });

  it("não renderiza badges quando image_providers está vazio/nulo", async () => {
    vi.resetModules();
    vi.doMock("@/integrations/supabase/client", () => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ ...errorRows[0], id: "err-empty", image_providers: null }],
          error: null,
        }),
      };
      return {
        supabase: {
          from: vi.fn(() => builder),
          storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn() })) },
        },
      };
    });
    const { default: Fresh } = await import("@/components/BookVideoHistory");
    render(<Fresh bookId="book-2" />);
    await waitFor(() => expect(screen.getAllByText("Falha").length).toBeGreaterThan(0));
    expect(screen.queryByText(/Gemini ·/)).not.toBeInTheDocument();
  });
});
