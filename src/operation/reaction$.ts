import { UnknownAction } from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import {
   NEVER,
   Observable,
   catchError,
   filter,
   map,
   merge,
   share,
   tap
} from 'rxjs'
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
      ) => Observable<UnknownAction>
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
         input$ => mapper(input$ as any),
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
         catchError(error => {
            console.error(error)
            return NEVER
            // TODO Ouput error
            // return of({
            //    fields: latestInputFields,
            //    action: undefined,
            //    changedFields: {},
            //    fieldsReactions: [],
            //    reactions: []
            // })
         })
      )
      return merge(inputData$, outputReaction$)
   }
