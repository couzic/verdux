import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { configureRootVertex, createGraph, Graph, Vertex } from 'verdux'

// ---------------------------------------------------------------------------
// Root vertex — slice holding celsius + alert
// ---------------------------------------------------------------------------

interface TemperatureState {
   celsius: number
   alert: string
}

const slice = createSlice({
   name: 'temperature',
   initialState: { celsius: 0, alert: 'ok' } as TemperatureState,
   reducers: {
      celsiusChanged: (state, action: PayloadAction<number>) => {
         state.celsius = action.payload
      },
      alertChanged: (state, action: PayloadAction<string>) => {
         state.alert = action.payload
      }
   }
})

export const temperatureActions = slice.actions
const { celsiusChanged, alertChanged } = slice.actions

const temperatureVertexConfig = configureRootVertex({ slice })
   // Derive `fahrenheit` synchronously from `celsius`.
   .computeFromFields(['celsius'], {
      fahrenheit: ({ celsius }) => celsius * (9 / 5) + 32
   })
   // React to the `celsius` field changing: dispatch an alert action.
   .fieldsReaction(['celsius'], ({ celsius }) =>
      celsius >= 30 ? alertChanged('hot') : alertChanged('ok')
   )

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('temperatureVertex', () => {
   let graph: Graph
   let vertex: Vertex<typeof temperatureVertexConfig>

   beforeEach(() => {
      graph = createGraph({ vertices: [temperatureVertexConfig] })
      vertex = graph.getVertexInstance(temperatureVertexConfig)
   })

   it('computes fahrenheit and reacts to celsius crossing the threshold', () => {
      graph.dispatch(temperatureActions.celsiusChanged(35))

      expect(vertex.currentState.fahrenheit).to.equal(95)
      expect(vertex.currentState.alert).to.equal('hot')
   })
})
