const express = require('express')
const app = express()
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = 3000

const admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



// middleware
app.use(cors());
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    try {
        const idToken = token.split(' ')[1];
        const decoded = await admin.auth().verifyIdToken(idToken);
        console.log('decoded in the token', decoded);
        req.decoded_email = decoded.email;
        next();
    }
    catch (err) {
        return res.status(401).send({ message: 'unauthorized access' })
    }


}


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


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded_email;
            const query = { email };
            const user = await userCollection.findOne(query);

            if (!user || user.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' });
            }

            next();
        }
        const verifyManager = async (req, res, next) => {
            const email = req.decoded_email;
            const query = { email };
            const user = await userCollection.findOne(query);

            if (!user || user.role !== 'manager') {
                return res.status(403).send({ message: 'forbidden access' });
            }

            next();
        }

        // users info get apis
        // app.get('/users', async (req, res) => {
        //     const result = await userCollection.find().toArray();
        //     res.send(result);
        // })

        app.get('/users', verifyFBToken,verifyAdmin, async (req, res) => {
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

        app.get('/users/:email/role', verifyFBToken, async (req, res) => {
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
        app.patch('/users/:id/role',verifyFBToken,verifyAdmin, async (req, res) => {
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

        // get single club info
        app.get('/clubs/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) }
            const result = await clubCollection.findOne(query);
            res.send(result);
        })

        // new club create by manager  info store apis
        app.post('/clubs',verifyFBToken,verifyManager, async (req, res) => {
            const club = req.body;
            club.status = 'pending';
            club.createdAt = new Date();
            club.updatedAt = new Date();

            const result = await clubCollection.insertOne(club);
            res.send(result);
        })



        app.get('/clubs',verifyFBToken,verifyAdmin, async (req, res) => {
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
        // get club by sorting pending and latest for admin dashboard
        app.get('/pending/clubs', async (req, res) => {
            const query = { status: 'pending' };

            const clubs = await clubCollection
                .find(query)
                .sort({ createdAt: -1 })
                .toArray();

            res.send(clubs);
        });


        app.get('/clubs/:email/manager',verifyFBToken,verifyManager, async (req, res) => {
            try {
                const email = req.params.email;

                if (!email) {
                    return res.status(400).send({ message: 'Email is required' });
                }

                const query = { managerEmail: email };
                const result = await clubCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Server error', error });
            }
        });

        app.patch('/clubs/:id/status',verifyFBToken,verifyAdmin, async (req, res) => {
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
        app.post('/booking/clubs',verifyFBToken, async (req, res) => {
            const clubMember = req.body;
            // //  already booked check
            // const alreadyJoined = await clubMemberCollection.findOne({

            //     clubId:clubMember.clubId
            // });

            // if (alreadyJoined) {
            //     return res.status(400).send({
            //         message: 'You have already booked this event',

            //     });

            // }

            const result = await clubMemberCollection.insertOne(clubMember);
            res.send(result);
        })
        // admin dashboard get all club members collection
        app.get('/booking/clubs', async (req, res) => {
            const result = await clubMemberCollection.find().toArray();
            res.send(result);
        })
        // get club join members request by sorting pending and latest for admin dashboard
        app.get('/club/pending-members',verifyFBToken, async (req, res) => {
            const query = { status: 'pending' };

            const clubs = await clubMemberCollection
                .find(query)
                .sort({ createdAt: -1 })
                .toArray();

            res.send(clubs);
        });





        app.get('/clubs/:email/myclub',verifyFBToken, async (req, res) => {
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
        // only admin can approve or reject status
        app.patch('/club-member/:id/status',verifyFBToken,verifyAdmin, async (req, res) => {
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
        app.post('/events',verifyFBToken,verifyManager, async (req, res) => {
            const event = req.body;
            event.status = 'pending';
            event.createdAt = new Date();
            event.updatedAt = new Date();
            const result = await eventCollection.insertOne(event);
            res.send(result);
        })

        // get all event by admin
        app.get('/events',verifyFBToken,verifyAdmin, async (req, res) => {
            const events = await eventCollection.find().toArray();
            res.send(events);
        })

        app.get('/events/:email/manager',verifyFBToken,verifyManager, async (req, res) => {
            try {
                const email = req.params.email;
                if (!email) {
                    return res.status(400).send({ message: 'Email is required' });
                }
                const query = { managerEmail: email };
                const result = await eventCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Server error', error });
            }
        });


        // get approved and latest events for homepage
        app.get('/events/approved', async (req, res) => {
            const query = { status: 'approved' };

            const clubs = await eventCollection
                .find(query)
                .sort({ createdAt: -1 })
                .toArray();

            res.send(clubs);
        });
        // get pending and latest events for admin Dashboard
        app.get('/events/pending',verifyFBToken,verifyAdmin, async (req, res) => {
            const query = { status: 'pending' };

            const clubs = await eventCollection
                .find(query)
                .sort({ createdAt: -1 })
                .toArray();

            res.send(clubs);
        });

        app.patch('/events/:id/status',verifyFBToken,verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updateStatus = req.body;

            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: updateStatus.status
                }
            }
            const result = await eventCollection.updateOne(query, updatedDoc)
            res.send(result);
        })

        app.put('/events/:id',verifyFBToken,verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const userInfo = req.body;

            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    ...userInfo,
                    updatedAt: new Date()
                }
            }
            const result = await eventCollection.updateOne(query, updatedDoc)
            res.send(result);
        })

        app.get('/events/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) }
            const result = await eventCollection.findOne(query);
            res.send(result);
        })



        // event registration apis
        app.post('/event/registrations',verifyFBToken, async (req, res) => {
            const eventRegistration = req.body;

            const result = await eventRegistrationsCollection.insertOne(eventRegistration);
            res.send(result);
        })

        app.get('/event/registrations',verifyFBToken,verifyAdmin, async (req, res) => {
            const result = await eventRegistrationsCollection.find().toArray();
            res.send(result);
        })

        app.get('/events/:email/myevents',verifyFBToken, async (req, res) => {
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

        // event registration status update by admin
        app.patch('/event/registered/:id/status',verifyFBToken,verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updateStatus = req.body;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: updateStatus.status
                }
            }
            const result = await eventRegistrationsCollection.updateOne(query, updatedDoc)
            res.send(result);
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
