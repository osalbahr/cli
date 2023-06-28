import { utils } from "tea"
const { host } = utils

export default function(command: string, args: string[], env: Record<string, string>) {
  const filename = host().platform == 'darwin' ? '/usr/lib/libSystem.dylib' : 'libc.so.6'

  const libc = Deno.dlopen(
    filename, {
      "execle": { parameters: ["pointer", "pointer", "pointer"], result: "i32" },
    } as const,
  )

  const argv = [command, ...args]

  //TODO need an array that fits the memory architecture! can't assume 64 bit!

  const argv_ = new BigUint64Array((argv.length + 1) * 4)
  for (let i = 0; i < argv.length; i++) {
    const a = new TextEncoder().encode(`${argv[i]}\0`)
    const b = Deno.UnsafePointer.of(a)
    const c = Deno.UnsafePointer.value(b)

    argv_.set([BigInt(c)], i)
  }
  argv_[argv.length] = 0n

  const buffer = new TextEncoder().encode(`${command}\0`)
  const foo = Deno.UnsafePointer.of(buffer)

  const env_strs = Object.entries(env).map(([k, v]) => `${k}=${v}`)

  const _result = libc.symbols.execle(foo, arr_to_c(args), arr_to_c(env_strs))

  throw new Error("execvp failed")
}

function arr_to_c(arr: string[]): Deno.PointerValue {
  //TODO word size may not be 4 bytes!
  const argv_ = new BigUint64Array((arr.length + 1) * 4)
  for (let i = 0; i < arr.length; i++) {
    const a = new TextEncoder().encode(`${arr[i]}\0`)
    const b = Deno.UnsafePointer.of(a)
    const c = Deno.UnsafePointer.value(b)

    argv_.set([BigInt(c)], i)
  }
  argv_[arr.length] = 0n
  return Deno.UnsafePointer.of(argv_)
}