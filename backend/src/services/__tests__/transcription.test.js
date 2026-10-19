/**
 * Unit tests for the provider-routed audio transcription dispatcher.
 *
 * Run with:
 *   node --test src/services/__tests__/transcription.test.js
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';

import { transcribeAudio } from '../interviewService.js';

function wavFixture() {
  const audio = Buffer.alloc(16044);
  audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(16000, 24); audio.writeUInt32LE(32000, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
  audio.write('data', 36); audio.writeUInt32LE(16000, 40); return audio;
}

describe('transcribeAudio — provider routing', () => {
  test('OpenAI adapter: calls audio.transcriptions.create', async () => {
    let capturedArgs = null;
    const provider = {
      providerName: 'openai',
      modelName: 'gpt-4o-mini',
      client: {
        audio: {
          transcriptions: {
            create: async (args) => {
              capturedArgs = args;
              return { text: 'hello world' };
            }
          }
        }
      }
    };

    const result = await transcribeAudio(
      { audioBuffer: wavFixture(), mimeType: 'audio/wav', language: 'en' },
      provider
    );

    assert.equal(result.text, 'hello world');
    assert.equal(capturedArgs.model, 'whisper-1');
    assert.equal(capturedArgs.language, 'en');
  });

  test('Groq adapter: uses whisper-large-v3-turbo model', async () => {
    let capturedArgs = null;
    const provider = {
      providerName: 'groq',
      modelName: 'llama-3.3-70b-versatile',
      client: {
        audio: {
          transcriptions: {
            create: async (args) => {
              capturedArgs = args;
              return { text: 'hola mundo' };
            }
          }
        }
      }
    };

    const result = await transcribeAudio(
      { audioBuffer: wavFixture(), mimeType: 'audio/wav', language: 'es' },
      provider
    );

    assert.equal(result.text, 'hola mundo');
    assert.equal(capturedArgs.model, 'whisper-large-v3-turbo');
  });

  test('Gemini adapter: uses inline audio + prompt', async () => {
    let capturedArgs = null;
    const provider = {
      providerName: 'gemini',
      model: {
        generateContent: async (args) => {
          capturedArgs = args;
          return { response: { text: () => 'transcribed text' } };
        }
      }
    };

    const result = await transcribeAudio(
      { audioBuffer: wavFixture(), mimeType: 'audio/wav', language: 'ja' },
      provider
    );

    assert.equal(result.text, 'transcribed text');
    assert.ok(capturedArgs.contents[0].parts[0].text.includes('ja'));
    assert.equal(capturedArgs.contents[0].parts[1].inlineData.mimeType, 'audio/wav');
    assert.ok(capturedArgs.contents[0].parts[1].inlineData.data.length > 0);
  });

  test('Unsupported provider shape: throws descriptive error', async () => {
    const provider = {
      providerName: 'openai',
      modelName: 'gpt-4o-mini',
      client: { /* no audio */ }
    };

    await assert.rejects(
      () => transcribeAudio(
        { audioBuffer: Buffer.from([1]), mimeType: 'audio/webm', language: 'en' },
        provider
      ),
      /does not support audio transcription/
    );
  });

  test('Unknown provider name: throws', async () => {
    const provider = {
      providerName: 'unknown-provider',
      generateContent: async () => ({ text: '' })
    };

    await assert.rejects(
      () => transcribeAudio(
        { audioBuffer: Buffer.from([1]), mimeType: 'audio/webm', language: 'en' },
        provider
      ),
      /Audio transcription is not supported/
    );
  });
  test('request cancellation reaches provider signal before service settles', async () => {
    const controller = new AbortController();
    const provider = { providerName: 'openai', client: { audio: { transcriptions: { create: async (_args, options) => {
      controller.abort(new Error('cancelled'));
      options.signal.throwIfAborted();
    } } } } };
    await assert.rejects(() => transcribeAudio({ audioBuffer: wavFixture(), signal: controller.signal }, provider), /cancelled/);
  });
});
