import express from "express";
import pg from "pg";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import env from 'dotenv';


const app = express();
const port = 3000;
env.config();
app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
    })
  );
const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

db.connect();

const PgSession = connectPgSimple(session);

app.use(session({
    store: new PgSession({
        pool: db,
        tableName: 'session'
    }),
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.get("/new-user", (req, res) => {
    res.render("new.ejs");
});

app.post("/new", async (req, res) => {
    const userName = req.body.name;
    if (userName) {
        try {
            await db.query("INSERT INTO users (user_name) VALUES($1)", [userName]);
            res.redirect("/");
        } catch (err) {
            console.error("Error executing query", err.stack);
            res.status(500).send("Internal Server Error");
        }
    } else {
        res.redirect("/");
    }
});

app.get("/tasks/:userId", async (req, res) => {
    req.session.userId = req.params.userId;
    try {
        const result = await db.query("SELECT pending_task FROM pending WHERE user_id = $1", [req.session.userId]);
        const work = result.rows.map(row => row.pending_task);
        res.render("pending.ejs", { ta: work, userId: req.session.userId });
    } catch (err) {
        console.error("Error executing query", err.stack);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/", async (req, res) => {
    try {
        const result = await db.query("SELECT id, user_name FROM users");
        const users = result.rows;
        res.render("index.ejs", { users });
    } catch (err) {
        console.error("Error executing query", err.stack);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/home", async (req, res) => {
    try {
        const result = await db.query("SELECT id, user_name FROM users");
        const users = result.rows;
        res.render("index.ejs", { users });
    } catch (err) {
        console.error("Error executing query", err.stack);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/pending", async (req, res) => {
    try {
        const result = await db.query("SELECT pending_task FROM pending WHERE user_id = $1", [req.session.userId]);
        const work = result.rows.map(row => row.pending_task);
        res.render("pending.ejs", { ta: work, userId: req.session.userId });
    } catch (err) {
        console.error("Error executing query", err.stack);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/completed", async (req, res) => {
    try {
        const result = await db.query("SELECT completed_task FROM completed WHERE user_id = $1", [req.session.userId]);
        const task = result.rows.map(row => row.completed_task);
        res.render("completed.ejs", { task: task, userId: req.session.userId });
    } catch (err) {
        console.error("Error executing query", err.stack);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/submit", async (req, res) => {
    const task = req.body.task;
    if (task) {
        try {
            await db.query("INSERT INTO pending (user_id, pending_task) VALUES ($1, $2)", [req.session.userId, task]);
            res.redirect(`/tasks/${req.session.userId}`);
        } catch (err) {
            console.error("Error executing query", err.stack);
            res.status(500).send("Internal Server Error");
        }
    } else {
        res.redirect(`/tasks/${req.session.userId}`);
    }
});

app.post("/remove", async (req, res) => {
    const taskIndex = req.body.index;
    try {
        const result = await db.query("SELECT pending_task FROM pending WHERE user_id = $1", [req.session.userId]);
        const tasks = result.rows.map(row => row.pending_task);
        const completedTask = tasks[taskIndex];
        
        await db.query("INSERT INTO completed (user_id, completed_task) VALUES ($1, $2)", [req.session.userId, completedTask]);
        await db.query("DELETE FROM pending WHERE user_id = $1 AND pending_task = $2", [req.session.userId, completedTask]);
        
        res.redirect(`/tasks/${req.session.userId}`);
    } catch (err) {
        console.error("Error executing query", err.stack);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
