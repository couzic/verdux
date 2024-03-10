import { VertexType } from '../vertex/VertexType'

export type VertexState<Type extends VertexType> = {
   [K in VertexStateKey<Type>]: K extends keyof Type['fields']
      ? K extends keyof Type['loadableFields']
         ? never // KEY CLASH PREVENTION. TODO implement runtime behavior ?
         : Type['fields'][K]
      : K extends keyof Type['loadableFields']
        ? Type['loadableFields'][K] | undefined
        : never
}

export type VertexErrorState<Type extends VertexType> = {
   [K in VertexStateKey<Type>]: K extends keyof Type['fields']
      ? K extends keyof Type['loadableFields']
         ? never // KEY CLASH PREVENTION. TODO implement runtime behavior ?
         : Type['fields'][K] | Error
      : K extends keyof Type['loadableFields']
        ? Type['loadableFields'][K] | undefined | Error
        : never
}

export type VertexLoadedState<Type extends VertexType> = {
   [K in VertexStateKey<Type>]: K extends keyof Type['fields']
      ? K extends keyof Type['loadableFields']
         ? never // KEY CLASH PREVENTION. TODO implement runtime behavior ?
         : Type['fields'][K]
      : K extends keyof Type['loadableFields']
        ? Type['loadableFields'][K]
        : never
}

export type VertexStateKey<Type extends VertexType> = keyof (Type['fields'] &
   Type['loadableFields'])
