import { VertexInternalState } from './VertexInternalState'
import { VertexState } from './VertexState'
import { VertexType } from './VertexType'
import { combineState } from './combineState'

export const fromInternalState = <Type extends VertexType>(
   internalState: VertexInternalState<Type>
): VertexState<Type> =>
   combineState(
      internalState.reduxState.vertex,
      internalState.readonlyFields,
      internalState.loadableFields
   )
