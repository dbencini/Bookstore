const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite'); // Assuming default sqlite filename

db.serialize(() => {
    db.each("PRAGMA table_info(cp_files)", (err, row) => {
        if (err) console.error(err);
        console.log(row);
    });
});

db.close();
