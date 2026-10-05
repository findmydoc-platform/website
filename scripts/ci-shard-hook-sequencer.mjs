import path from 'node:path'
import { BaseSequencer } from 'vitest/node'

export default class HookSequencer extends BaseSequencer {
  async sort(files) {
    const order = JSON.parse(process.env.CI_SHARD_FILE_ORDER ?? '[]')
    const relative = (file) => path.relative(process.cwd(), file.moduleId).split(path.sep).join('/')
    if (files.length !== order.length || files.some((file) => !order.includes(relative(file))))
      throw new Error('Hook diagnostic file selection differs from the configured order.')
    return [...files].sort((a, b) => order.indexOf(relative(a)) - order.indexOf(relative(b)))
  }
}
