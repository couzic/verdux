import { VertexType } from '../vertex/VertexType'
import { VertexConfig } from './VertexConfig'

export type VertexRuntimeConfig<Type extends VertexType> =
   | VertexConfig<Type>
   | {
        config: VertexConfig<Type>
        injectedDependencies: Partial<Type['dependencies']>
     }
