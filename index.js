const express = require('express')
const app = express()
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = 3000
// middleware
app.use(cors());
app.use(express.json());
// GyiOfv0bx60equGD
// ClubSphere

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cjfssbu.mongodb.net/?appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db('ClubSphere');
        const userCollection = db.collection('users');
        const clubCollection = db.collection('clubs');

        // users info get apis
        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })



        app.get('/users', async (req, res) => {
            const searchText = req.query.searchText;
            const query = {};

            if (searchText) {
                // query.displayName = {$regex: searchText, $options: 'i'}

                query.$or = [
                    { displayName: { $regex: searchText, $options: 'i' } },
                    { email: { $regex: searchText, $options: 'i' } },
                ]

            }

            const cursor = userCollection.find(query).sort({ createdAt: -1 }).limit(3);
            const result = await cursor.toArray();
            res.send(result);
        });

         app.get('/users/:email/role', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await userCollection.findOne(query);
            res.send({ role: user?.role || 'user' })
        })


        // users info store apis
        app.post('/users', async (req, res) => {
            const user = req.body;
            user.role = 'user';
            user.createdAt = new Date();
            const email = user.email;
            const userExists = await userCollection.findOne({ email })

            if (userExists) {
                return res.send({ message: 'user exists' })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        // users patch api for update role
        app.patch('/users/:id/role', async (req, res) => {
            const id = req.params.id;
            const roleInfo = req.body;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: roleInfo.role
                }
            }
            const result = await userCollection.updateOne(query, updatedDoc)
            res.send(result);
        })
        app.get('/clubs/:id', async(req,res)=>{
            const {id} = req.params;
            const query = {_id: new ObjectId(id)}
            const result = await clubCollection.findOne(query);
            res.send(result);
        })

        // new create club info store apis
        app.post('/clubs', async (req, res) => {
            const club = req.body;
            club.status = 'pending';
            club.createdAt = new Date();
            club.updatedAt = new Date();

            const result = await clubCollection.insertOne(club);
            res.send(result);
        })

        app.get('/clubs', async (req, res) => {
            const clubs = await clubCollection.find().toArray();
            res.send(clubs);
        })




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('ClubSphere server is running!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
