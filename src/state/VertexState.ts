import { VertexType } from '../VertexType'

export type VertexState<Type extends VertexType> = {
   [K in VertexStateKey<Type>]: K extends keyof Type['loadableFields']
      ? Type['loadableFields'][K] | undefined
      : K extends keyof Type['readonlyFields']
      ? Type['readonlyFields'][K]
      : K extends keyof Type['reduxState']
      ? Type['reduxState'][K]
      : never
}

export type VertexErrorState<Type extends VertexType> = {
   [K in VertexStateKey<Type>]: K extends keyof Type['loadableFields']
      ? Type['loadableFields'][K] | undefined | Error
      : K extends keyof Type['readonlyFields']
      ? Type['readonlyFields'][K] | Error
      : K extends keyof Type['reduxState']
      ? Type['reduxState'][K]
      : never
}

export type VertexLoadedState<Type extends VertexType> = {
   [K in VertexStateKey<Type>]: K extends keyof Type['loadableFields']
      ? Type['loadableFields'][K]
      : K extends keyof Type['readonlyFields']
      ? Type['readonlyFields'][K]
      : K extends keyof Type['reduxState']
      ? Type['reduxState'][K]
      : never
}

export type VertexStateKey<Type extends VertexType> =
   keyof (Type['reduxState'] & Type['readonlyFields'] & Type['loadableFields'])
