import { Reducer, Slice } from "@reduxjs/toolkit";
import { ReducerWithInitialState } from "@reduxjs/toolkit/dist/createReducer";
import { IsPlainObject } from "./IsPlainObject";
import { Match } from "./Match";
import { PickedLoadedVertexState } from "./PickedLoadedVertexState";
import { RootVertexConfig } from "./RootVertexConfig";
import { VertexStateKey } from "./VertexState";
import { VertexType } from "./VertexType";

export interface VertexConfig<Type extends VertexType> {
  readonly rootVertex: RootVertexConfig<any>
  readonly name: string
  readonly id: symbol
  readonly getInitialState: () => Readonly<Type['reduxState']>
  readonly reducer: Reducer<Type['reduxState']>
  readonly upstreamVertex: VertexConfig<any> | undefined

  configureDownstreamVertex<ReduxState extends object, UpstreamField extends VertexStateKey<Type> = never, LoadableFields extends object = {}>(options: ({
    slice: Slice<ReduxState>,
  } | {
    name: string,
    reducer: ReducerWithInitialState<ReduxState>,
  }) & {
    upstreamFields?: UpstreamField[]
  }):
    VertexConfig<{
      reduxState: ReduxState,
      readonlyFields: { [K in UpstreamField]: K extends keyof Type['reduxState']
        ? Type['reduxState'][K] // TODO readonlyFields & loadableFields
        : never },
      loadableFields: LoadableFields,
      dependencies: Type['dependencies']
    }>

  computeFromFields<
    K extends VertexStateKey<Type>,
    Computers extends Record<
      string,
      (
        pickedFields: {
          [PK in keyof PickedLoadedVertexState<
            Type,
            K
          >]: PickedLoadedVertexState<Type, K>[PK]
        },
      ) => any
    >
  >(
    fields: K[],
    computers: Computers
  ): IsPlainObject<Computers> extends false
    ? never
    : Match<K, keyof Type['loadableFields']> extends true
    ? VertexConfig<{
      reduxState: Type['reduxState'],
      readonlyFields: Type['readonlyFields'],
      loadableFields: {
        [LFK in (keyof Type['loadableFields']) | (keyof Computers)]: LFK extends keyof Computers
        ? ReturnType<Computers[LFK]>
        : LFK extends keyof Type['loadableFields']
        ? Type['loadableFields'][LFK]
        : never
      },
      dependencies: Type['dependencies']
    }>
    : VertexConfig<{
      reduxState: Type['reduxState'],
      readonlyFields: {
        [RFK in (keyof Type['readonlyFields']) | (keyof Computers)]: RFK extends keyof Computers
        ? ReturnType<Computers[RFK]>
        : RFK extends keyof Type['readonlyFields']
        ? Type['readonlyFields'][RFK]
        : never
      },
      loadableFields: Type['loadableFields'],
      dependencies: Type['dependencies']
    }>
}
