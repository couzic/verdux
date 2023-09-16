import { createSlice } from '@reduxjs/toolkit'
import { configureRootVertex } from '../../configureRootVertex'
import { NEVER, delay, of } from 'rxjs'
import { Graph } from '../../Graph'
import { createGraph } from '../../createGraph'
import { Vertex } from '../../Vertex'
import { expect } from 'chai'

describe('loadFromFields() loads as soon as input fields are loaded', () => {
   const rootConfig = configureRootVertex({
      slice: createSlice({
         name: 'root',
         initialState: {},
         reducers: {}
      })
   })
      .load({
         username: of('bob'),
         irrelevent: NEVER
      })
      .loadFromFields(['username'], {
         uppercaseUsername: ({ username }) => of(username.toUpperCase())
      })
   let graph: Graph
   let vertex: Vertex<typeof rootConfig>
   beforeEach(() => {
      graph = createGraph({
         vertices: [rootConfig]
      })
      vertex = graph.getVertexInstance(rootConfig)
   })
   it('ignores irrelevant loading fields', () => {
      expect(vertex.currentLoadableState.status).to.equal('loading')
      expect(
         vertex.currentLoadableState.loadableFields.uppercaseUsername
      ).to.deep.equal({
         status: 'loaded',
         value: 'BOB',
         error: undefined
      })
   })
})
