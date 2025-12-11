const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

const sql = `ALTER TABLE Users ADD COLUMN googleId VARCHAR(255) DEFAULT NULL;`;

db.run(sql, (err) => {
    if (err) {
        console.error("Error adding column:", err.message);
    } else {
        console.log("Successfully added googleId column to Users table.");
        // We probably also want to add the unique index, but let's just get the column first.
        // SQLite doesn't easily support adding UNIQUE constraint on existing column in one go easily without recreation sometimes, 
        // but let's try a separate index creation if needed. 
        // For now, let's just add the column. Unique index can be added separately.
    }
    db.close();
});
