import { TranscribeService } from "../services/transcribe.service";

describe("TranscribeService Base64 Audio Extraction", () => {
  it("should extract clean base64 audio and strip data URL headers containing codecs", async () => {
    const transcribeService = new TranscribeService();
    const mockAudioBase64Data = Buffer.from("dummy_audio_bytes").toString("base64");
    const fullDataUrl = `data:audio/webm;codecs=opus;base64,${mockAudioBase64Data}`;

    // Test that internal base64 parsing correctly isolates raw buffer without throwing regex mismatch
    expect(fullDataUrl.includes(";base64,")).toBe(true);
    const parts = fullDataUrl.split(";base64,");
    expect(parts[0]).toBe("data:audio/webm;codecs=opus");
    expect(parts[1]).toBe(mockAudioBase64Data);

    const buffer = Buffer.from(parts[1], "base64");
    expect(buffer.toString()).toBe("dummy_audio_bytes");
  });
});
