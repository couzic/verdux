import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { computeFromFields } from '../operation/computeFromFields'
import { fieldsReaction } from '../operation/fieldsReaction'
import { load } from '../operation/load'
import { loadFromFields } from '../operation/loadFromFields'
import { loadFromFields$ } from '../operation/loadFromFields$'
import { reaction } from '../operation/reaction'
import { reaction$ } from '../operation/reaction$'
import { sideEffect } from '../operation/sideEffect'
import { VertexOperationsOnly } from './VertexConfig'

import { UnknownAction } from '@reduxjs/toolkit'
import { Observable } from 'rxjs'
import { VertexRun } from '../run/VertexRun'
import { VertexLoadableState } from '../state/VertexLoadableState'

export class VertexOperationsBuilder implements VertexOperationsOnly<any, any> {
   public readonly trackedActions: BaseActionCreator<any, any>[] = []

   private readonly _operations: [VertexRun] = [] as any

   get operations(): [VertexRun] {
      return this._operations
   }

   computeFromFields(fields: any[], computers: any): any {
      this._operations.push(computeFromFields(fields, computers))
      return this
   }

   computeFromFields$(fields: any[], computers: any): any {
      this._operations.push(computeFromFields(fields, computers))
      return this
   }

   loadFromFields(fields: any[], loaders: any): any {
      this._operations.push(loadFromFields(fields, loaders))
      return this
   }

   load(loaders: any): any {
      this._operations.push(load(loaders))
      return this
   }

   loadFromFields$(fields: any[], loaders: any): any {
      this._operations.push(loadFromFields$(fields, loaders))
      return this
   }

   // loadFromStream(input$: Observable<any>, loaders: any): any {
   // }

   reaction<ActionCreator extends BaseActionCreator<any, any>>(
      actionCreator: ActionCreator,
      mapper: (input: any) => UnknownAction
   ) {
      if (!this.trackedActions.includes(actionCreator)) {
         this.trackedActions.push(actionCreator)
      }
      this._operations.push(reaction(actionCreator, mapper))
      return this
   }

   reaction$<ActionCreator extends BaseActionCreator<any, any>>(
      actionCreator: ActionCreator,
      mapper: (input$: Observable<any>) => Observable<UnknownAction>
   ) {
      if (!this.trackedActions.includes(actionCreator)) {
         this.trackedActions.push(actionCreator)
      }
      this._operations.push(reaction$(actionCreator, mapper))
      return this
   }

   fieldsReaction(
      fields: any[],
      mapper: (
         pickedState: any,
         vertex: VertexLoadableState<any>
      ) => UnknownAction
   ) {
      this._operations.push(fieldsReaction(fields, mapper))
      return this
   }

   sideEffect<ActionCreator extends BaseActionCreator<any, any>>(
      actionCreator: ActionCreator,
      callback: (input: any) => void
   ) {
      // TODO Track action ???
      this._operations.push(sideEffect(actionCreator, callback))
      return this
   }
}
