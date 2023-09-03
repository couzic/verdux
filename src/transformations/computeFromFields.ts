import { map } from 'rxjs'
import { fromInternalState } from '../fromInternalState'
import { pickInternalState } from '../pickInternalState'

export const computeFromFieldsTransformation =
   (fields: string[], computers: any) => (dependencies: any) =>
      map((internalState: any) => {
         // TODO make sure recomputing only occurs when picked fields change
         const picked = fromInternalState(
            pickInternalState(internalState, fields as any)
         )

         const computedValues: any = {}
         const computedFields = Object.keys(computers)
         computedFields.forEach(computedField => {
            computedValues[computedField] = computers[computedField](
               picked as any,
               dependencies
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
