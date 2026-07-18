import { describe, it, expect } from "vitest";
import { validatePdfFile, MAX_PDF_SIZE_BYTES } from "./validatePdfFile";

function makeFile(
  parts: BlobPart[],
  name: string,
  type = "application/pdf",
  sizeOverride?: number,
): File {
  const file = new File(parts, name, { type });
  if (sizeOverride !== undefined) {
    Object.defineProperty(file, "size", { value: sizeOverride });
  }
  return file;
}

const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7

describe("validatePdfFile", () => {
  it("rejeita arquivos sem extensão/MIME de PDF com reason=not_pdf", async () => {
    const file = makeFile(["hello"], "notes.txt", "text/plain");
    const result = await validatePdfFile(file);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("not_pdf");
      expect(result.title).toMatch(/PDF/i);
    }
  });

  it("rejeita PDFs acima de 50MB com reason=too_large", async () => {
    const file = makeFile([PDF_HEADER], "big.pdf", "application/pdf", MAX_PDF_SIZE_BYTES + 1);
    const result = await validatePdfFile(file);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("too_large");
      expect(result.title).toMatch(/50MB/);
    }
  });

  it("rejeita arquivo vazio com reason=invalid_magic_bytes_empty", async () => {
    const file = makeFile([], "empty.pdf", "application/pdf");
    const result = await validatePdfFile(file);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("invalid_magic_bytes_empty");
      expect(result.description).toBeTruthy();
    }
  });

  it("rejeita arquivo com extensão .pdf mas sem assinatura %PDF- com reason=invalid_magic_bytes_no_signature", async () => {
    const fake = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG
    const file = makeFile([fake], "fake.pdf", "application/pdf");
    const result = await validatePdfFile(file);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("invalid_magic_bytes_no_signature");
    }
  });

  it("aceita PDF válido com assinatura %PDF- correta", async () => {
    const file = makeFile([PDF_HEADER], "valid.pdf", "application/pdf");
    const result = await validatePdfFile(file);
    expect(result.ok).toBe(true);
  });

  it("aceita PDF válido identificado apenas pela extensão (MIME vazio)", async () => {
    const file = makeFile([PDF_HEADER], "valid.PDF", "");
    const result = await validatePdfFile(file);
    expect(result.ok).toBe(true);
  });
});
