import { VertexLoadableState } from './VertexLoadableState'
import { toVertexLoadableState } from './toVertexLoadableState'

export const pickLoadableState = (
   loadableState: VertexLoadableState<any>,
   keys: string[]
): VertexLoadableState<any> => {
   const pickedFields = {} as any
   keys.forEach(key => {
      pickedFields[key] = loadableState.fields[key]
   })
   return toVertexLoadableState(pickedFields)
}
