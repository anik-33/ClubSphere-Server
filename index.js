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
        const eventCollection = db.collection('events');
        const clubMemberCollection = db.collection('clubMembers');
        const eventRegistrationsCollection = db.collection('eventRegistrations')

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
        app.get('/clubs/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) }
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

        // get club by sorting approved and latest 
        app.get('/approved/clubs', async (req, res) => {
            const query = { status: 'approved' };

            const clubs = await clubCollection
                .find(query)
                .sort({ createdAt: -1 })
                .toArray();

            res.send(clubs);
        });


        app.get('/clubs/:email/manager', async (req, res) => {
            try {
                const email = req.params.email;

                if (!email) {
                    return res.status(400).send({ message: 'Email is required' });
                }

                const query = { managerEmail: email };
                const result = await clubCollection.find(query).toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Server error', error });
            }
        });

        app.patch('/clubs/:id/status', async (req, res) => {
            const id = req.params.id;
            const updateStatus = req.body;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: updateStatus.status
                }
            }
            const result = await clubCollection.updateOne(query, updatedDoc)
            res.send(result);
        })

        // club member apis who have joined club
        app.post('/booking/clubs', async (req, res) => {
            const clubMember = req.body;
            const result = await clubMemberCollection.insertOne(clubMember);
            res.send(result);
        })

        app.get('/booking/clubs', async (req, res) => {
            const result = await clubMemberCollection.find().toArray();
            res.send(result);
        })

        app.get('/clubs/:email/myclub', async (req, res) => {
            try {
                const email = req.params.email;
                // console.log('PARAM EMAIL:', req.params.email);

                if (!email) {
                    return res.status(400).send({ message: 'Email is required' });
                }

                const query = { useremail: email };
                const result = await clubMemberCollection.find(query).toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Server error', error });
            }
        });

        app.patch('/club-member/:id/status',async(req,res)=>{
            const id = req.params.id;
            const updateStatus = req.body;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: updateStatus.status
                }
            }
            const result = await clubMemberCollection.updateOne(query, updatedDoc)
            res.send(result);
        })
        // event apis
        app.post('/events', async (req, res) => {
            const event = req.body;
            event.status = 'pending';
            event.createdAt = new Date();
            event.updatedAt = new Date();
            const result = await eventCollection.insertOne(event);
            res.send(result);
        })


        app.get('/events', async (req, res) => {
            const events = await eventCollection.find().toArray();
            res.send(events);
        })

        app.get('/events/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) }
            const result = await eventCollection.findOne(query);
            res.send(result);
        })

        // event registration apis
        app.post('/event/registrations', async (req, res) => {
            const eventRegistration = req.body;
            const result = await eventRegistrationsCollection.insertOne(eventRegistration);
            res.send(result);
        })

        app.get('/event/registrations', async (req, res) => {
            const result = await eventRegistrationsCollection.find().toArray();
            res.send(result);
        })

            app.get('/events/:email/myevents', async (req, res) => {
            try {
                const email = req.params.email;
                // console.log('PARAM EMAIL:', req.params.email);

                if (!email) {
                    return res.status(400).send({ message: 'Email is required' });
                }

                const query = { userEmail: email };
                const result = await eventRegistrationsCollection.find(query).toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Server error', error });
            }
        });


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
