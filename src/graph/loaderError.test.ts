import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { of, throwError } from 'rxjs'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from './createGraph'

// End-to-end test: a failing loader is per-field and non-fatal. A loader that
// errors sets ONLY its field to status:'error', leaves siblings and the vertex
// alive, and (for loadFromFields) recovers on the next input change. There is
// no verdux-specific error API — loaders signal failure the standard RxJS way.
// Everything asserts on the PUBLIC vertex surface (`currentLoadableState` /
// `currentState`), exactly as a UI component would consume it.
describe('createGraph loader error contract', () => {
   describe('load(): an errored loader fails one field, the vertex stays alive', () => {
      const makeSlice = () =>
         createSlice({
            name: 'root',
            initialState: { name: '' },
            reducers: {
               setName: (state, action: PayloadAction<string>) => {
                  state.name = action.payload
               }
            }
         })

      let graph: ReturnType<typeof createGraph>
      let vertex: ReturnType<typeof graph.getVertexInstance>
      let setName: (name: string) => PayloadAction<string>

      beforeEach(() => {
         const slice = makeSlice()
         setName = slice.actions.setName
         const rootVertexConfig = configureRootVertex({ slice }).load({
            failing: throwError(() => new Error('boom')),
            healthy: of('ok')
         })
         graph = createGraph({ vertices: [rootVertexConfig] })
         vertex = graph.getVertexInstance(rootVertexConfig)
      })

      it('parks ONLY the failing field in error, sibling stays loaded', () => {
         const ls = vertex.currentLoadableState
         expect(ls.fields.failing.status).to.equal('error')
         expect(ls.fields.failing.value).to.equal(undefined)
         expect(ls.fields.failing.errors.map(e => e.message)).to.deep.equal([
            'boom'
         ])
         expect(ls.fields.healthy.status).to.equal('loaded')
         expect(ls.fields.healthy.value).to.equal('ok')
      })

      it('aggregates the vertex status to error', () => {
         expect(vertex.currentLoadableState.status).to.equal('error')
      })

      it('keeps the vertex alive: a later slice action still updates state', () => {
         graph.dispatch(setName('Alice'))
         expect(vertex.currentState.name).to.equal('Alice')
         // The errored field is unchanged and the sibling is still readable:
         // the vertex was not torn down.
         expect(vertex.currentLoadableState.fields.failing.status).to.equal(
            'error'
         )
         expect(vertex.currentLoadableState.fields.healthy.value).to.equal('ok')
      })
   })

   describe('loadFromFields(): an errored loader recovers on the next input change', () => {
      const makeSlice = () =>
         createSlice({
            name: 'root',
            initialState: { id: '1' },
            reducers: {
               setId: (state, action: PayloadAction<string>) => {
                  state.id = action.payload
               }
            }
         })

      let graph: ReturnType<typeof createGraph>
      let vertex: ReturnType<typeof graph.getVertexInstance>
      let setId: (id: string) => PayloadAction<string>

      beforeEach(() => {
         const slice = makeSlice()
         setId = slice.actions.setId
         let attempt = 0
         const rootVertexConfig = configureRootVertex({ slice }).loadFromFields(
            ['id'],
            {
               // Fails on the first run, succeeds afterwards. Because
               // loadFromFields rebuilds its loaders per input change, the
               // error is transparently recovered with no special API.
               data: ({ id }) =>
                  attempt++ === 0
                     ? throwError(() => new Error('boom'))
                     : of(`data-${id}`)
            }
         )
         graph = createGraph({ vertices: [rootVertexConfig] })
         vertex = graph.getVertexInstance(rootVertexConfig)
      })

      it('starts in error after the first loader throws', () => {
         const field = vertex.currentLoadableState.fields.data
         expect(field.status).to.equal('error')
         expect(field.errors.map(e => e.message)).to.deep.equal(['boom'])
      })

      it('recovers to loaded when the input changes and the loader succeeds', () => {
         expect(vertex.currentLoadableState.fields.data.status).to.equal(
            'error'
         )
         graph.dispatch(setId('2'))
         const field = vertex.currentLoadableState.fields.data
         expect(field.status).to.equal('loaded')
         expect(field.value).to.equal('data-2')
         expect(field.errors).to.deep.equal([])
      })
   })
})
