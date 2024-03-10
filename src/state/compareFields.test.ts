import { expect } from 'chai'
import { VertexFieldState } from './VertexFieldState'
import { compareFields } from './compareFields'

describe(compareFields.name, () => {
   it('distinguishes different values', () => {
      const previous: Record<string, VertexFieldState> = {
         name: { status: 'loaded', value: 'Bob', errors: [] }
      }
      const next: Record<string, VertexFieldState> = {
         name: { status: 'loaded', value: 'John', errors: [] }
      }
      expect(compareFields(previous, next)).to.be.false
   })
   it('distinguishes different statuses', () => {
      const previous: Record<string, VertexFieldState> = {
         name: { status: 'loading', value: undefined, errors: [] }
      }
      const next: Record<string, VertexFieldState> = {
         name: { status: 'error', value: undefined, errors: [new Error()] }
      }
      expect(compareFields(previous, next)).to.be.false
   })
   it('distinguishes different errors', () => {
      const previous: Record<string, VertexFieldState> = {
         name: { status: 'error', value: undefined, errors: [new Error('a')] }
      }
      const next: Record<string, VertexFieldState> = {
         name: { status: 'error', value: undefined, errors: [new Error('b')] }
      }
      expect(compareFields(previous, next)).to.be.false
   })
   it('matches same values', () => {
      const previous: Record<string, VertexFieldState> = {
         name: { status: 'loaded', value: 'Bob', errors: [] }
      }
      const next: Record<string, VertexFieldState> = {
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
      const previous: Record<string, VertexFieldState> = {
         name
      }
      const next: Record<string, VertexFieldState> = {
         name
      }
      expect(compareFields(previous, next)).to.be.true
   })
})
