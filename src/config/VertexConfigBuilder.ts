import { VertexStateKey } from '../state/VertexState'
import { VertexType } from '../vertex/VertexType'
import { VertexConfig } from './VertexConfig'

export interface VertexConfigBuilder<BuilderType extends VertexType> {
   addUpstreamVertex<
      Type extends VertexType,
      UpstreamField extends VertexStateKey<Type>,
      Dependencies extends object
   >(
      config: VertexConfig<Type>,
      options: {
         upstreamFields?: UpstreamField[]
         dependencies?: {
            [K in keyof Dependencies]: (
               upstreamDependencies: Type['dependencies']
            ) => Dependencies[K]
         }
      }
   ): VertexConfigBuilder<{
      fields: {
         [K in
            | keyof BuilderType['fields']
            | (UpstreamField &
                 keyof Type['fields'])]: K extends keyof Type['fields']
            ? Type['fields'][K]
            : K extends keyof BuilderType['fields']
              ? BuilderType['fields'][K]
              : never
      }
      loadableFields: {
         [K in
            | keyof BuilderType['loadableFields']
            | (UpstreamField &
                 keyof Type['loadableFields'])]: K extends keyof Type['loadableFields']
            ? Type['loadableFields'][K]
            : K extends keyof BuilderType['loadableFields']
              ? BuilderType['loadableFields'][K]
              : never
      }
      dependencies: {
         [K in
            | keyof BuilderType['dependencies']
            | keyof Type['dependencies']]: K extends keyof Type['dependencies']
            ? Type['dependencies'][K]
            : K extends keyof BuilderType['dependencies']
              ? BuilderType['dependencies'][K]
              : never
      }
   }>

   addDependencies<Dependencies extends object>(dependencyProviders: {
      [K in keyof Dependencies]: (
         upstreamDependencies: BuilderType['dependencies']
      ) => Dependencies[K]
   }): VertexConfigBuilder<{
      fields: BuilderType['fields']
      loadableFields: BuilderType['loadableFields']
      dependencies: {
         [K in
            | keyof BuilderType['dependencies']
            | keyof Dependencies]: K extends keyof Dependencies
            ? Dependencies[K]
            : K extends keyof BuilderType['dependencies']
              ? BuilderType['dependencies'][K]
              : never
      }
   }>
}
