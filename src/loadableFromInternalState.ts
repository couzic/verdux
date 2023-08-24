import { VertexInternalState } from './VertexInternalState'
import { VertexLoadableState } from './VertexLoadableState'
import { VertexType } from './VertexType'
import { fromInternalState } from './fromInternalState'
import { statusAndErrorsFromLoadableFields } from './statusAndErrorsFromLoadableFields'

export const loadableFromInternalState = <Type extends VertexType>(
   internalState: VertexInternalState<Type>
): VertexLoadableState<Type> => {
   const { status, errors } = statusAndErrorsFromLoadableFields(
      internalState.loadableFields
   )
   const state = fromInternalState(internalState)
   const reduxState = internalState.reduxState.vertex
   const { readonlyFields, loadableFields } = internalState
   return {
      status,
      errors,
      state,
      reduxState,
      readonlyFields,
      loadableFields
   }
}
