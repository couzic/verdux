import { UnknownAction } from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { map } from 'rxjs'
import { VerduxLogger, reportError } from '../graph/VerduxLogger'
import { VertexRun } from '../run/VertexRun'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { ReactionInput } from './ReactionInput'

export const reaction = (
   trackedAction: BaseActionCreator<any, any>,
   mapper: (input: VertexLoadableState<any>) => UnknownAction,
   logger?: VerduxLogger
): VertexRun =>
   map(data => {
      if (!data.action || data.action.type !== trackedAction.type) {
         return data
      }
      try {
         const input = new ReactionInput(
            data.action.payload,
            data.fields
         ) as VertexLoadableState<any>
         return {
            ...data,
            reactions: [...data.reactions, mapper(input)]
         }
      } catch (e: any) {
         reportError(
            logger,
            `[verdux] reaction on "${trackedAction.type}" threw an error. ` +
               'The reaction is skipped; future matching actions will still be processed.',
            e
         )
         return data
      }
   })
