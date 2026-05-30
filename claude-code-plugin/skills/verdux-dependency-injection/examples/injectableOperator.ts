import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import {
   debounceTime,
   distinctUntilChanged,
   map,
   MonoTypeOperatorFunction,
   of,
   pipe,
   switchMap
} from 'rxjs'
import { configureRootVertex } from 'verdux'

// ---------------------------------------------------------------------------
// The injectable "time" dependency.
//
// Its `debounce` method IS an rxjs operator factory. In production it's the
// real `debounceTime`; in tests it is swapped for an identity operator, which
// makes every debounced field resolve synchronously — no fake timers, no
// TestScheduler, no marble strings. The timing operator becomes just another
// dependency you can override with `.injectedWith`.
// ---------------------------------------------------------------------------

export interface Time {
   debounce: <T>(ms: number) => MonoTypeOperatorFunction<T>
}

export const createApiClient = () => ({
   search: (query: string) => of([`result for ${query}`])
})
export type ApiClient = ReturnType<typeof createApiClient>

const rootSlice = createSlice({ name: 'root', initialState: {}, reducers: {} })

export const rootVertexConfig = configureRootVertex({
   slice: rootSlice,
   dependencies: {
      // Production wiring: the operator factory is the real debounceTime.
      time: (): Time => ({ debounce: debounceTime }),
      apiClient: createApiClient
   }
})

// ---------------------------------------------------------------------------
// A search vertex whose `results` field is debounced via the injected operator.
// ---------------------------------------------------------------------------

const searchSlice = createSlice({
   name: 'search',
   initialState: { query: '' },
   reducers: {
      queryChanged: (state, action: PayloadAction<string>) => {
         state.query = action.payload
      }
   }
})
export const searchActions = searchSlice.actions

export const searchVertexConfig = rootVertexConfig
   .configureDownstreamVertex({ slice: searchSlice })
   .withDependencies(({ time, apiClient }, vertex) =>
      vertex.loadFromFields$(['query'], {
         results: pipe(
            map(({ query }) => query.trim()),
            time.debounce(300), // ← injected: real debounce in prod, identity in tests
            distinctUntilChanged(),
            switchMap(q => (q === '' ? of([] as string[]) : apiClient.search(q)))
         )
      })
   )
