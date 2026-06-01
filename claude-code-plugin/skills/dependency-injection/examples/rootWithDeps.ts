import { createSlice } from '@reduxjs/toolkit'
import { ajax } from 'rxjs/ajax'
import { catchError, map, of, throwError } from 'rxjs'
import { configureRootVertex } from 'verdux'

// A dependency is typically a plain object of observable-returning methods.
// Returning observables (not promises) keeps the dependency compatible with
// verdux's .load / .loadFromFields / .loadFromFields$ operations.

export const createApiClient = () => ({
   getProduct: (id: string) =>
      ajax.getJSON(`/api/products/${id}`).pipe(
         // Map "not found" to an in-band null so the component can branch
         // without touching loadableState.errors.
         catchError(err =>
            err.status === 404 ? of(null) : throwError(() => err)
         )
      ),
   listProducts: () =>
      ajax
         .getJSON<{ items: unknown[] }>('/api/products')
         .pipe(map(r => r.items)),
   search: (query: string) =>
      ajax.getJSON(`/api/products?q=${encodeURIComponent(query)}`)
})

export type ApiClient = ReturnType<typeof createApiClient>

const rootSlice = createSlice({
   name: 'root',
   initialState: {},
   reducers: {}
})

export const rootVertexConfig = configureRootVertex({
   slice: rootSlice,
   dependencies: {
      // Existing singleton: arrow returning it.
      router: () => router,
      // Factory producing a fresh instance: pass the bare factory.
      apiClient: createApiClient,
      // Trivial deps can be literal factories — this resolves to a Date.
      clock: () => new Date()
   }
})

// Placeholder router singleton — in a real project this is your actual router
// (e.g. TanStack Router), imported from its own module. A standard router
// exposes an imperative subscribe() plus a current `state`, NOT an Observable.
// A vertex adapts that into a value-stream where it consumes route params —
// see `withDependenciesChain.ts`. Here `state` carries one canned match and
// subscribe() is a no-op so the examples run end-to-end.
const router = {
   state: {
      matches: [{ params: { id: 'placeholder' } as { id: string } }]
   },
   subscribe: (_event: 'onResolved', _listener: () => void) => () => {}
} as any
