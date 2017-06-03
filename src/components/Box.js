import {Component} from 'react'
import {
  toArray, fromPairs, values, omit, compose, map, now, last,
  initial, flatten, mapValues, inRange, get, any,
} from 'lodash/fp'
import {withState} from 'recompose'
import cx from 'classnames'

const EXPIRY = 100
const WIGGLE = 0.3
const PERIOD = 60
const SIZE = 18
const SNAP = 3
const gc = (rn, xs) => xs.filter(({time}) => rn - time <= EXPIRY)

const COLORS = ['red', 'blue', 'yellow', 'black', 'purple', 'orange', 'green']

class Box extends Component {
  componentWillMount() {
    this.draw(0)
  }

  drawPoint = (ctx, t, point, scalar = 1, color = 'black') => {
    const rotation = 0
    const [x, y, rX, rY] = point
    ctx.beginPath()
    ctx.save()
    ctx.globalAlpha = Math.pow(1 - t, 2)
    ctx.ellipse(x, y, scalar * (rX || SIZE), scalar * (rY || SIZE), rotation, 0, 2 * Math.PI, false)
    ctx.fillStyle = color
    ctx.fill()
    ctx.restore()
    ctx.closePath()
  }

  drawCrosshair = (ctx, point, color = 'black') => {
    const [x, y] = point
    const width = innerWidth
    const height = innerHeight
    const yLabel = `y = ${y}`
    const ySize = ctx.measureText(yLabel)
    const xLabel = `x = ${x}`
    const xSize = ctx.measureText(xLabel)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.lineWidth = 1
    ctx.strokeStyle = color
    ctx.stroke()
    ctx.closePath()

    ctx.beginPath()
    ctx.fillStyle = color
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

  drawFPS = (ctx, fps, color) => {
    const label = `${fps.toFixed(0)} FPS`
    const size = ctx.measureText(label)
    ctx.beginPath()
    ctx.fillStyle = color
    ctx.font = '18px Futura'
    ctx.fillText(label, 10, 24)
    ctx.closePath()
  }

  drawRadius = (ctx, point, scalar = 2, color = 'black') => {
    const rotation = 0
    const [x, y, rX, rY, force] = point
    const width = innerWidth
    const height = innerHeight

    ctx.beginPath()
    ctx.ellipse(x, y, (rX || SIZE) * 2, (rY || SIZE) * 2, rotation, 0, 2 * Math.PI, false)
    ctx.lineWidth = scalar
    ctx.strokeStyle = color
    ctx.stroke()
    ctx.closePath()

    const yLabel = rY ? rX.toFixed(2) : '?'
    const ySize = ctx.measureText(yLabel)
    const xLabel = rX ? rX.toFixed(2) : '?'
    const xSize = ctx.measureText(xLabel)
    ctx.beginPath()
    ctx.fillStyle = color
    ctx.font = '14px Futura'
    ctx.fillText(yLabel, x + 4, y - (rY || SIZE) * 2 - 4)
    ctx.closePath()

    ctx.save()
    ctx.beginPath()
    ctx.translate(x - (rX || SIZE) * 2 - 18, y)
    ctx.rotate(Math.PI / 2)
    ctx.fillText(xLabel, 4, 4)
    ctx.closePath()
    ctx.restore()

    if (force) {
      ctx.beginPath()
      ctx.fillStyle = 'blue'
      ctx.fillText(`${force.toFixed(2)} FORCE`, x + (rX || 0) + 4, y + 4)
      ctx.closePath()
    }
  }

  draw = step => {
    const width = innerWidth
    const height = innerHeight
    if (this._ctx) {
      if (this._cvs.width !== width || this._cvs.height !== height) {
        this._cvs.width = width
        this._cvs.height = height
      }
      const ctx = this._ctx
      ctx.clearRect(0, 0, width, height)

      const rn = now()
      const trails = gc(rn, flatten(values(this.props.touches).map(initial)))
      const ghosts = [...this.props.ghosts, ...trails]

      gc(rn, ghosts).forEach(({time, point, color}) =>
         this.drawPoint(ctx, (rn - time) / EXPIRY, point, color)
      )

      COLORS.forEach((color, i) => {
         this.drawPoint(
           ctx, 0, [20, 80 + SIZE * 3 * i, SIZE, SIZE],
           1 + (color === this.props.brush ? 0.4 : 0), color,
         )
      })

      values(this.props.touches).forEach(history => {
        const {point, color} = last(history)
        if (history) {
          const start = history[0].point
          const [startX, startY, rX, rY, force] = start
          const distance = Math.abs(PERIOD - step)
          const hypot = Math.hypot(point[0] - startX, point[1] - startY) / 2
          const overExtended = (hypot / Math.max(rX || SIZE, rY)) > SNAP
          const radius = overExtended ? SNAP * Math.max(rX || SIZE, rY) : hypot
          this.drawPoint(
            ctx, 0, start, 1 + WIGGLE * Math.sqrt(distance / (PERIOD / 2)), color,
          )
          if (overExtended) {
            const factor = SNAP * Math.max(rX || SIZE, rY) / hypot
            this.drawPoint(ctx, 0, [
              startX + (point[0] - startX) * factor,
              startY + (point[1] - startY) * factor,
              10, 10
            ], force || 1, color)
          }
          this.drawRadius(
            ctx, [startX, startY, radius, radius, force],
            step < 6 ? 6 - step + 1 : 2,
            color,
          )
        }

        this.drawCrosshair(ctx, point, color)
        this.drawRadius(ctx, point, 1, color)
        this.drawPoint(ctx, 0, point, color)
      })

      if (this.props.prevTime !== null) {
        const delta = (rn - this.props.prevTime) / 1e3
        if (!this._fps || step === 0) this._fps = 1 / delta
        this.drawFPS(ctx, this._fps, this.props.brush)
      }
      this.props.setPrevTime(rn)
    }
    requestAnimationFrame(() => this.draw((step + 1) % PERIOD))
  }

  action = type => evt => {
    evt.preventDefault()
    const {touches, ghosts, setGhosts} = this.props
    const rn = now()
    const changed = toArray(evt.changedTouches)
    if (evt.type === 'touchstart') {
      console.log(evt)
    }
    const inToolbar = ({pageX, pageY}) => pageX < 100 && pageY > 50 && pageY < 450
    if (any(inToolbar, changed)) {
      const evt = changed.find(inToolbar)
      const color = COLORS[Math.floor((evt.pageY - 62) / 54)]
      this.props.setBrush(color)
    } if (type === 'touchstart') {
      this.props.setTouches({
        ...touches,
        ...fromPairs(changed.map(({pageX, pageY, radiusX, radiusY, force, identifier}) => [
          identifier,
          [{
            time: [rn],
            point: [pageX, pageY, radiusX, radiusY, force],
            color: this.props.brush,
          }],
        ])),
      })
    } else if (type === 'touchend' || type === 'touchcancel') {
      setGhosts([
        ...gc(rn, ghosts),
        ...changed.map(({pageX, pageY, radiusX, radiusY, force, identifier}) => ({
          time: rn,
          point: [pageX, pageY, radiusX, radiusY, force],
          color: get('color', last(touches[identifier])),
        })),
      ])
      this.props.setTouches(omit(map('identifier', changed), touches))
    } else {
      this.props.setTouches({
        ...touches,
        ...fromPairs(changed.map(({pageX, pageY, radiusX, radiusY, force, identifier}) => [
          identifier,
          [...touches[identifier], {
            time: rn,
            point: [pageX, pageY, radiusX, radiusY, force],
            color: get('color', last(touches[identifier])) || this.props.brush,
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
        width={innerWidth * 2}
        height={innerHeight * 2}
      />
    )
  }
}

export default compose(
  withState('brush', 'setBrush', 'black'),
  withState('prevTime', 'setPrevTime', null),
  withState('touches', 'setTouches', {}),
  withState('ghosts', 'setGhosts', []),
)(Box)
