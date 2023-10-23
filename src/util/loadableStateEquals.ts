import { VertexType } from '../VertexType'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { shallowEquals } from './shallowEquals'

export const loadableStateEquals = <Type extends VertexType>(
   previous: VertexLoadableState<Type>,
   next: VertexLoadableState<Type>
) =>
   previous.status === next.status && shallowEquals(previous.state, next.state)
