import { defineConfig, type TestProjectInlineConfiguration } from 'vitest/config'
import base from './vitest.config'

const stage = process.env.INTEGRATION_RUN_STAGE
if (process.env.INTEGRATION_BASELINE_COPY !== '1' || (stage !== 'seed' && stage !== 'suite'))
  throw new Error('Integration preparation configuration requires the serial baseline-copy runner.')
if (!process.env.INTEGRATION_COVERAGE_DIRECTORY)
  throw new Error('Integration preparation coverage directory is missing.')

const integration = base.test!.projects!.find(
  (project) => typeof project === 'object' && 'test' in project && project.test?.name === 'integration',
) as TestProjectInlineConfiguration
if (!integration) throw new Error('The normal integration project is missing.')

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    projects: [
      {
        ...integration,
        test: {
          ...integration.test,
          ...(stage === 'seed'
            ? { globalSetup: [], include: ['tests/setup/integrationBaselineSeed.ts'] }
            : {
                setupFiles: ['tests/setup/integrationBaselineCopy.ts', ...(integration.test!.setupFiles as string[])],
              }),
        },
      },
    ],
    coverage: {
      ...base.test!.coverage,
      // Partial seed/suite reports are checked against the unchanged thresholds only after native merging.
      thresholds: undefined,
      reportsDirectory: `${process.env.INTEGRATION_COVERAGE_DIRECTORY}/${stage}`,
      reporter: ['json'],
    },
  },
})
