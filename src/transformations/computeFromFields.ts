import { map } from 'rxjs'
import { Dependable } from '../Dependable'
import { fromInternalState } from '../fromInternalState'
import { pickInternalState } from '../pickInternalState'

export const computeFromFieldsTransformation =
   (
      fields: string[],
      computers: Dependable<any, Record<string, (state: any) => any>>
   ) =>
   (dependencies: any) => {
      const injectedComputers =
         typeof computers === 'function' ? computers(dependencies) : computers
      return map((internalState: any) => {
         // TODO make sure recomputing only occurs when picked fields change
         const picked = fromInternalState(
            pickInternalState(internalState, fields as any)
         )
         // TODO only compute when all fields are loaded

         const computedValues: any = {}
         const computedFields = Object.keys(injectedComputers)
         computedFields.forEach(computedField => {
            computedValues[computedField] = injectedComputers[computedField](
               picked as any
            ) // TODO catch errors ?
         })
         return {
            ...internalState,
            readonlyFields: {
               ...internalState.readonlyFields,
               ...computedValues
            } // TODO values computed from loadable fields go to loadable fields
         }
      })
   }
