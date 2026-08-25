const fs = require('node:fs')
const path = require('node:path')
const file = path.join(__dirname, '..', 'node_modules', '@deepseek-ai', 'dsh-host-directory-picker-native', 'lib', 'worker.cjs')
if (!fs.existsSync(file)) {
  console.error('[patch-dsh-directory-picker] worker.cjs not found:', file)
  process.exit(1)
}
let code = fs.readFileSync(file, 'utf8')
const marker = 'koffi.decode.wstring(address)'
if (code.includes(marker)) {
  console.log('[patch-dsh-directory-picker] already patched, nothing to do')
  process.exit(0)
}
const oldBlock = /\/\*\*\n\* Read a NUL-terminated UTF-16 string at a native address[\s\S]*?function readUtf16\(koffi, address\) \{\n\tconst bytes = Buffer\.from\(koffi\.view\(address, 32768\)\);\n\tlet end = 0;\n\twhile \(end \+ 1 < bytes\.length && bytes\[end\] !== 0\) end \+= 2;\n\treturn bytes\.toString\("utf16le", 0, end\);\n\}/
if (!oldBlock.test(code)) {
  console.error('[patch-dsh-directory-picker] old readUtf16 block not found; aborting (package layout changed?)')
  process.exit(1)
}
const newBlock = '/*\n* Read a NUL-terminated UTF-16 string at a native address. koffi\'s\n* \`_Out_ void **\` out-params surface a raw address, and\n* \`koffi.decode(addr, \'str16\')\` would dereference it as a pointer - crash\n* on real Windows - so read through the wstring decoder (koffi 3.1.0+),\n* which reads at the address on every supported runtime.\n*/\nfunction readUtf16(koffi, address) {\n\treturn koffi.decode.wstring(address);\n}'
code = code.replace(oldBlock, newBlock)
fs.writeFileSync(file, code)
console.log('[patch-dsh-directory-picker] patched worker.cjs (koffi.view -> koffi.decode.wstring)')
