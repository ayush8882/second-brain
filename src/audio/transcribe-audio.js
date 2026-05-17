import { DeepgramClient } from "@deepgram/sdk";
import { createReadStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultAudioPath = join(scriptDir, "test-audio.mp3");

const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

async function transcribeAudio(audioFilePath) {
  console.log(`Transcribing: ${audioFilePath}\n`);

  const result = await deepgram.listen.v1.media.transcribeFile(
    createReadStream(audioFilePath),
    {
      model: "nova-2", // best accuracy, handles Indian English well
      smart_format: true, // adds punctuation automatically
      language: "en-IN", // Indian English — important for your use case
    },
  );

  const transcript = result.results.channels[0].alternatives[0].transcript;
  const confidence = result.results.channels[0].alternatives[0].confidence;
  const duration = result.metadata.duration;

  console.log("Transcript:", transcript);
  console.log("Confidence:", (confidence * 100).toFixed(1) + "%");
  console.log("Audio duration:", duration + "s");
  console.log("Cost:", `$${(duration * 0.0043).toFixed(4)}`); // nova-2 pricing

  return transcript;
}

await transcribeAudio(process.argv[2] ?? defaultAudioPath);
c