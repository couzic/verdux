import { VertexType } from '../VertexType'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { VertexState } from '../state/VertexState'
import { combineState } from './combineState'

export const fromLoadableState = <Type extends VertexType>(
   loadableState: VertexLoadableState<Type>
): VertexState<Type> =>
   combineState(
      loadableState.reduxState,
      loadableState.readonlyFields,
      loadableState.loadableFields
   )
