# Opinionated review statistics in Slack

This workflow collects review statistics and posts them to Slack. The intention is to increase awareness for reviewers how they're doing. It is developed and used at [ParabolInc/parabol](https://github.com/ParabolInc/parabol).

# TODO

## Publish to a distribution branch

Actions are run from GitHub repos so we will checkin the packed dist folder. 

Then run [ncc](https://github.com/zeit/ncc) and push the results:
```bash
$ yarn package
$ git add dist
$ git commit -a -m "prod dependencies"
$ git push origin releases/v1
```

Note: We recommend using the `--license` option for ncc, which will create a license file for all of the production node modules used in your project.

Your action is now published! :rocket: 

See the [versioning documentation](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)

