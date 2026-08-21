'use strict'

// Mock dsh web server for validating the desktop shell without a real runtime.
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const logFile = path.join(__dirname, 'mock-requests.log')

// Record how the shell launched us, so tests can assert --patch wiring.
fs.appendFileSync(logFile, new Date().toISOString() + ' ARGV ' + JSON.stringify(process.argv.slice(2)) + '\n')

const server = http.createServer((req, res) => {
  fs.appendFileSync(logFile, new Date().toISOString() + ' ' + req.method + ' ' + req.url + '\n')
  if (req.url.startsWith('/assets/')) {
    res.writeHead(200, { 'content-type': 'application/javascript' })
    res.end('console.log("mock asset")')
    return
  }
  res.writeHead(200, { 'content-type': 'text/html' })
  res.end('<!doctype html><html><body><h1 id="app">mock dsh web</h1></body></html>')
})

server.listen(0, '127.0.0.1', () => {
  const { port } = server.address()
  console.log(`dsh web: http://127.0.0.1:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  })
}