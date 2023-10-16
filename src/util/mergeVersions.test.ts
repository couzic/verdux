import { expect } from 'chai'
import { VertexInternalState } from '../state/VertexInternalState'
import { mergeVersions } from './mergeVersions'

const emptyInternalState: VertexInternalState<any> = {
   versions: {},
   reduxState: { vertex: {}, downstream: {} },
   readonlyFields: {},
   loadableFields: {}
}

describe(mergeVersions.name, () => {
   it('handles simplest realistic cases', () => {
      const root = Symbol('root')
      const merged = mergeVersions([
         { ...emptyInternalState, versions: { [root]: 0 } },
         { ...emptyInternalState, versions: { [root]: 0 } }
      ])
      expect(merged.versions).to.deep.equal({ [root]: 0 })
      expect(merged.versionsConverged).to.be.true

      expect(
         mergeVersions([
            { ...emptyInternalState, versions: { [root]: 0 } },
            { ...emptyInternalState, versions: { [root]: 1 } }
         ]).versionsConverged
      ).to.be.false
   })

   it('handles complex case', () => {
      const root = Symbol('root')
      const A = Symbol('A')
      const B = Symbol('B')

      const merged = mergeVersions([
         { ...emptyInternalState, versions: { [root]: 0, [A]: 0, [B]: 0 } },
         { ...emptyInternalState, versions: { [root]: 0, [A]: 0, [B]: 0 } }
      ])
      expect(merged.versions).to.deep.equal({ [root]: 0, [A]: 0, [B]: 0 })
      expect(merged.versionsConverged).to.be.true

      expect(
         mergeVersions([
            { ...emptyInternalState, versions: { [root]: 0, [A]: 0, [B]: 0 } },
            { ...emptyInternalState, versions: { [root]: 0, [A]: 0, [B]: 1 } }
         ]).versionsConverged
      ).to.be.false
   })
})
