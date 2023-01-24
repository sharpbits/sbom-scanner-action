import { BinaryLike, BinaryToTextEncoding, createHmac, randomBytes } from 'crypto'

const headerPrefix = 'VERACODE-HMAC-SHA-256'
const verStr = 'vcode_request_version_1'

function hmac256(data: BinaryLike, key: BinaryLike, format?: BinaryToTextEncoding): string | Buffer {
  const hash = createHmac('sha256', key).update(data)
  // no format = Buffer / byte array
  return format ? hash.digest(format) : hash.digest()
}

function getByteArray(hex: string): Int8Array {
  const bytes = [] as number[]

  for (let i = 0; i < hex.length - 1; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16))
  }

  // signed 8-bit integer array (byte array)
  return Int8Array.from(bytes)
}

export function generateHeader(apiHost: string, apiId: string, apiKey: string, url: string, method: string): string {
  const data = `id=${apiId}&host=${apiHost}&url=${url}&method=${method}`
  const timestamp = new Date().getTime().toString()
  const nonce = randomBytes(16).toString('hex')

  // calculate signature
  const hashedNonce = hmac256(getByteArray(nonce), getByteArray(apiKey))
  const hashedTimestamp = hmac256(timestamp, hashedNonce)
  const hashedVerStr = hmac256(verStr, hashedTimestamp)
  const signature = hmac256(data, hashedVerStr, 'hex')

  return `${headerPrefix} id=${apiId},ts=${timestamp},nonce=${nonce},sig=${signature}`
}
