import { VertexLoadableState } from './VertexLoadableState'
import { VertexState } from './VertexState'
import { VertexType } from './VertexType'
import { combineState } from './combineState'

export const fromLoadableState = <Type extends VertexType>(
   loadableState: VertexLoadableState<Type>
): VertexState<Type> =>
   combineState(
      loadableState.reduxState,
      loadableState.readonlyFields,
      loadableState.loadableFields
   )
