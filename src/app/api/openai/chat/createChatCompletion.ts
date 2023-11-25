import { OpenAIStream, StreamingTextResponse } from 'ai';
import OpenAI from 'openai';

import { createErrorResponse } from '@/app/api/openai/errorResponse';
import { getServerConfig } from '@/config/server';
import { ChatErrorType } from '@/types/fetch';
import { OpenAIChatStreamPayload } from '@/types/openai/chat';

interface CreateChatCompletionOptions {
  openai: OpenAI;
  payload: OpenAIChatStreamPayload;
}

export const createChatCompletion = async ({ payload, openai }: CreateChatCompletionOptions) => {
  // ============  1. preprocess messages   ============ //
  const { messages, ...params } = payload;

  // remove unnecessary fields like `plugins` or `files` by lobe-chat
  const formatMessages = messages.map((m) => ({
    content: m.content,
    name: m.name,
    role: m.role,
  })) as OpenAI.ChatCompletionMessageParam[];

  // 硬编码限制gpt-4的使用
  if (
    messages.length > 2 &&
    openai.apiKey === getServerConfig().OPENAI_API_KEY &&
    params.model.startsWith('gpt-4')
  ) {
    params.model = 'gpt-3.5-turbo-16k';
  }

  // ============  2. send api   ============ //

  try {
    const response = await openai.chat.completions.create(
      {
        messages: formatMessages,
        ...params,
        stream: true,
      },
      { headers: { Accept: '*/*' } },
    );
    const stream = OpenAIStream(response);
    return new StreamingTextResponse(stream);
  } catch (error) {
    // Check if the error is an OpenAI APIError
    if (error instanceof OpenAI.APIError) {
      let errorResult: any;

      // if error is definitely OpenAI APIError, there will be an error object
      if (error.error) {
        errorResult = error.error;
      }
      // Or if there is a cause, we use error cause
      // This often happened when there is a bug of the `openai` package.
      else if (error.cause) {
        errorResult = error.cause;
      }
      // if there is no other request error, the error object is a Response like object
      else {
        errorResult = { headers: error.headers, stack: error.stack, status: error.status };
      }

      // track the error at server side
      console.error(errorResult);

      return createErrorResponse(ChatErrorType.OpenAIBizError, {
        endpoint: openai.baseURL,
        error: errorResult,
      });
    }

    // track the non-openai error
    console.error(error);

    // return as a GatewayTimeout error
    return createErrorResponse(ChatErrorType.InternalServerError, {
      endpoint: openai.baseURL,
      error: JSON.stringify(error),
    });
  }
};
