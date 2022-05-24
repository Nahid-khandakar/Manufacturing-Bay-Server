const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000


app.use(cors())
app.use(express.json());

// bay-admin
// KqgD6FctvwBJu45G


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const query = require('express/lib/middleware/query')
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.v2wyj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });





//all curd operation is here
async function run() {
    try {
        await client.connect();

        const partsCollection = client.db("mfg-bay").collection("parts-collection");
        const orderPartsCollection = client.db("mfg-bay").collection("order-collection");


        app.get('/parts', async (req, res) => {
            const query = {}
            const cursor = partsCollection.find(query);
            const result = await cursor.toArray()
            res.send(result)
        })


        app.get('/purchase/:id', async (req, res) => {
            const id = req.params
            const query = { _id: ObjectId(id) }
            const result = await partsCollection.findOne(query)
            res.send(result)
        })


        app.put('/parts/:id', async (req, res) => {
            const id = req.params.id
            const order = req.body


            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    availableQuantity: order.availableQuantity
                }
            }
            const updateParts = await partsCollection.updateOne(filter, updateDoc, options)

            const result = await orderPartsCollection.insertOne(order);

            res.send(updateDoc)

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