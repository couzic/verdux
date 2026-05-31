import { createSlice } from '@reduxjs/toolkit'
import { ajax } from 'rxjs/ajax'
import { catchError, map, of, throwError } from 'rxjs'
import { configureRootVertex } from 'verdux'

// Stub dependencies so this file compiles on its own. In a real project these
// live in their own modules (services/apiClient.ts, router.ts, etc.) and get
// imported here.

export interface Product {
   id: string
   name: string
}

const createApiClient = () => ({
   getProduct: (id: string) =>
      ajax
         .getJSON<Product>(`/api/products/${id}`)
         .pipe(
            catchError(err =>
               err.status === 404 ? of(null) : throwError(() => err)
            )
         ),
   listProducts: () =>
      ajax.getJSON<{ items: unknown[] }>('/api/products').pipe(map(r => r.items)),
   search: (q: string) =>
      ajax.getJSON(`/api/products?q=${encodeURIComponent(q)}`),
   listReviews: (_productId: string, _pageSize: number) =>
      of([] as unknown[])
})

const router = {
   productPage: {
      match$: of({ params: { id: 'placeholder' } as { id: string } })
   }
} as any

// Empty slice — the root is just a dependency well.
const rootSlice = createSlice({
   name: 'root',
   initialState: {},
   reducers: {}
})

export const rootVertexConfig = configureRootVertex({
   slice: rootSlice,
   dependencies: {
      router: () => router,
      apiClient: createApiClient
   }
})
