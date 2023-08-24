import { PickedInternalState } from './PickedInternalState'
import { VertexInternalState } from './VertexInternalState'
import { VertexStateKey } from './VertexState'
import { VertexType } from './VertexType'

export const pickInternalState = <
   Type extends VertexType,
   K extends VertexStateKey<Type>
>(
   internalState: VertexInternalState<Type>,
   keys: K[]
): PickedInternalState<Type, K> => {
   const reduxState = {
      vertex: {} as any,
      downstream: internalState.reduxState.downstream
   }
   const readonlyFields: any = {}
   const loadableFields: any = {}
   keys.forEach(key => {
      if (key in internalState.loadableFields) {
         loadableFields[key] = internalState.loadableFields[key]
      } else if (key in internalState.readonlyFields) {
         readonlyFields[key] = internalState.readonlyFields[key]
      } else if (key in internalState.reduxState.vertex) {
         reduxState.vertex[key] = internalState.reduxState.vertex[key]
      }
   })
   return {
      reduxState,
      readonlyFields,
      loadableFields
   }
}
