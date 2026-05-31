const path = require('path')

// Type-checking is handled separately by `npm run typecheck` (tsc --noEmit).
// At runtime we transpile only, so the example tests execute fast.
process.env.TS_NODE_TRANSPILE_ONLY = '1'
process.env.TS_NODE_PROJECT = path.join(__dirname, 'tsconfig.json')

module.exports = {
   require: ['ts-node/register', 'tsconfig-paths/register'],
   extension: ['ts'],
   spec: [
      // The two testing-skill examples are named *Test.ts (referenced by name
      // in that skill's prose); other runnable checks use the *.test.ts suffix.
      '../skills/verdux-testing/examples/*Test.ts',
      '../skills/**/examples/*.test.ts',
      // Extra sample code (task*.test.ts) that must also compile and pass.
      '*.test.ts'
   ],
   reporter: 'spec'
}
