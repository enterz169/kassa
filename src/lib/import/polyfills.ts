/**
 * Для pdf.js на старых Safari/iOS: нет асинхронного перебора ReadableStream и Promise.withResolvers.
 * Функция самодостаточна — её же код подставляется в воркер.
 */
export function installPdfPolyfills(): void {
  const g = globalThis as unknown as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const RS = g.ReadableStream
  if (RS && !RS.prototype[Symbol.asyncIterator]) {
    RS.prototype[Symbol.asyncIterator] = function (this: ReadableStream) {
      const reader = this.getReader()
      return {
        async next() {
          const r = await reader.read()
          if (r.done) { reader.releaseLock(); return { done: true, value: undefined } }
          return { done: false, value: r.value }
        },
        async return() {
          try { await reader.cancel() } catch { /* ignore */ }
          try { reader.releaseLock() } catch { /* ignore */ }
          return { done: true, value: undefined }
        },
        [Symbol.asyncIterator]() { return this },
      }
    }
  }
  if (typeof g.Promise.withResolvers !== 'function') {
    g.Promise.withResolvers = function () {
      let resolve!: (v?: unknown) => void; let reject!: (e?: unknown) => void
      const promise = new Promise((a, b) => { resolve = a; reject = b })
      return { promise, resolve, reject }
    }
  }
  if (typeof Array.prototype.at !== 'function') {
    Object.defineProperty(Array.prototype, 'at', { value(this: unknown[], i: number) { const n = Math.trunc(i) || 0; return this[n < 0 ? this.length + n : n] }, configurable: true, writable: true })
  }
}
