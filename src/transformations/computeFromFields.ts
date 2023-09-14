import { filter, map, pipe, scan } from 'rxjs'
import { Dependable } from '../Dependable'
import { VertexInternalState } from '../VertexInternalState'
import { fromInternalState } from '../fromInternalState'
import { internalStateEquals } from '../internalStateEquals'
import { pickInternalState } from '../pickInternalState'

const INITIAL_VALUE = Symbol('COMPUTE_FROM_FIELDS_INITIAL_VALUE')

export const computeFromFieldsTransformation =
   (
      fields: string[],
      computers: Dependable<any, Record<string, (state: any) => any>>
   ) =>
   (dependencies: any) => {
      const injectedComputers =
         typeof computers === 'function' ? computers(dependencies) : computers
      return pipe(
         scan(
            (
               previous:
                  | typeof INITIAL_VALUE
                  | {
                       pickedInternalState: VertexInternalState<any>
                       outputInternalState: VertexInternalState<any>
                    },
               inputInternalState: VertexInternalState<any>
            ) => {
               const pickedInternalState = pickInternalState(
                  inputInternalState,
                  fields
               )
               if (
                  previous !== INITIAL_VALUE &&
                  internalStateEquals(
                     previous.pickedInternalState,
                     pickedInternalState
                  )
               ) {
                  return {
                     pickedInternalState,
                     outputInternalState: previous.outputInternalState
                  }
               }

               const pickedLoadableFields = pickedInternalState.loadableFields
               const pickedLoadableValues = Object.values(pickedLoadableFields)
               const computingFromLoadableFields =
                  pickedLoadableValues.length !== 0
               const inputLoadableFieldsAllLoaded =
                  pickedLoadableValues.filter(_ => _.status !== 'loaded')
                     .length === 0
               if (!inputLoadableFieldsAllLoaded) {
                  const loading: any = {}
                  Object.keys(injectedComputers).forEach(computedField => {
                     loading[computedField] = {
                        status: 'loading',
                        value: undefined,
                        error: undefined // TODO pass down error !!!
                     }
                  })
                  return {
                     pickedInternalState,
                     outputInternalState: {
                        ...inputInternalState,
                        loadableFields: {
                           ...inputInternalState.loadableFields,
                           ...loading
                        }
                     }
                  }
               }

               const pickedState = fromInternalState(pickedInternalState)

               const computedValues: any = {}
               const computedFields = Object.keys(injectedComputers)
               if (computingFromLoadableFields) {
                  computedFields.forEach(computedField => {
                     computedValues[computedField] = {
                        status: 'loaded',
                        value: injectedComputers[computedField](
                           // TODO catch computing error
                           pickedState as any
                        ),
                        error: undefined
                     }
                  })
               } else {
                  computedFields.forEach(computedField => {
                     computedValues[computedField] = injectedComputers[
                        computedField
                     ](pickedState as any) // TODO catch computing error
                  })
               }
               const outputInternalState = computingFromLoadableFields
                  ? {
                       ...inputInternalState,
                       loadableFields: {
                          ...inputInternalState.loadableFields,
                          ...computedValues
                       }
                    }
                  : {
                       ...inputInternalState,
                       readonlyFields: {
                          ...inputInternalState.readonlyFields,
                          ...computedValues
                       }
                    }
               return {
                  pickedInternalState,
                  outputInternalState
               }
            },
            INITIAL_VALUE
         ),
         filter<any>(_ => _ !== INITIAL_VALUE),
         map(
            (_: { outputInternalState: VertexInternalState<any> }) =>
               _.outputInternalState
         )
      )
   }
