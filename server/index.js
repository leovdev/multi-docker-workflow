const keys = require('./keys')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(bodyParser.json())

//Postgres Client Setup
//tener cuidado con la mayúscula de Pool
const {Pool} = require('pg')
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
})

pgClient.on('error', ()=> console.log('Lost PG connection'))
//Hacer queries a Postgres
pgClient
    .query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch(err => console.log(err))

//redis Client setup
const redis= require('redis')
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: ()=> 1000
})
//cuando hay más de un cliente se debe duplicar
//dado que según la documentación de redis,
//solo hace una operación a la vez
const redisPublisher = redisClient.duplicate();


app.get('/values/all', async (req, res)=>{
    const values = await pgClient.query('SELECT * FROM values')
//super important
    res.send(values.rows)
})

//Redis dont have Promises support, thats why we
//use a normal callback in the next get func
app.get('/values/current', async (req, res) => {
    
    redisClient.hgetall('values', (err, values)=>{
        console.log("Obteniendo valores de redis", values)
        res.send(values);
        
    })
})

//Cuando el usuario ingresa el número desde la
//interfaz de React y se hace el Post
app.post('/values', async (req,res)=>{
    const index = req.body.index

    if (parseInt(index) > 40) {
        return res.status(422).send('Index too high');
    }
    redisClient.hset('values', index, 'Nothing yet!');
    redisPublisher.publish('insert', index);
    console.log("Insertando en redis", index)
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index])

    res.send({working:true})
})


app.listen(5000, ()=>{
    console.log('Escuchando')
})