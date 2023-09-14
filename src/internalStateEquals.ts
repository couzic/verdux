import { VertexInternalState } from './VertexInternalState'
import { VertexLoadableFields } from './VertexLoadableFields'
import { VertexType } from './VertexType'
import { shallowEquals } from './shallowEquals'

export const internalStateEquals = <Type extends VertexType>(
   previous: VertexInternalState<Type>,
   next: VertexInternalState<Type>
) =>
   shallowEquals(previous.reduxState.vertex, next.reduxState.vertex) &&
   shallowEquals(previous.readonlyFields, next.readonlyFields) &&
   loadableFieldsEquals(previous.loadableFields, next.loadableFields)

export const loadableFieldsEquals = (
   previous: VertexLoadableFields,
   next: VertexLoadableFields
) => {
   for (let key in previous) {
      if (!shallowEquals(previous[key], next[key])) {
         // TODO Dig deeper in each loadable value ?
         return false
      }
   }
   return true
}
