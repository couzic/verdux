import { Reducer, Slice, UnknownAction } from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { Observable } from 'rxjs'
import { computeFromFields } from '../operation/computeFromFields'
import { loadFromFields } from '../operation/loadFromFields'
import { reaction } from '../operation/reaction'
import { reaction$ } from '../operation/reaction$'
import { VertexRun } from '../run/VertexRun'
import { VertexState } from '../state/VertexState'
import { VertexId } from '../vertex/VertexId'
import { VertexConfig } from './VertexConfig'
import { VertexConfigBuilderImpl } from './VertexConfigBuilderImpl'
import { VertexFieldsDefinition } from './VertexFieldsDefinition'
import { configureVertex } from './configureVertex'

export class VertexConfigImpl<
   Fields extends VertexFieldsDefinition = any,
   Dependencies extends Record<string, any> = any
> implements VertexConfig<Fields, Dependencies>
{
   get rootVertex(): VertexConfig<any> {
      const upstreamVertices = this.upstreamVertices
      if (upstreamVertices.length === 0) return this as any
      return upstreamVertices[0].rootVertex
   }

   get upstreamVertices(): VertexConfig<any>[] {
      return this.builder.upstreamVertices
   }

   private readonly _injectableOperations: Array<
      (dependencies: Dependencies) => VertexRun
   > = []
   public getInjectedOperations(dependencies: Dependencies): [VertexRun] {
      return this._injectableOperations.map(injectableOperation =>
         injectableOperation(dependencies)
      ) as any
   }

   public readonly trackedActions: BaseActionCreator<any, any>[] = []

   constructor(
      public readonly name: string,
      public readonly id: VertexId,
      public readonly getInitialState: () => Record<string, any>,
      public readonly reducer: Reducer<Record<string, any>>,
      public readonly builder: VertexConfigBuilderImpl<Fields, Dependencies>
   ) {}

   isLoadableField(field: keyof Fields) {
      return this.builder.isLoadableField(field)
   }

   configureDownstreamVertex<
      ReduxFields extends Record<string, Record<string, any>>,
      UpstreamField extends keyof Fields = never,
      DownstreamDependencies extends Record<string, any> = {}
   >(
      options: (
         | {
              slice: Slice<ReduxFields>
           }
         | {
              name: string
              reducer: ReducerWithInitialState<ReduxFields>
           }
      ) & {
         upstreamFields?: UpstreamField[]
         dependencies?: {
            [K in keyof DownstreamDependencies]: (
               upstreamDependencies: Dependencies
            ) => DownstreamDependencies[K]
         }
      }
   ): any {
      return configureVertex(options, builder => {
         builder.addUpstreamVertex(this, {
            fields: options.upstreamFields
         })
         if (options.dependencies) {
            builder.addDependencies(options.dependencies as any)
         }
         return builder
      })
   }

   findClosestCommonAncestor() {
      return this.builder.findClosestCommonAncestor().vertexId
   }

   buildVertexDependencies(
      dependenciesByVertexId: Record<VertexId, Record<string, any>>,
      injectedDependencies: Record<string, any>
   ) {
      return this.builder.buildVertexDependencies(
         dependenciesByVertexId,
         injectedDependencies
      )
   }

   injectedWith(injectedDependencies: Partial<Dependencies>): any {
      return {
         config: this,
         injectedDependencies
      }
   }

   computeFromFields(fields: any[], computers: any): any {
      this._injectableOperations.push(dependencies =>
         computeFromFields(
            fields,
            typeof computers === 'function'
               ? computers(dependencies)
               : computers
         )
      )
      return this
   }

   loadFromFields(fields: any[], loaders: any): any {
      this._injectableOperations.push(dependencies =>
         loadFromFields(
            fields,
            typeof loaders === 'function' ? loaders(dependencies) : loaders
         )
      )
      return this
   }

   load(loaders: any): any {
      // TODO
      // this.internalStateTransformations.push(loadTransformation(loaders))
      return this
   }

   loadFromFields$(fields: any[], loaders: any): any {
      // TODO mark fields as loadable
      // this.internalStateTransformations.push(
      //    loadFromFieldsStreamTransformation(fields, loaders)
      // )
      return this
   }

   loadFromStream(input$: Observable<any>, loaders: any): any {
      // TODO mark fields as loadable
      // this.internalStateTransformations.push(
      //    loadFromStreamTransformation(input$, loaders)
      // )
      return this
   }

   reaction<ActionCreator extends BaseActionCreator<any, any>>(
      actionCreator: ActionCreator,
      mapper: (payload: any, state: VertexState<any>) => UnknownAction
   ) {
      if (!this.trackedActions.includes(actionCreator)) {
         this.trackedActions.push(actionCreator)
      }
      this._injectableOperations.push(() => reaction(actionCreator, mapper))
      return this
   }

   reaction$<ActionCreator extends BaseActionCreator<any, any>>(
      actionCreator: ActionCreator,
      mapper: (
         input$: Observable<{
            payload: any
            state: VertexState<any>
         }>
      ) => Observable<UnknownAction>
   ) {
      if (!this.trackedActions.includes(actionCreator)) {
         this.trackedActions.push(actionCreator)
      }
      this._injectableOperations.push(() => reaction$(actionCreator, mapper))
      return this
   }

   fieldsReaction<K extends keyof Fields>(
      fields: K[],
      operation: (pickedState: {
         [PK in K]: Fields[PK]['value']
      }) => UnknownAction
   ) {
      return this
   }

   // TODO Implement
   // sideEffect<ActionCreator extends BaseActionCreator<any, any>>(
   //    actionCreator: ActionCreator,
   //    operation: (payload: ActionCreator, vertex: VertexInstance<Type>) => void
   // ) {
   //    // this.sideEffects.push({ actionCreator, operation })
   //    return this
   // }
}
