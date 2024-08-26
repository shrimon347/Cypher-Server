const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ppfmuai.mongodb.net/?appName=Cluster0`;

//middleware
const corsConfig = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};
app.use(cors(corsConfig));
app.use(express.json());
// app.use(cookieParser());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    //await client.connect();
    //await client.db("admin").command({ ping: 1 });
    const productCollection = client.db("ecommerce").collection("productlist");
    const cartCollection = client.db("ecommerce").collection("carts");
    const userCollection = client.db("ecommerce").collection("users");
    const paymentCollection = client.db("ecommerce").collection("payments");

    //jwt releated api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      res.send({ token });
    });
    //middlewares
    const verifyToken = (req, res, next) => {
      console.log("inside verfiy token ", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorizedaccess" });
        }
        req.decoded = decoded;
        next();
      });
    };
    const verfiyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      console.log(email);
      const query = { email: email };
      const user = await userCollection.findOne(query);

      const isAdmin = user?.role === "admin";
      console.log(isAdmin);
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };

    // user related data
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      console.log(req.decoded.email);
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/users", verifyToken, verfiyAdmin, async (req, res) => {
      // console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existUser = await userCollection.findOne(query);
      if (existUser) {
        return res.send({ message: "User alreadu Exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.delete("/users/:id", verifyToken, verfiyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verfiyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatDoc);
        res.send(result);
      }
    );

    //product related data
    app.get("/products", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });
    app.patch("/product/:id", async(req, res) => {
      const data = req.body
      const id = req.params.id
      const filter = {_id : new ObjectId(id)}
      const updatedoc = {
        $set : {
          name: data.name,
          brand: data.brand,
          category: data.category,
          price: parseInt(data.price),
          description: data.description,
          rating: parseFloat(data.rating),
          stock: parseInt(data.stock),
          imageUrl: data.imageUrl,
          details: data.details,
          features: data.features,
          tab: data.tab,
        }
      }
      console.log(updatedoc);
      const result = await productCollection.updateOne(filter, updatedoc)
      res.send(result)
    })
    app.delete("/product/:id", verifyToken, verfiyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(query);
      res.send(result);
    });
    app.post("/addProduct", verifyToken, verfiyAdmin, async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    });
    //cart items for product
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    app.put("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const { quantity } = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          quantity: quantity,
        },
      };
      const options = { returnOriginal: false };
      const result = await cartCollection.findOneAndUpdate(
        query,
        update,
        options
      );
      res.send(result);
    });
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
    //payment intent 
    app.post('/create-payment-intent', async(req, res)=> {
      const {price} = req.body
      const amount = parseInt(100 * price)
      console.log('intnet amount ', amount);

      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency : 'usd',
        payment_method_types : ['card']
      })
      res.send({
        clientSecret : paymentIntent.client_secret
      })
      app.post('/payments', async(req, res)=> {
        const payment = req.body
        const paymentRresult = await paymentCollection.insertOne(payment)

        console.log('payment info', paymentRresult);

        const query = {_id : {
          $in : payment.cartIds.map(id => new ObjectId(id))
        }}

        const deleteResult = await cartCollection.deleteMany(query)
        res.send({paymentRresult, deleteResult})
      })
    })
  } finally {
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("ecommerce server is running");
});

app.listen(port, () => {
  console.log(` ecommerce server is running, ${port}`);
});
