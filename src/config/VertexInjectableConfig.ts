import { VertexConfig } from './VertexConfig'
import { VertexFieldsDefinition } from './VertexFieldsDefinition'
import { VertexInjectedConfig } from './VertexInjectedConfig'

export type VertexInjectableConfig<
   Fields extends VertexFieldsDefinition = any,
   Dependencies extends Record<string, any> = any
> =
   | VertexConfig<Fields, Dependencies>
   | VertexInjectedConfig<Fields, Dependencies>

export const isInjectedConfig = <
   Fields extends VertexFieldsDefinition,
   Dependencies extends Record<string, any>
>(
   injectableConfig: VertexInjectableConfig<Fields, Dependencies>
): injectableConfig is VertexInjectedConfig<Fields, Dependencies> =>
   'config' in injectableConfig
