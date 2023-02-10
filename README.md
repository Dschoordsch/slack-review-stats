# Opinionated review statistics in Slack

This workflow collects review statistics and posts them to Slack. The intention is to increase awareness for reviewers how they're doing. It is developed and used at [ParabolInc/parabol](https://github.com/ParabolInc/parabol).

## Why this?

While there are more elaborate packages out there, those did not solve exactly my requirements.

I want to have weekly statistics about all the reviews done in that week. This is posted in Slack on Fridays and gives developers feedback on how they're doing on reviews.
It's not meant to be used as a performance evaluation tool nor as a leaderboard. Thus there is no longterm history and the list cannot be re-ordered.
In addition I want to have statistics how we're doing as a whole, so I also wanted to have some overall statistics of how many PRs got merged and how long it took.

## What's to come?

Going forward I will change the logic of how the statistics is collected. Right now all PRs merged within the given timeframe are considered.
This gives some delay in the feedback which is not optimal, so that's the next thing.

Afterwards I will continue to tweak it if I see the data is not relevant enough.

## What's not to come?

There won't be a ton of configurability. I will tweak it towards that one goal of improving review times for our team and that's it.

## Pictures or it didn't happen

![Statistics of ParabolInc/parabol posted on Slack](docs/review-stats.png?raw=true)

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

