import { UnknownAction } from '@reduxjs/toolkit'
import { useContext } from 'react'
import { GraphContext } from './GraphContext'

export const useDispatch = () => {
   const graph = useContext(GraphContext)
   if (!graph) throw new Error('No verdux graph found in Context')
   return (action: UnknownAction) => graph.dispatch(action)
}
