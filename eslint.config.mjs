import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Pre-existing derived-state-via-effect pattern (code → Mermaid conversion,
    // rename-trigger sync) used throughout the editor/share components; newly
    // enabled by this eslint-config-next version bump, not part of it.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'public/monaco/**',
  ]),
])

export default eslintConfig
