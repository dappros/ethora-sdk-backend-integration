// Ethora.com platform, copyright: Dappros Ltd (c) 2026, all rights reserved
/**
 * Fetch Ethora OpenAPI spec (swagger.json) from a running backend.
 *
 * Usage:
 *   OPENAPI_URL=https://api.ethoradev.com/api-docs/swagger.json npm run openapi:fetch
 *
 * Output:
 *   ./openapi/swagger.json
 */

import fs from 'node:fs'
import path from 'node:path'

const OPENAPI_URL = process.env.OPENAPI_URL || 'https://api.ethoradev.com/api-docs/swagger.json'
const OUT_FILE = path.resolve(process.cwd(), 'openapi', 'swagger.json')

async function main() {
  console.log(`[openapi:fetch] Fetching: ${OPENAPI_URL}`)

  const res = await fetch(OPENAPI_URL, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`[openapi:fetch] Failed (${res.status}) ${OPENAPI_URL}\n${body.slice(0, 500)}`)
  }

  const json = await res.json()

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(json, null, 2) + '\n', 'utf8')

  console.log(`[openapi:fetch] Wrote: ${OUT_FILE}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


