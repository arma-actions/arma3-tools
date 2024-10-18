import * as fs from 'fs'
import * as path from 'path'
import {execSync} from 'child_process'
import * as https from 'https'
import * as unzipper from 'unzipper'
import * as os from 'os'
import * as core from '@actions/core'
import content from './reg'

function setupRegistry(): void {
  const regFilePath = path.join(__dirname, 'arma3tools.reg')
  fs.writeFileSync(regFilePath, content)
  execSync(`regedit /S "${regFilePath}"`)
}

async function downloadAndExtractTools(toolsUrl: string): Promise<void> {
  const tempZipPath = path.join(os.tmpdir(), 'tools.zip')

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempZipPath)
    https
      .get(toolsUrl, response => {
        response.pipe(file)
        file.on('finish', () => {
          file.close(() => {
            extractTools(tempZipPath, resolve, reject)
          })
        })
      })
      .on('error', err => {
        fs.unlink(tempZipPath, () => reject(err))
      })
  })
}

function extractTools(
  tempZipPath: string,
  resolve: () => void,
  reject: (err: Error) => void
): void {
  const extractPath =
    os.platform() === 'win32'
      ? 'C:\\arma3tools'
      : path.join(os.homedir(), '.local', 'share', 'arma3tools')

  fs.createReadStream(tempZipPath)
    .pipe(unzipper.Extract({path: extractPath}))
    .on('close', () => {
      fs.unlinkSync(tempZipPath)
      resolve()
    })
    .on('error', err => {
      fs.unlinkSync(tempZipPath)
      reject(err)
    })
}

function configureTools(): void {
  if (os.platform() !== 'win32') return

  const binMakeRulesPath = 'C:\\arma3tools\\BinMake\\binMakeRules.txt'
  let rules = fs.readFileSync(binMakeRulesPath, 'utf8')
  rules = rules.replace('O:\\Arma3CommunityTools', 'C:\\arma3tools')
  fs.writeFileSync(binMakeRulesPath, rules)
}

function installDirectX(): void {
  try {
    execSync('choco install directx -y')
  } catch (err) {
    core.info('Failed to install DirectX')
    core.debug((err as Error).name)
    core.debug((err as Error).message)
  }
}

async function main(toolsUrl: string): Promise<void> {
  await downloadAndExtractTools(toolsUrl)
  if (os.platform() === 'win32') {
    setupRegistry()
    installDirectX()
    configureTools()
  }
}

async function run(): Promise<void> {
  const toolsUrl = process.env.ARMA3_TOOLS_URL || process.argv[2]
  if (!toolsUrl) {
    throw new Error('ARMA3_TOOLS_URL environment variable is not set')
  }
  await main(toolsUrl)
}

run()
