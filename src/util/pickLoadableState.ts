import { VertexType } from '../VertexType'
import { PickedLoadableState } from '../state/PickedLoadableState'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { VertexStateKey } from '../state/VertexState'
import { combineState } from './combineState'
import { statusAndErrorsFromLoadableFields } from './statusAndErrorsFromLoadableFields'

export const pickLoadableState = <
   Type extends VertexType,
   K extends VertexStateKey<Type>
>(
   loadableState: VertexLoadableState<Type>,
   keys: K[]
): PickedLoadableState<Type, K> => {
   const reduxState: any = {}
   const readonlyFields: any = {}
   const loadableFields: any = {}
   keys.forEach(key => {
      if (key in loadableState.loadableFields) {
         loadableFields[key] = loadableState.loadableFields[key]
      } else if (key in loadableState.readonlyFields) {
         readonlyFields[key] = loadableState.readonlyFields[key]
      } else if (key in loadableState.reduxState) {
         reduxState[key] = loadableState.reduxState[key]
      }
   })
   const { status, errors } = statusAndErrorsFromLoadableFields(loadableFields)
   const state: any = combineState(reduxState, readonlyFields, loadableFields)
   return {
      status,
      errors,
      reduxState,
      readonlyFields,
      loadableFields,
      state
   }
}
