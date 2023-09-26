import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Subject, of } from 'rxjs'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

describe('rootVertex.fieldsReaction() from redux field', () => {
   let graph: Graph
   const slice = createSlice({
      name: 'root',
      initialState: { username: '', count: 0 },
      reducers: {
         setUsername: (state, action: PayloadAction<string>) => {
            state.username = action.payload
         },
         increment: (state, action: PayloadAction<number>) => {
            state.count += action.payload
         }
      }
   })
   const { setUsername } = slice.actions
   const rootVertexConfig = configureRootVertex({ slice }).fieldsReaction(
      ['username'],
      ({ username }) => slice.actions.increment(username.length)
   )
   let rootVertex: Vertex<typeof rootVertexConfig>
   beforeEach(() => {
      graph = createGraph({
         vertices: [rootVertexConfig]
      })
      rootVertex = graph.getVertexInstance(rootVertexConfig)
   })
   it('initially does not react', () => {
      expect(rootVertex.currentState).to.deep.equal({
         username: '',
         count: 0
      })
   })
   describe('when field updated', () => {
      beforeEach(() => {
         graph.dispatch(setUsername('Bob'))
      })
      it('triggers reaction', () => {
         expect(rootVertex.currentState).to.deep.equal({
            username: 'Bob',
            count: 3
         })
      })
   })
})

describe('rootVertex.fieldsReaction() from loadable field', () => {
   let graph: Graph
   const slice = createSlice({
      name: 'root',
      initialState: { uppercaseName: '' },
      reducers: {
         setUppercaseName: (state, action: PayloadAction<string>) => {
            state.uppercaseName = action.payload
         }
      }
   })
   const rootVertexConfig = configureRootVertex({
      slice,
      dependencies: { username$: () => of('') }
   })
      .load(({ username$ }) => ({
         username: username$
      }))
      .fieldsReaction(['username'], ({ username }) =>
         slice.actions.setUppercaseName(username.toUpperCase())
      )
   let rootVertex: Vertex<typeof rootVertexConfig>
   let username$: Subject<string>
   beforeEach(() => {
      username$ = new Subject()
      graph = createGraph({
         vertices: [rootVertexConfig.injectedWith({ username$ })]
      })
      rootVertex = graph.getVertexInstance(rootVertexConfig)
   })
   it('initially does not react', () => {
      expect(rootVertex.currentState).to.deep.equal({
         username: undefined,
         uppercaseName: ''
      })
   })
   describe('when field loaded', () => {
      beforeEach(() => {
         username$.next('Bob')
      })
      it('triggers reaction', () => {
         expect(rootVertex.currentState).to.deep.equal({
            username: 'Bob',
            uppercaseName: 'BOB'
         })
      })
   })
})

describe('rootVertex.fieldsReaction() from multiple loadable fields', () => {
   let graph: Graph
   const slice = createSlice({
      name: 'root',
      initialState: { fullName: '' },
      reducers: {
         setFullName: (state, action: PayloadAction<string>) => {
            state.fullName = action.payload
         }
      }
   })
   const rootVertexConfig = configureRootVertex({
      slice,
      dependencies: { firstName$: () => of(''), lastName$: () => of('') }
   })
      .load(({ firstName$, lastName$ }) => ({
         firstName: firstName$,
         lastName: lastName$
      }))
      .fieldsReaction(['firstName', 'lastName'], ({ firstName, lastName }) =>
         slice.actions.setFullName(firstName + ' ' + lastName)
      )
   let rootVertex: Vertex<typeof rootVertexConfig>
   let firstName$: Subject<string>
   let lastName$: Subject<string>
   beforeEach(() => {
      firstName$ = new Subject()
      lastName$ = new Subject()
      graph = createGraph({
         vertices: [rootVertexConfig.injectedWith({ firstName$, lastName$ })]
      })
      rootVertex = graph.getVertexInstance(rootVertexConfig)
   })
   describe('when first name received', () => {
      beforeEach(() => {
         firstName$.next('John')
      })
      it('does not react', () => {
         expect(rootVertex.currentState).to.deep.equal({
            firstName: 'John',
            lastName: undefined,
            fullName: ''
         })
      })
      describe('when last name received', () => {
         beforeEach(() => {
            lastName$.next('Snow')
         })
         it('does react', () => {
            expect(rootVertex.currentState).to.deep.equal({
               firstName: 'John',
               lastName: 'Snow',
               fullName: 'John Snow'
            })
         })
      })
   })
})
