import * as core from '@actions/core'
import ReviewStats from './ReviewStats'

async function run(): Promise<void> {
  try {
    const slackWebhook = core.getInput('slackWebhook', {required: true})
    const repository = core.getInput('repository') || process.env.GITHUB_REPOSITORY!
    const githubToken = core.getInput('token') || process.env.GITHUB_TOKEN!
    const timeDiff = core.getInput('timeDiff') || '7d'

    const reviewStats = new ReviewStats({
      slackWebhook,
      repository,
      githubToken,
      timeDiff
    })

    reviewStats.main()
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
