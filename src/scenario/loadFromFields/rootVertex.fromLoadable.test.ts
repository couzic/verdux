import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Subject, of } from 'rxjs'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

const username$: Subject<string> = new Subject()

describe('loadFromFields from loadable field', () => {
   const vertexConfig = configureRootVertex({
      slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
   })
      .load({
         username: username$
      })
      .loadFromFields(['username'], {
         greetings: ({ username }) => of('Hello, ' + username.toLowerCase())
      })
   let graph: Graph
   let vertex: Vertex<typeof vertexConfig>
   beforeEach(() => {
      graph = createGraph({ vertices: [vertexConfig] })
      vertex = graph.getVertexInstance(vertexConfig)
   })
   it('is initially loading', () => {
      expect(vertex.currentLoadableState.status).to.equal('loading')
   })
   describe('when username loaded', () => {
      beforeEach(() => {
         username$.next('Bob')
      })
      it('loads greetings', () => {
         expect(vertex.currentLoadableState.status).to.equal('loaded')
         expect(vertex.currentState).to.deep.equal({
            username: 'Bob',
            greetings: 'Hello, bob'
         })
      })
   })
})
