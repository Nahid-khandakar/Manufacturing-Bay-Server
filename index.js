const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000


app.use(cors())
app.use(express.json());

// bay-admin
// KqgD6FctvwBJu45G


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const query = require('express/lib/middleware/query')
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.v2wyj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


//check token
function verifyJwt(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader) {
        res.status(401).send({ message: 'unauthorized access' })
    }

    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        //console.log('come form decodec', decoded)
        req.decoded = decoded
        next()
    });
}


//all curd operation is here
async function run() {
    try {
        await client.connect();

        const partsCollection = client.db("mfg-bay").collection("parts-collection");
        const orderPartsCollection = client.db("mfg-bay").collection("order-collection");
        const userCollection = client.db("mfg-bay").collection("users");
        const reviewCollection = client.db("mfg-bay").collection("Reviews");


        //get all parts in home section
        app.get('/parts', async (req, res) => {
            const query = {}
            const cursor = partsCollection.find(query);
            const result = await cursor.toArray()
            res.send(result)
        })

        //get purchase data for purchase page
        app.get('/purchase/:id', async (req, res) => {
            const id = req.params
            const query = { _id: ObjectId(id) }
            const result = await partsCollection.findOne(query)
            res.send(result)
        })


        app.get('/orders', verifyJwt, async (req, res) => {
            const purchaseEmail = req.query.purchaseEmail
            const decodedEmail = req.decoded.email

            if (purchaseEmail === decodedEmail) {
                const query = { purchaseEmail: purchaseEmail }
                const orders = await orderPartsCollection.find(query).toArray()
                return res.send(orders)
            }
            else {
                return res.status(403).send({ message: 'forbidden' })
            }

        })


        app.delete('/orders/:email', verifyJwt, async (req, res) => {
            const email = req.params.email
            const filter = { purchaseEmail: email }
            const result = await orderPartsCollection.deleteOne(filter)
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


        //put all user information && update a document
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };

            const result = await userCollection.updateOne(filter, updateDoc, options);

            //token send
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '6h' })
            res.send({ result, token: token })
        })


        app.post('/userReview', verifyJwt, async (req, res) => {
            const review = req.body
            console.log(review)
            const doc = { email: review.email, rating: review.rating, review: review.rating }
            const result = await reviewCollection.insertOne(doc)
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