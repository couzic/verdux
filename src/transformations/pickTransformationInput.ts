import { filter, map, merge, of, scan, switchMap } from 'rxjs'
import { VertexInternalState } from '../state/VertexInternalState'
import { mergeVersionNumbers } from '../state/mergeVersionNumbers'
import { internalStateEquals } from '../util/internalStateEquals'
import { pickInternalState } from '../util/pickInternalState'
import { InternalStateTransformation } from './InternalStateTransformation'

const INITIAL_VALUE = Symbol(
   'PICK_TRANSFORMATION_INPUT_INITIAL_VALUE'
) as any as {
   internalState: VertexInternalState<any>
   pickedInternalState: VertexInternalState<any>
   fromMemory: boolean
}

export const pickTransformationInput =
   (
      fields: string[],
      transformation: InternalStateTransformation
   ): InternalStateTransformation =>
   dependencies =>
   internalState$ => {
      const injectedTransformation = transformation(dependencies)
      const input$ = internalState$.pipe(
         map(internalState => ({
            internalState,
            pickedInternalState: pickInternalState(internalState, fields)
         })),
         scan((previous, next) => {
            if (previous === INITIAL_VALUE) {
               return {
                  internalState: next.internalState,
                  pickedInternalState: next.pickedInternalState,
                  fromMemory: false
               }
            } else {
               const fromMemory = internalStateEquals(
                  previous.pickedInternalState,
                  next.pickedInternalState
               )
               return {
                  internalState: next.internalState,
                  pickedInternalState: next.pickedInternalState,
                  fromMemory
               }
            }
         }, INITIAL_VALUE)
      )

      const fromMemory$ = input$.pipe(filter(_ => _.fromMemory))

      const notFromMemory$ = input$.pipe(
         filter(_ => !_.fromMemory),
         // TODO Remove switchMap if I can prove I must
         switchMap(({ pickedInternalState, internalState }) =>
            injectedTransformation(of(pickedInternalState)).pipe(
               map(
                  (outputInternalState): VertexInternalState<any> => ({
                     versions: internalState.versions,
                     reduxState: internalState.reduxState,
                     readonlyFields: {
                        ...internalState.readonlyFields,
                        ...outputInternalState.readonlyFields
                     },
                     loadableFields: {
                        ...internalState.loadableFields,
                        ...outputInternalState.loadableFields
                     }
                  })
               )
            )
         ),
         map(internalState => ({ fromMemory: false, internalState }))
      )

      const output$ = merge(fromMemory$, notFromMemory$).pipe(
         scan((previous, next): VertexInternalState<any> => {
            const versions = mergeVersionNumbers(
               previous.versions,
               next.internalState.versions
            )
            if (next.fromMemory) {
               return {
                  ...previous,
                  versions
               }
            } else {
               return {
                  ...next.internalState,
                  versions
               }
            }
         }, {} as VertexInternalState<any>)
      )

      return output$
   }
