import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

const rootSlice = createSlice({
   name: 'root',
   initialState: {},
   reducers: {}
})
const rootVertexConfig = configureRootVertex({ slice: rootSlice })

const anotherRootSlice = createSlice({
   name: 'anotherRoot',
   initialState: {},
   reducers: {}
})
const downstreamVertexConfig = configureRootVertex({
   slice: anotherRootSlice
})

it('throws error when creating graph with multiple root vertices', () => {
   expect(() =>
      createGraph({
         vertices: [rootVertexConfig, downstreamVertexConfig]
      })
   ).to.throw('multiple root vertices')
})
