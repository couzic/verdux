import { UnknownAction } from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { map } from 'rxjs'
import { VertexRun } from '../run/VertexRun'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { ReactionInput } from './ReactionInput'

export const reaction = (
   trackedAction: BaseActionCreator<any, any>,
   mapper: (input: VertexLoadableState<any>) => UnknownAction
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
         console.error(
            `[verdux] reaction on "${trackedAction.type}" threw an error. ` +
               'The reaction is skipped; future matching actions will still be processed.',
            e
         )
         return data
      }
   })
