require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = "Bp12345";

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("MongoDB connection error:", err));


const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
});

const User = mongoose.model("User", UserSchema);

const TodoSchema = new mongoose.Schema({
    text: { type: String, required: true },
    completed: { type: Boolean, default: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

const Todo = mongoose.model("Todo", TodoSchema);

const verifyToken = (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Access Denied. No Token Provided" });
    }

    const token = authHeader.split(" ")[1];
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(401).json({ message: "Invalid or Expired Token" });
    }
};

app.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: "All fields are required" });

        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ message: "Username already taken" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();

        res.json({ message: "User registered successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Internal Server Error" });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: "All fields are required" });

        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "1h" });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ message: "Internal Server Error" });
    }
});

app.get("/todos", verifyToken, async (req, res) => {
    try {
        const todos = await Todo.find({ userId: req.user.userId });
        res.json(todos);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch todos" });
    }
});

app.post("/todos", verifyToken, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ message: "Text is required" });

        const todo = new Todo({ text, completed: false, userId: req.user.userId });
        await todo.save();
        res.json(todo);
    } catch (err) {
        res.status(500).json({ message: "Failed to add todo" });
    }
});

app.put("/todos/:id", verifyToken, async (req, res) => {
    try {
        const { text, completed } = req.body;
        if (text === undefined && completed === undefined) {
            return res.status(400).json({ message: "Nothing to update" });
        }

        const todo = await Todo.findById(req.params.id);
        if (!todo) return res.status(404).json({ message: "Todo not found" });

        if (todo.userId.toString() !== req.user.userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        todo.text = text !== undefined ? text : todo.text;
        todo.completed = completed !== undefined ? completed : todo.completed;

        await todo.save();
        res.json(todo);
    } catch (err) {
        res.status(500).json({ message: "Failed to update todo" });
    }
});

app.delete("/todos/:id", verifyToken, async (req, res) => {
    try {
        const todo = await Todo.findById(req.params.id);
        if (!todo) return res.status(404).json({ message: "Todo not found" });

        if (todo.userId.toString() !== req.user.userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        await Todo.findByIdAndDelete(req.params.id);
        res.json({ message: "Todo deleted" });
    } catch (err) {
        res.status(500).json({ message: "Failed to delete todo" });
    }
});

app.listen(5000, () => console.log("Server running on port 5000"));
