require('dotenv').config()
const express = require('express')
const logger = require('./utilities/logger')
const bodyParser = require('body-parser')
const xml2js = require('xml2js')
const { query } = require('./utilities/mongodb')
const { subscribeToChannel } = require('./commands/subscribe')

const app = express()
const port = process.env.NOTIFICATION_SERVER_PORT
const HUB_URL = process.env.NOTIFICATION_HUB_URL
require('./utilities/websocket')(app)
app.use(bodyParser.text({ type: 'application/atom+xml' }))

// Endpoint to handle subscription verification (GET request)
app.get('/websub', (req, res) => {
  const { 'hub.mode': mode, 'hub.topic': topic, 'hub.challenge': challenge, 'hub.lease_seconds': leaseSeconds } = req.query

  if (mode === 'subscribe' || mode === 'unsubscribe') {
    logger.info(`Subscription mode: ${mode}, Topic: ${topic}, Lease Seconds: ${leaseSeconds}`)
    res.status(200).send(challenge)
  } else {
    res.status(400).send('Bad Request')
  }
})

// Endpoint to handle notifications (POST request)
app.post('/websub', (req, res) => {
  logger.info('Notification received:', req.headers, req.body) // Log headers and body

  xml2js.parseString(req.body, (err, result) => {
    if (err) {
      logger.error('Error parsing XML:', err)
      process.send({ error: 'Failed to parse XML' })
      res.status(500).send('Error parsing XML')
    } else {
      logger.info('forwarding data to parent program')
      process.send({ data: result })

      // Broadcast the data to all Websocket clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(result))
        }
      })
      res.status(200).send('OK')
    }
  })
})

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`)
})

async function main() {
  const TOPICS = await query()
  TOPICS.forEach(topic => subscribeToChannel(topic.youtubeChannelID, HUB_URL))
}

main()
