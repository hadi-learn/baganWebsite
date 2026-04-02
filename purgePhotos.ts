import { db } from './src/db';
import { matchPhotos } from './src/db/schema';
import cloudinary from './src/lib/cloudinary';

async function run() {
  const photos = await db.select().from(matchPhotos);
  console.log('Deleting', photos.length, 'photos...');
  for (const p of photos) {
    try {
      if (p.cloudinaryPublicId) {
        await cloudinary.uploader.destroy(p.cloudinaryPublicId);
        console.log('- deleted', p.cloudinaryPublicId);
      }
    } catch(e) {
      console.error(e);
    }
  }
  await db.delete(matchPhotos);
  console.log('DB cleared.');
  process.exit(0);
}
run();
