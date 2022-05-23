const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000


app.use(cors())
app.use(express.json());

// bay-admin
// KqgD6FctvwBJu45G


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.v2wyj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });





//all curd operation is here
async function run() {
    try {
        await client.connect();

        const partsCollection = client.db("mfg-bay").collection("parts-collection");


        app.get('/parts', async (req, res) => {
            const query = {}
            const cursor = partsCollection.find(query);
            const result = await cursor.toArray()
            res.send(result)
        })


    } finally {
        //await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Manufacturing server working')
})

app.listen(port, () => {
    console.log(`server running port on ${port}`)
})