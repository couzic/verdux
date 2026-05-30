import { createSlice } from '@reduxjs/toolkit'
import { distinctUntilChanged, filter, map, Observable, of } from 'rxjs'
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
            // URL param → observable stream of product id. The router is an
            // untyped dependency here, so we annotate the shape its match$
            // emits at the point of use.
            productId: (
               router.productPage.match$ as Observable<{
                  params: { id: string }
               }>
            ).pipe(
               filter(Boolean),
               map(match => match.params.id),
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
