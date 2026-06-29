import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 10)

export function generateShareId(): string {
  return nanoid()
}
