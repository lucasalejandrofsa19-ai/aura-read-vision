/**
 * Verifica que:
 *  - Contas Premium NÃO veem o aviso/contador de imagens geradas.
 *  - Contas gratuitas continuam vendo o contador (e o alerta quando atingem o limite).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HighlightImageDialog } from "@/components/HighlightImageDialog";

const hasPremiumAccessMock = vi.fn();
vi.mock("@/hooks/useUserData", () => ({
  useUserData: () => ({ hasPremiumAccess: hasPremiumAccessMock() }),
}));

vi.mock("@/lib/storageUrl", () => ({
  getSignedStorageUrl: vi.fn(async () => "https://example.test/img.png"),
}));

// Mock chainable supabase client
const imageCountRef = { value: 0 };
vi.mock("@/integrations/supabase/client", () => {
  const galleryQuery: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };
  const countQuery: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn(() => Promise.resolve({ count: imageCountRef.value, error: null })),
  };
  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
      from: vi.fn(() => {
        // Return a proxy that supports both flows
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) return countQuery;
            return galleryQuery;
          },
        };
      }),
      functions: { invoke: vi.fn() },
      storage: { from: vi.fn(() => ({ remove: vi.fn() })) },
    },
  };
});

const renderDialog = () =>
  render(
    <MemoryRouter>
      <HighlightImageDialog text="Um destaque de teste" highlightId="hl-1" />
    </MemoryRouter>
  );

describe("HighlightImageDialog — visibilidade do contador de imagens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("conta Premium: NÃO exibe contador nem aviso de limite", async () => {
    hasPremiumAccessMock.mockReturnValue(true);
    imageCountRef.value = 5; // acima do limite

    renderDialog();
    fireEvent.click(screen.getByTitle(/gerar imagem com ia/i));

    // Espera o diálogo abrir
    await waitFor(() =>
      expect(screen.getByText(/gerar imagem do destaque/i)).toBeInTheDocument()
    );

    // Deve dar tempo do loadImageCount resolver
    await waitFor(() => {
      expect(screen.queryByText(/imagens geradas:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/imagens gratuitas/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/assine o plano premium\/pro/i)).not.toBeInTheDocument();
    });
  });

  it("conta grátis abaixo do limite: exibe contador de imagens gratuitas restantes", async () => {
    hasPremiumAccessMock.mockReturnValue(false);
    imageCountRef.value = 1;

    renderDialog();
    fireEvent.click(screen.getByTitle(/gerar imagem com ia/i));

    await waitFor(() =>
      expect(screen.getByText(/gerar imagem do destaque/i)).toBeInTheDocument()
    );

    await waitFor(() => {
      expect(screen.getByText(/imagens geradas:/i)).toBeInTheDocument();
      expect(screen.getByText(/gratuitas restantes/i)).toBeInTheDocument();
    });
  });

  it("conta grátis no limite: exibe o alerta com CTA para Premium/Pro", async () => {
    hasPremiumAccessMock.mockReturnValue(false);
    imageCountRef.value = 3;

    renderDialog();
    fireEvent.click(screen.getByTitle(/gerar imagem com ia/i));

    await waitFor(() =>
      expect(screen.getByText(/gerar imagem do destaque/i)).toBeInTheDocument()
    );

    await waitFor(() => {
      expect(
        screen.getByText(/você já usou 3 de 3 imagens gratuitas/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/assine o plano premium\/pro/i)).toBeInTheDocument();
    });
  });
});
