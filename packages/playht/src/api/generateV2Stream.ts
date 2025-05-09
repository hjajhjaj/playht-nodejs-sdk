import type { AxiosRequestConfig } from 'axios';
import type { V2ApiOptions } from './apiCommon';
import { type PlayDialogTurboEngineStreamOptions } from '../index';
import { keepAliveHttpsAgent } from './internal/http';
import { convertError } from './internal/convertError';
import { mapPlayDialogTurboVoice } from './internal/tts/dialog-turbo/PlayDialogTurboVoice';
import { extractErrorHeadersAndStatusIfTheyExist, getAxiosClient } from './internal/config/getAxiosClient';
import { PlayRequestConfigWithDefaults } from './internal/config/PlayRequestConfig';
import { debugLog } from './internal/debug/debugLog';
import { SDKSettings } from './APISettingsStore';

export async function generateV2Stream(
  text: string,
  voice: string,
  options: V2ApiOptions | PlayDialogTurboEngineStreamOptions,
  reqConfig: PlayRequestConfigWithDefaults,
): Promise<NodeJS.ReadableStream> {
  const { apiKey, userId } = reqConfig.settings;

  const outputFormat = options?.outputFormat || 'mp3';
  const accept = outputFormat === 'mp3' ? 'audio/mpeg' : 'audio/basic';

  const data = {
    text,
    voice_engine: options?.voiceEngine,
    ...(options?.voiceEngine === 'PlayDialog-turbo'
      ? {
          voice: mapPlayDialogTurboVoice(options?.voiceId),
          language: options?.language,
        }
      : {
          voice,
          quality: options?.quality || 'medium',
          output_format: outputFormat,
          speed: options?.speed || 1,
          sample_rate: options?.sampleRate || 24000,
          seed: options?.seed,
          temperature: options?.temperature,
          emotion: options?.emotion,
          voice_guidance: options?.voiceGuidance,
          text_guidance: options?.textGuidance,
          style_guidance: options?.styleGuidance,
        }),
  };
  const streamOptions = {
    method: 'POST',
    url: 'https://api.play.ht/api/v2/tts/stream',
    headers: {
      accept,
      'content-type': 'application/json',
      AUTHORIZATION: apiKey,
      'X-USER-ID': userId,
    },
    data,
    responseType: 'stream',
    httpsAgent: keepAliveHttpsAgent,
    signal: reqConfig.signal,
  } as const satisfies AxiosRequestConfig;

  const response = await getAxiosClient(reqConfig.settings)(streamOptions).catch((error: unknown) => {
    debugRequest(reqConfig.settings, data, extractErrorHeadersAndStatusIfTheyExist(error));
    return convertError(error);
  });
  debugRequest(reqConfig.settings, data, response);
  return response.data;
}

function debugRequest(
  sdkSettings: Partial<SDKSettings> | undefined,
  payloadForEngine: any,
  response: { headers: Record<string, any>; status: number; errorMessage?: string },
) {
  debugLog(
    sdkSettings,
    `Request - Inference Backend: v2-tts-stream - Params: ${JSON.stringify(payloadForEngine)} - Request-ID: ${
      response.headers['x-play-request-id']
    } - Status: ${response.status}${response.errorMessage ? ` - Error: ${response.errorMessage}` : ''}`,
  );
}
