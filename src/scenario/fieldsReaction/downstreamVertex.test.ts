import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Subject, of } from 'rxjs'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

const rootVertexConfig = configureRootVertex({
   slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
})

describe('downstreamVertex.fieldsReaction() from isolated loadable field', () => {
   let graph: Graph
   const slice = createSlice({
      name: 'downstreamVertexName',
      initialState: { reacted: '' },
      reducers: {
         userIdChanged: (state, action: PayloadAction<string>) => {
            state.reacted = action.payload
         }
      }
   })
   const createUserService = () => ({
      getLoggedInUserId: () => of('DEFAULT'),
      getUsernameById: (id: string) => of('DEFAULT')
   })
   type UserService = ReturnType<typeof createUserService>
   const vertexConfig = rootVertexConfig
      .configureDownstreamVertex({
         slice,
         dependencies: {
            userService: createUserService
         }
      })
      .load(({ userService }) => ({
         userId: userService.getLoggedInUserId()
      }))
      .loadFromFields(['userId'], ({ userService }) => ({
         username: ({ userId }) => userService.getUsernameById(userId)
      }))
      .fieldsReaction(['userId'], ({ userId }) =>
         slice.actions.userIdChanged(userId)
      )
   let vertex: Vertex<typeof vertexConfig>
   let userService: UserService
   let receivedUserId$: Subject<string>
   let receivedUserName$: Subject<string>
   beforeEach(() => {
      receivedUserId$ = new Subject()
      receivedUserName$ = new Subject()
      userService = {
         getLoggedInUserId: () => receivedUserId$,
         getUsernameById: () => receivedUserName$
      }
      graph = createGraph({
         vertices: [
            rootVertexConfig,
            vertexConfig.injectedWith({ userService })
         ]
      })
      vertex = graph.getVertexInstance(vertexConfig)
   })
   it('initially does not react', () => {
      expect(vertex.currentState.reacted).to.equal('')
   })
   describe('when user id received', () => {
      beforeEach(() => {
         receivedUserId$.next('123')
      })
      it('does react already', () => {
         expect(vertex.currentState.reacted).to.equal('123')
      })
   })
})
