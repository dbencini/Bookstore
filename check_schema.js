const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.all("PRAGMA table_info(Users);", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log("Users Table Columns:", rows.map(r => r.name));
    }
});

db.close();
