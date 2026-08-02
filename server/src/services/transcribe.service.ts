import fs from "fs";
import path from "path";
import os from "os";
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
      else if (mime.includes("m4a") || mime.includes("mp4")) extension = "m4a";
      else if (mime.includes("ogg")) extension = "ogg";
      else extension = "webm";

      audioBuffer = Buffer.from(parts[1], "base64");
    } else {
      audioBuffer = Buffer.from(base64Audio, "base64");
    }

    if (audioBuffer.length === 0) {
      throw new Error("Audio buffer is empty");
    }

    const tempFilePath = path.join(os.tmpdir(), `twys_voice_${Date.now()}.${extension}`);
    await fs.promises.writeFile(tempFilePath, audioBuffer);

    try {
      console.log(`[TRANSCRIBE SERVICE] Transcribing ${audioBuffer.length} bytes of audio via OpenAI Whisper-1...`);
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        language: "uk",
      });

      const text = String(response.text || "").trim();
      console.log("[TRANSCRIBE SERVICE] Whisper result:", text);
      return text;
    } catch (error: any) {
      console.error("[TRANSCRIBE SERVICE ERROR]", error);
      throw new Error(error.message || "Failed to transcribe audio with Whisper");
    } finally {
      fs.promises.unlink(tempFilePath).catch(() => {});
    }
  }
}
