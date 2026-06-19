// Sincroniza estado de geração da capa no banco (cover_status) + cache local
// para feedback otimista enquanto o invalidate da query não completa.

import { supabase } from "@/integrations/supabase/client";

const KEY = "aura:cover-failed";

const read = (): Record<string, true> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};

const write = (map: Record<string, true>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
};

export const markCoverFailed = async (bookId: string) => {
  if (!bookId) return;
  const m = read();
  m[bookId] = true;
  write(m);
  // Persistir no DB para sincronizar entre dispositivos/sessões
  await supabase
    .from("books")
    .update({ cover_status: "failed" })
    .eq("id", bookId)
    .then(() => {}, () => {});
};

export const clearCoverFailed = async (bookId: string) => {
  if (!bookId) return;
  const m = read();
  delete m[bookId];
  write(m);
  await supabase
    .from("books")
    .update({ cover_status: "ready" })
    .eq("id", bookId)
    .then(() => {}, () => {});
};

// Cache local: usado como fallback otimista antes do refetch trazer cover_status
export const isCoverFailedLocal = (bookId: string): boolean => {
  if (!bookId) return false;
  return !!read()[bookId];
};
