import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";

interface Highlight {
  id: string;
  page_number: number;
  text: string;
  color: string | null;
  created_at: string;
}

interface Note {
  id: string;
  note_text: string;
  page_number: number;
  created_at: string;
}

interface ExportOptions {
  includeHighlights: boolean;
  includeNotes: boolean;
  groupByPage: boolean;
  includeTimestamps: boolean;
  includeColors: boolean;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const MAX_W = PAGE_W - MARGIN * 2;

class PdfWriter {
  doc: jsPDF;
  y: number;

  constructor() {
    this.doc = new jsPDF({ unit: "mm", format: "a4" });
    this.doc.setFont("helvetica", "normal");
    this.y = MARGIN;
  }

  ensure(space: number) {
    if (this.y + space > PAGE_H - MARGIN) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  text(str: string, opts: { size?: number; bold?: boolean; italic?: boolean; color?: [number, number, number]; indent?: number } = {}) {
    const { size = 11, bold = false, italic = false, color = [30, 30, 30], indent = 0 } = opts;
    const style = bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";
    this.doc.setFont("helvetica", style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(color[0], color[1], color[2]);
    const lines = this.doc.splitTextToSize(str || "", MAX_W - indent);
    for (const line of lines) {
      this.ensure(size * 0.42 + 1.5);
      this.doc.text(line, MARGIN + indent, this.y);
      this.y += size * 0.42 + 1.5;
    }
  }

  spacer(mm = 3) {
    this.y += mm;
  }

  rule() {
    this.ensure(4);
    this.doc.setDrawColor(200);
    this.doc.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += 4;
  }

  save(name: string) {
    const blob = this.doc.output("blob");
    saveAs(blob, name);
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

export function exportHighlightsPDF(
  bookTitle: string,
  highlights: Highlight[],
  notes: Note[],
  options: ExportOptions,
) {
  const w = new PdfWriter();

  w.text(bookTitle, { size: 20, bold: true, color: [20, 20, 20] });
  w.spacer(1);
  w.text("Destaques e Anotações Exportados", { size: 12, color: [110, 110, 110] });
  w.text(new Date().toLocaleDateString("pt-BR"), { size: 9, color: [150, 150, 150] });
  w.spacer(2);
  w.rule();

  const hi = options.includeHighlights ? highlights : [];
  const no = options.includeNotes ? notes : [];

  if (options.groupByPage) {
    const pages = new Set<number>();
    hi.forEach((h) => pages.add(h.page_number));
    no.forEach((n) => pages.add(n.page_number));
    const sorted = Array.from(pages).sort((a, b) => a - b);
    for (const p of sorted) {
      w.spacer(2);
      w.text(`Página ${p}`, { size: 14, bold: true, color: [40, 40, 60] });
      w.spacer(1);
      for (const h of hi.filter((x) => x.page_number === p)) {
        w.text(`"${h.text}"`, { size: 11, italic: true, indent: 3 });
        if (options.includeColors && h.color) w.text(`Cor: ${h.color}`, { size: 9, color: [120, 120, 120], indent: 3 });
        if (options.includeTimestamps) w.text(fmtDate(h.created_at), { size: 8, color: [150, 150, 150], indent: 3 });
        w.spacer(2);
      }
      for (const n of no.filter((x) => x.page_number === p)) {
        w.text("Anotação:", { size: 10, bold: true, color: [59, 130, 246], indent: 3 });
        w.text(n.note_text, { size: 11, indent: 3 });
        if (options.includeTimestamps) w.text(fmtDate(n.created_at), { size: 8, color: [150, 150, 150], indent: 3 });
        w.spacer(2);
      }
    }
  } else {
    if (hi.length) {
      w.text("Destaques", { size: 14, bold: true, color: [40, 40, 60] });
      w.spacer(1);
      for (const h of hi) {
        w.text(`Página ${h.page_number}`, { size: 9, bold: true, color: [110, 110, 110] });
        w.text(`"${h.text}"`, { size: 11, italic: true });
        if (options.includeColors && h.color) w.text(`Cor: ${h.color}`, { size: 9, color: [120, 120, 120] });
        if (options.includeTimestamps) w.text(fmtDate(h.created_at), { size: 8, color: [150, 150, 150] });
        w.spacer(2);
      }
    }
    if (no.length) {
      w.spacer(2);
      w.text("Anotações", { size: 14, bold: true, color: [40, 40, 60] });
      w.spacer(1);
      for (const n of no) {
        w.text(`Página ${n.page_number}`, { size: 9, bold: true, color: [110, 110, 110] });
        w.text(n.note_text, { size: 11 });
        if (options.includeTimestamps) w.text(fmtDate(n.created_at), { size: 8, color: [150, 150, 150] });
        w.spacer(2);
      }
    }
  }

  w.save(`${bookTitle}-export-${Date.now()}.pdf`);
}

export function exportSimpleTextPDF(title: string, body: string, filename: string) {
  const w = new PdfWriter();
  w.text(title, { size: 20, bold: true });
  w.spacer(1);
  w.text(new Date().toLocaleDateString("pt-BR"), { size: 9, color: [150, 150, 150] });
  w.spacer(2);
  w.rule();
  // Split into paragraphs
  const paragraphs = body.split(/\n{2,}/);
  for (const p of paragraphs) {
    w.text(p.trim(), { size: 11 });
    w.spacer(3);
  }
  w.save(filename);
}
