const fs = require('fs');

let content = fs.readFileSync('src/tests/users-pagination.int.test.ts', 'utf8');

// Replace the problematic parsing lines
content = content.replace(
  'const page = parseInt(req.query.page as string) || 1;',
  'const pageParam = req.query.page as string;\n    const page = pageParam ? parseInt(pageParam) : 1;\n    const finalPage = isNaN(page) ? 1 : page;'
);

content = content.replace(
  'const limit = parseInt(req.query.limit as string) || 10;',
  'const limitParam = req.query.limit as string;\n    const limit = limitParam ? parseInt(limitParam) : 10;\n    const finalLimit = isNaN(limit) ? 10 : limit;'
);

// Replace validation checks
content = content.replace('if (page < 1)', 'if (finalPage < 1)');
content = content.replace('if (limit < 1 || limit > 100)', 'if (finalLimit < 1 || finalLimit > 100)');

// Replace usage in calculations
content = content.replace('const startIndex = (page - 1) * limit;', 'const startIndex = (finalPage - 1) * finalLimit;');
content = content.replace('const endIndex = startIndex + limit;', 'const endIndex = startIndex + finalLimit;');

// Replace in response
content = content.replace('page,\n      limit,', 'page: finalPage,\n      limit: finalLimit,');

fs.writeFileSync('src/tests/users-pagination.int.test.ts', content);
console.log('Test file fixed successfully');
