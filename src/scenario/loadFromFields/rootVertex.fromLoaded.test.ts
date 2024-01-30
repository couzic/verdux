import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { BehaviorSubject, Subject, map, of } from 'rxjs'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

const username$: Subject<string> = new BehaviorSubject('Bob')

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
      .loadFromFields$(['greetings'], {
         uppercaseGreetings: map(({ greetings }) => greetings.toUpperCase())
      })
   let graph: Graph
   let vertex: Vertex<typeof vertexConfig>
   beforeEach(() => {
      graph = createGraph({ vertices: [vertexConfig] })
      vertex = graph.getVertexInstance(vertexConfig)
   })
   it('is initially loaded', () => {
      expect(vertex.currentLoadableState.status).to.equal('loaded')
   })
   it('loads greetings', () => {
      expect(vertex.currentLoadableState.status).to.equal('loaded')
      expect(vertex.currentState).to.deep.equal({
         username: 'Bob',
         greetings: 'Hello, bob',
         uppercaseGreetings: 'HELLO, BOB'
      })
   })
})
