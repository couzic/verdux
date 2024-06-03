import { expect } from 'chai'
import { VertexFields } from '../run/VertexFields'
import { VertexFieldState } from './VertexFieldState'
import { compareFields } from './compareFields'

describe(compareFields.name, () => {
   it('distinguishes different values', () => {
      const previous: VertexFields = {
         name: { status: 'loaded', value: 'Bob', errors: [] }
      }
      const next: VertexFields = {
         name: { status: 'loaded', value: 'John', errors: [] }
      }
      expect(compareFields(previous, next)).to.be.false
   })
   it('distinguishes different statuses', () => {
      const previous: VertexFields = {
         name: { status: 'loading', value: undefined, errors: [] }
      }
      const next: VertexFields = {
         name: { status: 'error', value: undefined, errors: [new Error()] }
      }
      expect(compareFields(previous, next)).to.be.false
   })
   it('distinguishes different errors', () => {
      const previous: VertexFields = {
         name: { status: 'error', value: undefined, errors: [new Error('a')] }
      }
      const next: VertexFields = {
         name: { status: 'error', value: undefined, errors: [new Error('b')] }
      }
      expect(compareFields(previous, next)).to.be.false
   })
   it('matches same values', () => {
      const previous: VertexFields = {
         name: { status: 'loaded', value: 'Bob', errors: [] }
      }
      const next: VertexFields = {
         name: { status: 'loaded', value: 'Bob', errors: [] }
      }
      expect(compareFields(previous, next)).to.be.true
   })
   it('matches same field reference', () => {
      const name: VertexFieldState = {
         status: 'loaded',
         value: {},
         errors: []
      }
      const previous: VertexFields = {
         name
      }
      const next: VertexFields = {
         name
      }
      expect(compareFields(previous, next)).to.be.true
   })
})
