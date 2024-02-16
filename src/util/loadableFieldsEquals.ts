import { VertexLoadableFields } from '../state/VertexLoadableFields'
import { shallowEquals } from './shallowEquals'

export const loadableFieldsEquals = (
   previous: VertexLoadableFields,
   next: VertexLoadableFields
) => {
   for (let key in previous) {
      if (!shallowEquals(previous[key], next[key])) {
         return false
      }
   }
   return true
}
