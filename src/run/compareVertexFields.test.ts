import { expect } from 'chai'
import { VertexFields } from './VertexFields'
import { compareVertexFields } from './compareVertexFields'

const sut = compareVertexFields

describe(sut.name, () => {
   describe('simple root vertex', () => {
      it('handles initial comparison', () => {
         const fields: VertexFields = {
            name: {
               status: 'loaded',
               value: '',
               errors: []
            }
         }
         const changedFields = compareVertexFields(undefined, fields)
         expect(changedFields).to.deep.equal({
            name: true
         })
      })
      it('ignores identical values', () => {
         const changedFields = compareVertexFields(
            {
               name: {
                  status: 'loaded',
                  value: '',
                  errors: []
               }
            },
            {
               name: {
                  status: 'loaded',
                  value: '',
                  errors: []
               }
            }
         )
         expect(changedFields).to.deep.equal({})
      })
      it('detects changed value', () => {
         const changedFields = compareVertexFields(
            {
               name: {
                  status: 'loaded',
                  value: '',
                  errors: []
               }
            },
            {
               name: {
                  status: 'loaded',
                  value: 'Bob',
                  errors: []
               }
            }
         )
         expect(changedFields).to.deep.equal({ name: true })
      })
      it('detects changed status', () => {
         const changedFields = compareVertexFields(
            {
               name: {
                  status: 'loaded',
                  value: undefined,
                  errors: []
               }
            },
            {
               name: {
                  status: 'loading',
                  value: undefined,
                  errors: []
               }
            }
         )
         expect(changedFields).to.deep.equal({ name: true })
      })
      it('detects a field newly added to the field set', () => {
         const previous: VertexFields = {
            count: { status: 'loaded', value: 1, errors: [] }
         }
         const next: VertexFields = {
            count: { status: 'loaded', value: 1, errors: [] },
            added: { status: 'loaded', value: 42, errors: [] } // absent from `previous`
         }

         expect(compareVertexFields(previous, next)).to.deep.equal({
            added: true
         })
      })
   })
})
