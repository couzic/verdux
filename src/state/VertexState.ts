import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'

export type VertexState<Fields extends VertexFieldsDefinition> = {
   [K in keyof Fields]: Fields[K]['loadable'] extends true
      ? Fields[K]['value'] | undefined
      : Fields[K]['value']
}

export type VertexLoadedState<Fields extends VertexFieldsDefinition> = {
   [K in keyof Fields]: Fields[K]['value']
}
