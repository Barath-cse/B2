const fs = require('fs');
const path = require('path');

/**
 * Automatically cleans up files and metadata that are older than 8 days.
 */
const cleanupExpiredFiles = () => {
    const uploadsDir = path.join(__dirname, '../uploads');
    const EXPIRY_DAYS = 8;
    const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const now = new Date();

    console.log(`[Cleanup] 🕒 Starting cleanup task at ${now.toISOString()}`);

    if (!fs.existsSync(uploadsDir)) {
        console.warn(`[Cleanup] 📁 Uploads directory not found: ${uploadsDir}`);
        return;
    }

    try {
        const files = fs.readdirSync(uploadsDir);
        let deletedCount = 0;

        files.forEach(file => {
            // We look for the .json metadata files first
            if (file.endsWith('.json') && !file.includes('-access') && file !== '.shared-keys.json') {
                const metadataPath = path.join(uploadsDir, file);
                const fileId = file.replace('.json', '');
                
                try {
                    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
                    const uploadedAt = new Date(metadata.uploadedAt);
                    
                    if (now - uploadedAt > EXPIRY_MS) {
                        console.log(`[Cleanup] 🗑️ File ${fileId} has expired (Uploaded: ${metadata.uploadedAt})`);

                        // 1. Delete encrypted file
                        const encryptedFilePath = metadata.storagePath || path.join(uploadsDir, fileId);
                        if (fs.existsSync(encryptedFilePath)) {
                            fs.unlinkSync(encryptedFilePath);
                            console.log(`[Cleanup]   - Deleted encrypted file: ${fileId}`);
                        }

                        // 2. Delete access list if exists
                        const accessPath = path.join(uploadsDir, `${fileId}-access.json`);
                        if (fs.existsSync(accessPath)) {
                            fs.unlinkSync(accessPath);
                            console.log(`[Cleanup]   - Deleted access control list: ${fileId}-access.json`);
                        }

                        // 3. Delete metadata file
                        fs.unlinkSync(metadataPath);
                        console.log(`[Cleanup]   - Deleted metadata: ${file}`);

                        deletedCount++;
                    }
                } catch (parseErr) {
                    console.error(`[Cleanup] ❌ Error processing metadata file ${file}:`, parseErr.message);
                }
            }
        });

        // Optional: Cleanup .shared-keys.json entries
        cleanupSharedKeys(uploadsDir, EXPIRY_MS);

        if (deletedCount > 0) {
            console.log(`[Cleanup] ✅ Successfully deleted ${deletedCount} expired files and their details.`);
        } else {
            console.log('[Cleanup] ✓ No expired files found.');
        }
    } catch (err) {
        console.error('[Cleanup] ❌ Error scanning uploads directory:', err.message);
    }
};

/**
 * Removes entries from shared keys file for expired files
 */
function cleanupSharedKeys(uploadsDir, expiryMs) {
    const sharedKeysPath = path.join(uploadsDir, '.shared-keys.json');
    if (!fs.existsSync(sharedKeysPath)) return;

    try {
        const now = new Date();
        const sharedKeys = JSON.parse(fs.readFileSync(sharedKeysPath, 'utf8'));
        let modified = false;

        for (const [shareId, shareRecord] of Object.entries(sharedKeys)) {
            const sharedAt = new Date(shareRecord.sharedAt);
            if (now - sharedAt > expiryMs) {
                delete sharedKeys[shareId];
                modified = true;
                console.log(`[Cleanup]   - Removed shared key record: ${shareId}`);
            }
        }

        if (modified) {
            fs.writeFileSync(sharedKeysPath, JSON.stringify(sharedKeys, null, 2));
        }
    } catch (err) {
        console.warn(`[Cleanup] ⚠️ Could not cleanup shared keys: ${err.message}`);
    }
}

module.exports = { cleanupExpiredFiles };
