import {
   ActionCreatorWithPayload,
   Reducer,
   Slice,
   UnknownAction
} from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { Observable } from 'rxjs'
import { VertexInstance } from '../VertexInstance'
import { VertexType } from '../VertexType'
import { PickedVertexLoadedState } from '../state/PickedVertexLoadedState'
import { VertexStateKey } from '../state/VertexState'
import { IsDependablePlainObject, IsPlainObject } from '../util/IsPlainObject'
import { Match } from '../util/Match'
import { Dependable } from './Dependable'
import { VertexRuntimeConfig } from './VertexRuntimeConfig'

export interface VertexConfig<Type extends VertexType> {
   readonly rootVertex: VertexConfig<any>
   readonly name: string
   readonly id: symbol
   readonly getInitialState: () => Readonly<Type['reduxState']>
   readonly reducer: Reducer<Type['reduxState']>
   readonly upstreamVertices: VertexConfig<any>[]

   configureDownstreamVertex<
      ReduxState extends object,
      UpstreamField extends VertexStateKey<Type> = never,
      Dependencies extends object = {}
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
         dependencies?: {
            [K in keyof Dependencies]: (
               upstreamDependencies: Type['dependencies']
            ) => Dependencies[K]
         }
      }
   ): VertexConfig<{
      reduxState: ReduxState
      readonlyFields: {
         [K in UpstreamField &
            (
               | keyof Type['reduxState']
               | keyof Type['readonlyFields']
            )]: K extends keyof Type['readonlyFields']
            ? Type['readonlyFields'][K]
            : K extends keyof Type['reduxState']
              ? Type['reduxState'][K]
              : never
      }
      loadableFields: {
         [K in UpstreamField &
            keyof Type['loadableFields']]: K extends keyof Type['loadableFields']
            ? Type['loadableFields'][K]
            : never
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
            [PK in keyof PickedVertexLoadedState<
               Type,
               K
            >]: PickedVertexLoadedState<Type, K>[PK]
         }) => any
      >
   >(
      fields: K[],
      computers: Dependable<Type['dependencies'], Computers>
   ): IsPlainObject<Computers> extends false
      ? never
      : Match<K, keyof Type['loadableFields']> extends true
        ? VertexConfig<{
             reduxState: Type['reduxState']
             readonlyFields: Type['readonlyFields']
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
             reduxState: Type['reduxState']
             readonlyFields: {
                [RFK in
                   | keyof Type['readonlyFields']
                   | keyof Computers]: RFK extends keyof Computers
                   ? ReturnType<Computers[RFK]>
                   : RFK extends keyof Type['readonlyFields']
                     ? Type['readonlyFields'][RFK]
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
                  : FK extends keyof Type['readonlyFields']
                    ? Type['loadableFields'][FK]
                    : FK extends keyof Type['reduxState']
                      ? Type['reduxState'][FK]
                      : never
            }) => Observable<LoadableFields[LFK]>
         }
      >
   ): IsDependablePlainObject<Type['dependencies'], LoadableFields> extends true
      ? VertexConfig<{
           reduxState: Type['reduxState']
           readonlyFields: Type['readonlyFields']
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
           reduxState: Type['reduxState']
           readonlyFields: Type['readonlyFields']
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
                     : FK extends keyof Type['readonlyFields']
                       ? Type['readonlyFields'][FK]
                       : FK extends keyof Type['reduxState']
                         ? Type['reduxState'][FK]
                         : never
               }>
            ) => Observable<LoadableFields[LFK]>
         }
      >
   ): IsDependablePlainObject<Type['dependencies'], typeof loaders> extends true
      ? VertexConfig<{
           reduxState: Type['reduxState']
           readonlyFields: Type['readonlyFields']
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
           reduxState: Type['reduxState']
           readonlyFields: Type['readonlyFields']
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
            : FK extends keyof Type['readonlyFields']
              ? Type['loadableFields'][FK]
              : FK extends keyof Type['reduxState']
                ? Type['reduxState'][FK]
                : never
      }) => UnknownAction
   ): this

   sideEffect<ActionCreator extends BaseActionCreator<any, any>>(
      actionCreator: ActionCreator,
      operation: (
         payload: ActionCreator extends ActionCreatorWithPayload<infer P, any>
            ? P
            : never,
         vertex: VertexInstance<Type> // TODO limited vertex instance ? (no dispatch)
      ) => void
   ): this

   // TODO
   // computeFromLoadableFields()
   // Compute from fields even if they are not loaded yet. Allows more low level, manual handling.

   // TODO
   // loadableFieldsReaction()
   // react to loadable fields even when status is not loaded. In this case the operation input is a LoadableState, not a State
}
