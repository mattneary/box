import {Component} from 'react'
import {
  toArray, fromPairs, values, omit, compose, map, now, last,
  initial, flatten, mapValues,
} from 'lodash/fp'
import {withState} from 'recompose'
import cx from 'classnames'

const EXPIRY = 1e3
const gc = (rn, xs) => xs.filter(({time}) => rn - time <= EXPIRY)
const gcObj = rn => mapValues(xs => gc(rn, xs))

class Box extends Component {
  componentWillMount() {
    this.draw()
  }

  draw = () => {
    const scale = devicePixelRatio
    const width = innerWidth
    const height = innerHeight
    if (this._ctx) {
      if (this._cvs.width !== width || this._cvs.height !== height) {
        this._cvs.width = width
        this._cvs.height = height
      }
      const ctx = this._ctx
      ctx.clearRect(0, 0, width, height)

      ctx.beginPath()
      ctx.rect(1, 1, width - 3, height - 3)
      ctx.strokeStyle = 'blue'
      ctx.stroke()
      ctx.closePath()

      const radius = 30

      const rn = now()
      const trails = flatten(values(this.props.touches).map(initial))
      const ghosts = [...this.props.ghosts, ...trails]

      gc(rn, ghosts).forEach(
        ({time, point: [x, y]}) => {
          const t = (rn - time) / EXPIRY
          ctx.save()
          ctx.globalAlpha = Math.pow(1 - t, 2)
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, 2 * Math.PI, false)
          ctx.fillStyle = 'white'
          ctx.fill()
          ctx.lineWidth = 3
          ctx.strokeStyle = 'blue'
          ctx.stroke()
          ctx.closePath()
          ctx.restore()
        }
      )

      values(this.props.touches).forEach(trail => {
        const {point: [x, y]} = last(trail)
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, 2 * Math.PI, false)
        ctx.fillStyle = 'white'
        ctx.fill()
        ctx.lineWidth = 3
        ctx.strokeStyle = 'blue'
        ctx.stroke()
        ctx.closePath()
      })
    }
    requestAnimationFrame(() => this.draw())
  }

  action = type => evt => {
    evt.preventDefault()
    const {touches, ghosts, setGhosts} = this.props
    const rn = now()
    const setTouches = compose(this.props.setTouches, gcObj(rn))
    const changed = toArray(evt.changedTouches)
    if (type === 'touchstart') {
      setTouches({
        ...touches,
        ...fromPairs(changed.map(({pageX, pageY, identifier}) => [
          identifier,
          [{time: [rn], point: [pageX, pageY]}],
        ])),
      })
    } else if (type === 'touchend' || type === 'touchcancel') {
      setTouches(omit(map('identifier', changed), touches))
      setGhosts([
        ...gc(rn, ghosts),
        ...changed.map(({pageX, pageY}) => ({
          time: rn,
          point: [pageX, pageY],
        })),
      ])
    } else {
      setTouches({
        ...touches,
        ...fromPairs(changed.map(({pageX, pageY, identifier}) => [
          identifier,
          [...touches[identifier], {
            time: rn,
            point: [pageX, pageY],
          }],
        ])),
      })
    }
  }

  getContext = cvs => {
    if (!cvs) return
    ['touchstart', 'touchend', 'touchmove', 'touchcancel'].forEach(name => {
      cvs.addEventListener(name, this.action(name), false)
    })
    this._cvs = cvs
    this._ctx = cvs.getContext('2d')
  }

  render() {
    return (
      <canvas
        ref={this.getContext}
        width={innerWidth}
        height={innerHeight}
      />
    )
  }
}

export default compose(
  withState('touches', 'setTouches', {}),
  withState('ghosts', 'setGhosts', []),
)(Box)
