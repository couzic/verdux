import { VertexType } from '../VertexType'
import { VertexInternalState } from '../state/VertexInternalState'
import { loadableFieldsEquals } from './loadableFieldsEquals'
import { shallowEquals } from './shallowEquals'

export const internalStateEquals = <Type extends VertexType>(
   previous: VertexInternalState<Type>,
   next: VertexInternalState<Type>
) =>
   shallowEquals(previous.reduxState.vertex, next.reduxState.vertex) &&
   shallowEquals(previous.readonlyFields, next.readonlyFields) &&
   loadableFieldsEquals(previous.loadableFields, next.loadableFields)
