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
      'verdux-testing/examples/*Test.ts',
      '**/examples/*.test.ts',
      // Eval regression suite: code a skills-only agent produced (see _eval/).
      '_eval/*.test.ts'
   ],
   reporter: 'spec'
}
