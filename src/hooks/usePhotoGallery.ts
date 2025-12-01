import { useState, useEffect } from 'react';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

export interface UserPhoto {
  filepath: string;
  webviewPath: string;
}

const PHOTO_STORAGE = 'photos';

export function usePhotoGallery() {
  const [photos, setPhotos] = useState<UserPhoto[]>([]);

  // Load saved photos on app start
  useEffect(() => {
    const loadSaved = async () => {
      const { value } = await Preferences.get({ key: PHOTO_STORAGE });
      const photosInPreferences = value ? JSON.parse(value) : [];

      const photosWithBase64 = await Promise.all(
        photosInPreferences.map(async (photo: UserPhoto) => {
          const file = await Filesystem.readFile({
            path: photo.filepath,
            directory: Directory.Data,
          });

          return {
            filepath: photo.filepath,
            webviewPath: `data:image/jpeg;base64,${file.data}`,
          };
        })
      );

      setPhotos(photosWithBase64);
    };

    loadSaved();
  }, []);

  // Convert a photo to base64 for saving
  const convertBlobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

  // Save photo to filesystem and return object for gallery
  const savePicture = async (photo: Photo, fileName: string): Promise<UserPhoto> => {
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();
    const base64Data = await convertBlobToBase64(blob);

    await Filesystem.writeFile({
      path: fileName,
      data: base64Data.split(',')[1], // strip "data:image/jpeg;base64," before saving
      directory: Directory.Data,
    });

    return {
      filepath: fileName,
      webviewPath: `data:image/jpeg;base64,${base64Data.split(',')[1]}`,
    };
  };

  // Take a new photo and update gallery
  const addNewToGallery = async () => {
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100,
    });

    const fileName = `${new Date().getTime()}.jpeg`;
    const savedFileImage = await savePicture(capturedPhoto, fileName);

    const newPhotos = [savedFileImage, ...photos];
    setPhotos(newPhotos);

    await Preferences.set({
      key: PHOTO_STORAGE,
      value: JSON.stringify(newPhotos),
    });
  };

  return {
    photos,
    addNewToGallery,
  };
}
