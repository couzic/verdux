import { VertexType } from '../VertexType'
import { VertexInternalState } from '../state/VertexInternalState'
import { loadableFieldsEquals } from './loadableFieldsEquals'
import { shallowEquals } from './shallowEquals'

export const deepInternalStateEquals = <Type extends VertexType>(
   previous: VertexInternalState<Type>,
   next: VertexInternalState<Type>
) =>
   previous.reduxState === next.reduxState &&
   shallowEquals(previous.readonlyFields, next.readonlyFields) &&
   loadableFieldsEquals(previous.loadableFields, next.loadableFields)
