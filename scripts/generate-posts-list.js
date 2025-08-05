import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const postsDir = path.join(__dirname, '../posts');
const outputDir = path.join(__dirname, '../public');
const outputFile = path.join(outputDir, 'posts.json');

function getPosts(dir) {
  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  const posts = dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      return {
        name: dirent.name,
        type: 'folder',
        children: getPosts(res),
      };
    } else if (dirent.name.endsWith('.md')) {
      return {
        name: dirent.name,
        type: 'file',
        path: path.relative(postsDir, res).split(path.sep).join('/'), // Use relative path for URLs
      };
    }
    return null;
  }).filter(Boolean); // Filter out null values for non-md files
  return posts;
}

const postsList = getPosts(postsDir);

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputFile, JSON.stringify(postsList, null, 2));

console.log('Posts list generated successfully!');
