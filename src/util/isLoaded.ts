import { VertexType } from '../VertexType'
import { VertexInternalState } from '../state/VertexInternalState'

export const isLoaded = <Type extends VertexType>(
   internalState: VertexInternalState<Type>
): boolean => {
   let loaded = true
   const loadableKeys = Object.keys(internalState.loadableFields) as Array<
      keyof Type['loadableFields']
   >
   loadableKeys.forEach(key => {
      if (internalState.loadableFields[key].status !== 'loaded') {
         loaded = false
      }
   })
   return loaded
}
