import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';

/**
 * Convert a WAV audio buffer to MP3 at 192kbps using FFmpeg.
 * Uses temp files for FFmpeg I/O, cleans up after conversion.
 * @param {Buffer} wavBuffer - The input WAV file buffer
 * @returns {Promise<Buffer>} - The converted MP3 file buffer
 */
export async function convertWavToMp3(wavBuffer) {
  const id = randomBytes(8).toString('hex');
  const inputPath = join(tmpdir(), `cdn-wav-${id}.wav`);
  const outputPath = join(tmpdir(), `cdn-mp3-${id}.mp3`);

  try {
    // Write WAV buffer to temp file
    await fs.writeFile(inputPath, wavBuffer);

    // Convert WAV → MP3 at 192kbps
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .format('mp3')
        .on('error', (err) => reject(new Error(`FFmpeg conversion failed: ${err.message}`)))
        .on('end', () => resolve())
        .save(outputPath);
    });

    // Read the converted MP3 into a buffer
    const mp3Buffer = await fs.readFile(outputPath);
    return mp3Buffer;
  } finally {
    // Clean up temp files
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}
