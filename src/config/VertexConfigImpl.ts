import { Reducer, Slice, UnknownAction } from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { Observable } from 'rxjs'
import { VertexRun } from '../run/VertexRun'
import { VertexId } from '../vertex/VertexId'
import { VertexConfig, VertexOperationsOnly } from './VertexConfig'
import { VertexConfigBuilderImpl } from './VertexConfigBuilderImpl'
import { VertexFieldsDefinition } from './VertexFieldsDefinition'
import { VertexOperationsBuilder } from './VertexOperationsBuilder'
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

   private readonly _operationsToInject: Array<
      (
         dependencies: Dependencies,
         config: VertexOperationsOnly<any, any>
      ) => VertexOperationsOnly<any, any>
   > = []

   resolveOperations(dependencies: Dependencies): {
      operations: [VertexRun]
      trackedActions: BaseActionCreator<any, any>[]
   } {
      let operationsBuilder = new VertexOperationsBuilder()
      this._operationsToInject.forEach(operationToInject => {
         operationsBuilder = operationToInject(
            dependencies,
            operationsBuilder
         ) as any
      })
      const operations = operationsBuilder.operations
      const trackedActions = operationsBuilder.trackedActions
      return { operations, trackedActions }
   }

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

   withDependencies<OutputFields extends VertexFieldsDefinition>(
      f: (
         dependencies: Dependencies,
         config: VertexOperationsOnly<Fields, Dependencies>
      ) => VertexOperationsOnly<OutputFields, Dependencies>
   ): VertexConfig<OutputFields, Dependencies> {
      this._operationsToInject.push(f)
      return this as any
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
      this._operationsToInject.push((_, config) =>
         config.computeFromFields(fields, computers)
      )
      return this
   }

   computeFromFields$(fields: any[], computers: any): any {
      this._operationsToInject.push((_, config) =>
         config.computeFromFields$(fields, computers)
      )
      return this
   }

   loadFromFields(fields: any[], loaders: any): any {
      this._operationsToInject.push((_, config) =>
         config.loadFromFields(fields, loaders)
      )
      return this
   }

   load(loaders: any): any {
      this._operationsToInject.push((_, config) => config.load(loaders))
      return this
   }

   loadFromFields$(fields: any[], loaders: any): any {
      this._operationsToInject.push((_, config) =>
         config.loadFromFields$(fields, loaders)
      )
      return this
   }

   // loadFromStream(input$: Observable<any>, loaders: any): any {
   // }

   reaction<ActionCreator extends BaseActionCreator<any, any>>(
      actionCreator: ActionCreator,
      mapper: (input: any) => UnknownAction
   ) {
      this._operationsToInject.push((_, config) =>
         config.reaction(actionCreator, mapper)
      )
      return this
   }

   reaction$<ActionCreator extends BaseActionCreator<any, any>>(
      actionCreator: ActionCreator,
      mapper: (input$: Observable<any>) => Observable<UnknownAction>
   ) {
      this._operationsToInject.push((_, config) =>
         config.reaction$(actionCreator, mapper)
      )
      return this
   }

   fieldsReaction<K extends keyof Fields>(
      fields: K[],
      mapper: (pickedState: any, vertex: any) => UnknownAction
   ) {
      this._operationsToInject.push((_, config) =>
         config.fieldsReaction(fields, mapper)
      )
      return this
   }

   sideEffect<ActionCreator extends BaseActionCreator<any, any>>(
      actionCreator: ActionCreator,
      callback: (input: any) => void
   ) {
      this._operationsToInject.push((_, config) =>
         config.sideEffect(actionCreator, callback)
      )
      return this
   }
}
