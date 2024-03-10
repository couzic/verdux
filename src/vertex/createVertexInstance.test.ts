import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { configureRootVertex } from '../config/configureRootVertex'
import { createVertexInstance } from './createVertexInstance'
import { Subject } from 'rxjs'

describe(createVertexInstance.name, () => {
   describe('single root vertex', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {
               name: '',
               age: 0
            },
            reducers: {
               setName: (state, action: PayloadAction<string>) => {
                  state.name = action.payload
               }
            }
         })
      })
      let latestState: any
      let latestLoadableState: any
      let latestPick: any
      it('creates vertex instance', () => {
         const fields$ = new Subject<any>()
         const vertex = createVertexInstance(rootVertexConfig, fields$, {})
         fields$.next({
            name: { status: 'loaded', value: '', errors: [] },
            age: { status: 'loaded', value: 0, errors: [] }
         })
         vertex.state$.subscribe(state => {
            latestState = state
         })
         vertex.loadableState$.subscribe(loadableState => {
            latestLoadableState = loadableState
         })
         vertex.pick(['name']).subscribe(pick => {
            latestPick = pick
         })
         expect(vertex.id).to.equal(rootVertexConfig.id)
         expect(vertex.currentState).to.deep.equal({ name: '', age: 0 })
         const expectedLoadableState = {
            status: 'loaded',
            errors: [],
            state: { name: '', age: 0 },
            fields: {
               name: {
                  status: 'loaded',
                  value: '',
                  errors: []
               },
               age: { status: 'loaded', value: 0, errors: [] }
            }
         }
         expect(vertex.currentLoadableState).to.deep.equal(
            expectedLoadableState
         )
         expect(latestState).to.deep.equal({ name: '', age: 0 })
         expect(latestLoadableState).to.deep.equal(expectedLoadableState)
         expect(latestPick).to.deep.equal({
            status: 'loaded',
            errors: [],
            state: { name: '' },
            fields: {
               name: {
                  status: 'loaded',
                  value: '',
                  errors: []
               }
            }
         })
      })

      describe('picked fields', () => {
         it('are not emitted when they have not changed', () => {
            const fields$ = new Subject<any>()
            const vertex = createVertexInstance(rootVertexConfig, fields$, {})
            let pickedEmissions = 0
            vertex.pick(['name']).subscribe(() => {
               pickedEmissions++
            })
            fields$.next({
               name: { status: 'loaded', value: '', errors: [] },
               age: { status: 'loaded', value: 0, errors: [] }
            })
            fields$.next({
               name: { status: 'loaded', value: '', errors: [] },
               age: { status: 'loaded', value: 1, errors: [] }
            })
            expect(pickedEmissions).to.equal(1)
         })
      })
   })
})
