import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';

export function createEmbeddings(config: ConfigService): OpenAIEmbeddings {
  const apiKey = config.get<string>('AI_API_KEY');
  if (!apiKey) {
    throw new ServiceUnavailableException('AI_API_KEY is not configured');
  }

  const model = config.get<string>('AI_EMBEDDING_MODEL', 'text-embedding-v3');
  const baseURL = config.get<string>(
    'AI_BASE_URL',
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
  );

  return new OpenAIEmbeddings({
    apiKey,
    model,
    configuration: { baseURL },
  });
}
