import { Context, Schema } from 'koishi'
import _proxy, { FastProxyOptions } from 'fast-proxy'
import { IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeaders, RequestOptions, ServerResponse } from 'node:http';

export type Stream = ReadableStream | WritableStream

declare module 'koishi' {
  interface Context {
    proxy: (options?: FastProxyOptions) => {
      enable(
        originReq: IncomingMessage,
        originRes: ServerResponse,
        source: string,
        opts?: {
          base?: string;
          onResponse?(req: IncomingMessage, res: ServerResponse, stream: Stream): void;
          rewriteRequestHeaders?(req: IncomingMessage, headers: IncomingHttpHeaders): IncomingHttpHeaders;
          rewriteHeaders?(headers: OutgoingHttpHeaders): OutgoingHttpHeaders;
          request?: RequestOptions;
          queryString?: string;
        }
      ): void;
      close(): void;
    }
  }
}

export const name = 'proxy'

export interface Config {
  port?: number
}

export const Config: Schema<Config> = Schema.object({
  port: Schema.number().min(5600).max(65535).default(5665).description('proxy port'),
}).description('Proxy config')

export function apply(ctx: Context, config: Config) {
  const pool = new Map<string, ReturnType<Context['proxy']>>()
  ctx.on('dispose', () => {
    for (const proxy of pool.values()) {
      if (proxy)
        proxy.close()
    }
  })

  ctx.proxy = (options?: FastProxyOptions) => {
    options = options || {
      base: `http://127.0.0.1:${config.port}`,
    }

    ctx.proxy[Context.current]?.collect('proxy', () => {
      const proxy = pool.get(options.base)
      if (proxy) return proxy
      return _proxy(options)
    })

    const { proxy: enable, close } = _proxy(options)
    const proxy = { enable, close }
    pool.set(options.base, proxy)
    return proxy
  }
}

Context.service('proxy')
