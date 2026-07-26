import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

@Injectable()
export class LangchainClient {
  private readonly logger = new Logger(LangchainClient.name);
  private llm: ChatOpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getLlm(): ChatOpenAI {
    if (this.llm) return this.llm;

    const apiKey = this.config.get<string>('AI_API_KEY');
    if (!apiKey) {
      this.logger.error('AI_API_KEY is not configured');
      throw new Error('AI_API_KEY is not configured');
    }

    const model = this.config.get<string>('AI_MODEL', 'qwen-max');
    const baseURL = this.config.get<string>(
      'AI_BASE_URL',
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    );

    this.logger.log(`Initializing LLM model=${model} baseURL=${baseURL}`);

    this.llm = new ChatOpenAI({
      apiKey,
      model,
      configuration: { baseURL },
    });
    return this.llm;
  }

  async invoke(system: string, user: string): Promise<string> {
    const model = this.config.get<string>('AI_MODEL', 'qwen-max');
    this.logger.log(`AI invoke start model=${model} promptLen=${user.length}`);

    const start = Date.now();
    let lastError: Error | null = null;

    // 重试机制：最多重试 3 次
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await this.getLlm().invoke([
          { role: 'system', content: system },
          { role: 'human', content: user },
        ]);
        const content = result.content;
        const text = typeof content === 'string' ? content : JSON.stringify(content);
        this.logger.log(`AI invoke ok ${Date.now() - start}ms answerLen=${text.length}`);
        return text;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const message = lastError.message;

        if (attempt < 3) {
          this.logger.warn(`AI invoke attempt ${attempt} failed, retrying in ${1000 * attempt}ms: ${message}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } else {
          this.logger.error(`AI invoke failed after ${attempt} attempts ${Date.now() - start}ms: ${message}`);
        }
      }
    }

    throw lastError;
  }

  async *stream(
    system: string,
    messages: Array<{ role: 'human' | 'assistant' | 'user'; content: string }>,
  ): AsyncGenerator<string> {
    const model = this.config.get<string>('AI_MODEL', 'qwen-max');
    this.logger.log(`AI stream start model=${model} messages=${messages.length}`);

    const start = Date.now();
    try {
      const llmStream = await this.getLlm().stream([
        { role: 'system', content: system },
        ...messages,
      ]);

      for await (const chunk of llmStream) {
        const content = chunk.content;
        let text = '';
        if (typeof content === 'string') {
          text = content;
        } else if (Array.isArray(content)) {
          text = content
            .map((part) => {
              if (typeof part === 'string') return part;
              if (
                part &&
                typeof part === 'object' &&
                'text' in part &&
                typeof (part as { text: unknown }).text === 'string'
              ) {
                return (part as { text: string }).text;
              }
              return '';
            })
            .join('');
        }
        if (text) yield text;
      }

      this.logger.log(`AI stream ok ${Date.now() - start}ms`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI stream failed ${Date.now() - start}ms: ${message}`);
      throw err instanceof Error ? err : new Error(message);
    }
  }
}