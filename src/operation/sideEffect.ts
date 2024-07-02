import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { map } from 'rxjs'
import { VertexRun } from '../run/VertexRun'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { ReactionInput } from './ReactionInput'

export const sideEffect = (
   trackedAction: BaseActionCreator<any, any>,
   callback: (input: VertexLoadableState<any> & { payload: any }) => void
): VertexRun =>
   map(data => {
      if (!data.action || data.action.type !== trackedAction.type) {
         return data
      }
      try {
         const input = new ReactionInput(data.action.payload, data.fields)
         return {
            ...data,
            sideEffects: [...data.sideEffects, () => callback(input as any)]
         }
      } catch (e: any) {
         // TODO Log error
         // console.error(
         //    `An error occured while processing side effect for "${trackedAction.type}":`
         // )
         // console.error(e)
         return data
      }
   })
