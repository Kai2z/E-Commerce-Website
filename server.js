const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const app = express();
const pool = require('./config/db');
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
const cors = require('cors');
const helmet = require('helmet');

const PORT = process.env.PORT;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: true
}));

app.use((req, res, next) => {
    console.log(`${req.method} request was made to ${req.url} `);
    next();
})


app.get("/", (req, res) => {
    res.send('Welcome to the E-Commerce Website!');
});

app.get("/products", async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send('something went wrong');
    }
});

app.post("/cart", async (req, res) => {
    const productId = parseInt(req.query.productId);
    const quantity = req.query.quantity ? parseInt(req.query.quantity) : 1; // Default to 1 if not provided

    const errors = [];

    // Check if productId is missing
    if (productId === undefined || productId === null) {
        errors.push("Missing productId");
    } else if (isNaN(productId) || productId <= 0) {
        errors.push("Invalid productId");
    }


    if (req.query.quantity && (isNaN(quantity) || quantity <= 0)) {
        errors.push("Invalid quantity");
    }

    if (errors.length > 0) {
        return res.status(400).json({
            errors
        });
    }

    try {
        
        if (!req.session.cart) {
            req.session.cart = [];
        }

        const existingProductIndex = req.session.cart.findIndex(item => item.productId === productId);

        if (existingProductIndex !== -1) {
            req.session.cart[existingProductIndex].quantity += quantity;
        } else {
            req.session.cart.push({
                productId,
                quantity
            });
        }

        res.json({
            message: "Product added to cart",
            cart: req.session.cart
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong');
    }
});

app.get("/cart", (req, res) => {
    if (!req.session.cart || req.session.cart.length === 0) {
        return res.json({
            message: "Your cart is empty"
        });
    }
    res.json({
        cart: req.session.cart
    });
})

app.delete("/cart/:productId", (req, res) => {
    if (!req.session.cart || req.session.cart.length === 0) {
        return res.status(400).json({
            message: "Cannot remove, Your cart is empty!"
        })
    }
    const productId = parseInt(req.params.productId);

    const productIndex = req.session.cart.findIndex(item => item.productId === productId);

    if (productIndex === -1) {
        return res.status(400).json({
            message: "Product doesn't exist in the cart!"
        });
    }
    req.session.cart.splice(productIndex, 1);
    res.status(200).json({
        message: "Product removed from cart",
        cart: req.session.cart
    });
});


// (async () => {
//     const password = "your_password";
//     const hashedPassword = await bcrypt.hash(password, 10);
//     console.log("Hashed Password:", hashedPassword);
// })();

app.listen(PORT, () => {
    console.log(`server is running on http://localhost:${PORT}`);
})  