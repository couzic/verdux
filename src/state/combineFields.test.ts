import { expect } from 'chai'
import { VertexFields } from '../run/VertexFields'
import { combineFields } from './combineFields'

describe(combineFields.name, () => {
   it('combines fields', () => {
      const fields: VertexFields = {
         name: { status: 'loaded', value: 'Bob', errors: [] },
         age: { status: 'loaded', value: 40, errors: [] }
      }
      expect(combineFields(fields)).to.deep.equal({
         state: { name: 'Bob', age: 40 },
         fields,
         status: 'loaded',
         errors: []
      })
   })
   it('handles loading fields', () => {
      const fields: VertexFields = {
         name: { status: 'loaded', value: 'Bob', errors: [] },
         age: { status: 'loading', value: undefined, errors: [] }
      }
      expect(combineFields(fields)).to.deep.equal({
         state: { name: 'Bob', age: undefined },
         fields,
         status: 'loading',
         errors: []
      })
   })
   it('handles fields in error', () => {
      const error = new Error()
      const fields: VertexFields = {
         name: { status: 'loading', value: undefined, errors: [] },
         age: { status: 'error', value: undefined, errors: [error] }
      }
      expect(combineFields(fields)).to.deep.equal({
         state: { name: undefined, age: undefined },
         fields,
         status: 'error',
         errors: [error]
      })
   })
})
