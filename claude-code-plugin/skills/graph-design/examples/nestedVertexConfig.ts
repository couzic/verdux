import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { distinctUntilChanged, map, switchMap, Observable, of } from 'rxjs'
import { rootVertexConfig } from './rootVertexConfig'

// A three-level nested graph:
//   root
//    └── productPage (owns `product`, loaded from URL)
//         └── productReviews (upstreamFields: ['product'])

// -------- parent vertex ------------------------------------------------------

const productPageSlice = createSlice({
   name: 'productPage',
   initialState: {},
   reducers: {}
})

export const productPageVertexConfig = rootVertexConfig
   .configureDownstreamVertex({ slice: productPageSlice })
   .withDependencies(({ router, apiClient }, vertex) => {
      // A standard router exposes an imperative subscribe(), not an Observable.
      // Adapt it once into a value-stream of the current route params, then
      // load off it (a route match is a value-stream — `load` is its home).
      const routeParams$ = new Observable<{ id: string }>(subscriber => {
         const current = () => {
            const { matches } = router.state
            return matches[matches.length - 1].params
         }
         subscriber.next(current())
         return router.subscribe('onResolved', () => subscriber.next(current()))
      })
      return vertex.load({
         product: routeParams$.pipe(
            map(({ id }) => id),
            distinctUntilChanged(),
            // switchMap, not mergeMap: a new route id must cancel the in-flight
            // fetch for the previous one, or fast navigation races stale results.
            switchMap(id => apiClient.getProduct(id))
         )
      })
   })

// -------- child vertex with upstreamFields ----------------------------------

interface ProductReviewsState {
   pageSize: number
}

const productReviewsSlice = createSlice({
   name: 'productReviews',
   initialState: { pageSize: 20 } as ProductReviewsState,
   reducers: {
      pageSizeChanged: (state, action: PayloadAction<number>) => {
         state.pageSize = action.payload
      }
   }
})

export const productReviewsActions = productReviewsSlice.actions

export const productReviewsVertexConfig = productPageVertexConfig
   .configureDownstreamVertex({
      slice: productReviewsSlice,
      // Re-run the subgraph when the parent's `product` changes, OR when our
      // own `pageSize` slice changes. Without this array, product changes
      // would not reach us.
      upstreamFields: ['product']
   })
   .withDependencies(({ apiClient }, vertex) =>
      vertex.loadFromFields(['product', 'pageSize'], {
         reviews: ({ product, pageSize }) =>
            !product ? of([]) : apiClient.listReviews(product.id, pageSize)
      })
   )
