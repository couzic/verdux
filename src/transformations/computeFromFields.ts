import { map } from 'rxjs'
import { Dependable } from '../config/Dependable'
import { combineState } from '../util/combineState'
import { pickTransformationInput } from './pickTransformationInput'

export const computeFromFieldsTransformation = (
   fields: string[],
   computers: Dependable<any, Record<string, (state: any) => any>>
) =>
   pickTransformationInput(fields, (dependencies: any) => internalState$ => {
      const injectedComputers =
         typeof computers === 'function' ? computers(dependencies) : computers
      const computedFields = Object.keys(injectedComputers)

      const output$ = internalState$.pipe(
         map(internalState => {
            const { loadableFields } = internalState
            const loadableValues = Object.values(loadableFields)
            const computingFromLoadableFields = loadableValues.length !== 0
            if (computingFromLoadableFields) {
               const loadableFieldsAllLoaded =
                  loadableValues.filter(_ => _.status !== 'loaded').length === 0
               if (loadableFieldsAllLoaded) {
                  const computedValues: any = {}
                  const state = combineState(
                     internalState.reduxState.vertex,
                     internalState.readonlyFields,
                     internalState.loadableFields
                  )
                  // TODO NOW NOW wrap with try catch block and pass down error
                  computedFields.forEach(computedField => {
                     computedValues[computedField] = {
                        status: 'loaded',
                        value: injectedComputers[computedField](
                           // TODO NOW catch computing error
                           state as any
                        ),
                        error: undefined
                     }
                  })
                  return {
                     versions: {},
                     reduxState: { vertex: {}, downstream: {} },
                     readonlyFields: {},
                     loadableFields: computedValues
                  }
               } else {
                  // Still loading input fields
                  const loading: any = {}
                  computedFields.forEach(computedField => {
                     loading[computedField] = {
                        status: 'loading',
                        value: undefined,
                        error: undefined // TODO NOW pass down error !!!
                     }
                  })
                  return {
                     versions: internalState.versions,
                     reduxState: { vertex: {}, downstream: {} },
                     readonlyFields: {},
                     loadableFields: loading
                  }
               }
            } else {
               const computedValues: any = {}
               const state = combineState(
                  internalState.reduxState.vertex,
                  internalState.readonlyFields,
                  internalState.loadableFields
               )
               // TODO wrap with try catch block and pass down error
               computedFields.forEach(computedField => {
                  computedValues[computedField] = injectedComputers[
                     computedField
                  ](state as any)
               })
               return {
                  versions: {},
                  reduxState: { vertex: {}, downstream: {} },
                  readonlyFields: computedValues,
                  loadableFields: {}
               }
            }
         })
      )

      return output$
   })
