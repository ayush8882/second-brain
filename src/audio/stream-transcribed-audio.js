// lesson12-exercise2-realtime-stt.js
// This is the pattern used in real voicebots.
// Audio streams in, text streams out — simultaneously.
import { DeepgramClient } from "@deepgram/sdk";
import { createReadStream } from "node:fs";
import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });
const scriptDir = dirname(fileURLToPath(import.meta.url));

const defaultAudioPath = join(scriptDir, "test-audio.mp3");

async function streamingTranscribe(audioFilePath) {
  const connection = await deepgram.listen.v1.connect({
    model: "nova-2",
    smart_format: true,
    language: "en-IN",
    interim_results: true,
    endpointing: 300,
  });

  const transcript = [];

  return new Promise((resolve, reject) => {
    connection.on("error", reject);

    connection.on("open", () => {
      console.log("✓ Deepgram connection open\n");

      const audioStream = createReadStream(audioFilePath);
      audioStream.on("data", (chunk) => {
        try {
          connection.sendMedia(chunk);
        } catch (e) {
          audioStream.destroy();
          reject(e);
        }
      });
      audioStream.on("error", reject);
      audioStream.on("end", () => {
        connection.sendCloseStream({ type: "CloseStream" });
      });
    });

    connection.on("message", (data) => {
      if (!data || typeof data !== "object" || data.type !== "Results") return;

      const text = data.channel.alternatives[0]?.transcript ?? "";
      const isFinal = data.is_final;

      if (!text) return;

      if (isFinal) {
        console.log(`[FINAL] "${text}"`);
        transcript.push(text);
      } else {
        process.stdout.write(`\r[live] ${text}                    `);
      }
    });

    connection.on("close", () => {
      console.log("\n✓ Deepgram connection closed");
      resolve(transcript.join(" "));
    });

    connection.connect();
  });
}

const fullTranscript = await streamingTranscribe(
  process.argv[2] ?? defaultAudioPath,
);
console.log("\nFull transcript:", fullTranscript);
