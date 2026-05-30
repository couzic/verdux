import { expect } from 'chai'
import { map } from 'rxjs'
import { createGraph, Graph, Vertex } from 'verdux'
import {
   rootVertexConfig,
   searchActions,
   searchVertexConfig,
   Time
} from './injectableOperator'

// Injecting an identity operator in place of `debounceTime` makes the debounced
// `results` field resolve synchronously, so the test reads dispatch → assert
// with no timers. This is the concrete answer to "how do I test a debounced
// field" — you don't fake time, you inject past it.

describe('injectable operator (testable debounce)', () => {
   let graph: Graph
   let vertex: Vertex<typeof searchVertexConfig>

   beforeEach(() => {
      const passThroughTime: Time = { debounce: () => map(value => value) }
      graph = createGraph({
         vertices: [
            rootVertexConfig.injectedWith({ time: passThroughTime }),
            searchVertexConfig
         ]
      })
      vertex = graph.getVertexInstance(searchVertexConfig)
   })

   it('loads results synchronously when debounce is identity', () => {
      graph.dispatch(searchActions.queryChanged('pikachu'))
      expect(vertex.currentLoadableState.status).to.equal('loaded')
      expect(vertex.currentState.results).to.deep.equal(['result for pikachu'])
   })

   it('clears results to the empty sentinel when the query is blanked', () => {
      graph.dispatch(searchActions.queryChanged('pikachu'))
      expect(vertex.currentState.results).to.deep.equal(['result for pikachu'])

      graph.dispatch(searchActions.queryChanged('   '))
      expect(vertex.currentState.results).to.deep.equal([])
   })
})
