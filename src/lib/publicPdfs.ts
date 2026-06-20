/**
 * Registro central de PDFs públicos hospedados no CDN do Lovable.
 *
 * Como adicionar um novo PDF público:
 * 1) Faça upload via CLI: `lovable-assets create --file <arquivo> --filename <nome>.pdf > src/assets/public-pdfs/<nome>.pdf.asset.json`
 * 2) Importe o ponteiro abaixo e adicione um item em PUBLIC_PDFS.
 *
 * Os arquivos ficam disponíveis para QUALQUER usuário (autenticado ou não) baixar.
 */
import bibliaTNM from "@/assets/public-pdfs/biblia-traducao-novo-mundo.pdf.asset.json";
import bibliaSBTB from "@/assets/public-pdfs/biblia-sagrada-sbtb.pdf.asset.json";

export interface PublicPdf {
  id: string;
  title: string;
  author?: string;
  description?: string;
  url: string;
  sizeBytes: number;
  filename: string;
}
export const PUBLIC_PDFS_LABEL = "PDFs Públicos";
export const PUBLIC_PDFS_TOOLTIP = "PDFs Públicos (abre em nova aba)";
export const PUBLIC_PDFS_DESCRIPTION =
  "Abre o catálogo de PDFs públicos em uma nova aba do navegador, sem interromper a página atual.";


export const PUBLIC_PDFS: PublicPdf[] = [
  {
    id: "biblia-traducao-novo-mundo",
    title: "Bíblia Sagrada — Tradução do Novo Mundo",
    author: "Watch Tower Bible & Tract Society of Pennsylvania",
    description: "Tradução completa das Escrituras Sagradas disponível gratuitamente.",
    url: bibliaTNM.url,
    sizeBytes: bibliaTNM.size,
    filename: bibliaTNM.original_filename,
  },
  {
    id: "biblia-sagrada-sbtb",
    title: "Bíblia Sagrada — SBTB",
    author: "Sociedade Bíblica Trinitariana do Brasil",
    description: "Edição completa da Bíblia Sagrada (SBTB) disponível gratuitamente.",
    url: bibliaSBTB.url,
    sizeBytes: bibliaSBTB.size,
    filename: bibliaSBTB.original_filename,
  },
];

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
