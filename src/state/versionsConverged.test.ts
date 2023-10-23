import { expect } from 'chai'
import { VertexInternalState } from './VertexInternalState'
import { versionsConverged } from './versionsConverged'

const emptyInternalState: VertexInternalState<any> = {
   versions: {},
   reduxState: { vertex: {}, downstream: {} },
   readonlyFields: {},
   loadableFields: {}
}

describe(versionsConverged.name, () => {
   it('handles simplest realistic cases', () => {
      const root = Symbol('root')
      expect(
         versionsConverged([
            { ...emptyInternalState, versions: { [root]: 0 } },
            { ...emptyInternalState, versions: { [root]: 0 } }
         ])
      ).to.be.true

      expect(
         versionsConverged([
            { ...emptyInternalState, versions: { [root]: 0 } },
            { ...emptyInternalState, versions: { [root]: 1 } }
         ])
      ).to.be.false
   })

   it('handles complex case', () => {
      const root = Symbol('root')
      const A = Symbol('A')
      const B = Symbol('B')

      expect(
         versionsConverged([
            { ...emptyInternalState, versions: { [root]: 0, [A]: 0, [B]: 0 } },
            { ...emptyInternalState, versions: { [root]: 0, [A]: 0, [B]: 0 } }
         ])
      ).to.be.true

      expect(
         versionsConverged([
            { ...emptyInternalState, versions: { [root]: 0, [A]: 0, [B]: 0 } },
            { ...emptyInternalState, versions: { [root]: 0, [A]: 0, [B]: 1 } }
         ])
      ).to.be.false
   })
})
