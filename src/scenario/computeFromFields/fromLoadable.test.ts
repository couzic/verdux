import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Subject, of } from 'rxjs'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

describe('rootVertex.computeFromFields() from loadable fields', () => {
   let graph: Graph
   let computations = 0
   const slice = createSlice({
      name: 'root',
      initialState: {},
      reducers: {}
   })
   const rootVertexConfig = configureRootVertex({
      slice,
      dependencies: { fetchUsername: () => () => of('bob') }
   })
      .load(({ fetchUsername }) => ({ username: fetchUsername() }))
      .computeFromFields(['username'], {
         uppercaseUsername: ({ username }) => {
            ++computations
            return username.toUpperCase()
         }
      })
   let receivedUsername$: Subject<string>
   let rootVertex: Vertex<typeof rootVertexConfig>
   beforeEach(() => {
      receivedUsername$ = new Subject()
      graph = createGraph({
         vertices: [
            rootVertexConfig.injectedWith({
               fetchUsername: () => receivedUsername$
            })
         ]
      })
      rootVertex = graph.getVertexInstance(rootVertexConfig)
   })
   it('considers fields computed from loading fields to themselves be loading', () => {
      expect(computations).to.equal(0)
      expect(rootVertex.currentLoadableState.status).to.equal('loading')
      expect(rootVertex.currentState.username).to.equal(undefined)
      expect(
         rootVertex.currentLoadableState.loadableFields.username.status
      ).to.equal('loading')
      expect(rootVertex.currentState.uppercaseUsername).to.equal(undefined)
      expect(
         rootVertex.currentLoadableState.loadableFields.uppercaseUsername.status
      ).to.equal('loading')
   })
   describe('when input field loaded', () => {
      beforeEach(() => {
         receivedUsername$.next('bob')
      })
      it('considers fields computed from loaded fields to themselves be loaded', () => {
         expect(computations).to.equal(1)
         expect(rootVertex.currentLoadableState.status).to.equal('loaded')
         expect(rootVertex.currentState.username).to.equal('bob')
         expect(
            rootVertex.currentLoadableState.loadableFields.username.status
         ).to.equal('loaded')
         expect(rootVertex.currentState.uppercaseUsername).to.equal('BOB')
         expect(
            rootVertex.currentLoadableState.loadableFields.uppercaseUsername
               .status
         ).to.equal('loaded')
      })
   })
})
