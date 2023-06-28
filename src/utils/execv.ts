import { utils, Path } from "tea"
const { host } = utils

export default function({cmd: argv, env}: {cmd: string[], env: Record<string, string>}) {
  const filename = host().platform == 'darwin' ? '/usr/lib/libSystem.dylib' : 'libc.so.6'

  const libc = Deno.dlopen(
    filename, {
      "execv": { parameters: ["pointer", "pointer"], result: "i32" },
    } as const
  )

  // execle is the only variant that takes env and is variadic
  // deno ffi cannot call variadic functions
  for (const key in env) {
    Deno.env.set(key, env[key])
  }

  find_in_PATH(argv, Deno.env.get('PATH'))

  const command = Deno.UnsafePointer.of(new TextEncoder().encode(`${argv[0]}\0`))
  const _result = libc.symbols.execv(command, arr_to_c(argv))

  throw new Error("execle failed")
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

function find_in_PATH(cmd: string[], PATH?: string) {
  PATH ??= "/usr/bin:/bin"  // see manpage for execvp(3)

  for (const part of PATH.split(':')) {
    const path = (part == '' || part == '.' ? Path.cwd() : new Path(part)).join(cmd[0])
    if (path.isExecutableFile()) {
      cmd[0] = path.string
      return
    }
  }
}
