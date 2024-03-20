import { VertexId } from '../vertex/VertexId'
import { VertexConfig } from './VertexConfig'
import { VertexConfigBuilder } from './VertexConfigBuilder'
import { VertexConfigImpl } from './VertexConfigImpl'
import { VertexFieldsDefinition } from './VertexFieldsDefinition'

export class VertexConfigBuilderImpl<
   Fields extends VertexFieldsDefinition = any,
   Dependencies extends Record<string, any> = any
> implements VertexConfigBuilder<Fields, Dependencies>
{
   public readonly upstreamVertices: VertexConfig<any>[] = []
   public readonly fieldsByUpstreamVertexId: Record<VertexId, string[]> = {}
   private buildDependencies: (
      dependenciesByVertexId: Record<VertexId, Record<string, any>>,
      injectedDependencies: Record<string, any>
   ) => Dependencies
   private readonly fieldIsLoadable: Record<string, boolean> = {}

   constructor(public readonly vertexId: symbol) {
      this.buildDependencies = () => ({}) as Dependencies
   }

   isRoot(): boolean {
      return this.upstreamVertices.length === 0
   }

   isLoadableField(field: keyof Fields): boolean {
      return this.fieldIsLoadable[field] || false
   }

   addUpstreamVertex<
      UpstreamFields extends VertexFieldsDefinition,
      UpstreamDependencies extends Record<string, any>
   >(
      config: VertexConfig<UpstreamFields, UpstreamDependencies>,
      options: {
         fields?: Array<keyof UpstreamFields>
         dependencies?: Array<keyof UpstreamDependencies>
      }
   ): VertexConfigBuilderImpl {
      this.upstreamVertices.push(config)
      this.fieldsByUpstreamVertexId[config.id] =
         (options.fields as string[]) || []
      const previousBuildDependencies = this.buildDependencies
      this.buildDependencies = (
         dependenciesByVertexId,
         injectedDependencies
      ) => {
         const previousDependencies = previousBuildDependencies(
            dependenciesByVertexId,
            {}
         )
         const currentDependencies: any = options.dependencies
            ? {}
            : dependenciesByVertexId[config.id]
         ;(options.dependencies || []).forEach(dependency => {
            // TODO No need to build the dependency if it is injected
            currentDependencies[dependency] =
               dependenciesByVertexId[config.id][dependency as any]
         })
         return {
            ...previousDependencies,
            ...currentDependencies,
            ...injectedDependencies
         }
      }
      return this
   }

   findClosestCommonAncestor(): VertexConfigBuilderImpl {
      if (this.isRoot()) {
         return this
      }
      if (this.upstreamVertices.length === 1) {
         // single upstream vertex
         return (this.upstreamVertices[0] as VertexConfigImpl<any>).builder
      } else {
         // multiple upstream vertices
         let commonAncestor: VertexConfigBuilderImpl<any> | undefined =
            undefined
         const isCommonAncestor = (candidate: VertexConfigBuilderImpl<any>) => {
            if (candidate.isRoot()) {
               return true
            }
            let candidateMatches = true
            this.upstreamVertices
               .filter(_ => _.id !== candidate.vertexId)
               .forEach(otherUpstreamVertex => {
                  if (!candidateMatches) return
                  let otherCandidate = (
                     otherUpstreamVertex as VertexConfigImpl<any>
                  ).builder
                  while (otherCandidate.vertexId !== candidate.vertexId) {
                     if (otherCandidate.isRoot()) {
                        candidateMatches = false
                        break
                     }
                     otherCandidate = otherCandidate.findClosestCommonAncestor()
                  }
               })
            return candidateMatches
         }
         this.upstreamVertices.forEach(upstreamVertex => {
            if (commonAncestor) return
            let candidate = (upstreamVertex as VertexConfigImpl<any>).builder
            let candidateIsCommonAncestor = isCommonAncestor(candidate)
            while (!candidateIsCommonAncestor && !candidate.isRoot()) {
               candidate = candidate.findClosestCommonAncestor()
               candidateIsCommonAncestor = isCommonAncestor(candidate)
            }
            if (isCommonAncestor(candidate)) {
               commonAncestor = candidate
            }
         })
         if (!commonAncestor)
            throw new Error('Impossible to find closest common ancestor') // TODO more detail
         return commonAncestor
      }
   }

   addDependencies<
      AddedDependencies extends Record<string, any>
   >(dependencyProviders: {
      [K in keyof AddedDependencies]: (
         dependencies: Dependencies
      ) => AddedDependencies[K]
   }): VertexConfigBuilderImpl {
      const previousBuildDependencies = this.buildDependencies
      this.buildDependencies = (
         dependenciesByVertexId,
         injectedDependencies
      ) => {
         const previousDependencies = previousBuildDependencies(
            dependenciesByVertexId,
            {}
         )
         const currentDependencies = {} as any
         Object.keys(dependencyProviders).forEach(key => {
            currentDependencies[key] = dependencyProviders[key](
               previousDependencies as any
            )
         })
         return {
            ...previousDependencies,
            ...currentDependencies,
            ...injectedDependencies
         }
      }
      return this
   }

   buildVertexDependencies(
      dependenciesByVertexId: Record<VertexId, Record<string, any>>,
      injectedDependencies: Record<string, any>
   ): Dependencies {
      return this.buildDependencies(
         dependenciesByVertexId,
         injectedDependencies
      )
   }
}
