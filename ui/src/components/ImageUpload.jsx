import { useEffect, useState } from 'react';
import Uppy from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';
import Dashboard from '@uppy/react/dashboard';

// Import Uppy styles using package exports
import '@uppy/core/css/style.css';
import '@uppy/dashboard/css/style.css';

export default function ImageUpload({ onUploadSuccess }) {
  const [uppy] = useState(() => {
    const u = new Uppy({
      restrictions: {
        allowedFileTypes: ['image/*'],
        maxNumberOfFiles: 1
      },
      autoProceed: false
    });

    u.use(XHRUpload, {
      endpoint: '/api/media/upload',
      fieldName: 'file',
      formData: true,
      withCredentials: true
    });

    return u;
  });

  useEffect(() => {
    const handleComplete = (result) => {
      console.log('Upload complete:', result.successful);
      if (result.successful && result.successful.length > 0) {
        const response = result.successful[0].response.body;
        if (onUploadSuccess) {
          onUploadSuccess(response);
        }
      }
    };

    const handleError = (file, error) => {
      console.error('Upload error:', file?.name, error);
    };

    uppy.on('complete', handleComplete);
    uppy.on('upload-error', handleError);

    return () => {
      uppy.off('complete', handleComplete);
      uppy.off('upload-error', handleError);
    };
  }, [uppy, onUploadSuccess]);

  useEffect(() => {
    return () => {
      uppy.cancelAll();
    };
  }, [uppy]);

  return (
    <Dashboard
      uppy={uppy}
      proudlyDisplayPoweredByUppy={false}
      height={360}
      note="Drop an image here or click to browse"
    />
  );
}
