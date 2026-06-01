import { createSlice } from '@reduxjs/toolkit'
import { distinctUntilChanged, map, Observable, of } from 'rxjs'
import { rootVertexConfig } from './rootWithDeps'

// The classic `.withDependencies((deps, vertex) => vertex.<ops>(...))` shape.
// Everything chained inside the callback becomes part of the vertex behavior
// and receives resolved service instances rather than hardcoded imports.

const slice = createSlice({
   name: 'productPage',
   initialState: {},
   reducers: {}
})

export const productPageVertexConfig = rootVertexConfig
   .configureDownstreamVertex({ slice })
   .withDependencies(({ apiClient, router }, vertex) => {
      // A standard router (TanStack, React Router, …) exposes an imperative
      // subscribe(), not an Observable. Adapt it ONCE into a value-stream of
      // the current route params, then load off it. A route match is a
      // value-stream — its latest value is always meaningful — so `load` is
      // its right home. (An *event* stream would be bridged to a dispatched
      // action instead; see the operations skill.)
      const routeParams$ = new Observable<{ id: string }>(subscriber => {
         const current = () => {
            const { matches } = router.state
            return matches[matches.length - 1].params
         }
         subscriber.next(current()) // emit the current params synchronously
         // subscribe() returns its own teardown — hand it back as unsubscribe.
         return router.subscribe('onResolved', () => subscriber.next(current()))
      })
      return vertex
         .load({
            // URL param → observable stream of product id.
            productId: routeParams$.pipe(
               map(({ id }) => id),
               distinctUntilChanged()
            )
         })
         .loadFromFields(['productId'], {
            product: ({ productId }) => apiClient.getProduct(productId)
         })
         .loadFromFields(['product'], {
            // Cascade load: related products load once the product itself
            // resolves. Returning `of([])` short-circuits when product is
            // null (404 case).
            relatedProducts: ({ product }) =>
               !product ? of([]) : apiClient.listProducts()
         })
   })
