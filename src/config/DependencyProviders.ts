import { VertexType } from '../vertex/VertexType'

export type DependencyProviders<Type extends VertexType = any> = Record<
   string,
   (dependencies: Type['dependencies']) => any
>
