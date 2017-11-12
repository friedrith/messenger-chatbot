// import http from 'http'
import express from 'express'
import MessengerBot from 'messenger-bot'
import dotenv from 'dotenv'
import winston from 'winston'

if ('production' !== process.env.NODE_ENV) {
  try {
    dotenv.config()
  } catch (err) {
    winston.error('impossible to read file .env', { error: err })
  }
}

const bot = new MessengerBot({
  token: process.env.PAGE_TOKEN,
  verify: process.env.VERIFY_TOKEN,
  app_secret: process.env.APP_SECRET,
})


bot.on('error', (err) => {
  console.log(err.message)
})

bot.setGetStartedButton('GET_STARTED_PAYLOAD', (err, payload) => {
  // console.
  // bot.sendMessage(payload.sender.id, { text: 'Bonjour' })

  // winston.info('get started', { payload })

})

bot.on('message', (payload, reply) => {
  let text = payload.message.text
  bot.sendSenderAction(payload.sender.id, 'mark_seen')
  setTimeout(() => {
    bot.getProfile(payload.sender.id, (err, profile) => {
      if (err) {
        throw err
      }

      reply({
        "attachment":{
      "type":"template",
      "payload":{
        "template_type":"button",
        "text":"What do you want to do next?",
        "buttons":[
          {
            "type":"web_url",
            "url":"https://petersapparel.parseapp.com",
            "title":"Show Website"
          },
        ]
      }
      } }, (err) => {
        if (err) {
          winston.error(`error while posting button ${JSON.stringify(err)}`, { err })
        } else {
          winston.info(`Echoed back to ${profile.first_name} ${profile.last_name}: ${text}`)
        }

      })
    })
  }, 10000)
})

const app = express()
const server =
app
.use(bot.middleware())
.listen(process.env.PORT, () => {
  winston.info(`server listening on port ${server.address().port}`)
})
