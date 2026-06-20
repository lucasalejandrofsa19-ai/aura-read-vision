import { describe, it, expect } from "vitest";
import { pickVideoMimeType, MP4_MIME, WEBM_MIME } from "./videoMimeType";

const chrome = { isTypeSupported: (t: string) => t === MP4_MIME || t === WEBM_MIME };
const firefox = { isTypeSupported: (t: string) => t === WEBM_MIME };
const ancient = { isTypeSupported: () => false };

describe("pickVideoMimeType", () => {
  it("returns MP4 on Chrome (supports avc1/aac)", () => {
    expect(pickVideoMimeType(chrome)).toEqual({ mimeType: MP4_MIME, ext: "mp4" });
  });

  it("falls back to WebM on Firefox (no MP4 encode support)", () => {
    expect(pickVideoMimeType(firefox)).toEqual({ mimeType: WEBM_MIME, ext: "webm" });
  });

  it("returns null when neither MP4 nor WebM is supported", () => {
    expect(pickVideoMimeType(ancient)).toBeNull();
  });

  it("returns null when MediaRecorder is unavailable", () => {
    expect(pickVideoMimeType(undefined)).toBeNull();
  });
});
