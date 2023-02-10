# Opinionated review statistics in Slack

This workflow collects review statistics and posts them to Slack. The intention is to increase awareness for reviewers how they're doing. It is developed and used at [ParabolInc/parabol](https://github.com/ParabolInc/parabol).

## Configure the workflow

You need to create a [Slack webhook](https://api.slack.com/messaging/webhooks) and pass it via `slack-webhook` to the workflow. All other configuration options are optional.

Your workflow should look something like this
```
name: Pull Request Stats

on:
  schedule:
    - cron: '54 14 * * 5'

jobs:
  stats:
    runs-on: ubuntu-latest
    steps:
      - uses: Dschoordsch/slack-review-stats@v1.0.0
        with:
          slack-webhook: ${{ secrets.SLACK_WEBHOOK }}
```

## Publish to a distribution branch

Actions are run from GitHub repos so we will checkin the packed dist folder. 

Then run [ncc](https://github.com/zeit/ncc) and push the results:
```bash
$ yarn package
$ git add dist
$ git commit -a -m "prod dependencies"
$ git push origin releases/v1.0.0
```

Your action is now published! :rocket: 

See the [versioning documentation](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)

