import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { of } from 'rxjs'
import { configureRootVertex } from '../config/configureRootVertex'
import { createVertexInstance } from './createVertexInstance'

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
         const vertex = createVertexInstance(rootVertexConfig, {})
         vertex.__pushFields(
            {
               name: { status: 'loaded', value: '', errors: [] },
               age: { status: 'loaded', value: 0, errors: [] }
            },
            { name: true, age: true }
         )
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

      it('handles undefined or empty changed fields', () => {
         const vertex = createVertexInstance(rootVertexConfig, {})
         let emissions = 0
         vertex.loadableState$.subscribe(() => {
            emissions++
         })
         vertex.__pushFields(
            {
               name: { status: 'loaded', value: '', errors: [] },
               age: { status: 'loaded', value: 0, errors: [] }
            },
            { name: true, age: true }
         )
         vertex.__pushFields(
            {
               name: { status: 'loaded', value: '', errors: [] },
               age: { status: 'loaded', value: 0, errors: [] }
            },
            undefined
         )
         vertex.__pushFields(
            {
               name: { status: 'loaded', value: '', errors: [] },
               age: { status: 'loaded', value: 0, errors: [] }
            },
            {}
         )
         expect(emissions).to.equal(1)
      })

      describe('vertex with empty state', () => {
         const emptyStateVertexConfig = configureRootVertex({
            slice: createSlice({
               name: 'root',
               initialState: {},
               reducers: {}
            })
         })
         it('pushed first state even if changed fields are empty', () => {
            const vertex = createVertexInstance(emptyStateVertexConfig, {})
            let pickedEmissions = 0
            vertex.loadableState$.subscribe(() => {
               pickedEmissions++
            })
            vertex.__pushFields({}, {})
            expect(pickedEmissions).to.equal(1)
         })

         it('pushed first state even if changed fields are undefined', () => {
            const vertex = createVertexInstance(emptyStateVertexConfig, {})
            let pickedEmissions = 0
            vertex.loadableState$.subscribe(() => {
               pickedEmissions++
            })
            vertex.__pushFields({}, undefined)
            expect(pickedEmissions).to.equal(1)
         })
      })

      describe('picked fields', () => {
         it('are not emitted when they have not changed', () => {
            const vertex = createVertexInstance(rootVertexConfig, {})
            let pickedEmissions = 0
            vertex.pick(['name']).subscribe(() => {
               pickedEmissions++
            })
            vertex.__pushFields(
               {
                  name: { status: 'loaded', value: '', errors: [] },
                  age: { status: 'loaded', value: 0, errors: [] }
               },
               { name: true, age: true }
            )
            vertex.__pushFields(
               {
                  name: { status: 'loaded', value: '', errors: [] },
                  age: { status: 'loaded', value: 1, errors: [] }
               },
               { age: true }
            )
            expect(pickedEmissions).to.equal(1)
         })

         it('are emitted as many times as they have changed', () => {
            const vertex = createVertexInstance(rootVertexConfig, {})
            let pickedEmissions = 0
            vertex.pick(['name', 'age']).subscribe(() => {
               pickedEmissions++
            })
            vertex.__pushFields(
               {
                  name: { status: 'loaded', value: '', errors: [] },
                  age: { status: 'loaded', value: 0, errors: [] }
               },
               { name: true, age: true }
            )
            vertex.__pushFields(
               {
                  name: { status: 'loaded', value: 'Bob', errors: [] },
                  age: { status: 'loaded', value: 0, errors: [] }
               },
               { name: true }
            )
            vertex.__pushFields(
               {
                  name: { status: 'loaded', value: 'Bob', errors: [] },
                  age: { status: 'loaded', value: 1, errors: [] }
               },
               { age: true }
            )
            expect(pickedEmissions).to.equal(3)
         })
      })
   })

   describe('single root vertex loading from nullable field', () => {
      const dataMapVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'dataMap',
            initialState: { clickedDept: null as null | number },
            reducers: {}
         }),
         dependencies: {}
      }).loadFromFields(['clickedDept'], {
         deptData: () => of(null)
      })
      it('picks from nullable field', () => {
         const vertex = createVertexInstance(dataMapVertexConfig, {})
         vertex.__pushFields(
            {
               clickedDept: { status: 'loaded', value: null, errors: [] },
               deptData: { status: 'loading', value: undefined, errors: [] }
            },
            { clickedDept: true, deptData: true }
         )
         vertex.__pushFields(
            {
               clickedDept: { status: 'loaded', value: null, errors: [] },
               deptData: { status: 'loaded', value: null, errors: [] }
            },
            { deptData: true }
         )
         let pickedEmissions = 0
         vertex.pick(['clickedDept']).subscribe(loadableState => {
            pickedEmissions++
         })
         expect(pickedEmissions).to.equal(1)
      })
   })
})
