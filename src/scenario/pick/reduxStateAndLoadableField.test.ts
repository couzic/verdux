import { createSlice } from '@reduxjs/toolkit'
import { Observable, of } from 'rxjs'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../config/configureRootVertex'

type Observed<O extends Observable<any>> = O extends Observable<infer T>
   ? T
   : never

const neverCalled = () => {
   let graph: Graph

   const rootVertexConfig = configureRootVertex({
      slice: createSlice({
         name: 'root',
         initialState: { username: '' },
         reducers: {}
      })
   })
      .computeFromFields(['username'], {
         greeting: ({ username }) => 'Hello, ' + username
      })
      .load({
         someLoadableField: of('whatever')
      })

   const rootVertex: Vertex<typeof rootVertexConfig> = {} as any
   const pick$ = rootVertex.pick(['username', 'greeting', 'someLoadableField'])
   let pick: Observed<typeof pick$> = {} as any
   let username: string = pick.state.username
   let greeting: string = pick.state.greeting
}
