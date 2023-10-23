import { expect } from 'chai'
import { mergeVersionNumbers } from './mergeVersionNumbers'

describe(mergeVersionNumbers.name, () => {
   it('handles undefined values', () => {
      const merged = mergeVersionNumbers(undefined as any, undefined as any)
      expect(merged).to.deep.equal({})
   })

   it('handles equal values', () => {
      const root = Symbol('root')
      const merged = mergeVersionNumbers({ [root]: 0 }, { [root]: 0 })
      expect(merged).to.deep.equal({ [root]: 0 })
   })

   it('handles case where previous version is higher', () => {
      const root = Symbol('root')
      const merged = mergeVersionNumbers({ [root]: 1 }, { [root]: 0 })
      expect(merged).to.deep.equal({ [root]: 1 })
   })

   it('handles case where next version is higher', () => {
      const root = Symbol('root')
      const merged = mergeVersionNumbers({ [root]: 0 }, { [root]: 1 })
      expect(merged).to.deep.equal({ [root]: 1 })
   })

   it('combines different keys', () => {
      const vertexId = Symbol('vertexId')
      const anotherVertexId = Symbol('anotherVertexId')
      const merged = mergeVersionNumbers(
         { [vertexId]: 0 },
         { [anotherVertexId]: 1 }
      )
      expect(merged).to.deep.equal({
         [vertexId]: 0,
         [anotherVertexId]: 1
      })
   })
})
