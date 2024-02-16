import { expect } from 'chai'
import { loadableFieldsEquals } from './loadableFieldsEquals'

const sut = loadableFieldsEquals

describe(sut.name, () => {
   it('handles empty fields', () => {
      expect(sut({}, {})).to.be.true
   })
   it('handles same loading fields', () => {
      expect(
         sut(
            { a: { error: undefined, status: 'loading', value: undefined } },
            { a: { error: undefined, status: 'loading', value: undefined } }
         )
      ).to.be.true
   })
   it('handles same field with different statuses', () => {
      expect(
         sut(
            { a: { error: undefined, status: 'loading', value: undefined } },
            { a: { error: undefined, status: 'loaded', value: 1 } }
         )
      ).to.be.false
   })
   it('handles same loaded fields', () => {
      expect(
         sut(
            { a: { error: undefined, status: 'loaded', value: 1 } },
            { a: { error: undefined, status: 'loaded', value: 1 } }
         )
      ).to.be.true
   })
   it('handles loaded fields with different values', () => {
      expect(
         sut(
            { a: { error: undefined, status: 'loaded', value: 1 } },
            { a: { error: undefined, status: 'loaded', value: 2 } }
         )
      ).to.be.false
   })
   it('handles loaded fields with same reference', () => {
      const loadedValue = { k: 1 }
      expect(
         sut(
            { a: { error: undefined, status: 'loaded', value: loadedValue } },
            { a: { error: undefined, status: 'loaded', value: loadedValue } }
         )
      ).to.be.true
   })
})
