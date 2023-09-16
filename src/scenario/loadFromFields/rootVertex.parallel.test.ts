import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import * as chai from 'chai'
import { Observable, Subject, of } from 'rxjs'
import { stub } from 'sinon'
import sinonChai from 'sinon-chai'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

chai.use(sinonChai)
const { expect } = chai

describe('rootVertex.loadFromFields() - parallel', () => {
   const slice = createSlice({
      name: 'root',
      initialState: { username: 'bob' },
      reducers: {
         setUsername: (state, action: PayloadAction<string>) => {
            state.username = action.payload
         }
      }
   })
   const rootVertexConfig = configureRootVertex({
      slice,
      dependencies: {
         userProfileService: () => ({
            getUserProfile: (username: string) => of({ name: username })
         })
      }
   })
      .loadFromFields(['username'], ({ userProfileService }) => ({
         userProfile: ({ username }) => {
            return userProfileService.getUserProfile(username)
         }
      }))
      .loadFromFields(['username'], {
         uppercaseUsername: state => of(state.username.toUpperCase())
      })
   let graph: Graph
   describe('when injecting dependency', () => {
      let receivedUserProfile$: Subject<{ name: string }>
      let userProfileService: {
         getUserProfile: (name: string) => Observable<{ name: string }>
      }
      let rootVertex: Vertex<typeof rootVertexConfig>
      beforeEach(() => {
         receivedUserProfile$ = new Subject()
         userProfileService = {
            getUserProfile: stub().returns(receivedUserProfile$)
         }
         graph = createGraph({
            vertices: [rootVertexConfig.injectedWith({ userProfileService })]
         })
         rootVertex = graph.getVertexInstance(rootVertexConfig)
      })
      it('loads received fields independently from each other', () => {
         expect(rootVertex.currentLoadableState.status).to.equal('loading')
         expect(
            rootVertex.currentLoadableState.loadableFields.userProfile
         ).to.deep.equal({
            status: 'loading',
            value: undefined,
            error: undefined
         })

         expect(
            rootVertex.currentLoadableState.loadableFields.uppercaseUsername
         ).to.deep.equal({ status: 'loaded', value: 'BOB', error: undefined })
      })
   })
})
