import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { of } from 'rxjs'
import { rootVertexConfig } from '../../verdux-dependency-injection/examples/rootWithDeps'

// Support file for ProductPage.tsx. A real project would colocate this with
// the page component and load `product` / `relatedProducts` from a service
// (see verdux-graph-design). Here the loaders use static observables so the
// example is self-contained and the field types line up with the component.

interface Product {
   id: string
   name: string
}

interface ProductPageState {
   cart: string[]
   selected: string | null
}

const slice = createSlice({
   name: 'productPage',
   initialState: { cart: [], selected: null } as ProductPageState,
   reducers: {
      addToCart: (state, action: PayloadAction<string>) => {
         state.cart.push(action.payload)
      },
      select: (state, action: PayloadAction<string>) => {
         state.selected = action.payload
      }
   }
})

export const productPageActions = slice.actions

export const productPageVertexConfig = rootVertexConfig
   .configureDownstreamVertex({ slice })
   .withDependencies((_deps, vertex) =>
      vertex
         .load({
            product: of<Product | null>({ id: '1', name: 'Widget' })
         })
         .loadFromFields(['product'], {
            relatedProducts: ({ product }) =>
               of<Product[]>(product ? [{ id: '2', name: 'Gadget' }] : [])
         })
   )
