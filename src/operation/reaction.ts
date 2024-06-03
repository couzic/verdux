import { UnknownAction } from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { map } from 'rxjs'
import { VertexRun } from '../run/VertexRun'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { ReactionInput } from './ReactionInput'

export const reaction =
   (
      trackedAction: BaseActionCreator<any, any>,
      mapper: (
         input: VertexLoadableState<any> & { dependencies: any; payload: any }
      ) => UnknownAction
   ) =>
   (dependencies: any): VertexRun =>
      map(data => {
         if (!data.action || data.action.type !== trackedAction.type) {
            return data
         }
         try {
            const input = new ReactionInput(
               data.action.payload,
               dependencies,
               data.fields
            )
            return {
               ...data,
               reactions: [...data.reactions, mapper(input)]
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
