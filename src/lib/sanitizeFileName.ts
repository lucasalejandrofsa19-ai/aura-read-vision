// Remove acentos e caracteres não suportados pelo Supabase Storage.
// Mantém sempre a extensão .pdf ao final.
export const sanitizeFileName = (name: string) => {
  const base = name.replace(/\.pdf$/i, "");
  const clean =
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 80) || "documento";
  return `${clean}.pdf`;
};
