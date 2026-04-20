import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { filter, map, mergeMap, of } from 'rxjs'
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
   .withDependencies(({ router, apiClient }, vertex) =>
      vertex.load({
         product: router.productPage.match$.pipe(
            filter(Boolean),
            map(({ params }) => params.id),
            mergeMap(id => apiClient.getProduct(id))
         )
      })
   )

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
