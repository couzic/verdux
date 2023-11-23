import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Observable, Subject, of } from 'rxjs'
import { stub } from 'sinon'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

interface PokemonService {
   findByName: (name: string) => Observable<{ name: string }>
}
const createPokemonService = (): PokemonService => ({
   findByName: (name: string) => of({ name })
})

const vertexConfig = configureRootVertex({
   slice: createSlice({
      name: 'root',
      initialState: {},
      reducers: {}
   }),
   dependencies: {
      pokemonService: createPokemonService
   }
})
   .loadFromStream(
      () => of('pikachu'),
      ({ pokemonService }) => ({
         pokemon: pokemonName => pokemonService.findByName(pokemonName)
      })
   )
   .loadFromFields(['pokemon'], {
      evolvesFrom: ({ pokemon }) => (!pokemon ? of(null) : of('OK')),
      evolvesTo: ({ pokemon }) => (!pokemon ? of([]) : of('OK'))
   })

describe('load pokemon test', () => {
   let vertex: Vertex<typeof vertexConfig>
   let receivedPokemon$: Subject<{ name: string }>
   beforeEach(() => {
      receivedPokemon$ = new Subject()
      const pokemonService: PokemonService = {
         findByName: stub().returns(receivedPokemon$)
      }
      const graph = createGraph({
         vertices: [vertexConfig.injectedWith({ pokemonService })]
      })
      vertex = graph.getVertexInstance(vertexConfig)
   })
   it('should load pokemon', () => {
      vertex.loadableState$.subscribe(loadableState => {
         expect(loadableState.loadableFields).to.have.keys(
            'pokemon',
            'evolvesFrom',
            'evolvesTo'
         )
         expect(loadableState.state).to.have.keys(
            'pokemon',
            'evolvesFrom',
            'evolvesTo'
         )
      })
      receivedPokemon$.next({ name: 'pikachu' })
   })
})
