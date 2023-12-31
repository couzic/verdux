import { Slice } from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { AnyAction, Reducer } from 'redux'
import { Observable } from 'rxjs'
import { VertexInstance } from '../VertexInstance'
import { VertexType } from '../VertexType'
import { VertexInternalState } from '../state/VertexInternalState'
import { VertexStateKey } from '../state/VertexState'
import { computeFromFieldsTransformation } from '../transformations/computeFromFields'
import { loadTransformation } from '../transformations/load'
import { loadFromFieldsTransformation } from '../transformations/loadFromFields'
import { loadFromFieldsStreamTransformation } from '../transformations/loadFromFields$'
import { loadFromStreamTransformation } from '../transformations/loadFromStream'
import { DependencyProviders } from './DependencyProviders'
import { VertexConfig } from './VertexConfig'
import { VertexRuntimeConfig } from './VertexRuntimeConfig'

export class SingleUpstreamVertexConfig<Type extends VertexType>
   implements VertexConfig<Type>
{
   readonly id: symbol
   readonly reactions: Array<{
      actionCreator: BaseActionCreator<any, any>
      operation: (
         payload$: Observable<any>,
         vertex: VertexInstance<Type>
      ) => Observable<AnyAction>
   }> = []
   readonly fieldsReactions: Array<{
      fields: any[]
      operation: (fields: any) => AnyAction
   }> = []

   protected readonly internalStateTransformations: Array<
      (
         dependencies: Type['dependencies']
      ) => (
         internalState$: Observable<VertexInternalState<any>>
      ) => Observable<VertexInternalState<any>>
   > = []

   get rootVertex(): VertexConfig<any> {
      if (this.inputRootVertex === null) return this as any
      return this.inputRootVertex
   }

   constructor(
      public readonly name: string,
      public readonly getInitialState: () => Type['reduxState'],
      public readonly reducer: Reducer<Type['reduxState']>,
      public readonly upstreamVertex: VertexConfig<any> | undefined,
      public readonly upstreamFields: string[],
      private readonly inputRootVertex: VertexConfig<any> | null,
      public readonly dependencyProviders: DependencyProviders
   ) {
      this.id = Symbol(`Vertex ${name}`)
   }

   configureDownstreamVertex<
      ReduxState extends object,
      UpstreamField extends VertexStateKey<Type> = never
   >(
      options: (
         | {
              slice: Slice<ReduxState>
           }
         | {
              name: string
              reducer: ReducerWithInitialState<ReduxState>
           }
      ) & {
         upstreamFields?: UpstreamField[]
         dependencies?: DependencyProviders<Type>
      }
   ): any {
      const { name, getInitialState, reducer } =
         'slice' in options ? options.slice : { ...options, ...options.reducer }
      const upstreamFields: string[] =
         (options.upstreamFields as string[]) || []
      const downstreamConfig = new SingleUpstreamVertexConfig(
         name,
         getInitialState,
         reducer as Reducer<any>,
         this as any,
         upstreamFields,
         this.rootVertex,
         options.dependencies || {}
      )
      return downstreamConfig
   }

   applyInternalStateTransformations(
      internalState$: Observable<VertexInternalState<any>>,
      dependencies: Type['dependencies']
   ) {
      return this.internalStateTransformations.reduce(
         (observable, transformation) =>
            transformation(dependencies)(observable),
         internalState$
      )
   }

   injectedWith(
      injectedDependencies: Partial<Type['dependencies']>
   ): VertexRuntimeConfig<Type> {
      return {
         config: this,
         injectedDependencies
      }
   }

   computeFromFields(fields: any[], computers: any): any {
      this.internalStateTransformations.push(
         computeFromFieldsTransformation(fields, computers)
      )
      return this
   }

   loadFromFields(fields: any[], loaders: any): any {
      this.internalStateTransformations.push(
         loadFromFieldsTransformation(fields, loaders)
      )
      return this
   }

   load(loaders: any): any {
      this.internalStateTransformations.push(loadTransformation(loaders))
      return this
   }

   loadFromFields$(fields: any[], loaders: any): any {
      this.internalStateTransformations.push(
         loadFromFieldsStreamTransformation(fields, loaders)
      )
      return this
   }

   loadFromStream(input$: Observable<any>, loaders: any): any {
      this.internalStateTransformations.push(
         loadFromStreamTransformation(input$, loaders)
      )
      return this
   }

   reaction(
      actionCreator: BaseActionCreator<any, any>,
      operation: (
         payload$: Observable<any>,
         vertex: VertexInstance<Type>
      ) => Observable<AnyAction>
   ) {
      this.reactions.push({ actionCreator, operation })
      return this
   }

   fieldsReaction<K extends VertexStateKey<Type>>(
      fields: K[],
      operation: (fields: {
         [FK in K]: FK extends keyof Type['loadableFields']
            ? Type['loadableFields'][FK]
            : FK extends keyof Type['readonlyFields']
            ? Type['loadableFields'][FK]
            : FK extends keyof Type['reduxState']
            ? Type['reduxState'][FK]
            : never
      }) => AnyAction
   ) {
      this.fieldsReactions.push({ fields, operation })
      return this
   }
}
