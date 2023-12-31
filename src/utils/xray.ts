import os from 'node:os'
import { spawn, exec } from 'node:child_process'
import { resolve } from 'pathe'
import { XrayConfig } from '~/types'

const XRAY_CORE = resolve(join(XRAY_CORE_DIR, XRAY_CORE_BIN))
const XRAY_CONFIG = resolve(join(XRAY_CORE_DIR, 'config.json'))
const RAYNER_PID = resolve(join(RAYNER_DIR, 'xray.pid'))

process.on('exit', () => {
  fse.remove(RAYNER_PID)
})

export const rewriteXrayConfig = async (config: XrayConfig) => {
  await fse.remove(XRAY_CONFIG)
  return await fse.outputJson(XRAY_CONFIG, config)
}

export const loadXrayConfig = async () => {
  try {
    const json: XrayConfig = await fse.readJson(XRAY_CONFIG)
    return json
  } catch {
    return undefined
  }
}

export const downloadXrayCoreZip = async (conf: RaynerConfig) => {
  const release = parseXrayCoreReleaseURL(conf)
  await downloadFromURL(release, { proxy: conf.proxy, output: XRAY_CORE_DIR })
}

export const unzipXrayCoreZip = async (conf: RaynerConfig) => {
  const release = parseXrayCoreReleaseURL(conf)
  const filename = parseFilename(release, { strict: true })
  await unzip(join(XRAY_CORE_DIR, filename), { output: XRAY_CORE_DIR })
  await fse.remove(join(XRAY_CORE_DIR, filename))
}

export const existXrayCoreBin = async () => {
  const exist = await fse.pathExists(XRAY_CORE)
  if (!exist) { consola.warn(`Do not exist xray core under ${XRAY_CORE}`) }
  return exist
}

export const parseXrayCoreReleaseURL = ({ xray }: RaynerConfig) => {
  const _platform = os.platform()
  const _arch = os.arch()
  const plarform = XRAY_CORE_PLATFOFMS?.[_platform] ?? _platform
  const arch = XRAY_CORE_ARCHES?.[_arch] ?? _arch

  return `${XRAY_CORE_RELEASE}/v${xray.version}/Xray-${plarform}-${arch}.zip`
}

export const runXrayCore = async () => {
  const valid = await validateConfig()
  if (!valid) { await writeDefaltXrayConfig() }
  const xrayConf = await loadXrayConfig()
  if (!xrayConf) { return }

  const [{ port }] = xrayConf.inbounds ?? []
  if (!port) { return }
  const isPortAvailable = !!(await checkPort(port))

  if (!isPortAvailable) {
    xrayConf.inbounds[0].port = await getRandomPort()
    await rewriteXrayConfig(xrayConf)
  }

  const { pid } = spawn(XRAY_CORE, ['run', '-c', XRAY_CONFIG])
  const pidPath = join(RAYNER_DIR, 'xray.pid')
  await fse.ensureFile(pidPath)
  await fse.outputFile(pidPath, String(pid))
  return pid
}

export const startXrayCore = runXrayCore

export const stopXrayCore = async () => {
  const pidPath = join(RAYNER_DIR, 'xray.pid')
  fse.ensureFile(pidPath)
  const pid = await fse.readFile(pidPath)
  if (!pid) { return }
  terminateProcessByPid(pid)
}

export const restartXrayCore = async () => {
  await stopXrayCore()
  return await startXrayCore()
}

export const writeDefaltXrayConfig = async () => {
  await fse.outputJson(XRAY_CONFIG, defaultXrayConfig)
}

export const validateConfig = async (path: string = XRAY_CONFIG) => {
  const exist = await fse.pathExists(path)
  if (!exist) { return false }
  return testXrayConfig()
}

export const testXrayConfig = async () => {
  try {
    const stdout = await execXrayAsync('-test')
    return stdout.includes('Configuration OK')
  } catch (error) {
    return false
  }
}

export const execXrayAsync = (cmd: string, options: { stdout: boolean } = { stdout: false }): Promise<string> => {
  return new Promise((resolve, reject) => {
    const p = exec(`${XRAY_CORE} ${cmd}`, (error, stdout) => {
      if (error) {
        reject(error)
        return
      }
      resolve(stdout)
    })

    if (options.stdout) {
      p.stdout?.pipe(process.stdout)
    }
  })
}
