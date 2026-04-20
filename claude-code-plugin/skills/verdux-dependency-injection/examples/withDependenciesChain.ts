import { createSlice } from '@reduxjs/toolkit'
import {
   distinctUntilChanged,
   filter,
   map,
   mergeMap,
   of,
   switchMap
} from 'rxjs'
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
   .withDependencies(({ apiClient, router }, vertex) =>
      vertex
         .load({
            // URL param → observable stream of product id
            productId: router.productPage.match$.pipe(
               filter(Boolean),
               map(({ params }) => params.id as string),
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
   )
