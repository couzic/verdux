import { VertexType } from '../VertexType'
import { VertexInternalState } from '../state/VertexInternalState'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { combineState } from './combineState'
import { statusAndErrorsFromLoadableFields } from './statusAndErrorsFromLoadableFields'

export const loadableFromInternalState = <Type extends VertexType>(
   internalState: VertexInternalState<Type>
): VertexLoadableState<Type> => {
   const reduxState = internalState.reduxState.vertex
   const { readonlyFields, loadableFields } = internalState
   const { status, errors } = statusAndErrorsFromLoadableFields(loadableFields)
   const state = combineState(reduxState, readonlyFields, loadableFields)
   return {
      status,
      errors,
      state,
      reduxState,
      readonlyFields,
      loadableFields
   }
}
