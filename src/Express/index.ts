import {Express} from "express";
import config from "../config";
import {Http2Server} from "http2";
import StartDB from "../Database";

const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const Server = require('http').Server


import Auth from './routes/auth'
import Events from './routes/events'
const PrepareApp = (app: Express): Express => {
    app.use(cors())
    app.use(bodyParser.json())
    app.use('/auth', Auth)
    app.use('/events', Events)
    return app
}

const PrepareServer = (server: Http2Server): Promise<Http2Server> => {
    return StartDB.then(() => {
        server.listen(config.port)

        server.on('listening', () => {
            console.log(`\n\nListening on port ${config.port}\n`)
            console.log("Config:\t")
            console.log(config)
        })
        return server
    })
}

const MyServer = (): Promise<Http2Server> => {
    return PrepareServer(Server(PrepareApp(express())))
}

/** MAIN EXECUTION **/
export default MyServer

