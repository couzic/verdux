import { VertexFields } from '../run/VertexFields'

export const pickFields = (
   toPick: string[],
   fromFields: VertexFields
): VertexFields => {
   const pickedFields = {} as any
   toPick.forEach(key => {
      pickedFields[key] = fromFields[key]
   })
   return pickedFields
}
