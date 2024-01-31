import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { NEVER, Subject, of, skip } from 'rxjs'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

const rootVertexConfig = configureRootVertex({
   slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
})

const createUserService = () => ({
   getUsernameById: (id: string) => of('DEFAULT')
})
type UserService = ReturnType<typeof createUserService>

describe('downstreamVertex loadFromFields from loadable field', () => {
   const slice = createSlice({
      name: 'downstreamVertexName',
      initialState: { userId: null as string | null, whatever: 'nevermind' },
      reducers: {
         userIdChanged: (state, action: PayloadAction<string>) => {
            state.userId = action.payload
         },
         inputValueChanged: (state, action: PayloadAction<string>) => {
            state.whatever = action.payload
         }
      }
   })
   const vertexConfig = rootVertexConfig
      .configureDownstreamVertex({
         slice,
         dependencies: {
            userService: createUserService
         }
      })
      .loadFromFields(['userId'], ({ userService }) => ({
         username: ({ userId }) =>
            userId === null ? NEVER : userService.getUsernameById(userId)
      }))
      .fieldsReaction(['userId'], ({ userId }) =>
         slice.actions.inputValueChanged(userId || '')
      )
   let graph: Graph
   let vertex: Vertex<typeof vertexConfig>
   let userService: UserService
   let receivedBob$: Subject<string>
   let receivedSteve$: Subject<string>
   beforeEach(() => {
      receivedBob$ = new Subject()
      receivedSteve$ = new Subject()
      userService = {
         getUsernameById: id => (id === '123' ? receivedBob$ : receivedSteve$)
      }
      graph = createGraph({
         vertices: [
            rootVertexConfig,
            vertexConfig.injectedWith({ userService })
         ]
      })
      vertex = graph.getVertexInstance(vertexConfig)
   })
   it('is initially loading', () => {
      expect(vertex.currentLoadableState.status).to.equal('loading')
   })
   describe('when id for bob is set', () => {
      beforeEach(() => {
         graph.dispatch(slice.actions.userIdChanged('123'))
      })
      it('it is still loading', () => {
         expect(vertex.currentLoadableState.status).to.equal('loading')
      })
      describe('when bob received', () => {
         beforeEach(() => {
            receivedBob$.next('Bob')
         })
         it('is loaded', () => {
            expect(vertex.currentLoadableState.status).to.equal('loaded')
         })
         it('does not emit "Bob" after id for steve is set', () => {
            let emittedBob = false
            vertex.loadableState$.pipe(skip(1)).subscribe(loadableState => {
               if (loadableState.state.username === 'Bob') emittedBob = true
            })
            graph.dispatch(slice.actions.userIdChanged('456'))
            expect(emittedBob).to.be.false
         })
      })
   })
})
