import { VertexType } from '../VertexType'
import { PickedVertexInternalState } from '../state/PickedVertexInternalState'
import { VertexInternalState } from '../state/VertexInternalState'
import { VertexStateKey } from '../state/VertexState'

export const pickInternalState = <
   Type extends VertexType,
   K extends VertexStateKey<Type>
>(
   internalState: VertexInternalState<Type>,
   keys: K[]
): PickedVertexInternalState<Type, K> => {
   const reduxState = {
      vertex: {} as any,
      downstream: internalState.reduxState.downstream
   }
   const readonlyFields: any = {}
   const loadableFields: any = {}
   keys.forEach(key => {
      // TODO Warn if clash
      if (key in internalState.loadableFields) {
         loadableFields[key] = internalState.loadableFields[key]
      } else if (key in internalState.readonlyFields) {
         readonlyFields[key] = internalState.readonlyFields[key]
      } else if (key in internalState.reduxState.vertex) {
         reduxState.vertex[key] = internalState.reduxState.vertex[key]
      }
   })
   return {
      versions: internalState.versions, // TODO track only relevant upstream versions
      reduxState,
      readonlyFields,
      loadableFields
   }
}
