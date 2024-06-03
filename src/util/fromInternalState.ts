import { VertexType } from '../VertexType'
import { VertexInternalState } from '../state/VertexInternalState'
import { VertexState } from '../state/VertexState'
import { combineState } from './combineState'

export const fromInternalState = <Type extends VertexType>(
   internalState: VertexInternalState<Type>
): VertexState<Type> =>
   combineState(
      internalState.reduxState.vertex,
      internalState.readonlyFields,
      internalState.loadableFields
   )
