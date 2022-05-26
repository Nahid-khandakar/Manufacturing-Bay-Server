const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


app.use(cors())
app.use(express.static("public"));
app.use(express.json());


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
        const reviewCollection = client.db("mfg-bay").collection("reviews");
        const profileCollection = client.db("mfg-bay").collection("users-profile");
        const paymentsCollection = client.db("mfg-bay").collection("payments");



        //verify admin
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email
            const requesterAccount = await userCollection.findOne({ email: requester });

            if (requesterAccount.role === 'admin') {
                next()
            } else {
                res.status(403).send({ message: 'forbidden' })
            }
        }


        // for stripe
        app.post('/create-payment-intent', verifyJwt, async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        //get user and make admin
        app.get('/user', verifyJwt, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users)
        })

        //set user role as admin
        app.put('/user/admin/:email', verifyJwt, verifyAdmin, async (req, res) => {
            const email = req.params.email
            console.log(email)
            const filter = { email: email }
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)

        })

        //admin role
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin })
        })



        //get all parts in home section
        app.get('/parts', async (req, res) => {
            const query = {}
            const cursor = partsCollection.find(query);
            const result = await cursor.toArray()
            res.send(result)
        })

        app.delete('/parts/:id', async (req, res) => {
            const id = req.params
            const query = { _id: ObjectId(id) }
            const result = await partsCollection.deleteOne(query);
            res.send(result)

        })

        //set wrong api this api post part in home page
        app.post('/parts', verifyJwt, verifyAdmin, async (req, res) => {

            const partsDetails = req.body
            console.log(partsDetails)
            const result = await partsCollection.insertOne(partsDetails)
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

        app.get('/purchaseOrders', async (req, res) => {
            const query = {}
            const cursor = orderPartsCollection.find(query);
            const result = await cursor.toArray()
            res.send(result)

        })

        app.delete('/purchaseOrders/:id', async (req, res) => {
            const id = req.params
            const query = { _id: ObjectId(id) }
            const result = await orderPartsCollection.deleteOne(query);
            res.send(result)

        })



        app.patch('/orders/:id', verifyJwt, async (req, res) => {
            const id = req.params.id
            const payment = req.body
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const updatedBooking = await orderPartsCollection.updateOne(filter, updateDoc)
            const result = await paymentsCollection.insertOne(payment)

            res.send(updateDoc)
        })


        app.get('/orders/:id', verifyJwt, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await orderPartsCollection.findOne(query)
            res.send(result)
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



        app.get('/userReview', verifyJwt, async (req, res) => {
            const query = {}
            const cursor = reviewCollection.find(query);
            const result = await cursor.toArray()
            res.send(result)
        })

        app.post('/userReview', verifyJwt, async (req, res) => {
            const userReview = req.body
            //console.log(userReview)
            const doc = { name: userReview.name, email: userReview.email, rating: userReview.rating, review: userReview.review }
            const result = await reviewCollection.insertOne(doc)
            res.send(result)
        })



        app.get('/userProfile', verifyJwt, async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await profileCollection.findOne(query)
            res.send(result)


        })

        app.put('/userProfile/:email', verifyJwt, async (req, res) => {
            const email = req.params.email
            const userProfile = req.body
            //console.log(userProfile)

            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: userProfile,
            };

            const update = await profileCollection.updateOne(filter, updateDoc, options)

            res.send(update)
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