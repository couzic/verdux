import { createSlice } from '@reduxjs/toolkit'
import { Subject } from 'rxjs'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

describe('deep downstream vertex cascade loading', () => {
   it('fixes weird bug', () => {
      const rootLoaded$ = new Subject<string>()
      const loadedByChild$ = new Subject<string>()

      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {},
            reducers: {}
         })
      }).load({
         rootLoaded: rootLoaded$
      })

      const childVertexConfig = rootVertexConfig
         .configureDownstreamVertex({
            slice: createSlice({
               name: 'child',
               initialState: {},
               reducers: {}
            })
         })
         .load({
            loadedByChild: loadedByChild$
         })
         .loadFromFields(['loadedByChild'], {
            // No need for actual loading here
         })

      const grandChildVertexConfig =
         childVertexConfig.configureDownstreamVertex({
            slice: createSlice({
               name: 'grandChild',
               initialState: {},
               reducers: {}
            }),
            upstreamFields: []
         })

      const graph = createGraph({
         vertices: [grandChildVertexConfig]
      })

      graph.getVertexInstance(grandChildVertexConfig)

      rootLoaded$.next('rootLoaded 1')
      loadedByChild$.next('loadedByChild 1')
   })
})
