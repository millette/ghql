'use strict'

// npm
const { parse } = require('ndjson')

process.stdin
  .pipe(parse())
  .on('data', (obj) => console.log(JSON.stringify(obj, null, '  ')))
  .once('end', () => console.error('All done'))
  .once('error', (err) => console.error(err))
