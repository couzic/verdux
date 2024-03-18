import { VertexLoadableState } from './VertexLoadableState'
import { combineFields } from './combineFields'

export const pickLoadableState = (
   loadableState: VertexLoadableState<any>,
   keys: string[]
): VertexLoadableState<any> => {
   const pickedFields = {} as any
   keys.forEach(key => {
      pickedFields[key] = loadableState.fields[key]
   })
   return combineFields(pickedFields)
}
