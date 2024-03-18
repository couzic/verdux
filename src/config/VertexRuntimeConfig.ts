import { VertexConfig } from './VertexConfig'
import { VertexFieldsDefinition } from './VertexFieldsDefinition'

export type VertexRuntimeConfig<
   Fields extends VertexFieldsDefinition = any,
   Dependencies extends Record<string, any> = any
> =
   | VertexConfig<Fields, Dependencies>
   | {
        config: VertexConfig<Fields, Dependencies>
        injectedDependencies: Partial<Dependencies>
     }
