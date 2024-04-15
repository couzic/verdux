import { expect } from 'chai'
import { VertexFields } from '../run/VertexFields'
import { toVertexState } from './toVertexState'

describe(toVertexState.name, () => {
   it('combines fields', () => {
      const fields: VertexFields = {
         name: { status: 'loaded', value: 'Bob', errors: [] },
         age: { status: 'loaded', value: 40, errors: [] },
         whatever: { status: 'loading', value: undefined, errors: [] }
      }
      expect(toVertexState(fields)).to.deep.equal({
         name: 'Bob',
         age: 40,
         whatever: undefined
      })
   })
})
