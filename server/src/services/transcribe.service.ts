import { toFile } from "openai";
import { openai } from "../config/openai";

export class TranscribeService {
  public async transcribeAudio(base64Audio: string): Promise<string> {
    if (!base64Audio) {
      throw new Error("No audio payload provided");
    }

    let audioBuffer: Buffer;
    let extension = "webm";

    if (base64Audio.includes(";base64,")) {
      const parts = base64Audio.split(";base64,");
      const mime = parts[0].toLowerCase();
      if (mime.includes("mp3")) extension = "mp3";
      else if (mime.includes("wav")) extension = "wav";
      else if (mime.includes("mp4") || mime.includes("aac")) extension = "mp4";
      else if (mime.includes("m4a")) extension = "m4a";
      else if (mime.includes("ogg") || mime.includes("oga")) extension = "ogg";
      else if (mime.includes("flac")) extension = "flac";
      else extension = "webm";

      audioBuffer = Buffer.from(parts[1], "base64");
    } else {
      audioBuffer = Buffer.from(base64Audio, "base64");
    }

    if (audioBuffer.length === 0) {
      throw new Error("Audio buffer is empty");
    }

    try {
      console.log(`[TRANSCRIBE SERVICE] Transcribing ${audioBuffer.length} bytes of audio (${extension}) via OpenAI Whisper-1...`);
      const file = await toFile(audioBuffer, `voice.${extension}`);
      const response = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: "uk",
      });

      const text = String(response.text || "").trim();
      console.log("[TRANSCRIBE SERVICE] Whisper result:", text);
      return text;
    } catch (error: any) {
      console.error("[TRANSCRIBE SERVICE ERROR]", error);
      throw new Error(error.message || "Failed to transcribe audio with Whisper");
    }
  }
}
