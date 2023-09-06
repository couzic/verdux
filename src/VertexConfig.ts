import { Reducer, Slice } from '@reduxjs/toolkit'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { Observable } from 'rxjs'
import { Dependable } from './Dependable'
import { DependencyProviders } from './DependencyProviders'
import { IsDependablePlainObject, IsPlainObject } from './IsPlainObject'
import { Match } from './Match'
import { PickedLoadedVertexState } from './PickedLoadedVertexState'
import { VertexRuntimeConfig } from './VertexRuntimeConfig'
import { VertexStateKey } from './VertexState'
import { VertexType } from './VertexType'

export interface VertexConfig<Type extends VertexType> {
   readonly rootVertex: VertexConfig<any>
   readonly name: string
   readonly id: symbol
   readonly getInitialState: () => Readonly<Type['reduxState']>
   readonly reducer: Reducer<Type['reduxState']>
   readonly upstreamVertex: VertexConfig<any> | undefined
   readonly dependencyProviders: DependencyProviders

   configureDownstreamVertex<
      ReduxState extends object,
      UpstreamField extends VertexStateKey<Type> = never,
      LoadableFields extends object = {},
      Dependencies extends Record<string, () => any> = {}
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
         dependencies?: Dependencies
      }
   ): VertexConfig<{
      reduxState: ReduxState
      readonlyFields: {
         [K in UpstreamField]: K extends keyof Type['reduxState']
            ? Type['reduxState'][K] // TODO readonlyFields & loadableFields
            : never
      }
      loadableFields: LoadableFields
      dependencies: Type['dependencies']
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

   loadFromFields<K extends VertexStateKey<Type>, LoadableValues>(
      fields: K[],
      loaders: Dependable<
         Type['dependencies'],
         {
            [LVK in keyof LoadableValues]: (fields: {
               [FK in K]: FK extends keyof Type['loadableFields']
                  ? Type['loadableFields'][FK]
                  : FK extends keyof Type['readonlyFields']
                  ? Type['loadableFields'][FK]
                  : FK extends keyof Type['reduxState']
                  ? Type['reduxState'][FK]
                  : never
            }) => Observable<LoadableValues[LVK]>
         }
      >
   ): IsDependablePlainObject<Type['dependencies'], LoadableValues> extends true
      ? VertexConfig<{
           reduxState: Type['reduxState']
           readonlyFields: Type['readonlyFields']
           loadableFields: {
              [P in keyof (Type['loadableFields'] &
                 LoadableValues)]: P extends keyof LoadableValues
                 ? LoadableValues[P]
                 : P extends keyof Type['loadableFields']
                 ? Type['loadableFields'][P]
                 : never
           }
           dependencies: Type['dependencies']
        }>
      : never

   load<LoadableValues>(
      loaders: Dependable<
         Type['dependencies'],
         {
            [LVK in keyof LoadableValues]: Observable<LoadableValues[LVK]>
         }
      >
   ): IsDependablePlainObject<Type['dependencies'], typeof loaders> extends true
      ? VertexConfig<{
           reduxState: Type['reduxState']
           readonlyFields: Type['readonlyFields']
           loadableFields: {
              [P in keyof (Type['loadableFields'] &
                 LoadableValues)]: P extends keyof LoadableValues
                 ? LoadableValues[P]
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
            [LVK in keyof LoadableFields]: (
               fields$: Observable<{
                  [FK in K]: FK extends keyof Type['loadableFields']
                     ? Type['loadableFields'][FK]
                     : FK extends keyof Type['readonlyFields']
                     ? Type['readonlyFields'][FK]
                     : FK extends keyof Type['reduxState']
                     ? Type['reduxState'][FK]
                     : never
               }>
            ) => Observable<LoadableFields[LVK]>
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

   // TODO
   // computeFromLoadableFields()
   // Compute from fields even if they are not loaded yet. Allows more low level, manual handling.
}
