import { VertexInternalState } from './VertexInternalState'
import { VertexLoadableFields } from './VertexLoadableFields'
import { VertexType } from './VertexType'
import { shallowEquals } from './shallowEquals'

// TODO Delete if no use can be found
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
   const keys = Object.keys(previous)
   // TODO Eject from loop on first non-loaded field
   keys.forEach(key => {
      if (!shallowEquals(previous[key], next[key])) return false // TODO Dig deeper in each loadable value ?
   })
   return true
}
