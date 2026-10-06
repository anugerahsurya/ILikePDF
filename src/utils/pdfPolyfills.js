/**
 * Polyfills for Uint8Array and Promise modern standards
 * Needed by PDF.js and various PDF processors in Electron/Chromium environments.
 */

// 1. Uint8Array.prototype.toHex
if (typeof Uint8Array.prototype.toHex !== 'function') {
  Uint8Array.prototype.toHex = function () {
    let hex = ''
    for (let i = 0; i < this.length; i++) {
      hex += this[i].toString(16).padStart(2, '0')
    }
    return hex
  }
}

// 2. Uint8Array.prototype.setFromHex
if (typeof Uint8Array.prototype.setFromHex !== 'function') {
  Uint8Array.prototype.setFromHex = function (hexString) {
    const cleanHex = String(hexString || '').replace(/\s+/g, '')
    const maxBytes = Math.min(this.length, Math.floor(cleanHex.length / 2))
    for (let i = 0; i < maxBytes; i++) {
      this[i] = parseInt(cleanHex.substr(i * 2, 2), 16)
    }
    return { read: maxBytes * 2, written: maxBytes }
  }
}

// 3. Uint8Array.fromHex
if (typeof Uint8Array.fromHex !== 'function') {
  Uint8Array.fromHex = function (hexString) {
    const cleanHex = String(hexString || '').replace(/\s+/g, '')
    if (cleanHex.length % 2 !== 0) {
      throw new TypeError('Invalid hex string length')
    }
    const bytes = new Uint8Array(cleanHex.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16)
    }
    return bytes
  }
}

// 4. Uint8Array.prototype.toBase64
if (typeof Uint8Array.prototype.toBase64 !== 'function') {
  Uint8Array.prototype.toBase64 = function () {
    let binary = ''
    const len = this.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(this[i])
    }
    return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(this).toString('base64')
  }
}

// 5. Uint8Array.fromBase64
if (typeof Uint8Array.fromBase64 !== 'function') {
  Uint8Array.fromBase64 = function (base64String) {
    const binary = typeof atob !== 'undefined' ? atob(base64String) : Buffer.from(base64String, 'base64').toString('binary')
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
}

// 6. Promise.withResolvers
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () {
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}
