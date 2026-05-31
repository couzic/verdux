import { createSlice } from '@reduxjs/toolkit'
import { Suspense } from 'react'
import { of } from 'rxjs'
import { configureRootVertex, createGraph } from 'verdux'
import { GraphContext } from '../skills/react-integration/examples/GraphContext'
import { useVertexState } from '../skills/react-integration/examples/useVertexState'

// ---------------------------------------------------------------------------
// Vertex config — tree-first: a root vertex (a bare dependency well with an
// empty slice) and one downstream vertex that produces two loadable fields,
// `title: string` and `count: number`, from static observables.
// ---------------------------------------------------------------------------

const rootSlice = createSlice({
   name: 'root',
   initialState: {},
   reducers: {}
})

const rootVertexConfig = configureRootVertex({ slice: rootSlice })

const pageSlice = createSlice({
   name: 'page',
   initialState: {},
   reducers: {}
})

export const pageVertexConfig = rootVertexConfig
   .configureDownstreamVertex({ slice: pageSlice })
   .load({
      title: of<string>('Hello, verdux'),
      count: of<number>(42)
   })

// ---------------------------------------------------------------------------
// Module-singleton graph — created once as a side effect of the first import
// and kept for the life of the page.
// ---------------------------------------------------------------------------

export const graph = createGraph({
   vertices: [pageVertexConfig]
})

// ---------------------------------------------------------------------------
// Provider at the top of the tree — one graph, one provider, no nesting.
// ---------------------------------------------------------------------------

export const App = () => (
   <GraphContext.Provider value={graph}>
      <Page />
   </GraphContext.Provider>
)

// Each leaf suspends independently and picks exactly the one field it needs.
export const Page = () => (
   <main>
      <Suspense fallback={<Spinner />}>
         <Title />
      </Suspense>
      <Suspense fallback={<Spinner />}>
         <Count />
      </Suspense>
   </main>
)

// Reads ONLY `title`. Does not rerender when `count` changes.
const Title = () => {
   const { title } = useVertexState({
      vertex: pageVertexConfig,
      fields: ['title']
   })
   return <h1>{title}</h1>
}

// Reads ONLY `count`. Suspends independently of Title.
const Count = () => {
   const { count } = useVertexState({
      vertex: pageVertexConfig,
      fields: ['count']
   })
   return <span>{count}</span>
}

const Spinner = () => <div>Loading…</div>
