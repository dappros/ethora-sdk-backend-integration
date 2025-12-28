// Ethora.com platform, copyright: Dappros Ltd (c) 2026, all rights reserved
/**
 * Convert OpenAPI to Postman collection.
 *
 * Input:
 *   ./openapi/swagger.json
 *
 * Output:
 *   ./postman/ethora-api.postman_collection.json
 */

import fs from 'node:fs'
import path from 'node:path'
import converter from 'openapi-to-postmanv2'

const IN_FILE = path.resolve(process.cwd(), 'openapi', 'swagger.json')
const OUT_FILE = path.resolve(process.cwd(), 'postman', 'ethora-api.postman_collection.json')

async function main() {
  if (!fs.existsSync(IN_FILE)) {
    throw new Error(`[openapi:postman] Missing ${IN_FILE}. Run: npm run openapi:fetch`)
  }

  const openapi = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'))

  const options = {
    folderStrategy: 'Tags',
    // Keep original endpoint order as much as possible
    requestParametersResolution: 'Example',
    schemaFaker: true,
  }

  console.log('[openapi:postman] Converting OpenAPI -> Postman collection...')
  const result = await new Promise((resolve, reject) => {
    converter.convert({ type: 'json', data: openapi }, options, (err, conversionResult) => {
      if (err) return reject(err)
      return resolve(conversionResult)
    })
  })

  if (!result || result.result !== true) {
    throw new Error(`[openapi:postman] Conversion failed: ${JSON.stringify(result, null, 2)}`)
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(result.output[0].data, null, 2) + '\n', 'utf8')

  console.log(`[openapi:postman] Wrote: ${OUT_FILE}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


