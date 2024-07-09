import { expect } from 'chai'
import { VertexId } from '../vertex/VertexId'
import { serializeGraphRunData } from './serializeGraphRunData'

describe(serializeGraphRunData.name, () => {
   it('serializes error', () => {
      const vertexId = 'vid' as VertexId
      const fieldName = 'fn'
      const serialized = serializeGraphRunData({
         fieldsByVertexId: {
            [vertexId]: {
               [fieldName]: {
                  status: 'error',
                  value: undefined,
                  errors: [new Error('error message')]
               }
            }
         }
      } as any)
      expect(
         serialized.fieldsByVertexId[vertexId][fieldName].errors[0].message
      ).to.equal('error message')
   })
})
