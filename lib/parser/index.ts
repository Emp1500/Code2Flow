import { convertJS }     from './javascript'
import { convertTS }     from './typescript'
import { convertPython } from './python'
import { graphToMermaid } from './converter'
import type { SupportedLanguage } from './types'

export function codeToMermaid(code: string, language: SupportedLanguage): string {
  const graph = language === 'python' ? convertPython(code)
              : language === 'typescript' ? convertTS(code)
              : convertJS(code)
  return graphToMermaid(graph)
}

export * from './types'
export { graphToMermaid } from './converter'
