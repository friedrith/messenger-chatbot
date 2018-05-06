// import http from 'http'
import express from 'express'
import MessengerBot from 'messenger-bot'
import dotenv from 'dotenv'
import winston from 'winston'
import TvDb from 'node-tvdb'
import moment from 'moment'

if ('production' !== process.env.NODE_ENV) {
  try {
    dotenv.config()
  } catch (err) {
    winston.error('impossible to read file .env', { error: err })
  }
}

const ANSWER_TIMEOUT = 2000

const tvdb = new TvDb(process.env.TVDB)

const bot = new MessengerBot({
  token: process.env.PAGE_TOKEN,
  verify: process.env.VERIFY_TOKEN,
  app_secret: process.env.APP_SECRET,
})


bot.on('error', (err) => {
  console.log(err.message)
})

bot.setGetStartedButton([
   {
     "title": "View More",
     "type": "postback",
     "payload": "payload"
   }
 ], (err, payload) => {
  if (err) {
    console.error('error', err)
  } else {
    // winston.info('get started', { payload })
  }
  // console.
  // bot.sendMessage(payload.sender.id, { text: 'Bonjour' })

})

const previousSeries = {
}

const keepNotifiing = {}

bot.on('postback', (payload, reply, actions) => {
  if (payload.postback.title === 'View More') {
    const { seriesId } = JSON.parse(payload.postback.payload)
    tvdb.getSeriesById(seriesId)
    .then(series => {
      findInfoSeries(series, reply, { sender: payload.sender })
    })
    .catch(error => {
      reply({
        text: 'Sorry but I didn\'t find series with this name. Please try another one',
      })
      winston.error('error', { error })
    })
  } else if (payload.postback.title === 'Démarrer') {
    reply({
      text: 'Hello! I am here to help you about your favorites series.Please enter the name of a series.',
    })
  }


})

/*
bot.on('message', (payload, reply) => {
  reply({
    text: 'Hello!',
  })
})*/


bot.on('message', (payload, reply) => {
  const text = payload.message.text
  bot.sendSenderAction(payload.sender.id, 'mark_seen')
  bot.sendSenderAction(payload.sender.id, 'typing_on')
  setTimeout(() => {
    if (text === 'hello') {
      reply({
        text: 'Hello!',
      })
      bot.sendSenderAction(payload.sender.id, 'typing_on')
      setTimeout(() => {
        reply({
          text: 'Please enter the name of a series.',
        })
      }, ANSWER_TIMEOUT)

    } else if (text === 'Yes') {
      if (previousSeries[payload.sender.id] === 'cancel') {
        reply({
          text: `Ok! Got it! I won't notify you anymore`,
        })
      } else if (previousSeries[payload.sender.id]) {
        reply({
          text: `Ok I will send you a notification when the new episode of ${previousSeries[payload.sender.id].seriesName} will be released!`,
        })
        if (!keepNotifiing[payload.sender.id]) {
          keepNotifiing[payload.sender.id] = {}
        }
        keepNotifiing[payload.sender.id][previousSeries[payload.sender.id].id] = true
      }

    } else if (text === 'No') {
      if (previousSeries[payload.sender.id]) {
        reply({
          text: `Ok as you want.`,
        })
      }
    } else {
      tvdb.getSeriesByName(text)
      .then(responses => {
        let found = false
        for (let i = 0 ; i < responses.length ; i++) {
          const series = responses[i]
          if (series.seriesName.toLowerCase() === text.toLowerCase()) {
            found = true
            findInfoSeries(series, reply, payload)
          }

        }

        if (!found) {
          const elements = []
          for (let i = 0 ; elements.length < 4 && i < responses.length ; i++) {
            const series = responses[i]
            elements.push({
              title: series.seriesName,
              image_url: `https://www.thetvdb.com/banners/_cache/${series.banner}`,
              subtitle: series.overview,
              "buttons": [
                 {
                   "title": "View More",
                   "type": "postback",
                   "payload": JSON.stringify({
                     seriesId: series.id,
                   }),
                 }
               ]
            })
          }

          if (elements) {
            reply({
              "attachment":{
                "type":"template",
                "payload":{
                  "template_type":"list",
                  "top_element_style": "compact",
                  "elements": elements,
                  "buttons": [
                     {
                       "title": "View More",
                       "type": "postback",
                       "payload": "payload"
                     }
                   ]
                }
              }
            }, (err) => {
              if (err) {
                winston.error('error while replying', { err })
              }
            })
          } else {
            reply({
              text: 'Sorry but I didn\'t find series with this name. Please try another one',
            })
          }
        }


      })
      .catch(error => {
        reply({
          text: 'Sorry but I didn\'t find series with this name. Please try another one',
        })
        winston.error('error', error)
      })
    }
  }, ANSWER_TIMEOUT)
})


function findInfoSeries (series, reply, payload) {
  let timeout = 0
  if (series.aliases && series.aliases.length > 0) {
    reply({
      text: `The series ${series.seriesName} is also known under the names "${series.aliases.join('and')}".`
    })
    timeout += ANSWER_TIMEOUT
  }

  if (series.firstAired) {
    setTimeout(() => {
      reply({
        text: `It has been on air for the first time the ${moment(series.firstAired).format("MMMM Do YYYY")}.`
      })
    }, timeout)
    timeout += ANSWER_TIMEOUT
  }

  if (series.network) {
    if (series.status === 'Ended') {
      setTimeout(() => {
        reply({
          text: `You could have seen it on ${series.network}.`
        })
      }, timeout)
    } else {
      setTimeout(() => {
        reply({
          text: `You can see it on ${series.network}.`
        })
      }, timeout)
    }
    timeout += ANSWER_TIMEOUT
  }

  if (series.status) {
    if (series.status === 'Ended') {
      setTimeout(() => {
        reply({
          text: `Sorry but the series is now ended.`
        })
      }, timeout)
    } else if (series.status === 'Continuing') {
      setTimeout(() => {
        reply({
          text: `The series is still going on.`
        })
        setTimeout(() => {
          if (keepNotifiing[payload.sender.id] && keepNotifiing[payload.sender.id][series.id]) {
            previousSeries[payload.sender.id] = 'cancel'
            reply({
              "text": "You asked to be notified when a new episode is released. Do you want me to forget to notify you?",
              "quick_replies": [
                {
                  "content_type":"text",
                  "title":"Yes",
                  "payload":"ANSWER_1_YES"
                },
                {
                  "content_type":"text",
                  "title":"Maybe a next time",
                  "payload":"ANSWER_1_NO"
                }
              ],
            })
          } else {
            previousSeries[payload.sender.id] = series
            reply({
              "text": "Do you want to be notified when a new episode is released?",
              "quick_replies": [
                {
                  "content_type":"text",
                  "title":"Yes",
                  "payload":"ANSWER_1_YES"
                },
                {
                  "content_type":"text",
                  "title":"Maybe a next time",
                  "payload":"ANSWER_1_NO"
                }
              ],
            })
          }
        }, timeout + ANSWER_TIMEOUT)
      }, timeout)
    }

  }
}


const app = express()
const server =
app
.use(bot.middleware())
.listen(process.env.PORT, () => {
  winston.info(`server listening on port ${server.address().port}`)
})
