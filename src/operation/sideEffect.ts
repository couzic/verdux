import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { map } from 'rxjs'
import { VerduxLogger, reportError } from '../graph/VerduxLogger'
import { VertexRun } from '../run/VertexRun'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { ReactionInput } from './ReactionInput'

export const sideEffect = (
   trackedAction: BaseActionCreator<any, any>,
   callback: (input: VertexLoadableState<any> & { payload: any }) => void,
   logger?: VerduxLogger
): VertexRun =>
   map(data => {
      if (!data.action || data.action.type !== trackedAction.type) {
         return data
      }
      const input = new ReactionInput(data.action.payload, data.fields)
      return {
         ...data,
         // The callback runs later, in createGraph's subscribe loop, so a throw
         // here would escape as an uncaught error — guard it so it is logged and
         // contained, like the rest of the reaction family.
         sideEffects: [
            ...data.sideEffects,
            () => {
               try {
                  callback(input as any)
               } catch (e: any) {
                  reportError(
                     logger,
                     `[verdux] sideEffect on "${trackedAction.type}" threw an error. ` +
                        'The side effect is skipped; future matching actions will still be processed.',
                     e
                  )
               }
            }
         ]
      }
   })
