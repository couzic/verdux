import { VertexConfig } from './VertexConfig'
import { VertexFieldsDefinition } from './VertexFieldsDefinition'

export type VertexInjectedConfig<
   Fields extends VertexFieldsDefinition = any,
   Dependencies extends Record<string, any> = any
> = {
   config: VertexConfig<Fields, Dependencies>
   injectedDependencies: Partial<Dependencies>
}
