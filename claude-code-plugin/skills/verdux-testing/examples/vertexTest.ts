// SNIPPET — the cross-skill import paths below are illustrative. In a real
// project, `rootVertexConfig` / `productPageVertexConfig` / `ApiClient` live
// wherever you defined them; adjust imports to your layout.
import { expect } from 'chai'
import { Subject } from 'rxjs'
import { createGraph, Graph, VertexInstance } from 'verdux'
import {
   rootVertexConfig,
   ApiClient
} from '../../verdux-dependency-injection/examples/rootWithDeps'
import { productPageVertexConfig } from '../../verdux-dependency-injection/examples/withDependenciesChain'

// Canonical vertex test. Builds a fresh graph per test; injects Subject-based
// service stubs; asserts on currentState / currentLoadableState; drives time
// synchronously with Subject.next().

describe('productPageVertex', () => {
   let graph: Graph
   let vertex: VertexInstance<typeof productPageVertexConfig>
   let productLoad$: Subject<{ id: string; name: string } | null>

   beforeEach(() => {
      productLoad$ = new Subject()
      const fakeApiClient: Partial<ApiClient> = {
         getProduct: () => productLoad$.asObservable(),
         listProducts: () => new Subject().asObservable()
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

   it('starts with no product loaded', () => {
      expect(vertex.currentLoadableState.status).to.equal('loading')
   })

   it('enters loaded state when the service emits', () => {
      // Drive the router-derived productId flow (mock the router match$
      // elsewhere if your test needs a specific id). Here we assume the
      // router fired at beforeEach time.
      productLoad$.next({ id: 'abc', name: 'Widget' })
      expect(vertex.currentLoadableState.status).to.equal('loaded')
      expect(vertex.currentState.product).to.deep.equal({
         id: 'abc',
         name: 'Widget'
      })
   })

   it('maps a 404 to null', () => {
      productLoad$.next(null)
      expect(vertex.currentState.product).to.equal(null)
   })
})
