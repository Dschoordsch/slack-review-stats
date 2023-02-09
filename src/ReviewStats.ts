import ms from 'ms'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import fetch from 'node-fetch'
dayjs.extend(isoWeek)

const GITHUB_ENDPOINT = 'https://api.github.com/graphql'
const QUERY = `
query($searchQuery: String!) { 
  search(query: $searchQuery, type: ISSUE, first: 100) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      ... on PullRequest {
        number
        url
        publishedAt
        mergedAt
        author { ...UserFragment }
        timelineItems(first: 100) {
          nodes {
            __typename
            ... on ReviewRequestedEvent {
              createdAt
              requestedReviewer { ...UserFragment }
            }
            ... on PullRequestReview {
              id
              author { ...UserFragment }
              comments(first: 1) {
                totalCount
              }
              bodyText
              submittedAt
              state
            }
            ... on MergedEvent {
              actor { ...UserFragment }
              createdAt
            }
            ... on IssueComment {
              author { ...UserFragment }
              createdAt
            }
          }
        }
      }
    }
  }
}
fragment UserFragment on User {
  url
  login
  avatarUrl
}
`

const calculateTimeToReview = (request: Date, review: Date) => {
  const timeToReview = review.valueOf() - request.valueOf()
  const requestWeek = dayjs(request).isoWeek()
  const reviewWeek = dayjs(review).isoWeek()
  const weekends = reviewWeek - requestWeek

  return timeToReview - weekends * ms('2d')
}

const padRight = (str: string, width: number) => {
  const length = Math.min(str.length, width)
  return str.slice(0, length) + ' '.repeat(width - length)
}

const formatRow = (values: (string|number|undefined)[], format: number[]) => {
  const rows = [] as string[]

  do {
    const row = [] as string[]

    const overflow = Array(values.length).fill('')
    values.forEach((value, index) => {
      const valueStr = value === undefined ? '-' : value.toString()
      const fieldLength = format[Math.min(index, format.length - 1)]
      row.push(padRight(valueStr, fieldLength))
      if (valueStr.length > fieldLength) {
        overflow[index] = valueStr.slice(fieldLength).trim()
      }
    })
    values = overflow

    rows.push(row.join(' | '))
  } while(values.find(value => !!value))

  return rows.join('\n')
}

const median = (values: number[]) => {
  if(values.length === 0) return undefined

  values.sort()
  var middle = Math.floor(values.length / 2)
  if (values.length % 2) return values[middle]
  return (values[middle- 1] + values[middle]) / 2.0;
}

const safeMs = (val: number | undefined | null) => typeof val === 'number' && isFinite(val) ? ms(val) : undefined


export type ReviewStatsOptions = {
  slackWebhook: string
  repository: string
  githubToken: string
  timeDiff: string
}

class ReviewStats {
  slackWebhook: string
  repository: string
  githubToken: string
  timeDiff: string

  constructor(options: ReviewStatsOptions) {
    this.slackWebhook = options.slackWebhook
    this.repository = options.repository
    this.githubToken = options.githubToken
    this.timeDiff = options.timeDiff
  }

  fetchData = async (mergedAfter: Date) => {
    const searchQuery = `is:pr archived:false is:closed is:merged repo:${this.repository} merged:>=${mergedAfter.toISOString()}`
    const response = await fetch(GITHUB_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'Authorization': `bearer ${this.githubToken}`
      },
      body: JSON.stringify({
        QUERY,
        variables: {
          searchQuery
        }
      })
    })

    console.log(`Pulling stats for ${this.repository}: ${response.status}`)

    //TODO we're not checking pagination yet
     
    return response.json()
  }

  pushToSlack = async (body: any) => {
    const response = await fetch(this.slackWebhook, {
      method: 'POST',
      body: JSON.stringify(body)
    })

    console.log(`Pushing stats: ${response.status}`)
  }

  parseStats = (rawData: any) => {
    const reviewerStats = {} as any

    console.log('rawData:', rawData)
    const prs = rawData.data.search.nodes.map((pr: any) => {
      const publishedAt = new Date(pr.publishedAt)
      const mergedAt = new Date(pr.mergedAt)
      const timeToMerge = mergedAt.valueOf() - publishedAt.valueOf()

      const requestedReviewers = {} as Record<string, Date | undefined>
      const reviewers = new Set<string>() 
      let comments = 0
      let reviews = 0
      pr.timelineItems.nodes.forEach((item: any) => {
        if (item.__typename === 'ReviewRequestedEvent') {
          requestedReviewers[item.requestedReviewer.login] = new Date(item.createdAt)
        }
        if (item.__typename === 'PullRequestReview') {
          const login = item.author.login

          if (!reviewerStats[login]) {
            reviewerStats[login] = {
              ...item.author,
              timesToReview: [],
              reviewStates: [],
              comments: 0,
              reviewedPRs: 0,
            }
          }
          reviewerStats[login].reviewStates.push(item.state)
          reviewerStats[login].comments += item.comments.totalCount

          const request = requestedReviewers[login]
          if (request) {
            const timeToReview = calculateTimeToReview(request, new Date(item.submittedAt))
            reviewerStats[login].timesToReview.push(timeToReview)
            requestedReviewers[login] = undefined
          }

          reviewers.add(login)
          comments += item.comments.totalCount
          if (item.bodyText) {
            comments++
          }
          reviews++
        }
        if (item.__typename === 'MergedEvent') {
          const login = item.actor.login
          if (login !== pr.author.login) {
            if (!reviewerStats[login]) {
              reviewerStats[login] = {
                ...item.actor,
                timesToReview: [],
                reviewStates: [],
                comments: 0,
                reviewedPRs: 0,
              }
            }

            const request = requestedReviewers[login]
            if (request) {
              const timeToReview = calculateTimeToReview(request, new Date(item.createdAt))
              reviewerStats[login].timesToReview.push(timeToReview)
              requestedReviewers[login] = undefined
            }

            reviewers.add(login)
            reviews++
          }
        }
        if (item.__typename === 'IssueComment') {
          const login = item.author.login
          // no bots
          if (login !== undefined) {
            if (login !== pr.author.login) {
              if (!reviewerStats[login]) {
                reviewerStats[login] = {
                  ...item.author,
                  timesToReview: [],
                  reviewStates: [],
                  comments: 0,
                  reviewedPRs: 0,
                }
              }
              reviewerStats[login].comments++
              comments++
            }
          }
        }
      })
      reviewers.forEach(reviewer => {
        reviewerStats[reviewer].reviewedPRs++
      })

      return {
        number: pr.number,
        url: pr.url,
        author: pr.author,
        timeToMerge: timeToMerge,
        comments,
        reviews,
      }
    })

    return {
      reviewerStats,
      prs
    }
  }

  formatReviewers = (reviewerStats) => {
    const format = [15, 9]
    const rows = [] as string[]
    rows.push(formatRow(['login', 'median time to review', 'reviewed PRs', 'comments', 'approvals', 'changes requested'], format))

    const reviewers = Object.values(reviewerStats)
    reviewers.sort((a: any, b: any) => {
      const medianA = median(a.timesToReview)
      const medianB = median(b.timesToReview)
      if (medianA === undefined) return 1
      if (medianB === undefined) return -1
      return medianA < medianB ? -1 : 1
    })
    reviewers.forEach((reviewer: any) => {
      const {login, timesToReview, reviewedPRs, reviewStates, comments} = reviewer
      const medianTimeToReview = safeMs(median(timesToReview))
      const approvals = reviewStates.filter(state => state === 'APPROVED').length
      const changesRequested = reviewStates.filter(state => state === 'CHANGES_REQUESTED').length
      rows.push(formatRow([login, medianTimeToReview, reviewedPRs, comments, approvals, changesRequested], format))
    })
    return rows.join('\n')
  }

  formatPrs = (prs) => {
    const format = [20, 6]
    const rows = [] as string[]
    rows.push(formatRow(['', 'min', 'max', 'median'], format))

    const timesToMerge = prs.map(({timeToMerge}: {timeToMerge: number}) => timeToMerge)
    rows.push(formatRow(['time to merge', safeMs(Math.min(...timesToMerge)), safeMs(Math.max(...timesToMerge)), safeMs(median(timesToMerge))], format))

    const comments = prs.map(({comments}) => comments)
    rows.push(formatRow(['comments per PR', Math.min(...comments), Math.max(...comments), median(comments)], format))

    const reviews = prs.map(({reviews}) => reviews)
    rows.push(formatRow(['reviews per PR', Math.min(...reviews), Math.max(...reviews), median(reviews)], format))

    return rows.join('\n')
  }

  main = async () => {
    const now = new Date()
    const mergedSince = new Date(now.valueOf() - ms(this.timeDiff))

    const rawData = await this.fetchData(mergedSince)
    const {reviewerStats, prs} = this.parseStats(rawData)

    console.log(`Stats for last ${this.timeDiff}`)
    console.log('Reviewer stats')
    console.log(this.formatReviewers(reviewerStats))
    console.log('PR stats')
    console.log(`Total ${prs.length} PRs merged`)
    console.log(this.formatPrs(prs))

    if (process.argv.includes('--debug')) {
      console.log('\nDEBUG')
      console.log('Read following PRs')
      prs.forEach((pr) => {
        console.log(`#${pr.number} ${pr.url}`)
        console.log(`- author: ${pr.author.login}`)
        console.log(`- comments: ${pr.comments}`)
        console.log(`- reviews: ${pr.reviews}`)
        console.log(`- time to merge: ${ms(pr.timeToMerge)}`)
      })
      console.log('DEBUG - Not sending to Slack')
      return
    }

    const slackMessage = {
      blocks: [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Review stats for last ${this.timeDiff}*\nTotal ${prs.length} PRs merged`
        },
      }, {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Reviewer stats'
        },
      }, {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '```\n' + this.formatReviewers(reviewerStats) + '\n```'
        },
      }, {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'PR stats'
        },
      }, {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '```\n' + this.formatPrs(prs) + '\n```'
        },
      }]
    }

    this.pushToSlack(slackMessage)
  }
}

export default ReviewStats
