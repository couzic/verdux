import { VertexConfig } from './VertexConfig'
import { VertexFieldsDefinition } from './VertexFieldsDefinition'

export interface VertexConfigBuilder<
   Fields extends VertexFieldsDefinition,
   Dependencies extends Record<string, any>
> {
   addUpstreamVertex<
      UpstreamFields extends VertexFieldsDefinition,
      UpstreamDependencies extends Record<string, any>
   >(
      config: VertexConfig<UpstreamFields, UpstreamDependencies>,
      options: {
         fields?: Array<keyof UpstreamFields>
         dependencies?: Array<keyof UpstreamDependencies>
      }
   ): VertexConfigBuilder<
      {
         [K in
            | keyof UpstreamFields
            | keyof Fields]: K extends keyof UpstreamFields
            ? UpstreamFields[K]
            : K extends keyof Fields
              ? Fields[K]
              : never
      },
      {
         [K in
            | keyof UpstreamDependencies
            | keyof Dependencies]: K extends keyof UpstreamDependencies
            ? UpstreamDependencies[K]
            : K extends keyof Dependencies
              ? Dependencies[K]
              : never
      }
   >

   addDependencies<
      AddedDependencies extends Record<string, any>
   >(dependencyProviders: {
      [K in keyof AddedDependencies]: (
         dependencies: Dependencies
      ) => AddedDependencies[K]
   }): VertexConfigBuilder<
      Fields,
      {
         [K in
            | keyof AddedDependencies
            | keyof Dependencies]: K extends keyof AddedDependencies
            ? AddedDependencies[K]
            : K extends keyof Dependencies
              ? Dependencies[K]
              : never
      }
   >
}
