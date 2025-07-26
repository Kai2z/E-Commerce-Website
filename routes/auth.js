const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
    v4: uuidv4
} = require('uuid');
const pool = require('../config/db');

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

const generateAccessToken = (userId) => {
    return jwt.sign({
        userId
    }, ACCESS_TOKEN_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY
    });
}

const generateRefreshToken = async (userId) => {
    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await pool.query(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)", [userId, refreshToken, expiresAt]
    )
    return refreshToken;
};

router.post('/register', async (req, res) => {
    const {
        email,
        password
    } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required!"
        });
    }
    try {
        const userExists = await pool.query("SELECT * FROM users where email=$1", [
            email
        ]);

        if (userExists.rows.length > 0) {
            return res.status(400).json({
                message: "user already exisits"
            })
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await pool.query("INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id", [
            email,
            hashedPassword
        ]);

        return res.status(201).json({
            message: 'user created successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'something went wrong'
        })
    }
});

router.post("/login", async (req, res) => {
    const {
        email,
        password
    } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: 'Email and password are required'
        });
    }
    try {
        const userQuery = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
        const user = userQuery.rows[0];
        if (!user) {
            return res.status(400).json({
                message: 'Invalid email'
            });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                message: 'Invalid password'
            });
        }
        const accessToken = generateAccessToken(user.id);
        const refreshToken = await generateRefreshToken(user.id);

        res.status(200).json({
            message: "login successful",
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Something went wrong'
        });
    }
});

router.post("/refresh-token", async (req, res) => {
    const {
        refreshToken
    } = req.body;

    if (!refreshToken) {
        return res.status(400).json({
            message: "refresh token is required"
        });
    }
    try {
        const tokenQuery = await pool.query('SELECT * FROM refresh_tokens where token =$1 AND expires_at > NOW()', [refreshToken]);

        if (tokenQuery.rows.length === 0) {
            return res.status(400).json({
                message: 'Invalid or expired refresh token'
            });
        }
        const userId = tokenQuery.rows[0].user_id;
        const accessToken = generateAccessToken(userId);

        res.json({
            accessToken
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Something went wrong"
        });
    }
});

router.post('/logout', async (req, res) => {
    const {
        refreshToken
    } = req.body;

    if (!refreshToken) {
        return res.status(400).json({
            message: "Refresh token is required"
        });
    }

    try {
        await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

        res.json({
            message: "Logged out successfully"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Something went wrong"
        });
    }
});

module.exports = router;