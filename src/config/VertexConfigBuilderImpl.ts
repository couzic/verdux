import { Observable } from 'rxjs'
import { VertexType } from '../VertexType'
import { VertexInternalState } from '../state/VertexInternalState'
import { VertexStateKey } from '../state/VertexState'
import { incomingFromMultipleUpstreamInternalStates } from '../state/incomingFromMultipleUpstreamInternalStates'
import { incomingFromSingleUpstreamInternalState } from '../state/incomingFromSingleUpstreamInternalState'
import { DependencyProviders } from './DependencyProviders'
import { VertexConfig } from './VertexConfig'
import { VertexConfigBuilder } from './VertexConfigBuilder'
import { VertexConfigImpl } from './VertexConfigImpl'

export class VertexConfigBuilderImpl<
   BuilderType extends {
      readonlyFields: object
      loadableFields: object
      dependencies: object
   }
> implements VertexConfigBuilder<BuilderType>
{
   public readonly upstreamVertices: VertexConfig<any>[] = []
   private readonly upstreamFieldsByVertexId: Record<
      symbol,
      VertexStateKey<any>[]
   > = {}
   private readonly chainedDependencyProviders: Array<{
      vertexId: symbol
      dependencyProviders: DependencyProviders<any>
   }> = []

   constructor(
      public readonly vertexId: symbol,
      private readonly name: string
   ) {}

   isRoot(): boolean {
      return this.upstreamVertices.length === 0
   }

   addUpstreamVertex<
      Type extends VertexType,
      UpstreamField extends VertexStateKey<Type>,
      Dependencies extends object
   >(
      config: VertexConfig<Type>,
      options: {
         upstreamFields?: UpstreamField[] | undefined
         dependencies?:
            | {
                 [K in keyof Dependencies]: (
                    upstreamDependencies: Type['dependencies']
                 ) => Dependencies[K]
              }
            | undefined
      }
   ): VertexConfigBuilder<any> {
      this.upstreamVertices.push(config)
      this.upstreamFieldsByVertexId[config.id] = options.upstreamFields || []
      if (options.dependencies) {
         this.chainedDependencyProviders.push({
            vertexId: config.id,
            dependencyProviders: options.dependencies
         })
      }
      return this
   }

   findClosestCommonAncestor(): VertexConfigBuilderImpl<any> {
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

   addDependencies<Dependencies extends object>(dependencyProviders: {
      [K in keyof Dependencies]: (
         upstreamDependencies: BuilderType['dependencies']
      ) => Dependencies[K]
   }): VertexConfigBuilder<any> {
      this.chainedDependencyProviders.push({
         vertexId: this.vertexId,
         dependencyProviders
      })
      return this
   }

   buildVertexDependencies(
      dependenciesByUpstreamVertexId: Record<symbol, any>,
      injectedDependencies: any
   ): BuilderType['dependencies'] {
      let dependencies: any = {}
      this.chainedDependencyProviders.forEach(
         ({ vertexId, dependencyProviders }) => {
            const inputDependencies =
               vertexId === this.vertexId
                  ? dependencies
                  : dependenciesByUpstreamVertexId[vertexId]
            const dependencyNames = Object.keys(dependencyProviders || {})
            dependencyNames.forEach(depName => {
               const injectedDep = injectedDependencies[depName]
               if (injectedDep) {
                  dependencies[depName] = injectedDep
               } else {
                  dependencies[depName] =
                     dependencyProviders[depName](inputDependencies)
               }
            })
         }
      )
      return dependencies
   }

   buildIncomingFromSingleUpstreamInternalStateStream(
      upstreamInternalState$: Observable<VertexInternalState<any>>
   ): Observable<VertexInternalState<any>> {
      // TODO Remove check
      if (this.isRoot()) {
         throw Error('Not implemented for root vertex')
      }
      // TODO Remove check
      if (this.upstreamVertices.length > 1) {
         throw Error('Not implemented for multiple upstream vertices')
      }
      const upstreamVertex = this.upstreamVertices[0]
      const pickedFields = this.upstreamFieldsByVertexId[
         upstreamVertex.id
      ] as string[]
      return incomingFromSingleUpstreamInternalState(
         this.name,
         pickedFields,
         upstreamInternalState$
      )
   }

   buildIncomingFromMultipleUpstreamInternalStateStream(
      commonAncestorInternalState$: Observable<VertexInternalState<any>>,
      internalStateStreamByDirectAncestorId: Record<
         symbol,
         Observable<VertexInternalState<any>>
      >
   ): Observable<VertexInternalState<any>> {
      // TODO Remove check
      if (this.isRoot()) {
         throw Error('Not implemented for root vertex')
      }
      // TODO Remove check
      if (this.upstreamVertices.length === 1) {
         throw Error('Not implemented for single upstream vertex')
      }
      return incomingFromMultipleUpstreamInternalStates(
         this.name,
         commonAncestorInternalState$,
         this.upstreamVertices.map(upstreamVertex => ({
            internalState$:
               internalStateStreamByDirectAncestorId[upstreamVertex.id],
            pickedFields: this.upstreamFieldsByVertexId[upstreamVertex.id]
         }))
      )
   }
}
