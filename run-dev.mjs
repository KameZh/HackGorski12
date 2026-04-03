import { spawn } from 'node:child_process'
import process from 'node:process'

const isWindows = process.platform === 'win32'
const backend = spawn('npm', ['--prefix', 'Backend', 'start'], {
  stdio: 'inherit',
  shell: isWindows,
})

const frontend = spawn('npm', ['--prefix', 'pytechka-frontend', 'run', 'dev', '--', '--host', '0.0.0.0'], {
  stdio: 'inherit',
  shell: isWindows,
})

const shutdown = () => {
  backend.kill()
  frontend.kill()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

backend.on('exit', (code) => {
  if (code && code !== 0) {
    frontend.kill()
    process.exit(code)
  }
})

frontend.on('exit', (code) => {
  if (code && code !== 0) {
    backend.kill()
    process.exit(code)
  }
})
