// SNIPPET — the cross-skill import paths below are illustrative. Adjust
// imports to match your project's layout.
import { expect } from 'chai'
import { of, Subject } from 'rxjs'
import { createGraph, Graph, Vertex } from 'verdux'
import {
   rootVertexConfig,
   ApiClient
} from '../../dependency-injection/examples/rootWithDeps'
import { productPageVertexConfig } from '../../dependency-injection/examples/withDependenciesChain'

// Rerender-minimization test: subscribe to vertex.pick([...]) and count
// emissions. pick() only emits when a listed field actually changes, so if
// an unrelated action bumps emissions, you have a regression.

describe('productPageVertex pick() emissions', () => {
   let graph: Graph
   let vertex: Vertex<typeof productPageVertexConfig>
   let productLoad$: Subject<{ id: string; name: string } | null>

   beforeEach(() => {
      productLoad$ = new Subject()
      const fakeApiClient: Partial<ApiClient> = {
         getProduct: () => productLoad$.asObservable(),
         listProducts: () => of<unknown[]>([])
      }
      graph = createGraph({
         vertices: [
            rootVertexConfig.injectedWith({
               apiClient: fakeApiClient as ApiClient
            }),
            productPageVertexConfig
         ]
      })
      vertex = graph.getVertexInstance(productPageVertexConfig)
   })

   it('emits once on initial load, again only when the picked field changes', () => {
      let emissions = 0
      vertex.pick(['product']).subscribe(() => emissions++)
      expect(emissions).to.equal(1) // initial emission

      productLoad$.next({ id: 'abc', name: 'Widget' })
      expect(emissions).to.equal(2) // product changed

      // Dispatch an action that changes a different vertex or unrelated
      // flag; emissions must stay at 2.
      graph.dispatch({ type: 'some/unrelatedAction' })
      expect(emissions).to.equal(2)
   })
})
