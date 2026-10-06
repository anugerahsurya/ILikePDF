import { zipSync } from 'fflate'

export function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function baseName(name) {
  return name.replace(/\.[^/.]+$/, '')
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/* Bundles many outputs into one ZIP so the browser doesn't block a burst of downloads. */
export async function downloadZip(items, zipName) {
  const entries = {}
  const used = new Set()
  for (const item of items) {
    let name = item.name
    for (let n = 2; used.has(name); n++) name = item.name.replace(/(\.[^.]+)?$/, `_${n}$1`)
    used.add(name)
    entries[name] = [new Uint8Array(await item.blob.arrayBuffer()), { level: 0 }]
  }
  downloadBlob(new Blob([zipSync(entries)], { type: 'application/zip' }), zipName)
}

export function downloadAll(items, zipName) {
  if (items.length === 1) return downloadBlob(items[0].blob, items[0].name)
  return downloadZip(items, zipName)
}

let uid = 0
export function withIds(files) {
  return files.map(file => ({ id: `f${++uid}`, file }))
}

export function moveItem(list, from, to) {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/* Parses "1-3, 5, 8-6" into groups of zero-based page indices. */
export function parseRanges(input, total) {
  const groups = []
  for (const raw of input.split(',')) {
    const part = raw.trim()
    if (!part) continue
    const match = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/)
    if (!match) throw new Error(`Bagian "${part}" tidak valid. Gunakan format seperti 1-3, 5.`)
    const a = Number(match[1])
    const b = match[2] ? Number(match[2]) : a
    if (a < 1 || b < 1 || a > total || b > total) {
      throw new Error(`Halaman "${part}" di luar jangkauan (1–${total}).`)
    }
    const step = a <= b ? 1 : -1
    const group = []
    for (let i = a; i !== b + step; i += step) group.push(i - 1)
    groups.push(group)
  }
  if (!groups.length) throw new Error('Isi rentang halaman terlebih dahulu, misalnya 1-3, 5.')
  return groups
}
