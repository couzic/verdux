import { createSlice } from '@reduxjs/toolkit'
import * as chai from 'chai'
import { Subject } from 'rxjs'
import sinonChai from 'sinon-chai'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

chai.use(sinonChai)
const { expect } = chai

describe('rootVertex.load() from source', () => {
   it('fixed weird bug', () => {
      const source$ = new Subject<string>()

      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: { someValue: '' },
            reducers: {}
         })
      })
         .load({ fromSource: source$ })
         .computeFromFields(['someValue'], {
            sameValue: ({ someValue }) => someValue
         })

      const graph = createGraph({
         vertices: [rootVertexConfig]
      })
      const vertex = graph.getVertexInstance(rootVertexConfig)

      source$.next('A')
      expect(vertex.currentState.fromSource).to.equal('A')
   })
})
