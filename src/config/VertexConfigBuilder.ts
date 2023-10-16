import { VertexType } from '../VertexType'
import { VertexStateKey } from '../state/VertexState'
import { VertexConfig } from './VertexConfig'

export interface VertexConfigBuilder<
   BuilderType extends {
      readonlyFields: object
      loadableFields: object
      dependencies: object
   }
> {
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
      readonlyFields: {
         [K in
            | keyof BuilderType['readonlyFields']
            | (UpstreamField &
                 (
                    | keyof Type['readonlyFields']
                    | keyof Type['reduxState']
                 ))]: K extends keyof Type['readonlyFields']
            ? Type['readonlyFields'][K]
            : K extends keyof Type['reduxState']
            ? Type['reduxState'][K]
            : K extends keyof BuilderType['readonlyFields']
            ? BuilderType['readonlyFields'][K]
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
      readonlyFields: BuilderType['readonlyFields']
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
