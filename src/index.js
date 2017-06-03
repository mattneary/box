import {Component} from 'react'
import {render} from 'react-dom'
import Box from './components/Box'

import cs from './styles.css'

class App extends Component {
  render () {
    return <Box />
  }
}

render(<App/>, document.getElementById('app'))
