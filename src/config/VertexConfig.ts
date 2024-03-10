import {
   ActionCreatorWithPayload,
   Reducer,
   Slice,
   UnknownAction
} from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { Observable } from 'rxjs'
import { PickedLoadedVertexState } from '../state/PickedLoadedVertexState'
import { VertexStateKey } from '../state/VertexState'
import { IsDependablePlainObject, IsPlainObject } from '../util/IsPlainObject'
import { Match } from '../util/Match'
import { VertexId } from '../vertex/VertexId'
import { VertexInstance } from '../vertex/VertexInstance'
import { VertexType } from '../vertex/VertexType'
import { Dependable } from './Dependable'
import { VertexRuntimeConfig } from './VertexRuntimeConfig'

export interface VertexConfig<Type extends VertexType> {
   readonly rootVertex: VertexConfig<any>
   readonly name: string
   readonly id: VertexId
   // readonly getInitialReduxState: () => any
   readonly reducer: Reducer
   // readonly dependencyProviders: DependencyProviders
   readonly upstreamVertices: VertexConfig<any>[]

   isLoadableField(field: VertexStateKey<Type>): boolean

   configureDownstreamVertex<
      ReduxFields extends Record<string, unknown>,
      UpstreamField extends VertexStateKey<Type> = never,
      Dependencies extends Record<string, any> = {}
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
            [K in keyof Dependencies]: (
               upstreamDependencies: Type['dependencies']
            ) => Dependencies[K]
         }
      }
   ): VertexConfig<{
      fields: {
         [K in
            | keyof ReduxFields
            | (UpstreamField & keyof Type['fields'])]: K extends UpstreamField
            ? Type['fields'][K] // Upstream field overwrites redux field. TODO make sure runtime works the same way
            : K extends keyof ReduxFields
              ? ReduxFields[K]
              : never
      }
      loadableFields: {
         [K in UpstreamField &
            keyof Type['loadableFields']]: Type['loadableFields'][K]
      }
      dependencies: {
         [D in
            | keyof Type['dependencies']
            | keyof Dependencies]: D extends keyof Dependencies
            ? Dependencies[D]
            : D extends keyof Type['dependencies']
              ? Type['dependencies'][D]
              : never
      }
   }>

   injectedWith(
      dependencies: Partial<Type['dependencies']>
   ): VertexRuntimeConfig<Type>

   computeFromFields<
      K extends VertexStateKey<Type>,
      Computers extends Record<
         string,
         (pickedFields: {
            [PK in keyof PickedLoadedVertexState<
               Type,
               K
            >]: PickedLoadedVertexState<Type, K>[PK]
         }) => any
      >
   >(
      fields: K[],
      computers: Dependable<Type['dependencies'], Computers>
   ): IsPlainObject<Computers> extends false
      ? never
      : Match<K, keyof Type['loadableFields']> extends true
        ? VertexConfig<{
             fields: Type['fields']
             loadableFields: {
                [LFK in
                   | keyof Type['loadableFields']
                   | keyof Computers]: LFK extends keyof Computers
                   ? ReturnType<Computers[LFK]>
                   : LFK extends keyof Type['loadableFields']
                     ? Type['loadableFields'][LFK]
                     : never
             }
             dependencies: Type['dependencies']
          }>
        : VertexConfig<{
             fields: {
                [FK in
                   | keyof Type['fields']
                   | keyof Computers]: FK extends keyof Computers
                   ? ReturnType<Computers[FK]>
                   : FK extends keyof Type['fields']
                     ? Type['fields'][FK]
                     : never
             }
             loadableFields: Type['loadableFields']
             dependencies: Type['dependencies']
          }>

   loadFromFields<K extends VertexStateKey<Type>, LoadableFields>(
      fields: K[],
      loaders: Dependable<
         Type['dependencies'],
         {
            [LFK in keyof LoadableFields]: (fields: {
               [FK in K]: FK extends keyof Type['loadableFields']
                  ? Type['loadableFields'][FK]
                  : FK extends keyof Type['fields']
                    ? Type['fields'][FK]
                    : never
            }) => Observable<LoadableFields[LFK]>
         }
      >
   ): IsDependablePlainObject<Type['dependencies'], LoadableFields> extends true
      ? VertexConfig<{
           fields: Type['fields']
           loadableFields: {
              [P in keyof (Type['loadableFields'] &
                 LoadableFields)]: P extends keyof LoadableFields
                 ? LoadableFields[P]
                 : P extends keyof Type['loadableFields']
                   ? Type['loadableFields'][P]
                   : never
           }
           dependencies: Type['dependencies']
        }>
      : never

   load<LoadableFields>(
      loaders: Dependable<
         Type['dependencies'],
         {
            [LFK in keyof LoadableFields]: Observable<LoadableFields[LFK]>
         }
      >
   ): IsDependablePlainObject<Type['dependencies'], typeof loaders> extends true
      ? VertexConfig<{
           fields: Type['fields']
           loadableFields: {
              [P in keyof (Type['loadableFields'] &
                 LoadableFields)]: P extends keyof LoadableFields
                 ? LoadableFields[P]
                 : P extends keyof Type['loadableFields']
                   ? Type['loadableFields'][P]
                   : never
           }
           dependencies: Type['dependencies']
        }>
      : never

   loadFromFields$<K extends VertexStateKey<Type>, LoadableFields>(
      fields: K[],
      loaders: Dependable<
         Type['dependencies'],
         {
            [LFK in keyof LoadableFields]: (
               fields$: Observable<{
                  [FK in K]: FK extends keyof Type['loadableFields']
                     ? Type['loadableFields'][FK]
                     : FK extends keyof Type['fields']
                       ? Type['fields'][FK]
                       : never
               }>
            ) => Observable<LoadableFields[LFK]>
         }
      >
   ): IsDependablePlainObject<Type['dependencies'], typeof loaders> extends true
      ? VertexConfig<{
           fields: Type['fields']
           loadableFields: {
              [P in keyof (Type['loadableFields'] &
                 LoadableFields)]: P extends keyof LoadableFields
                 ? LoadableFields[P]
                 : P extends keyof Type['loadableFields']
                   ? Type['loadableFields'][P]
                   : never
           }
           dependencies: Type['dependencies']
        }>
      : never

   loadFromStream<Input, LoadableFields>(
      input$: Dependable<Type['dependencies'], Observable<Input>>,
      loaders: Dependable<
         Type['dependencies'],
         {
            [LFK in keyof LoadableFields]: (
               input: Input
            ) => Observable<LoadableFields[LFK]>
         }
      >
   ): IsDependablePlainObject<Type['dependencies'], typeof loaders> extends true // TODO ensure compilation error when passing function
      ? VertexConfig<{
           fields: Type['fields']
           loadableFields: {
              [P in keyof (Type['loadableFields'] &
                 LoadableFields)]: P extends keyof LoadableFields
                 ? LoadableFields[P]
                 : P extends keyof Type['loadableFields']
                   ? Type['loadableFields'][P]
                   : never
           }
           dependencies: Type['dependencies']
        }>
      : never

   reaction<ActionCreator extends BaseActionCreator<any, any>>(
      actionCreator: ActionCreator,
      operation: (
         payload$: Observable<
            ActionCreator extends ActionCreatorWithPayload<infer P, any>
               ? P
               : never
         >,
         vertex: VertexInstance<Type>
      ) => Observable<UnknownAction>
   ): this

   fieldsReaction<K extends VertexStateKey<Type>>(
      fields: K[],
      operation: (fields: {
         [FK in K]: FK extends keyof Type['loadableFields']
            ? Type['loadableFields'][FK]
            : FK extends keyof Type['fields']
              ? Type['fields'][FK]
              : never
      }) => UnknownAction
   ): this

   // TODO
   // computeFromLoadableFields()
   // Compute from fields even if they are not loaded yet. Allows more low level, manual handling.

   // TODO
   // loadableFieldsReaction()
   // react to loadable fields even when status is not loaded. In this case the operation input is a LoadableState, not a State
}
