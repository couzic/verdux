import { Slice } from '@reduxjs/toolkit'
import {
   ActionCreatorWithPayload,
   BaseActionCreator
} from '@reduxjs/toolkit/dist/createAction'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { AnyAction, Reducer } from 'redux'
import { Observable } from 'rxjs'
import { VertexInstance } from '../VertexInstance'
import { VertexType } from '../VertexType'
import { VertexInternalState } from '../state/VertexInternalState'
import { VertexStateKey } from '../state/VertexState'
import { incomingToOutgoingInternalStateStream } from '../state/incomingToOutgoingInternalStateStream'
import { InternalStateTransformation } from '../transformations/InternalStateTransformation'
import { computeFromFieldsTransformation } from '../transformations/computeFromFields'
import { loadTransformation } from '../transformations/load'
import { loadFromFieldsTransformation } from '../transformations/loadFromFields'
import { loadFromFieldsStreamTransformation } from '../transformations/loadFromFields$'
import { loadFromStreamTransformation } from '../transformations/loadFromStream'
import { VertexConfig } from './VertexConfig'
import { VertexConfigBuilderImpl } from './VertexConfigBuilderImpl'
import { VertexRuntimeConfig } from './VertexRuntimeConfig'
import { configureDownstreamVertex } from './configureDownstreamVertex'

export class VertexConfigImpl<Type extends VertexType>
   implements VertexConfig<Type>
{
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
   readonly sideEffects: Array<{
      actionCreator: BaseActionCreator<any, any>
      operation: (
         payload: any,
         vertex: VertexInstance<Type>
      ) => void | Promise<void>
   }> = []

   protected readonly internalStateTransformations: InternalStateTransformation[] =
      []

   get rootVertex(): VertexConfig<any> {
      const upstreamVertices = this.upstreamVertices
      if (upstreamVertices.length === 0) return this as any
      return upstreamVertices[0].rootVertex
   }

   checkHasRootVertex(expectedRootVertex: VertexConfigImpl<any>) {
      const upstreamVertices = this.upstreamVertices
      if (upstreamVertices.length === 0) {
         if (this.id !== expectedRootVertex.id)
            throw new Error(
               `Error creating graph: impossible to create graph with multiple root vertices ("${expectedRootVertex.id.description}" is a root but another root "${this.id.description}" exists)`
            )
      } else {
         upstreamVertices.forEach(upstreamVertex =>
            (upstreamVertex as VertexConfigImpl<any>).checkHasRootVertex(
               expectedRootVertex
            )
         )
      }
   }

   get upstreamVertices(): VertexConfig<any>[] {
      return this.builder.upstreamVertices
   }

   constructor(
      public readonly name: string,
      public readonly id: symbol,
      public readonly getInitialState: () => Type['reduxState'],
      public readonly reducer: Reducer<Type['reduxState']>,
      public readonly builder: VertexConfigBuilderImpl<Type>
   ) {}

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
         dependencies?: any
      }
   ): any {
      return configureDownstreamVertex(options, builder =>
         builder.addUpstreamVertex(this, {
            upstreamFields: options.upstreamFields,
            dependencies: options.dependencies
         })
      )
   }

   findClosestCommonAncestor() {
      return this.builder.findClosestCommonAncestor().vertexId
   }

   buildVertexDependencies(
      dependenciesByUpstreamVertexId: any,
      injectedDependencies: any
   ) {
      return this.builder.buildVertexDependencies(
         dependenciesByUpstreamVertexId,
         injectedDependencies
      )
   }

   createOutgoingInternalStateStream(
      incomingInternalState$: Observable<VertexInternalState<any>>,
      dependencies: Type['dependencies']
   ) {
      const injectedTransformations = this.internalStateTransformations.map(
         transformation => transformation(dependencies)
      )
      return incomingToOutgoingInternalStateStream(
         this.id,
         incomingInternalState$,
         injectedTransformations
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

   sideEffect<ActionCreator extends BaseActionCreator<any, any, never, never>>(
      actionCreator: ActionCreator,
      operation: (
         payload: ActionCreator extends ActionCreatorWithPayload<infer P, any>
            ? P
            : never,
         vertex: VertexInstance<Type>
      ) => void
   ) {
      this.sideEffects.push({ actionCreator, operation })
      return this
   }
}