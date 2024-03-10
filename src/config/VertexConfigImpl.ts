import { Reducer, UnknownAction } from '@reduxjs/toolkit'
import { Observable } from 'rxjs'
import { VertexStateKey } from '../state/VertexState'
import { VertexType } from '../vertex/VertexType'
import { VertexConfig } from './VertexConfig'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { VertexInstance } from '../vertex/VertexInstance'
import { VertexId } from '../vertex/VertexId'
import { VertexConfigBuilderImpl } from './VertexConfigBuilderImpl'

export class VertexConfigImpl<Type extends VertexType>
   implements VertexConfig<Type>
{
   get rootVertex(): VertexConfig<any> {
      const upstreamVertices = this.upstreamVertices
      if (upstreamVertices.length === 0) return this as any
      return upstreamVertices[0].rootVertex
   }

   get upstreamVertices(): VertexConfig<any>[] {
      return this.builder.upstreamVertices
   }

   constructor(
      public readonly name: string,
      public readonly id: VertexId,
      public readonly getInitialState: () => Record<string, any>,
      public readonly reducer: Reducer<Record<string, any>>,
      public readonly builder: VertexConfigBuilderImpl<Type>
   ) {}

   isLoadableField(field: VertexStateKey<Type>) {
      return this.builder.isLoadableField(field)
   }

   // TODO Implement
   configureDownstreamVertex(
      options: any,
      upstreamFields?: string[],
      dependencies?: any
   ): any {
      return {} as any
      // return configureDownstreamVertex(options, builder =>
      //    builder.addUpstreamVertex(this, {
      //       upstreamFields: options.upstreamFields,
      //       dependencies: options.dependencies
      //    })
      // )
   }

   findClosestCommonAncestor() {
      return this.builder.findClosestCommonAncestor().vertexId
   }

   //  buildVertexDependencies(
   //     dependenciesByUpstreamVertexId: any,
   //     injectedDependencies: any
   //  ) {
   //     return this.builder.buildVertexDependencies(
   //        dependenciesByUpstreamVertexId,
   //        injectedDependencies
   //     )
   //  }

   //  createOutgoingInternalStateStream(
   //     incomingInternalState$: Observable<VertexInternalState<any>>,
   //     dependencies: Type['dependencies']
   //  ) {
   //     const injectedTransformations = this.internalStateTransformations.map(
   //        transformation => transformation(dependencies)
   //     )
   //     return incomingToOutgoingInternalStateStream(
   //        this.id,
   //        incomingInternalState$,
   //        injectedTransformations
   //     )
   //  }

   injectedWith(injectedDependencies: Partial<Type['dependencies']>): any {
      return {
         config: this,
         injectedDependencies
      }
   }

   computeFromFields(fields: any[], computers: any): any {
      // TODO mark fields as loadable if they are computed from loadable fields
      // this.internalStateTransformations.push(
      //    computeFromFieldsTransformation(fields, computers)
      // )
      return this
   }

   loadFromFields(fields: any[], loaders: any): any {
      // TODO mark fields as loadable
      // this.internalStateTransformations.push(
      //    loadFromFieldsTransformation(fields, loaders)
      // )
      return this
   }

   load(loaders: any): any {
      // TODO mark fields as loadable
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

   reaction(
      actionCreator: BaseActionCreator<any, any>,
      operation: (
         payload$: Observable<any>,
         vertex: VertexInstance<Type>
      ) => Observable<UnknownAction>
   ) {
      // this.reactions.push({ actionCreator, operation })
      return this
   }

   fieldsReaction<K extends VertexStateKey<Type>>(
      fields: K[],
      operation: (fields: any) => UnknownAction
   ) {
      // this.fieldsReactions.push({ fields, operation })
      return this
   }

   sideEffect<ActionCreator extends BaseActionCreator<any, any, never, never>>(
      actionCreator: ActionCreator,
      operation: (payload: ActionCreator, vertex: VertexInstance<Type>) => void
   ) {
      // this.sideEffects.push({ actionCreator, operation })
      return this
   }
}
