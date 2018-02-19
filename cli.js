'use strict'

// self
const { doit, dothem } = require('.')

if (process.argv.length < 2) { throw new Error('Missing username argument.') }
const p = process.argv.length === 4 ? doit : dothem
p(process.argv[2], (user) => console.log(JSON.stringify(user)))
  .then(console.error)
  .catch(console.error)
