/**
 * Construction de l'exécutable portable Windows.
 *
 * Deux contraintes d'environnement obligent à encadrer l'appel à makensis que
 * fait electron-builder :
 *
 * 1. Aucun pipe stdio ne peut être créé pour un process fils ici (ENOTCONN sur
 *    createSocket). electron-builder envoie le script NSIS sur stdin et lit la
 *    sortie par pipe : on écrit le script dans un fichier passé en argument, et
 *    on redirige les sorties vers des fichiers.
 * 2. Windows plafonne le répertoire de travail à 260 caractères (MAX_PATH) et
 *    ne résout pas les !include au-delà. Les chemins pnpm (.pnpm/<hash long>)
 *    dépassent cette limite : on recopie les templates NSIS vers un chemin
 *    court et on réécrit les chemins absolus du script vers cette copie.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const cp = require('child_process')

const utilPath = path.join(
  __dirname,
  'node_modules/.pnpm/builder-util@26.15.3/node_modules/builder-util/out/util.js'
)
const util = require(utilPath)

/** Le dossier NSIS en cache porte un suffixe temporaire : on retrouve le binaire. */
function resolveMakensis(command) {
  if (fs.existsSync(command)) return command
  const cache = path.join(os.homedir(), 'AppData/Local/electron-builder/Cache')
  const stack = [cache]
  while (stack.length) {
    const dir = stack.pop()
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) stack.push(full)
      else if (e.name.toLowerCase() === 'makensis.exe') return full
    }
  }
  return command
}

/** Exécution sans aucun pipe : les sorties vont dans des fichiers. */
function runNoPipe(command, args, cwd) {
  command = resolveMakensis(command)
  const outPath = path.join(os.tmpdir(), `mk-out-${Date.now()}.log`)
  const errPath = path.join(os.tmpdir(), `mk-err-${Date.now()}.log`)
  const fdOut = fs.openSync(outPath, 'w')
  const fdErr = fs.openSync(errPath, 'w')
  let stdout = ''
  let stderr = ''
  try {
    const r = cp.spawnSync(command, args, { cwd, stdio: ['ignore', fdOut, fdErr] })
    fs.closeSync(fdOut)
    fs.closeSync(fdErr)
    stdout = fs.readFileSync(outPath, 'utf8')
    stderr = fs.readFileSync(errPath, 'utf8')
    if (r.error) throw r.error
    if (r.status !== 0) {
      throw new Error(`${command} a quitté avec le code ${r.status}\n${stdout}\n${stderr}`)
    }
    return stdout
  } finally {
    try { fs.unlinkSync(outPath) } catch {}
    try { fs.unlinkSync(errPath) } catch {}
  }
}

util.spawnAndWriteWithOutput = function (command, args, data, options) {
  const cwd = options && options.cwd
  let script = data.toString()
  let runCwd = cwd

  if (cwd && cwd.length > 200) {
    const short = path.join(os.tmpdir(), 'eb-nsis-tpl')
    fs.rmSync(short, { recursive: true, force: true })
    fs.cpSync(cwd, short, { recursive: true })
    const fwd = cwd.split(path.sep).join('/')
    const back = cwd.split('/').join(path.sep)
    for (const variant of new Set([cwd, fwd, back])) {
      script = script.split(variant).join(short)
    }
    runCwd = short
  }

  // makensis résout les !include relatifs (common.nsh...) par rapport au
  // dossier du script, pas au cwd : on l'écrit donc dans le dossier de templates.
  const file = path.join(
    runCwd || os.tmpdir(),
    `nsis-${Date.now()}-${Math.random().toString(36).slice(2)}.nsi`
  )
  fs.writeFileSync(file, script)
  const newArgs = args.filter((a) => a !== '-').concat([file])
  return Promise.resolve()
    .then(() => runNoPipe(command, newArgs, runCwd))
    .finally(() => {
      try { fs.unlinkSync(file) } catch {}
    })
}

const builder = require('electron-builder')
builder
  .build({ targets: builder.Platform.WINDOWS.createTarget() })
  .then((r) => console.log('OK:\n' + r.join('\n')))
  .catch((e) => {
    console.error('FAIL:', (e && e.message) || e)
    process.exit(1)
  })
