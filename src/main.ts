import './style.css'
import { Game } from './game.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#yard')
if (!canvas) throw new Error('Missing canvas')

new Game(canvas).startLoop()
