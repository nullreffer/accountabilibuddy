import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

export const uploadCheckinPhoto = async (
  groupId: string,
  checkinId: string,
  file: File
): Promise<string> => {
  const photoRef = ref(storage, `groups/${groupId}/checkins/${checkinId}/proof.jpg`);
  await uploadBytes(photoRef, file, {
    contentType: file.type || 'image/jpeg'
  });
  return getDownloadURL(photoRef);
};
