import { miniSerializeError } from '@reduxjs/toolkit'
import { GraphRunData } from '../run/RunData'
import { SerializedGraphRunData } from './SerializedGraphRunData'

export const serializeGraphRunData = (
   data: GraphRunData
): SerializedGraphRunData => {
   const { fieldsByVertexId } = data
   const vertexIds = Object.keys(fieldsByVertexId)
   const serializedFieldsByVertexId =
      {} as SerializedGraphRunData['fieldsByVertexId']
   vertexIds.forEach(vertexId => {
      const fields = fieldsByVertexId[vertexId]
      const serializedFields =
         {} as SerializedGraphRunData['fieldsByVertexId'][string]
      const fieldNames = Object.keys(fields)
      fieldNames.forEach(fieldName => {
         const field = fields[fieldName]
         if (field.status === 'loaded' || field.status === 'loading') {
            serializedFields[fieldName] = field
         } else {
            serializedFields[fieldName] = {
               status: 'error',
               errors: field.errors.map(miniSerializeError),
               value: undefined
            }
         }
      })
      serializedFieldsByVertexId[vertexId] = serializedFields
   })
   return { ...data, fieldsByVertexId: serializedFieldsByVertexId }
}
