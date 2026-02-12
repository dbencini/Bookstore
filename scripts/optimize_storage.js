require('dotenv').config();
const { sequelize } = require('../models');

async function run() {
    const action = process.argv[2] || 'check';

    try {
        console.log(`--- STORAGE OPTIMIZATION: ${action.toUpperCase()} ---`);

        if (action === 'check') {
            const [redo] = await sequelize.query("SHOW VARIABLES LIKE 'innodb_redo_log_capacity'");
            const [undo] = await sequelize.query("SHOW VARIABLES LIKE 'innodb_undo_log_truncate'");
            const [tablespaces] = await sequelize.query("SELECT NAME, FILE_SIZE, ALLOCATED_SIZE FROM INFORMATION_SCHEMA.INNODB_TABLESPACES WHERE NAME LIKE '%undo%'");

            console.log('\nRedo Log Capacity:', redo[0].Value);
            console.log('Undo Truncate Enabled:', undo[0].Value);
            console.log('\nUndo Tablespaces:');
            tablespaces.forEach(ts => {
                console.log(` - ${ts.NAME}: ${(ts.FILE_SIZE / 1024 / 1024).toFixed(2)} MB`);
            });
        }

        if (action === 'shrink_redo') {
            const targetSize = process.argv[3] || '104857600'; // 100MB default
            console.log(`Shrinking redo log capacity to ${targetSize} bytes...`);
            await sequelize.query(`SET GLOBAL innodb_redo_log_capacity = ${targetSize}`);
            console.log('Target capacity set. MySQL will now asynchronously delete old redo log files.');
        }

        if (action === 'truncate_undo') {
            console.log('Enabling automatic undo log truncation...');
            await sequelize.query("SET GLOBAL innodb_undo_log_truncate = ON");
            await sequelize.query("SET GLOBAL innodb_purge_rseg_truncate_frequency = 1");
            console.log('Settings applied. MySQL will reclaim space from inactive undo logs automatically.');
        }

        if (action === 'health_check') {
            const [[{ total }]] = await sequelize.query('SELECT COUNT(*) as total FROM Books');
            const [[{ visible }]] = await sequelize.query('SELECT COUNT(*) as visible FROM Books WHERE isVisible = 1');
            console.log(`\nHEALTH_CHECK: Total Books: ${total}, Visible: ${visible}`);
            if (total === visible) {
                console.log('STATUS: 100% SUCCESS - LIBRARY IS FULLY VISIBLE.');
            }
        }

        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e.message);
        process.exit(1);
    }
}

run();
