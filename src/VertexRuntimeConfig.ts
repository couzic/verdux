import { VertexConfig } from './VertexConfig'
import { VertexType } from './VertexType'

export type VertexRuntimeConfig<Type extends VertexType> =
   | VertexConfig<Type>
   | {
        config: VertexConfig<Type>
        injectedDependencies: Partial<Type['dependencies']>
     }
