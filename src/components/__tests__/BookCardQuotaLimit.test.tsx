/**
 * Teste de integração cobrindo o fluxo:
 * usuário gratuito atinge o limite diário (3/dia) de geração de vídeos IA
 * → botão "Gerar vídeo IA" fica visualmente desabilitado e exibe CTA de upgrade Premium.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import BookCard from "@/components/BookCard";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-free-1" } }),
}));

vi.mock("@/hooks/useGenerateCover", () => ({
  useGenerateCover: () => ({ generateCover: vi.fn(), generating: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis() })),
    storage: { from: vi.fn(() => ({ remove: vi.fn(), upload: vi.fn(), createSignedUrl: vi.fn() })) },
    functions: { invoke: vi.fn() },
  },
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: any[]) => toastError(...args), success: vi.fn(), loading: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const { supabase } = await import("@/integrations/supabase/client");

const renderCard = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BookCard
          book={{
            id: "book-1",
            title: "Livro Teste",
            author: "Autor",
            cover_color: "from-primary to-secondary",
            file_path: "path/a.pdf",
          }}
          index={0}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("BookCard — limite diário de vídeos IA (free)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("desabilita o botão e oferece CTA de upgrade quando allowed=false", async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: { allowed: false, used: 3, limit: 3, premium: false },
      error: null,
    });

    renderCard();

    const btn = await screen.findByTitle(/limite di[aá]rio atingido/i);
    await waitFor(() => expect(btn).toBeInTheDocument());

    fireEvent.click(btn);

    // CTA de upgrade Premium deve ser oferecida no toast
    expect(toastError).toHaveBeenCalled();
    const call = toastError.mock.calls[0];
    expect(String(call[0])).toMatch(/limite di[aá]rio/i);
    expect(call[1]?.action?.label).toMatch(/upgrade premium/i);

    // Aciona a CTA → navega para /pricing
    call[1].action.onClick();
    expect(navigateMock).toHaveBeenCalledWith("/pricing");

    // E não navega para a página de geração de vídeo
    expect(navigateMock).not.toHaveBeenCalledWith("/story-video/book-1");
  });

  it("permite gerar vídeo quando ainda há cota disponível", async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: { allowed: true, used: 1, limit: 3, premium: false },
      error: null,
    });

    renderCard();

    const btn = await screen.findByTitle(/gerar v[ií]deo ia/i);
    fireEvent.click(btn);

    expect(navigateMock).toHaveBeenCalledWith("/story-video/book-1");
    expect(toastError).not.toHaveBeenCalled();
  });
});
