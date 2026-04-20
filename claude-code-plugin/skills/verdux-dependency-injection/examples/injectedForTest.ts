import { Subject } from 'rxjs'
import { createGraph } from 'verdux'
import { rootVertexConfig, ApiClient } from './rootWithDeps'
import { productPageVertexConfig } from './withDependenciesChain'

// Overriding dependencies for tests: pass `rootVertexConfig.injectedWith({...})`
// to createGraph in place of the raw config. Only override what the test needs;
// everything else resolves normally.

export const makeTestGraph = () => {
   // Subject-based stub: the test drives emissions with productLoad$.next(...)
   const productLoad$ = new Subject<{ id: string; name: string } | null>()

   const fakeApiClient: Partial<ApiClient> = {
      getProduct: () => productLoad$.asObservable(),
      listProducts: () => new Subject().asObservable()
   }

   const graph = createGraph({
      vertices: [
         rootVertexConfig.injectedWith({
            apiClient: fakeApiClient as ApiClient
         }),
         productPageVertexConfig
      ]
   })

   return { graph, productLoad$ }
}

// Usage in a test:
//   const { graph, productLoad$ } = makeTestGraph()
//   graph.dispatch(someAction)
//   productLoad$.next({ id: 'abc', name: 'Widget' })
//   expect(graph.getVertexInstance(productPageVertexConfig).currentState.product)
//      .to.deep.equal({ id: 'abc', name: 'Widget' })
