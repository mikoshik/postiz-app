import React, { useCallback, useEffect, useMemo, useState } from 'react';
// @ts-ignore
import Uppy, { UploadResult } from '@uppy/core';
// @ts-ignore
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { getUppyUploadPlugin } from '@gitroom/react/helpers/uppy.upload';
import { Dashboard, FileInput, ProgressBar } from '@uppy/react';

// Uppy styles
import { useVariables } from '@gitroom/react/helpers/variable.context';
import Compressor from '@uppy/compressor';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { uniq } from 'lodash';

// Python service URL for HEIC conversion
const PYTHON_SERVICE_URL = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:8000';

// Helper function to convert HEIC using Python backend service
async function convertHeicViaPython(blob: Blob, filename: string): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', blob, filename);
  
  const response = await fetch(`${PYTHON_SERVICE_URL}/image/convert-heic?quality=90&output_format=JPEG`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  return await response.blob();
}

// Helper function to convert HEIC to JPEG with Python backend as primary method
async function convertHeicToJpeg(blob: Blob, filename: string): Promise<Blob> {
  // Method 1: Try Python backend service (most reliable)
  try {
    console.log('Trying Python service conversion...');
    const result = await convertHeicViaPython(blob, filename);
    console.log('Python service conversion successful');
    return result;
  } catch (pythonError: any) {
    console.warn('Python service failed:', pythonError?.message);
  }

  // Method 2: Try Canvas API (works if browser supports HEIC natively - Safari)
  try {
    console.log('Trying Canvas API conversion...');
    const result = await convertUsingCanvas(blob, 0.9);
    console.log('Canvas conversion successful');
    return result;
  } catch (canvasError: any) {
    console.warn('Canvas conversion failed:', canvasError?.message);
  }

  throw new Error('All HEIC conversion methods failed. Please make sure Python service is running or convert the file manually.');
}

// Helper function to convert image using Canvas API (works if browser supports HEIC natively)
async function convertUsingCanvas(blob: Blob, quality: number = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(
        (jpegBlob) => {
          if (jpegBlob) {
            resolve(jpegBlob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for canvas conversion'));
    };
    
    img.src = url;
  });
}

export function MultipartFileUploader({
  onUploadSuccess,
  allowedFileTypes,
  uppRef,
}: {
  // @ts-ignore
  onUploadSuccess: (result: UploadResult) => void;
  allowedFileTypes: string;
  uppRef?: any;
}) {
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(false);
  const onUploadSuccessExtended = useCallback(
    (result: UploadResult<any, any>) => {
      setReload(true);
      onUploadSuccess(result);
    },
    [onUploadSuccess]
  );
  useEffect(() => {
    if (reload) {
      setTimeout(() => {
        setReload(false);
      }, 1);
    }
  }, [reload]);
  useEffect(() => {
    setLoaded(true);
  }, []);
  if (!loaded || reload) {
    return null;
  }
  return (
    <MultipartFileUploaderAfter
      uppRef={uppRef || {}}
      onUploadSuccess={onUploadSuccessExtended}
      allowedFileTypes={allowedFileTypes}
    />
  );
}

export function useUppyUploader(props: {
  // @ts-ignore
  onUploadSuccess: (result: UploadResult) => void;
  allowedFileTypes: string;
}) {
  const setLocked = useLaunchStore((state) => state.setLocked);
  const toast = useToaster();
  const { storageProvider, backendUrl, disableImageCompression, transloadit } =
    useVariables();
  const { onUploadSuccess, allowedFileTypes } = props;
  const fetch = useFetch();
  return useMemo(() => {
    // Add HEIC/HEIF support when images are allowed (for iPhone camera photos)
    const allowedTypesWithHeic = allowedFileTypes
      .split(',')
      .flatMap((type) => {
        if (type.trim() === 'image/*') {
          return ['image/*', 'image/heic', 'image/heif', '.heic', '.heif'];
        }
        return [type];
      });

    const uppy2 = new Uppy({
      autoProceed: true,
      restrictions: {
        // maxNumberOfFiles: 5,
        allowedFileTypes: allowedTypesWithHeic,
        maxFileSize: 1000000000, // Default 1GB, but we'll override with custom validation
      },
    });

    // HEIC to JPG converter preprocessor - must be first to convert before type validation
    uppy2.addPreProcessor(async (fileIDs) => {
      const files = uppy2.getFiles();
      
      for (const file of files) {
        if (fileIDs.includes(file.id)) {
          const isHeic = 
            file.type === 'image/heic' || 
            file.type === 'image/heif' ||
            file.name?.toLowerCase().endsWith('.heic') ||
            file.name?.toLowerCase().endsWith('.heif');
          
          if (isHeic && file.data) {
            try {
              toast.show('Converting HEIC to JPG...', 'warning');
              
              // Convert HEIC to JPG using Python service
              const convertedBlob = await convertHeicToJpeg(file.data as Blob, file.name);
              
              // Create new filename with .jpg extension
              const newFileName = file.name
                ?.replace(/\.heic$/i, '.jpg')
                ?.replace(/\.heif$/i, '.jpg') || 'converted.jpg';
              
              // Remove old file and add converted one
              uppy2.removeFile(file.id);
              uppy2.addFile({
                name: newFileName,
                type: 'image/jpeg',
                data: convertedBlob,
                source: 'Local',
                isRemote: false,
              });
              
              toast.show('HEIC converted to JPG successfully!', 'success');
            } catch (error) {
              console.error('HEIC conversion error:', error);
              toast.show('Failed to convert HEIC file. Please convert it manually to JPG/PNG.', 'warning');
              uppy2.removeFile(file.id);
              throw new Error('HEIC conversion failed');
            }
          }
        }
      }
    });

    // check for valid file types it can be something like this image/*,video/mp4.
    // If it's an image, I need to replace image/* with image/png, image/jpeg, image/jpeg, image/gif (separately)
    uppy2.addPreProcessor((fileIDs) => {
      return new Promise<void>((resolve, reject) => {
        const files = uppy2.getFiles();
        const allowedTypes = allowedFileTypes
          .split(',')
          .map((type) => type.trim());

        // Expand generic types to specific ones
        const expandedTypes = allowedTypes.flatMap((type) => {
          if (type === 'image/*') {
            return ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
          }
          if (type === 'video/*') {
            return ['video/mp4', 'video/mpeg'];
          }
          return [type];
        });

        for (const file of files) {
          if (fileIDs.includes(file.id)) {
            const fileType = file.type;

            // Check if file type is allowed
            const isAllowed = expandedTypes.some((allowedType) => {
              if (allowedType.endsWith('/*')) {
                const baseType = allowedType.replace('/*', '/');
                return fileType?.startsWith(baseType);
              }
              return fileType === allowedType;
            });

            if (!isAllowed) {
              const error = new Error(
                `File type "${fileType}" is not allowed for file "${file.name}". Allowed types: ${allowedFileTypes}`
              );
              uppy2.log(error.message, 'error');
              uppy2.info(error.message, 'error', 5000);
              toast.show(
                `File type "${fileType}" is not allowed. Allowed types: ${allowedFileTypes}`
              );
              uppy2.removeFile(file.id);
              return reject(error);
            }
          }
        }

        resolve();
      });
    });

    uppy2.addPreProcessor((fileIDs) => {
      return new Promise<void>((resolve, reject) => {
        const files = uppy2.getFiles();

        for (const file of files) {
          if (fileIDs.includes(file.id)) {
            const isImage = file.type?.startsWith('image/');
            const isVideo = file.type?.startsWith('video/');

            const maxImageSize = 30 * 1024 * 1024; // 30MB
            const maxVideoSize = 1000 * 1024 * 1024; // 1GB

            if (isImage && file.size > maxImageSize) {
              const error = new Error(
                `Image file "${file.name}" is too large. Maximum size allowed is 30MB.`
              );
              uppy2.log(error.message, 'error');
              uppy2.info(error.message, 'error', 5000);
              toast.show(
                `Image file is too large. Maximum size allowed is 30MB.`
              );
              uppy2.removeFile(file.id); // Remove file from queue
              return reject(error);
            }

            if (isVideo && file.size > maxVideoSize) {
              const error = new Error(
                `Video file "${file.name}" is too large. Maximum size allowed is 1GB.`
              );
              uppy2.log(error.message, 'error');
              uppy2.info(error.message, 'error', 5000);
              toast.show(
                `Video file is too large. Maximum size allowed is 1GB.`
              );
              uppy2.removeFile(file.id); // Remove file from queue
              return reject(error);
            }
          }
        }

        resolve();
      });
    });

    const { plugin, options } = getUppyUploadPlugin(
      transloadit.length > 0 ? 'transloadit' : storageProvider,
      fetch,
      backendUrl,
      transloadit
    );

    uppy2.use(plugin, options);
    if (!disableImageCompression) {
      uppy2.use(Compressor, {
        convertTypes: ['image/jpeg'],
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 1,
      });
    }
    // Set additional metadata when a file is added
    uppy2.on('file-added', (file) => {
      setLocked(true);
      uppy2.setFileMeta(file.id, {
        useCloudflare: storageProvider === 'cloudflare' ? 'true' : 'false', // Example of adding a custom field
        // Add more fields as needed
      });
    });
    uppy2.on('error', (result) => {
      setLocked(false);
    });
    uppy2.on('complete', async (result) => {
      if (storageProvider === 'local') {
        setLocked(false);
        onUploadSuccess(result.successful
          .filter((p) => p.response?.body)
          .map((p) => p.response.body));
        return;
      }

      if (transloadit.length > 0) {
        // @ts-ignore
        const allRes = result.transloadit?.[0]?.results;
        if (!allRes) {
          setLocked(false);
          return;
        }
        const toSave = uniq<string>(
          (allRes[Object.keys(allRes)[0]] || []).flatMap((item: any) =>
            item.url.split('/').pop()
          )
        );

        const loadAllMedia = await Promise.all(
          toSave.map(async (name) => {
            return (
              await fetch('/media/save-media', {
                method: 'POST',
                body: JSON.stringify({
                  name,
                }),
              })
            ).json();
          })
        );

        setLocked(false);
        onUploadSuccess(loadAllMedia);
        return;
      }

      setLocked(false);
      onUploadSuccess(result.successful
        .filter((p) => p.response?.body?.saved)
        .map((p) => p.response.body.saved));
    });
    uppy2.on('upload-success', (file, response) => {
      // @ts-ignore
      uppy2.setFileState(file.id, {
        // @ts-ignore
        progress: uppy2.getState().files[file.id].progress,
        // @ts-ignore
        uploadURL: response?.body?.Location,
        response: response,
        isPaused: false,
      });
    });
    return uppy2;
  }, []);
}
export function MultipartFileUploaderAfter({
  onUploadSuccess,
  allowedFileTypes,
  uppRef,
}: {
  // @ts-ignore
  onUploadSuccess: (result: UploadResult) => void;
  allowedFileTypes: string;
  uppRef: any;
}) {
  const t = useT();
  const uppy = useUppyUploader({
    onUploadSuccess,
    allowedFileTypes,
  });
  const uppyInstance = useMemo(() => {
    uppRef.current = uppy;
    return uppy;
  }, []);
  return (
    <>
      {/* <Dashboard uppy={uppy} /> */}
      <div className="pointer-events-none bigWrap">
        <Dashboard
          height={23}
          width={200}
          className=""
          uppy={uppyInstance}
          id={`media-uploader`}
          showProgressDetails={true}
          hideUploadButton={true}
          hideRetryButton={true}
          hidePauseResumeButton={true}
          hideCancelButton={true}
          hideProgressAfterFinish={true}
        />
      </div>
      <FileInput
        uppy={uppyInstance}
        locale={{
          strings: {
            chooseFiles: t('upload', 'Upload'),
          },
          // @ts-ignore
          pluralize: (n: any) => n,
        }}
      />
    </>
  );
}
