const { CpFile, sequelize } = require('./models');
const fs = require('fs');
const path = require('path');

async function debugDownload() {
    try {
        await sequelize.authenticate();

        // 1. Find a dummy file
        const file = await CpFile.findOne();
        if (!file) {
            console.log('No file found.');
            return;
        }

        console.log(`Found file: ${file.id} (${file.type})`);

        // 2. Replicate Route Logic
        // In the route: const hotfolder = path.join(__dirname, '../public/hotfolder');
        // NOTE: __dirname in this script is 'c:\development\Bookstore'. 
        // In routes/admin.js, __dirname is 'c:\development\Bookstore\routes'.
        // So path.join(__dirname, '../public/hotfolder') -> 'c:\development\Bookstore\public\hotfolder'.

        // Simulating the relative path from the route file location:
        const routeDir = path.join(__dirname, 'routes');
        const hotfolder = path.join(routeDir, '../public/hotfolder');

        console.log(`Hotfolder Path: ${hotfolder}`);

        if (!fs.existsSync(hotfolder)) {
            console.log('Creating hotfolder...');
            fs.mkdirSync(hotfolder, { recursive: true });
        } else {
            console.log('Hotfolder exists.');
        }

        const fileName = `${file.type}_${file.id}.pdf`;
        const destPath = path.join(hotfolder, fileName);

        console.log(`Writing to: ${destPath}`);
        fs.writeFileSync(destPath, `Dummy content for ${file.url}`);

        // Update local path
        file.localPath = destPath;
        // await file.save(); // Don't actually save to DB to avoid mutating state if not needed, or do it.
        console.log('File written successfully.');

    } catch (err) {
        console.error('Error during download simulation:', err);
    } finally {
        await sequelize.close();
    }
}

debugDownload();
