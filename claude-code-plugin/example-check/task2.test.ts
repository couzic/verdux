import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { expect } from 'chai'
import {
   configureRootVertex,
   configureVertex,
   createGraph,
   Graph,
   Vertex
} from 'verdux'

// ---------------------------------------------------------------------------
// Root vertex — empty slice, no special dependencies. Pure dependency well.
// ---------------------------------------------------------------------------

const rootVertexConfig = configureRootVertex({
   slice: createSlice({ name: 'root', initialState: {}, reducers: {} }),
   dependencies: {}
})

// ---------------------------------------------------------------------------
// Two sibling vertices, each single-parent (tree-first) off the root.
// ---------------------------------------------------------------------------

const selectionSlice = createSlice({
   name: 'selection',
   initialState: { selectedId: 'a' },
   reducers: {
      selectedIdChanged: (state, action: PayloadAction<string>) => {
         state.selectedId = action.payload
      }
   }
})
export const selectionActions = selectionSlice.actions
const selectionVertexConfig = rootVertexConfig.configureDownstreamVertex({
   slice: selectionSlice
})

const settingsSlice = createSlice({
   name: 'settings',
   initialState: { pageSize: 10 },
   reducers: {
      pageSizeChanged: (state, action: PayloadAction<number>) => {
         state.pageSize = action.payload
      }
   }
})
export const settingsActions = settingsSlice.actions
const settingsVertexConfig = rootVertexConfig.configureDownstreamVertex({
   slice: settingsSlice
})

// ---------------------------------------------------------------------------
// summaryVertex — the multi-parent exception to tree-first. It reads fields
// from BOTH siblings, so it is built with configureVertex + addUpstreamVertex
// rather than configureDownstreamVertex. No dependencies are needed, so none
// are pulled from either upstream.
//
//   root
//    ├── selection  (owns `selectedId`)
//    ├── settings   (owns `pageSize`)
//    └── summary    ← reads selectedId + pageSize from BOTH siblings
// ---------------------------------------------------------------------------

const summaryVertexConfig = configureVertex(
   { slice: createSlice({ name: 'summary', initialState: {}, reducers: {} }) },
   builder =>
      builder
         .addUpstreamVertex(selectionVertexConfig, { fields: ['selectedId'] })
         .addUpstreamVertex(settingsVertexConfig, { fields: ['pageSize'] })
).computeFromFields(['selectedId', 'pageSize'], {
   summaryLabel: ({ selectedId, pageSize }) => `${selectedId} x${pageSize}`
})

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('summaryVertex (derives from two siblings)', () => {
   let graph: Graph
   let summary: Vertex<typeof summaryVertexConfig>

   beforeEach(() => {
      graph = createGraph({
         vertices: [
            selectionVertexConfig,
            settingsVertexConfig,
            summaryVertexConfig
         ]
      })
      summary = graph.getVertexInstance(summaryVertexConfig)
   })

   it('computes the initial summaryLabel from both siblings', () => {
      expect(summary.currentState.summaryLabel).to.equal('a x10')
   })

   it('recomputes summaryLabel when either sibling changes', () => {
      graph.dispatch(selectionActions.selectedIdChanged('b'))
      graph.dispatch(settingsActions.pageSizeChanged(25))
      expect(summary.currentState.summaryLabel).to.equal('b x25')
   })
})
