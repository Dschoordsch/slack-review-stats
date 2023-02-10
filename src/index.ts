import * as core from '@actions/core'
import ReviewStats from './reviewStats'

async function run(): Promise<void> {
  try {
    const slackWebhook = core.getInput('slack-webhook', {required: true})
    const repository = core.getInput('repository')
    const githubToken = core.getInput('github-token')
    const timeDiff = core.getInput('time-diff')

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
