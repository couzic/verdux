import {
   ActionCreatorWithPayload,
   Reducer,
   Slice,
   UnknownAction
} from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { Observable } from 'rxjs'
import { VertexState } from '../state/VertexState'
import { IsDependablePlainObject, IsPlainObject } from '../util/IsPlainObject'
import { VertexId } from '../vertex/VertexId'
import { Dependable } from './Dependable'
import { HasLoadable } from './HasLoadable'
import { VertexFieldsDefinition } from './VertexFieldsDefinition'
import { VertexInjectedConfig } from './VertexInjectedConfig'
export interface VertexConfig<
   Fields extends VertexFieldsDefinition = any,
   Dependencies extends Record<string, any> = any
> {
   readonly rootVertex: VertexConfig
   readonly name: string
   readonly id: VertexId
   // readonly getInitialReduxState: () => any
   readonly reducer: Reducer
   // readonly dependencyProviders: DependencyProviders
   readonly upstreamVertices: VertexConfig[]

   isLoadableField(field: keyof Fields): boolean

   configureDownstreamVertex<
      ReduxFields extends Record<string, any>,
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
   ): IsPlainObject<DownstreamDependencies> extends false
      ? never
      : VertexConfig<
           {
              [K in keyof ReduxFields | UpstreamField]: K extends UpstreamField
                 ? Fields[K]
                 : K extends keyof ReduxFields
                   ? { loadable: false; value: ReduxFields[K] }
                   : never
           },
           {
              [K in
                 | keyof DownstreamDependencies
                 | keyof Dependencies]: K extends keyof DownstreamDependencies
                 ? DownstreamDependencies[K]
                 : K extends keyof Dependencies
                   ? Dependencies[K]
                   : never
           }
        >

   injectedWith(
      dependencies: Partial<Dependencies>
   ): VertexInjectedConfig<Fields, Dependencies>

   computeFromFields<
      K extends keyof Fields,
      Computers extends Record<
         string,
         (pickedState: { [PK in K]: Fields[PK]['value'] }) => any
      >
   >(
      fields: K[],
      computers: Dependable<Dependencies, Computers>
   ): IsPlainObject<Computers> extends false
      ? never
      : VertexConfig<
           {
              [FK in keyof Computers | keyof Fields]: FK extends keyof Computers
                 ? {
                      loadable: HasLoadable<Pick<Fields, K>>
                      value: ReturnType<Computers[FK]>
                   }
                 : FK extends keyof Fields
                   ? Fields[FK]
                   : never
           },
           Dependencies
        >

   loadFromFields<K extends keyof Fields, LoadableFields>(
      fields: K[],
      loaders: Dependable<
         Dependencies,
         {
            [LFK in keyof LoadableFields]: (pickedState: {
               [PK in K]: Fields[PK]['value']
            }) => Observable<LoadableFields[LFK]>
         }
      >
   ): IsDependablePlainObject<Dependencies, LoadableFields> extends false
      ? never
      : VertexConfig<
           {
              [FK in
                 | keyof LoadableFields
                 | keyof Fields]: FK extends keyof LoadableFields
                 ? {
                      loadable: true
                      value: LoadableFields[FK]
                   }
                 : FK extends keyof Fields
                   ? Fields[FK]
                   : never
           },
           Dependencies
        >

   load<LoadableFields>(
      loaders: Dependable<
         Dependencies,
         {
            [LFK in keyof LoadableFields]: Observable<LoadableFields[LFK]>
         }
      >
   ): IsDependablePlainObject<Dependencies, typeof loaders> extends false
      ? never
      : VertexConfig<
           {
              [FK in
                 | keyof LoadableFields
                 | keyof Fields]: FK extends keyof LoadableFields
                 ? {
                      loadable: true
                      value: LoadableFields[FK]
                   }
                 : FK extends keyof Fields
                   ? Fields[FK]
                   : never
           },
           Dependencies
        >

   loadFromFields$<K extends keyof Fields, LoadableFields>(
      fields: K[],
      loaders: Dependable<
         Dependencies,
         {
            [LFK in keyof LoadableFields]: (
               fields$: Observable<{
                  [PK in K]: Fields[PK]['value']
               }>
            ) => Observable<LoadableFields[LFK]>
         }
      >
   ): IsDependablePlainObject<Dependencies, typeof loaders> extends false
      ? never
      : VertexConfig<
           {
              [FK in
                 | keyof LoadableFields
                 | keyof Fields]: FK extends keyof LoadableFields
                 ? {
                      loadable: true
                      value: LoadableFields[FK]
                   }
                 : FK extends keyof Fields
                   ? Fields[FK]
                   : never
           },
           Dependencies
        >

   loadFromStream<Input, LoadableFields>(
      input$: Dependable<Dependencies, Observable<Input>>,
      loaders: Dependable<
         Dependencies,
         {
            [LFK in keyof LoadableFields]: (
               input: Input
            ) => Observable<LoadableFields[LFK]>
         }
      >
   ): IsDependablePlainObject<Dependencies, typeof loaders> extends false
      ? never
      : VertexConfig<
           {
              [FK in
                 | keyof LoadableFields
                 | keyof Fields]: FK extends keyof LoadableFields
                 ? {
                      loadable: true
                      value: LoadableFields[FK]
                   }
                 : FK extends keyof Fields
                   ? Fields[FK]
                   : never
           },
           Dependencies
        >

   reaction<ActionCreator extends BaseActionCreator<any, any>>(
      actionCreator: ActionCreator,
      mapper: (
         payload: ActionCreator extends ActionCreatorWithPayload<infer P, any>
            ? P
            : never,
         state: VertexState<any>
      ) => UnknownAction
   ): this

   fieldsReaction<K extends keyof Fields>(
      fields: K[],
      mapper: (pickedState: {
         [PK in K]: Fields[PK]['value']
      }) => UnknownAction
   ): this

   // TODO
   // reaction$<ActionCreator extends BaseActionCreator<any, any>>(
   //    actionCreator: ActionCreator,
   //    mapper: (
   //       payload$: Observable<
   //          ActionCreator extends ActionCreatorWithPayload<infer P, any>
   //             ? P
   //             : never
   //       >,
   //       state: VertexState<any>
   //    ) => Observable<UnknownAction>
   // ): this

   // TODO
   // fieldsReaction$<K extends keyof Fields>(
   //    fields: K[],
   //    mapper: (
   //       pickedState$: Observable<{
   //          [PK in K]: Fields[PK]['value']
   //       }>
   //    ) => Observable<UnknownAction>
   // ): this

   // TODO
   // computeFromLoadableFields()
   // Compute from fields even if they are not loaded yet. Allows more low level, manual handling.

   // TODO
   // loadableFieldsReaction()
   // react to loadable fields even when status is not loaded. In this case the operation input is a LoadableState, not a State
}
