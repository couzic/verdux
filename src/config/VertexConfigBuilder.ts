import { VertexConfig } from './VertexConfig'
import { VertexFieldsDefinition } from './VertexFieldsDefinition'

export interface VertexConfigBuilder<
   Fields extends VertexFieldsDefinition,
   Dependencies extends Record<string, any>
> {
   addUpstreamVertex<
      UpstreamFields extends VertexFieldsDefinition,
      UpstreamDependencies extends Record<string, any>,
      const PulledFields extends keyof UpstreamFields = never,
      PulledDependencies extends
         keyof UpstreamDependencies = keyof UpstreamDependencies
   >(
      config: VertexConfig<UpstreamFields, UpstreamDependencies>,
      options: {
         fields?: Array<PulledFields>
         dependencies?: Array<PulledDependencies>
      }
   ): VertexConfigBuilder<
      {
         [K in PulledFields | keyof Fields]: K extends PulledFields
            ? UpstreamFields[K]
            : K extends keyof Fields
              ? Fields[K]
              : never
      },
      {
         [K in
            | PulledDependencies
            | keyof Dependencies]: K extends PulledDependencies
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
