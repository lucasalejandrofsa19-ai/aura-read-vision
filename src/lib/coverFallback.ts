// Marca livros cuja geração de capa falhou para exibir placeholder de fallback
// no BookCard em vez do spinner "Gerando capa…" eterno.

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
    /* storage cheio/indisponível — ignorar */
  }
};

export const markCoverFailed = (bookId: string) => {
  if (!bookId) return;
  const m = read();
  m[bookId] = true;
  write(m);
};

export const clearCoverFailed = (bookId: string) => {
  if (!bookId) return;
  const m = read();
  delete m[bookId];
  write(m);
};

export const isCoverFailed = (bookId: string): boolean => {
  if (!bookId) return false;
  return !!read()[bookId];
};
