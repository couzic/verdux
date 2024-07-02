import { createSlice } from '@reduxjs/toolkit'
import { of } from 'rxjs'
import { createGraph } from '../graph/createGraph'
import { configureRootVertex } from './configureRootVertex'

describe('VertexInstance (type testing only)', () => {
   it('has defined loadable fields when loaded', () => {
      const vertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {},
            reducers: {}
         })
      }).load({
         test: of('test')
      })

      const graph = createGraph({
         vertices: [vertexConfig]
      })

      const vertex = graph.getVertexInstance(vertexConfig)

      let s: string

      if (vertex.currentLoadableState.status === 'loaded') {
         s = vertex.currentLoadableState.state.test
         s = vertex.currentLoadableState.fields.test.value
      }

      vertex.loadableState$.subscribe(loadableState => {
         if (loadableState.status === 'loaded') {
            s = loadableState.state.test
            s = loadableState.fields.test.value
         }
      })

      vertex.pick(['test']).subscribe(loadableState => {
         if (loadableState.status === 'loaded') {
            s = loadableState.state.test
            s = loadableState.fields.test.value
         }
      })
   })
})
