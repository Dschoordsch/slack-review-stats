import * as core from '@actions/core'
import ReviewStats from './reviewStats'

async function run(): Promise<void> {
  try {
    const slackWebhook = core.getInput('slack-webhook', {required: true})
    core.info(`REPO: ${process.env.GITHUB_REPOSITORY}`)
    const repository =
      core.getInput('repository') || process.env.GITHUB_REPOSITORY!
    const githubToken =
      core.getInput('github-token') || process.env.GITHUB_TOKEN!
    const timeDiff = core.getInput('time-diff') || '7d'

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
