import { UnknownAction } from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { map } from 'rxjs'
import { VertexRun } from '../run/VertexRun'
import { VertexState } from '../state/VertexState'
import { combineFields } from '../state/combineFields'

export const reaction = (
   trackedAction: BaseActionCreator<any, any>,
   mapper: (payload: any, state: VertexState<any>) => UnknownAction
): VertexRun =>
   map(data => {
      if (!data.action || data.action.type !== trackedAction.type) {
         return data
      }
      try {
         const { state } = combineFields(data.fields)
         return {
            ...data,
            reactions: [...data.reactions, mapper(data.action.payload, state)]
         }
      } catch (e: any) {
         // TODO Log error
         // console.error(
         //    `An error occured while reacting to action "${trackedAction.type}":`
         // )
         // console.error(e)
         return data
      }
   })
