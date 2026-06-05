import { UnknownAction } from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import {
   Observable,
   catchError,
   filter,
   isObservable,
   map,
   merge,
   share,
   tap
} from 'rxjs'
import { VerduxLogger, reportError } from '../graph/VerduxLogger'
import { VertexRunData } from '../run/RunData'
import { VertexFields } from '../run/VertexFields'
import { VertexRun } from '../run/VertexRun'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { Reaction$Input } from './Reaction$Input'

export const reaction$ =
   (
      trackedAction: BaseActionCreator<any, any>,
      mapper: (
         input$: Observable<VertexLoadableState<any> & { payload: any }>
      ) => Observable<UnknownAction>,
      logger?: VerduxLogger
   ): VertexRun =>
   data$ => {
      let latestInputFields: VertexFields
      const inputData$ = data$.pipe(
         tap(data => (latestInputFields = data.fields)),
         share()
      )
      const outputReaction$ = inputData$.pipe(
         filter(
            data =>
               data.action !== undefined &&
               data.action.type === trackedAction.type
         ),
         map(data => new Reaction$Input(data.action!.payload, data.fields)),
         // The mapper is contracted to return an Observable. Throwing when called
         // or returning a non-Observable is a return-contract breach (a
         // programming error, not a runtime stream error), so — like every other
         // Observable-returning callback — it is left to fail fast rather than be
         // contained by the catchError below, which only handles errors delivered
         // THROUGH the returned stream.
         input$ => {
            const output$ = mapper(input$ as any)
            if (!isObservable(output$))
               throw new Error(
                  `reaction$ mapper for "${trackedAction.type}" must return an observable, received "${output$}" instead.`
               )
            return output$
         },
         map(
            (outputAction): VertexRunData => ({
               fields: latestInputFields,
               action: undefined,
               changedFields: {},
               fieldsReactions: [],
               reactions: [outputAction],
               sideEffects: [],
               initialRun: false
            })
         ),
         catchError((error, caught) => {
            reportError(
               logger,
               `[verdux] reaction$ on "${trackedAction.type}" threw an error. ` +
                  'The reaction stream stays alive; future matching actions will still be processed.',
               error
            )
            // Resubscribe to the same pipeline so future tracked actions
            // still produce reactions. `caught` is the Observable that was
            // being subscribed to; returning it creates a fresh subscription
            // to the shared `inputData$` source, which only emits future
            // values (no replay), so this is safe from infinite loops.
            return caught
         })
      )
      return merge(inputData$, outputReaction$)
   }
