import { describe, it, expect } from "vitest";
import { validatePdfMagicBytes, type PdfMagicBytesResult } from "./validatePdfMagicBytes";

function makeBlob(bytes: number[] | Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

function assertFail(r: PdfMagicBytesResult): asserts r is Extract<PdfMagicBytesResult, { ok: false }> {
  if (r.ok) throw new Error("expected failure result, got success");
}

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]; // %PDF-1.7

describe("validatePdfMagicBytes", () => {
  it("aceita PDF real (%PDF-1.7 no início)", async () => {
    const r = await validatePdfMagicBytes(makeBlob([...PDF_HEADER, 0x0a, 0x25, 0xe2]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe("1.7");
  });

  it("aceita PDF com bytes de lixo antes da assinatura (dentro dos primeiros 1024)", async () => {
    const padding = new Array(200).fill(0x20);
    const r = await validatePdfMagicBytes(makeBlob([...padding, ...PDF_HEADER]));
    expect(r.ok).toBe(true);
  });

  it("rejeita arquivo vazio com motivo 'empty'", async () => {
    const r = await validatePdfMagicBytes(new Blob([], { type: "application/pdf" }));
    assertFail(r);
    expect(r.reason).toBe("empty");
    expect(r.message).toMatch(/vazio/i);
  });

  it("rejeita arquivo sem assinatura %PDF- (ex.: imagem renomeada para .pdf)", async () => {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00];
    const r = await validatePdfMagicBytes(makeBlob(png));
    assertFail(r);
    expect(r.reason).toBe("no_signature");
    expect(r.message).toMatch(/não é um PDF real/i);
  });

  it("rejeita arquivo cuja assinatura aparece só após 1024 bytes", async () => {
    const padding = new Array(1100).fill(0x20);
    const r = await validatePdfMagicBytes(makeBlob([...padding, ...PDF_HEADER]));
    assertFail(r);
    expect(r.reason).toBe("no_signature");
  });
});
