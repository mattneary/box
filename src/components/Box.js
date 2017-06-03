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

  drawPoint = (ctx, t, point) => {
    const rotation = 0
    const [x, y, rX, rY] = point
    ctx.beginPath()
    ctx.save()
    ctx.globalAlpha = Math.pow(1 - t, 2)
    ctx.ellipse(x, y, rX || 30, rY || 30, rotation, 0, 2 * Math.PI, false)
    ctx.lineWidth = 3
    ctx.strokeStyle = 'blue'
    ctx.fillStyle = 'white'
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    ctx.closePath()
  }

  drawCrosshair = (ctx, point) => {
    ctx.beginPath()
    const [x, y] = point
    const width = innerWidth
    const height = innerHeight
    const yLabel = `y = ${y}`
    const ySize = ctx.measureText(yLabel)
    const xLabel = `x = ${x}`
    const xSize = ctx.measureText(xLabel)
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.strokeStyle = 'blue'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.closePath()

    ctx.beginPath()
    ctx.fillStyle = 'blue'
    ctx.font = '14px Futura'
    ctx.fillText(yLabel, width - ySize.width - 10, y - 18)
    ctx.closePath()

    ctx.save()
    ctx.beginPath()
    ctx.translate(x + 10, 0)
    ctx.rotate(Math.PI / 2)
    ctx.fillText(xLabel, 10, 4)
    ctx.closePath()
    ctx.restore()
  }

  drawRadius = (ctx, point) => {
    const rotation = 0
    const [x, y, rX, rY] = point
    const width = innerWidth
    const height = innerHeight

    ctx.beginPath()
    ctx.ellipse(x, y, (rX || 30) * 2, (rY || 30) * 2, rotation, 0, 2 * Math.PI, false)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'blue'
    ctx.stroke()
    ctx.closePath()

    const yLabel = rY ? rX.toFixed(2) : '?'
    const ySize = ctx.measureText(yLabel)
    const xLabel = rX ? rX.toFixed(2) : '?'
    const xSize = ctx.measureText(xLabel)
    ctx.beginPath()
    ctx.fillStyle = 'blue'
    ctx.font = '14px Futura'
    ctx.fillText(yLabel, x + 4, y - (rY || 30) * 2 - 4)
    ctx.closePath()

    ctx.save()
    ctx.beginPath()
    ctx.translate(x - (rX || 30) * 2 - 18, y)
    ctx.rotate(Math.PI / 2)
    ctx.fillText(xLabel, 4, 4)
    ctx.closePath()
    ctx.restore()
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

      const rn = now()
      const trails = flatten(values(this.props.touches).map(initial))
      const ghosts = [...this.props.ghosts, ...trails]

      gc(rn, ghosts).forEach(({time, point}) =>
         this.drawPoint(ctx, (rn - time) / EXPIRY, point)
      )

      values(this.props.touches).forEach(trail => {
        if (!trail.length) return
        const {point} = last(trail)
        this.drawCrosshair(ctx, point)
        this.drawRadius(ctx, point)
        this.drawPoint(ctx, 0, point)
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
        ...fromPairs(changed.map(({pageX, pageY, radiusX, radiusY, identifier}) => [
          identifier,
          [{time: [rn], point: [pageX, pageY, radiusX, radiusY]}],
        ])),
      })
    } else if (type === 'touchend' || type === 'touchcancel') {
      setTouches(omit(map('identifier', changed), touches))
      setGhosts([
        ...gc(rn, ghosts),
        ...changed.map(({pageX, pageY, radiusX, radiusY}) => ({
          time: rn,
          point: [pageX, pageY, radiusX, radiusY],
        })),
      ])
    } else {
      setTouches({
        ...touches,
        ...fromPairs(changed.map(({pageX, pageY, radiusX, radiusY, identifier}) => [
          identifier,
          [...touches[identifier], {
            time: rn,
            point: [pageX, pageY, radiusX, radiusY],
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
