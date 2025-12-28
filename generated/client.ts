// Ethora.com platform, copyright: Dappros Ltd (c) 2026, all rights reserved
/**
 * Typed OpenAPI client powered by `openapi-fetch`.
 *
 * Generated types:
 *   - `generated/ethora-openapi.d.ts` (run `npm run openapi:generate`)
 *
 * Usage example:
 *
 * ```ts
 * import { createEthoraApiClient } from './generated/client'
 *
 * const api = createEthoraApiClient({
 *   baseUrl: 'https://api.ethoradev.com',
 *   getBearerToken: async () => process.env.ACCESS_TOKEN, // optional
 * })
 *
 * // api.client.GET('/v1/chats/my')
 * ```
 */

import createClient from 'openapi-fetch'
import type { paths } from './ethora-openapi'

export type EthoraPaths = paths

export function createEthoraApiClient(opts: {
  baseUrl: string
  getBearerToken?: () => string | undefined | Promise<string | undefined>
}) {
  const client = createClient<EthoraPaths>({
    baseUrl: opts.baseUrl,
    fetch: async (input, init) => {
      const token = opts.getBearerToken ? await opts.getBearerToken() : undefined
      const headers = new Headers((init && init.headers) || {})
      if (token) headers.set('Authorization', `Bearer ${token.replace(/^JWT\\s+/i, '')}`)
      return fetch(input, { ...init, headers })
    },
  })

  return { client }
}


