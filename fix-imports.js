const fs = require('fs');
const path = require('path');

function fixImports(content) {
    content = content.replace(/import\s+\{\s*dbConnect\s*\}\s+from\s+['"].*?\/lib\/db['"]/g, "import dbConnect from '@/lib/db'");
    content = content.replace(/import\s+\{\s*BinPrediction\s*\}\s+from\s+['"].*?\/models\/BinPrediction['"]/g, "import BinPrediction from '@/lib/models/BinPrediction'");
    content = content.replace(/import\s+\{\s*RoutePlan\s*\}\s+from\s+['"].*?\/models\/RoutePlan['"]/g, "import RoutePlan from '@/lib/models/RoutePlan'");
    content = content.replace(/import\s+\{\s*CleanupLog\s*\}\s+from\s+['"].*?\/models\/CleanupLog['"]/g, "import CleanupLog from '@/lib/models/CleanupLog'");
    content = content.replace(/import\s+\{\s*AuditLog\s*\}\s+from\s+['"].*?\/models\/AuditLog['"]/g, "import AuditLog from '@/lib/models/AuditLog'");
    content = content.replace(/import\s+\{\s*User\s*\}\s+from\s+['"].*?\/models\/User['"]/g, "import User from '@/lib/models/User'");

    // also fix relative imports in lib/slaMonitoring.ts
    content = content.replace(/import\s+\{\s*BinPrediction\s*\}\s+from\s+['"]\.\/models\/BinPrediction['"]/g, "import BinPrediction from './models/BinPrediction'");
    content = content.replace(/import\s+\{\s*RoutePlan\s*\}\s+from\s+['"]\.\/models\/RoutePlan['"]/g, "import RoutePlan from './models/RoutePlan'");
    content = content.replace(/import\s+\{\s*CleanupLog\s*\}\s+from\s+['"]\.\/models\/CleanupLog['"]/g, "import CleanupLog from './models/CleanupLog'");
    content = content.replace(/import\s+\{\s*AuditLog\s*\}\s+from\s+['"]\.\/models\/AuditLog['"]/g, "import AuditLog from './models/AuditLog'");
    content = content.replace(/import\s+\{\s*User\s*\}\s+from\s+['"]\.\/models\/User['"]/g, "import User from './models/User'");

    return content;
}

function processDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const fixed = fixImports(content);
            if (content !== fixed) {
                fs.writeFileSync(fullPath, fixed, 'utf8');
                console.log('Fixed', fullPath);
            }
        }
    }
}

processDir('./app/api');
processDir('./app/admin');
processDir('./lib');
