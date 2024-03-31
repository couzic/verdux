import { UnknownAction } from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { map } from 'rxjs'
import { VertexRun } from '../run/VertexRun'

export const reaction = (
   trackedAction: BaseActionCreator<any, any>,
   mapper: (payload: any) => UnknownAction
): VertexRun =>
   map(data => {
      if (!data.action || data.action.type !== trackedAction.type) {
         return data
      }
      try {
         return {
            ...data,
            reactions: [...data.reactions, mapper(data.action.payload)]
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
